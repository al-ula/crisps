import {
  type CSSProperties,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import { redoCommand, undoCommand } from "@milkdown/kit/plugin/history";
import {
  blockquoteSchema,
  bulletListSchema,
  createCodeBlockCommand,
  insertHrCommand,
  insertImageCommand,
  liftFirstListItemCommand,
  liftListItemCommand,
  listItemSchema,
  orderedListSchema,
  paragraphSchema,
  setBlockTypeCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import {
  createTable,
  insertTableCommand,
  toggleStrikethroughCommand,
} from "@milkdown/kit/preset/gfm";
import { undoDepth, redoDepth } from "@milkdown/kit/prose/history";
import { NodeSelection, TextSelection, type EditorState } from "@milkdown/kit/prose/state";
import { findNodeInSelection } from "@milkdown/kit/prose";
import { liftTarget } from "@milkdown/kit/prose/transform";
import type { EditorView } from "@milkdown/kit/prose/view";
import { callCommand, replaceAll } from "@milkdown/kit/utils";
import {
  CODE_BLOCK_CODEMIRROR_LANGUAGES,
  DEFAULT_CODE_BLOCK_LANGUAGE,
  renderCodeBlockLanguage,
} from "../editor/codeBlockLanguages";
import { joinFrontmatter, splitFrontmatter } from "../editor/frontmatter";
import {
  createTauriEditorAdapter,
  emitEditorState,
  listenForEditorActions,
} from "../editor/tauriBridge";
import { LinkPopup, type LinkPopupValue } from "./LinkPopup";
import { SelectionToolbar } from "./SelectionToolbar";
import { EMPTY_EDITOR_STATE } from "../editor/types";
import type {
  EditorAction,
  EditorAdapter,
  EditorStateSnapshot,
} from "../editor/types";

interface MilkdownEditorProps {
  onChange: (markdown: string) => void;
  onReady: (adapter: EditorAdapter | null) => void;
}

export function MilkdownEditor({ onChange, onReady }: MilkdownEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const linkPopupRef = useRef<HTMLFormElement>(null);
  const linkNameInputRef = useRef<HTMLInputElement>(null);
  const linkHrefInputRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const frontmatterRef = useRef("");
  const onChangeRef = useRef(onChange);
  const suppressNextMarkdownUpdateRef = useRef(false);
  const suppressMarkdownTimerRef = useRef<number | null>(null);
  const toolbarRefreshFrameRef = useRef<number | null>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const [toolbarState, setToolbarState] = useState<{
    editorState: EditorStateSnapshot;
    style: CSSProperties;
    visible: boolean;
  }>({
    editorState: EMPTY_EDITOR_STATE,
    style: {},
    visible: false,
  });
  const [linkPopupState, setLinkPopupState] = useState<{
    style: CSSProperties;
    value: LinkPopupValue | null;
  }>({
    style: {},
    value: null,
  });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!rootRef.current) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;
    const beginSilentMarkdownSync = () => {
      suppressNextMarkdownUpdateRef.current = true;
      if (suppressMarkdownTimerRef.current != null) {
        window.clearTimeout(suppressMarkdownTimerRef.current);
      }
      suppressMarkdownTimerRef.current = window.setTimeout(() => {
        suppressNextMarkdownUpdateRef.current = false;
        suppressMarkdownTimerRef.current = null;
      }, 500);
    };

    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: "",
      features: {
        [Crepe.Feature.Toolbar]: false,
      },
      featureConfigs: {
        [Crepe.Feature.CodeMirror]: {
          languages: CODE_BLOCK_CODEMIRROR_LANGUAGES,
          renderLanguage: renderCodeBlockLanguage,
        },
        [Crepe.Feature.ImageBlock]: {
          onUpload: readFileAsDataUrl,
          blockOnUpload: readFileAsDataUrl,
          inlineOnUpload: readFileAsDataUrl,
        },
      },
    });
    crepeRef.current = crepe;

    const refreshToolbarState = (view: EditorView) => {
      const nextEditorState = buildEditorState(view);
      setToolbarState(buildSelectionToolbarState(view, nextEditorState, toolbarRef.current));
    };

    const scheduleToolbarRefresh = (view: EditorView) => {
      viewRef.current = view;
      if (toolbarRefreshFrameRef.current != null) {
        window.cancelAnimationFrame(toolbarRefreshFrameRef.current);
      }
      toolbarRefreshFrameRef.current = window.requestAnimationFrame(() => {
        toolbarRefreshFrameRef.current = null;
        if (viewRef.current) {
          refreshToolbarState(viewRef.current);
        }
      });
    };

    const emitSnapshot = (view: EditorView) => {
      const nextEditorState = buildEditorState(view);
      void emitEditorState(nextEditorState);
      scheduleToolbarRefresh(view);
    };

    crepe.on((listener) => {
      listener.mounted((ctx) => {
        emitSnapshot(ctx.get(editorViewCtx));
      });
      listener.focus((ctx) => {
        emitSnapshot(ctx.get(editorViewCtx));
      });
      listener.blur((ctx) => {
        emitSnapshot(ctx.get(editorViewCtx));
      });
      listener.selectionUpdated((ctx) => {
        emitSnapshot(ctx.get(editorViewCtx));
      });
      listener.updated((ctx) => {
        emitSnapshot(ctx.get(editorViewCtx));
      });
      listener.markdownUpdated((ctx, markdown) => {
        emitSnapshot(ctx.get(editorViewCtx));
        if (suppressNextMarkdownUpdateRef.current) {
          suppressNextMarkdownUpdateRef.current = false;
          if (suppressMarkdownTimerRef.current != null) {
            window.clearTimeout(suppressMarkdownTimerRef.current);
            suppressMarkdownTimerRef.current = null;
          }
          return;
        }

        onChangeRef.current(joinFrontmatter(frontmatterRef.current, markdown));
      });
    });

    const setMarkdown = (markdown: string) => {
      const parts = splitFrontmatter(markdown);
      frontmatterRef.current = parts.frontmatter;
      beginSilentMarkdownSync();
      crepe.editor.action(replaceAll(parts.body, true));
    };

    const getMarkdown = () =>
      joinFrontmatter(frontmatterRef.current, crepe.getMarkdown());

    const focus = () => {
      crepe.editor.action((ctx) => {
        ctx.get(editorViewCtx).focus();
      });
    };

    void crepe.create().then(async () => {
      if (disposed) {
        await crepe.destroy();
        return;
      }

      onReady(
        createTauriEditorAdapter({
          setMarkdown,
          getMarkdown,
          focus,
        }),
      );

      unlisten = await listenForEditorActions(async (action) => {
        await runMilkdownAction(
          crepe,
          action,
          frontmatterRef,
          onChangeRef.current,
          setLinkPopupState,
        );
        crepe.editor.action((ctx) => {
          scheduleToolbarRefresh(ctx.get(editorViewCtx));
        });
      });
    });

    return () => {
      disposed = true;
      if (suppressMarkdownTimerRef.current != null) {
        window.clearTimeout(suppressMarkdownTimerRef.current);
      }
      if (toolbarRefreshFrameRef.current != null) {
        window.cancelAnimationFrame(toolbarRefreshFrameRef.current);
      }
      crepeRef.current = null;
      viewRef.current = null;
      onReady(null);
      unlisten?.();
      void crepe.destroy();
    };
  }, [onReady]);

  const handleToolbarAction = async (action: EditorAction) => {
    const crepe = crepeRef.current;
    if (!crepe) return;

    await runMilkdownAction(
      crepe,
      action,
      frontmatterRef,
      onChangeRef.current,
      setLinkPopupState,
    );
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.focus();
      const nextEditorState = buildEditorState(view);
      setToolbarState(
        buildSelectionToolbarState(view, nextEditorState, toolbarRef.current),
      );
    });
  };

  const refreshToolbarPosition = () => {
    if (!viewRef.current) return;
    const nextEditorState = buildEditorState(viewRef.current);
    setToolbarState(
      buildSelectionToolbarState(
        viewRef.current,
        nextEditorState,
        toolbarRef.current,
      ),
    );
  };

  const closeLinkPopup = () => {
    setLinkPopupState({
      style: {},
      value: null,
    });
    viewRef.current?.focus();
  };

  const submitLinkPopup = () => {
    const view = viewRef.current;
    const value = linkPopupState.value;
    if (!view || !value) return;

    const href = value.href.trim();
    if (!href) return;

    applyLink(view, {
      ...value,
      href,
      name: value.name.trim(),
    });
    closeLinkPopup();
  };

  useEffect(() => {
    const handleViewportChange = () => {
      if (!viewRef.current) return;
      refreshToolbarPosition();
      setLinkPopupState((current) => {
        if (!current.value) return current;
        return {
          ...current,
          style: buildLinkPopupStyle(
            viewRef.current!,
            current.value.from,
            current.value.to,
            current.value.showName,
            linkPopupRef.current,
          ),
        };
      });
    };

    window.addEventListener("resize", handleViewportChange);
    document.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      document.removeEventListener("scroll", handleViewportChange, true);
    };
  }, []);

  useEffect(() => {
    if (!linkPopupState.value) return;

    const target = linkPopupState.value.showName
      ? linkNameInputRef.current
      : linkHrefInputRef.current;
    target?.focus();
    target?.select();
  }, [linkPopupState.value]);

  useEffect(() => {
    if (!linkPopupState.value) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (linkPopupRef.current?.contains(target)) return;
      closeLinkPopup();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeLinkPopup();
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [linkPopupState.value]);

  return (
    <>
      <div ref={rootRef} className="milkdown-host h-full" />
      <SelectionToolbar
        editorState={toolbarState.editorState}
        style={toolbarState.style}
        toolbarRef={toolbarRef}
        visible={toolbarState.visible && !linkPopupState.value}
        onAction={handleToolbarAction}
        onRefreshPosition={refreshToolbarPosition}
      />
      <LinkPopup
        popupRef={linkPopupRef}
        hrefInputRef={linkHrefInputRef}
        nameInputRef={linkNameInputRef}
        style={linkPopupState.style}
        value={linkPopupState.value}
        onChange={(patch) => {
          setLinkPopupState((current) =>
            current.value
              ? {
                  ...current,
                  value: {
                    ...current.value,
                    ...patch,
                  },
                }
              : current,
          );
        }}
        onSubmit={submitLinkPopup}
      />
    </>
  );
}

