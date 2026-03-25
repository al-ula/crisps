import { type MutableRefObject, useEffect, useRef } from "react";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import { redoCommand, undoCommand } from "@milkdown/kit/plugin/history";
import {
  blockquoteSchema,
  bulletListSchema,
  createCodeBlockCommand,
  headingSchema,
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
  toggleLinkCommand,
  toggleStrongCommand,
  wrapInBlockTypeCommand,
} from "@milkdown/kit/preset/commonmark";
import {
  insertTableCommand,
  toggleStrikethroughCommand,
} from "@milkdown/kit/preset/gfm";
import { undoDepth, redoDepth } from "@milkdown/kit/prose/history";
import type { EditorState } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { callCommand, replaceAll } from "@milkdown/kit/utils";
import { joinFrontmatter, splitFrontmatter } from "../editor/frontmatter";
import {
  createTauriEditorAdapter,
  emitEditorState,
  listenForEditorActions,
} from "../editor/tauriBridge";
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
  const frontmatterRef = useRef("");
  const onChangeRef = useRef(onChange);
  const suppressNextMarkdownUpdateRef = useRef(false);
  const suppressMarkdownTimerRef = useRef<number | null>(null);

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
      featureConfigs: {
        [Crepe.Feature.ImageBlock]: {
          onUpload: readFileAsDataUrl,
          blockOnUpload: readFileAsDataUrl,
          inlineOnUpload: readFileAsDataUrl,
        },
      },
    });

    const emitSnapshot = (view: EditorView) => {
      void emitEditorState(buildEditorState(view));
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
        );
      });
    });

    return () => {
      disposed = true;
      if (suppressMarkdownTimerRef.current != null) {
        window.clearTimeout(suppressMarkdownTimerRef.current);
      }
      onReady(null);
      unlisten?.();
      void crepe.destroy();
    };
  }, [onReady]);

  return <div ref={rootRef} className="milkdown-host h-full" />;
}

async function runMilkdownAction(
  crepe: Crepe,
  action: EditorAction,
  frontmatterRef: MutableRefObject<string>,
  onChange: (markdown: string) => void,
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
    case "underline":
    case "subscript":
    case "superscript":
      return;
    case "strikethrough":
      crepe.editor.action(callCommand(toggleStrikethroughCommand.key));
      return;
    case "code":
      crepe.editor.action(callCommand(toggleInlineCodeCommand.key));
      return;
    case "bulletList":
      crepe.editor.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        commands.call(wrapInBlockTypeCommand.key, {
          nodeType: bulletListSchema.type(ctx),
        });
      });
      return;
    case "orderedList":
      crepe.editor.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        commands.call(wrapInBlockTypeCommand.key, {
          nodeType: orderedListSchema.type(ctx),
        });
      });
      return;
    case "checklist":
      crepe.editor.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        commands.call(wrapInBlockTypeCommand.key, {
          nodeType: listItemSchema.type(ctx),
          attrs: { checked: false },
        });
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
        switch (action.blockType) {
          case "paragraph":
            commands.call(setBlockTypeCommand.key, {
              nodeType: paragraphSchema.type(ctx),
            });
            break;
          case "quote":
            commands.call(wrapInBlockTypeCommand.key, {
              nodeType: blockquoteSchema.type(ctx),
            });
            break;
          case "h1":
          case "h2":
          case "h3":
          case "h4":
          case "h5":
          case "h6":
            commands.call(setBlockTypeCommand.key, {
              nodeType: headingSchema.type(ctx),
              attrs: { level: Number(action.blockType.slice(1)) },
            });
            break;
        }
      });
      return;
    case "createLink": {
      const href = window.prompt("Link URL");
      if (!href) return;
      crepe.editor.action(callCommand(toggleLinkCommand.key, { href }));
      return;
    }
    case "insertImage": {
      const image = await promptForImage();
      if (!image) return;
      crepe.editor.action(callCommand(insertImageCommand.key, image));
      return;
    }
    case "insertTable":
      crepe.editor.action(
        callCommand(insertTableCommand.key, {
          row: action.rows ?? 3,
          col: action.columns ?? 3,
        }),
      );
      return;
    case "insertThematicBreak":
      crepe.editor.action(callCommand(insertHrCommand.key));
      return;
    case "insertCodeBlock":
      crepe.editor.action(callCommand(createCodeBlockCommand.key));
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

function buildEditorState(view: EditorView): EditorStateSnapshot {
  const state = view.state;
  const { blockType, listType } = getBlockState(state);

  return {
    canUndo: undoDepth(state) > 0,
    canRedo: redoDepth(state) > 0,
    bold: isMarkActive(state, "strong"),
    italic: isMarkActive(state, "emphasis"),
    underline: false,
    strikethrough: isMarkActive(state, "strike_through"),
    code: isMarkActive(state, "inline_code"),
    blockType,
    listType,
    focused: view.hasFocus(),
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