async function runMilkdownAction(
  crepe: Crepe,
  action: EditorAction,
  frontmatterRef: MutableRefObject<string>,
  onChange: (markdown: string) => void,
  setLinkPopupState: Dispatch<
    SetStateAction<{
      style: CSSProperties;
      value: LinkPopupValue | null;
    }>
  >,
) {
  switch (action.action) {
    case "undo":
      crepe.editor.action(callCommand(undoCommand.key));
      return;
    case "redo":
      crepe.editor.action(callCommand(redoCommand.key));
      return;
    case "bold":
      crepe.editor.action(callCommand(toggleStrongCommand.key));
      return;
    case "italic":
      crepe.editor.action(callCommand(toggleEmphasisCommand.key));
      return;
    case "subscript":
    case "superscript":
      return;
    case "strikethrough":
      crepe.editor.action(callCommand(toggleStrikethroughCommand.key));
      return;
    case "latex":
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        toggleInlineLatex(view);
      });
      return;
    case "code":
      crepe.editor.action(callCommand(toggleInlineCodeCommand.key));
      return;
    case "bulletList":
      crepe.editor.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        const view = ctx.get(editorViewCtx);
        if (!convertSelectedList(view, { kind: "bullet" }, ctx)) {
          commands.call(wrapInBulletListCommand.key);
        }
      });
      return;
    case "orderedList":
      crepe.editor.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        const view = ctx.get(editorViewCtx);
        if (!convertSelectedList(view, { kind: "ordered" }, ctx)) {
          commands.call(wrapInOrderedListCommand.key);
        }
      });
      return;
    case "checklist":
      crepe.editor.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        const view = ctx.get(editorViewCtx);

        if (
          !convertSelectedList(
            view,
            {
              kind: "check",
              checked: false,
            },
            ctx,
          )
        ) {
          commands.call(wrapInBulletListCommand.key);
          convertSelectedList(
            ctx.get(editorViewCtx),
            {
              kind: "check",
              checked: false,
            },
            ctx,
          );
        }
      });
      return;
    case "removeList":
      crepe.editor.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        for (let i = 0; i < 8; i += 1) {
          const lifted =
            commands.call(liftListItemCommand.key) ||
            commands.call(liftFirstListItemCommand.key);
          if (!lifted) break;
        }
      });
      return;
    case "blockType":
      crepe.editor.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        const view = ctx.get(editorViewCtx);
        switch (action.blockType) {
          case "paragraph":
            liftSelectionOutOfBlockquote(view, ctx);
            commands.call(setBlockTypeCommand.key, {
              nodeType: paragraphSchema.type(ctx),
            });
            break;
          case "quote":
            if (getBlockState(view.state).blockType !== "quote") {
              commands.call(wrapInBlockquoteCommand.key);
            }
            break;
          case "h1":
          case "h2":
          case "h3":
          case "h4":
          case "h5":
          case "h6":
            liftSelectionOutOfBlockquote(view, ctx);
            commands.call(
              wrapInHeadingCommand.key,
              Number(action.blockType.slice(1)),
            );
            break;
        }
      });
      return;
    case "createLink": {
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const value = getLinkPopupValue(view.state);
        setLinkPopupState({
          style: buildLinkPopupStyle(
            view,
            value.from,
            value.to,
            value.showName,
            null,
          ),
          value,
        });
      });
      return;
    }
    case "insertImage": {
      const image = await promptForImage();
      if (!image) return;
      crepe.editor.action(callCommand(insertImageCommand.key, image));
      return;
    }
    case "insertTable":
      crepe.editor.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        const view = ctx.get(editorViewCtx);
        if (
          !commands.call(insertTableCommand.key, {
            row: action.rows ?? 3,
            col: action.columns ?? 3,
          })
        ) {
          const table = createTable(ctx, action.rows ?? 3, action.columns ?? 3);
          view.dispatch(
            view.state.tr.replaceSelectionWith(table).scrollIntoView(),
          );
        }
      });
      return;
    case "insertThematicBreak":
      crepe.editor.action(callCommand(insertHrCommand.key));
      return;
    case "insertCodeBlock":
      crepe.editor.action(
        callCommand(createCodeBlockCommand.key, DEFAULT_CODE_BLOCK_LANGUAGE),
      );
      return;
    case "insertFrontmatter": {
      if (frontmatterRef.current) return;
      frontmatterRef.current = "---\n---\n\n";
      onChange(joinFrontmatter(frontmatterRef.current, crepe.getMarkdown()));
      crepe.editor.action((ctx) => {
        void emitEditorState(buildEditorState(ctx.get(editorViewCtx)));
      });
      return;
    }
  }
}

function convertSelectedList(
  view: EditorView,
  options: {
    kind: "bullet" | "ordered" | "check";
    checked?: boolean | null;
  },
  ctx: Parameters<typeof bulletListSchema.type>[0],
): boolean {
  const { state } = view;
  const { from, to } = state.selection;
  const bulletList = bulletListSchema.type(ctx);
  const orderedList = orderedListSchema.type(ctx);
  const listItem = listItemSchema.type(ctx);
  let tr = state.tr;
  let changed = false;

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type === bulletList || node.type === orderedList) {
      const nextType = options.kind === "ordered" ? orderedList : bulletList;
      if (node.type !== nextType) {
        const nextAttrs =
          nextType === orderedList
            ? {
                order:
                  typeof node.attrs.order === "number" ? node.attrs.order : 1,
                spread: Boolean(node.attrs.spread),
              }
            : {
                spread: Boolean(node.attrs.spread),
              };
        tr = tr.setNodeMarkup(pos, nextType, nextAttrs);
        changed = true;
      }
      return;
    }

    if (node.type !== listItem) return;

    const nextChecked =
      options.kind === "check" ? (options.checked ?? false) : null;
    if (node.attrs.checked !== nextChecked) {
      tr = tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        checked: nextChecked,
      });
      changed = true;
    }
  });

  if (!changed) return false;
  view.dispatch(tr.scrollIntoView());
  return true;
}

function liftSelectionOutOfBlockquote(
  view: EditorView,
  ctx: Parameters<typeof blockquoteSchema.type>[0],
): boolean {
  const { state } = view;
  const { $from, $to } = state.selection;
  const blockquote = blockquoteSchema.type(ctx);
  const range = $from.blockRange($to, (node) => node.type === blockquote);
  const target = range ? liftTarget(range) : null;

  if (range == null || target == null) return false;

  view.dispatch(state.tr.lift(range, target).scrollIntoView());
  return true;
}

function buildEditorState(view: EditorView): EditorStateSnapshot {
  const state = view.state;
  const { blockType, listType } = getBlockState(state);

  return {
    canUndo: undoDepth(state) > 0,
    canRedo: redoDepth(state) > 0,
    bold: isMarkActive(state, "strong"),
    italic: isMarkActive(state, "emphasis"),
    strikethrough: isMarkActive(state, "strike_through"),
    latex: isInlineLatexActive(state),
    code: isMarkActive(state, "inline_code"),
    blockType,
    listType,
    focused: view.hasFocus(),
  };
}

function buildSelectionToolbarState(
  view: EditorView,
  editorState: EditorStateSnapshot,
  toolbarElement: HTMLDivElement | null,
): {
  editorState: EditorStateSnapshot;
  style: CSSProperties;
  visible: boolean;
} {
  const selection = view.state.selection;
  const toolbarHasFocus =
    toolbarElement?.contains(document.activeElement) ?? false;
  const isTextSelection = selection instanceof TextSelection;
  const hasSelectedText =
    isTextSelection && !selection.empty && view.state.doc.textBetween(selection.from, selection.to).length > 0;

  if (!isTextSelection || !hasSelectedText || (!view.hasFocus() && !toolbarHasFocus)) {
    return {
      editorState,
      style: {},
      visible: false,
    };
  }

  const start = view.coordsAtPos(selection.from);
  const end = view.coordsAtPos(selection.to);
  const center = (start.left + end.right) / 2;
  const popupWidth = toolbarElement?.offsetWidth ?? 360;
  const popupHeight = (toolbarElement?.offsetHeight ?? 36) + 8;
  const topSafeArea = 52;
  const maxLeft = Math.max(8, window.innerWidth - popupWidth - 8);
  const left = Math.min(
    Math.max(center - popupWidth / 2, 8),
    maxLeft,
  );
  const preferredTop = Math.min(start.top, end.top) - popupHeight;
  const fallbackTop = Math.max(start.bottom, end.bottom) + 12;
  const maxTop = Math.max(topSafeArea, window.innerHeight - popupHeight - 8);
  const top =
    preferredTop >= topSafeArea
      ? preferredTop
      : Math.min(fallbackTop, maxTop);

  return {
    editorState,
    style: { left, top },
    visible: true,
  };
}

function getBlockState(state: EditorState): {
  blockType: string;
  listType: string;
} {
  let blockType = "paragraph";
  let listType = "";
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);

    if (node.type.name === "list_item" && node.attrs.checked != null) {
      listType = "check";
    }
    if (!listType && node.type.name === "bullet_list") {
      listType = "bullet";
    }
    if (!listType && node.type.name === "ordered_list") {
      listType = "number";
    }

    switch (node.type.name) {
      case "heading":
        blockType = `h${node.attrs.level}`;
        break;
      case "blockquote":
        blockType = "quote";
        break;
      case "code_block":
        blockType = "codeblock";
        break;
      case "table":
        blockType = "table";
        break;
    }
  }

  return { blockType, listType };
}

function isMarkActive(state: EditorState, markName: string): boolean {
  const mark = state.schema.marks[markName];
  if (!mark) return false;

  const { empty, from, to, $from } = state.selection;
  if (empty) {
    return Boolean(mark.isInSet(state.storedMarks ?? $from.marks()));
  }

  return state.doc.rangeHasMark(from, to, mark);
}

function getLinkPopupValue(state: EditorState): LinkPopupValue {
  const link = findLinkRange(state);
  if (link) {
    return {
      from: link.from,
      to: link.to,
      href: link.href,
      name: "",
      showName: false,
    };
  }

  const { selection, doc } = state;
  const hasSelectedText =
    selection instanceof TextSelection &&
    !selection.empty &&
    doc.textBetween(selection.from, selection.to).length > 0;

  return {
    from: selection.from,
    to: selection.to,
    href: "",
    name: "",
    showName: !hasSelectedText,
  };
}

function buildLinkPopupStyle(
  view: EditorView,
  from: number,
  to: number,
  showName: boolean,
  popupElement: HTMLFormElement | null,
): CSSProperties {
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);
  const center = (start.left + end.right) / 2;
  const popupWidth = popupElement?.offsetWidth ?? 360;
  const maxLeft = Math.max(8, window.innerWidth - popupWidth - 8);
  const left = Math.min(Math.max(center - popupWidth / 2, 8), maxLeft);
  const popupHeight = showName ? 132 : 84;
  const preferredTop = Math.min(start.top, end.top) - popupHeight;
  const fallbackTop = Math.max(start.bottom, end.bottom) + 12;
  const top =
    preferredTop >= 8
      ? preferredTop
      : Math.min(fallbackTop, Math.max(8, window.innerHeight - popupHeight - 8));

  return {
    left,
    top,
  };
}

function findLinkRange(state: EditorState): {
  from: number;
  to: number;
  href: string;
} | null {
  const markType = state.schema.marks.link;
  if (!markType) return null;

  const { selection, doc } = state;
  const scanFrom = Math.max(0, selection.from - (selection.empty ? 1 : 0));
  const scanTo = Math.min(doc.content.size, selection.to + 1);
  let start = -1;
  let end = -1;
  let href = "";

  doc.nodesBetween(scanFrom, scanTo, (node, pos) => {
    if (!node.isText) return;

    const mark = markType.isInSet(node.marks);
    if (!mark) return;

    const nodeEnd = pos + node.nodeSize;
    const intersects = selection.empty
      ? selection.from >= pos && selection.from <= nodeEnd
      : selection.to > pos && selection.from < nodeEnd;

    if (!intersects) return;

    if (start === -1 || pos < start) start = pos;
    if (nodeEnd > end) end = nodeEnd;
    href = String(mark.attrs.href ?? "");
  });

  if (start === -1 || end === -1) return null;

  return { from: start, to: end, href };
}

function applyLink(
  view: EditorView,
  value: LinkPopupValue,
): boolean {
  const { state } = view;
  const type = state.schema.marks.link;
  if (!type) return false;

  const tr = state.tr;

  if (value.showName) {
    const label = value.name || value.href;
    const textNode = state.schema.text(label, [type.create({ href: value.href })]);
    const next = tr.replaceRangeWith(value.from, value.to, textNode);
    view.dispatch(
      next.setSelection(
        TextSelection.create(next.doc, value.from + label.length),
      ).scrollIntoView(),
    );
    return true;
  }

  const next = tr
    .removeMark(value.from, value.to, type)
    .addMark(value.from, value.to, type.create({ href: value.href }));
  view.dispatch(
    next.setSelection(TextSelection.create(next.doc, value.from, value.to)).scrollIntoView(),
  );
  return true;
}

function isInlineLatexActive(state: EditorState): boolean {
  const inlineMath = state.schema.nodes.math_inline;
  if (!inlineMath) return false;

  return findNodeInSelection(state, inlineMath).hasNode;
}

function toggleInlineLatex(view: EditorView): boolean {
  const { state } = view;
  const inlineMath = state.schema.nodes.math_inline;
  if (!inlineMath) return false;

  const { hasNode, pos, target } = findNodeInSelection(state, inlineMath);
  const { selection, doc, tr } = state;

  if (!hasNode) {
    const text = doc.textBetween(selection.from, selection.to);
    const next = tr.replaceSelectionWith(
      inlineMath.create({
        value: text,
      }),
    );
    view.dispatch(
      next.setSelection(NodeSelection.create(next.doc, selection.from)),
    );
    return true;
  }

  const { from, to } = selection;
  if (!target || pos < 0) return false;

  let next = tr.delete(pos, pos + 1);
  const content = String(target.attrs.value ?? "");
  next = next.insertText(content, pos);
  view.dispatch(
    next.setSelection(
      TextSelection.create(next.doc, from, to + content.length - 1),
    ),
  );
  return true;
}

async function promptForImage(): Promise<
  | {
      src: string;
      alt?: string;
      title?: string;
    }
  | undefined
> {
  const src = window.prompt("Image URL. Leave blank to upload a file.");
  if (src === null) return undefined;
  if (src.trim()) {
    return { src: src.trim() };
  }

  const file = await pickImageFile();
  if (!file) return undefined;
  return {
    src: await readFileAsDataUrl(file),
    alt: file.name,
  };
}

function pickImageFile(): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("cancel", () => {
      resolve(undefined);
      input.remove();
    });
    input.onchange = () => {
      resolve(input.files?.[0]);
      input.remove();
    };
    input.click();
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
