import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { open } from "@tauri-apps/plugin-dialog";
import "../editor/milkdownTheme.css";
import { editorViewCtx } from "@milkdown/kit/core";
import { undoDepth, redoDepth } from "@milkdown/kit/prose/history";
import { findNodeInSelection } from "@milkdown/kit/prose";
import {
  NodeSelection,
  TextSelection,
  type EditorState,
} from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import {
  CODE_BLOCK_CODEMIRROR_LANGUAGES,
  getCodeBlockExtensions,
  renderCodeBlockLanguage,
} from "../editor/codeBlockLanguages";
import type { BlockMenuItemKey } from "../editor/blockMenuConfig";
import { buildBlockMenuModel } from "../editor/blockMenuConfig";
import {
  findActiveBlock,
  findBlockTargetAtCoords,
  getActiveBlockElement,
  getBlockControlPosition,
  getDropIndicatorStyle,
  type ActiveBlock,
  type BlockTarget,
  type BlockDropTarget,
} from "../editor/blockEdit";
import {
  type EditorImageValue,
  runAddBlockAction,
  runChangeBlockAction,
  runEditorAction,
} from "../editor/editorActions";
import { joinFrontmatter, splitFrontmatter } from "../editor/frontmatter";
import { createMilkdownRuntime } from "../editor/milkdownRuntime";
import { setCodeBlockCopyHandler } from "../editor/clipboardBridge";
import {
  createTauriEditorAdapter,
  emitEditorState,
  listenForEditorActions,
} from "../editor/tauriBridge";
import { EMPTY_EDITOR_STATE } from "../editor/types";
import { normalizeImageSrcForMarkdown } from "../editor/imageSrc";
import { extractToc } from "../editor/toc";
import type {
  EditorAction,
  EditorAdapter,
  EditorStateSnapshot,
} from "../editor/types";
import { BlockEditorOverlay } from "./BlockEditorOverlay";
import { getBlockIconForBlock } from "./BlockIcon";
import { ImagePopup, type ImagePopupValue } from "./ImagePopup";
import { LatexPopup, type LatexPopupValue } from "./LatexPopup";
import { LinkPopup, type LinkPopupValue } from "./LinkPopup";
import { SelectionToolbar } from "./SelectionToolbar";

interface MilkdownEditorProps {
  isDarkTheme: boolean;
  onChange: (markdown: string) => void;
  onWriteClipboard?: (payload: {
    text: string;
    operation: "copy" | "cut";
    source: "selection" | "code-block";
  }) => Promise<void>;
  onReady: (adapter: EditorAdapter | null) => void;
}

interface BlockMenuState {
  visible: boolean;
  style: CSSProperties;
  activeBlock: ActiveBlock | null;
  activeItemKey: BlockMenuItemKey | null;
}

interface DragState {
  sourceBlock: ActiveBlock;
  target: BlockDropTarget | null;
}

const EMPTY_BLOCK_MENU_STATE: BlockMenuState = {
  visible: false,
  style: {},
  activeBlock: null,
  activeItemKey: null,
};

const BLOCK_DRAG_MIME = "application/x-crisps-block";

export function MilkdownEditor({
  isDarkTheme,
  onChange,
  onWriteClipboard,
  onReady,
}: MilkdownEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const linkPopupRef = useRef<HTMLFormElement>(null);
  const latexPopupRef = useRef<HTMLFormElement>(null);
  const imagePopupRef = useRef<HTMLFormElement>(null);
  const blockMenuRef = useRef<HTMLDivElement | null>(null);
  const blockHandleRef = useRef<HTMLDivElement | null>(null);
  const linkNameInputRef = useRef<HTMLInputElement>(null);
  const linkHrefInputRef = useRef<HTMLInputElement>(null);
  const latexInputRef = useRef<HTMLInputElement>(null);
  const imagePathInputRef = useRef<HTMLInputElement>(null);
  const imageAltInputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const frontmatterRef = useRef("");
  const onChangeRef = useRef(onChange);
  const onWriteClipboardRef = useRef(onWriteClipboard);
  const suppressNextMarkdownUpdateRef = useRef(false);
  const suppressMarkdownTimerRef = useRef<number | null>(null);
  const editorChromeRefreshFrameRef = useRef<number | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const runtimeRef = useRef<ReturnType<typeof createMilkdownRuntime> | null>(
    null,
  );
  const imagePopupFileRef = useRef<File | null>(null);
  const imagePopupResolverRef = useRef<
    ((value: EditorImageValue | undefined) => void) | null
  >(null);
  const blockMenuStateRef = useRef<BlockMenuState>(EMPTY_BLOCK_MENU_STATE);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const hoveredBlockRef = useRef<ActiveBlock | null>(null);
  const hoveredElementRef = useRef<HTMLElement | null>(null);
  const selectionBlockRef = useRef<ActiveBlock | null>(null);
  const menuBlockRef = useRef<ActiveBlock | null>(null);
  const menuTriggerBlockRef = useRef<ActiveBlock | null>(null);
  const menuTriggerRectRef = useRef<DOMRect | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const handleBlockRef = useRef<ActiveBlock | null>(null);
  const handleElementRef = useRef<HTMLElement | null>(null);
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
  const [latexPopupState, setLatexPopupState] = useState<{
    style: CSSProperties;
    value: LatexPopupValue | null;
  }>({
    style: {},
    value: null,
  });
  const [imagePopupValue, setImagePopupValue] =
    useState<ImagePopupValue | null>(null);
  const [blockMenuState, setBlockMenuState] = useState<BlockMenuState>(
    EMPTY_BLOCK_MENU_STATE,
  );
  const [hoveredBlock, setHoveredBlockState] = useState<ActiveBlock | null>(
    null,
  );
  const [selectionBlock, setSelectionBlockState] = useState<ActiveBlock | null>(
    null,
  );
  const [dragState, setDragStateState] = useState<DragState | null>(null);
  const [handleStyle, setHandleStyle] = useState<CSSProperties>({});
  const [dropIndicatorState, setDropIndicatorState] = useState<{
    placement: BlockDropTarget["placement"];
    style: CSSProperties;
  } | null>(null);

  const blockMenuModel = useMemo(
    () => buildBlockMenuModel(toolbarState.editorState),
    [toolbarState.editorState],
  );
  const handleMenuIcon = getBlockIconForBlock(
    dragState?.target?.block ??
      dragState?.sourceBlock ??
      handleBlockRef.current ??
      hoveredBlock ??
      (toolbarState.editorState.focused ? selectionBlock : null),
  );
  const editorVisible = (rootRef.current?.getClientRects().length ?? 0) > 0;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onWriteClipboardRef.current = onWriteClipboard;
  }, [onWriteClipboard]);

  useEffect(() => {
    setCodeBlockCopyHandler((text) => {
      return (
        onWriteClipboardRef.current?.({
          text,
          operation: "copy",
          source: "code-block",
        }) ?? Promise.resolve()
      );
    });
    return () => {
      setCodeBlockCopyHandler(null);
    };
  }, []);

  useEffect(() => {
    blockMenuStateRef.current = blockMenuState;
  }, [blockMenuState]);

  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!blockMenuState.visible || !blockMenuState.activeBlock || !view) return;

    const anchorRect = getBlockMenuAnchorRect(view, blockMenuState.activeBlock);
    if (!anchorRect || !blockMenuRef.current) return;

    const nextStyle = buildBlockMenuStyle(anchorRect, blockMenuRef.current);
    setBlockMenuState((current) =>
      current.visible
        ? {
            ...current,
            style: nextStyle,
          }
        : current,
    );
  }, [blockMenuState.activeBlock, blockMenuState.visible]);

  const setHoveredBlock = (block: ActiveBlock | null) => {
    hoveredBlockRef.current = block;
    setHoveredBlockState(block);
  };

  const setHoveredTarget = (target: BlockTarget | null) => {
    hoveredElementRef.current = target?.element ?? null;
    setHoveredBlock(target?.block ?? null);
  };

  const setSelectionBlock = (block: ActiveBlock | null) => {
    selectionBlockRef.current = block;
    setSelectionBlockState(block);
  };

  const setMenuBlock = (block: ActiveBlock | null) => {
    menuBlockRef.current = block;
  };

  const setDragState = (next: DragState | null) => {
    dragStateRef.current = next;
    setDragStateState(next);
  };

  const refreshToolbarState = (view: EditorView) => {
    const nextEditorState = buildEditorState(view);
    setToolbarState(
      buildSelectionToolbarState(view, nextEditorState, toolbarRef.current),
    );
  };

  const getVisibleHandleBlock = (
    view: EditorView,
    selection: ActiveBlock | null,
  ) => {
    if (blockMenuStateRef.current.visible) return null;
    return (
      dragStateRef.current?.target?.block ??
      dragStateRef.current?.sourceBlock ??
      hoveredBlockRef.current ??
      (view.hasFocus() ? selection : null)
    );
  };

  const getInteractiveHandleBlock = () => {
    return (
      dragStateRef.current?.target?.block ??
      dragStateRef.current?.sourceBlock ??
      handleBlockRef.current ??
      hoveredBlockRef.current ??
      selectionBlockRef.current
    );
  };

  const getBlockMenuTriggerElement = () =>
    blockHandleRef.current?.querySelector<HTMLButtonElement>(
      '[data-role="block-menu-trigger"]',
    ) ?? null;

  const getBlockMenuAnchorRect = (
    view: EditorView,
    block: ActiveBlock | null,
  ): DOMRect | null =>
    menuTriggerRectRef.current ??
    getBlockMenuTriggerElement()?.getBoundingClientRect() ??
    getActiveBlockElement(view, block)?.getBoundingClientRect() ??
    null;

  const isBlockMenuOverlayTarget = (target: Node | null) =>
    Boolean(
      target &&
      (blockHandleRef.current?.contains(target) ||
        blockMenuRef.current?.contains(target) ||
        (target instanceof Element &&
          target.closest(".block-popup-submenu-menu"))),
    );

  const refreshBlockControls = (view: EditorView) => {
    const nextSelectionBlock = findActiveBlock(view.state);
    setSelectionBlock(nextSelectionBlock);

    const handleBlock = getVisibleHandleBlock(view, nextSelectionBlock);
    const handleAnchorBlock =
      handleBlock ??
      (blockMenuStateRef.current.visible ? menuBlockRef.current : null);
    handleBlockRef.current = handleBlock;
    const handleElement =
      (dragStateRef.current?.target?.block.pos === handleAnchorBlock?.pos
        ? dragStateRef.current?.target?.element
        : null) ??
      (hoveredBlockRef.current?.pos === handleAnchorBlock?.pos
        ? hoveredElementRef.current
        : null) ??
      (menuBlockRef.current?.pos === handleAnchorBlock?.pos
        ? getActiveBlockElement(view, menuBlockRef.current)
        : null) ??
      getActiveBlockElement(view, handleAnchorBlock);
    handleElementRef.current = handleElement ?? null;
    setHandleStyle(getBlockControlPosition(view, handleAnchorBlock));

    if (blockMenuStateRef.current.visible && menuBlockRef.current) {
      setBlockMenuState((current) =>
        current.visible
          ? {
              ...current,
              style: buildBlockMenuStyle(
                getBlockMenuAnchorRect(view, menuBlockRef.current),
                blockMenuRef.current,
              ),
              activeBlock: menuBlockRef.current,
            }
          : current,
      );
    }

    const dropTarget = dragStateRef.current?.target ?? null;
    const indicatorStyle = getDropIndicatorStyle(view, dropTarget);
    setDropIndicatorState(
      dropTarget && indicatorStyle
        ? {
            placement: dropTarget.placement,
            style: indicatorStyle,
          }
        : null,
    );
  };

  const refreshEditorChrome = (view = viewRef.current) => {
    if (!view) return;
    refreshToolbarState(view);
    refreshBlockControls(view);
    setLinkPopupState((current) => {
      if (!current.value || !viewRef.current) return current;
      return {
        ...current,
        style: buildLinkPopupStyle(
          viewRef.current,
          current.value.from,
          current.value.to,
          current.value.showName,
          linkPopupRef.current,
        ),
      };
    });
    setLatexPopupState((current) => {
      if (!current.value || !viewRef.current) return current;
      return {
        ...current,
        style: buildLatexPopupStyle(
          viewRef.current,
          current.value.from,
          current.value.to,
          latexPopupRef.current,
        ),
      };
    });
  };

  const scheduleEditorChromeRefresh = (view: EditorView) => {
    viewRef.current = view;
    if (editorChromeRefreshFrameRef.current != null) {
      window.cancelAnimationFrame(editorChromeRefreshFrameRef.current);
    }
    editorChromeRefreshFrameRef.current = window.requestAnimationFrame(() => {
      editorChromeRefreshFrameRef.current = null;
      if (viewRef.current) {
        refreshEditorChrome(viewRef.current);
      }
    });
  };

  const stopAutoScroll = () => {
    if (autoScrollFrameRef.current != null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    dragPointerRef.current = null;
  };

  const updateDragTargetAtPointer = (view: EditorView) => {
    const sourceBlock = dragStateRef.current?.sourceBlock ?? null;
    const pointer = dragPointerRef.current;
    if (!sourceBlock || !pointer) return;

    const target =
      runtimeRef.current?.blockEdit.resolveDropTargetAtCoords(
        {
          left: pointer.x,
          top: pointer.y,
        },
        sourceBlock,
      ) ?? null;

    setDragState({
      sourceBlock,
      target,
    });
    scheduleEditorChromeRefresh(view);
  };

  const startAutoScroll = (view: EditorView) => {
    if (autoScrollFrameRef.current != null) return;

    const tick = () => {
      autoScrollFrameRef.current = null;
      const container = scrollContainerRef.current;
      const pointer = dragPointerRef.current;
      const sourceBlock = dragStateRef.current?.sourceBlock;
      if (!container || !pointer || !sourceBlock) return;

      const rect = container.getBoundingClientRect();
      const threshold = 72;
      const maxSpeed = 18;
      let delta = 0;

      if (pointer.y < rect.top + threshold) {
        const intensity = Math.max(
          0,
          (rect.top + threshold - pointer.y) / threshold,
        );
        delta = -Math.max(4, Math.round(maxSpeed * intensity));
      } else if (pointer.y > rect.bottom - threshold) {
        const intensity = Math.max(
          0,
          (pointer.y - (rect.bottom - threshold)) / threshold,
        );
        delta = Math.max(4, Math.round(maxSpeed * intensity));
      }

      if (delta !== 0) {
        const previous = container.scrollTop;
        container.scrollTop += delta;
        if (container.scrollTop !== previous) {
          updateDragTargetAtPointer(view);
        }
      }

      if (dragPointerRef.current && dragStateRef.current?.sourceBlock) {
        autoScrollFrameRef.current = window.requestAnimationFrame(tick);
      }
    };

    autoScrollFrameRef.current = window.requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (!rootRef.current) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;
    let removeEditorListeners: (() => void) | undefined;

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

    const emitSnapshot = (view: EditorView) => {
      const nextEditorState = buildEditorState(view);
      void emitEditorState(nextEditorState);
      scheduleEditorChromeRefresh(view);
    };

    const syncLatexPopupState = (
      view: EditorView,
      openWhenSelected: boolean,
    ) => {
      setLatexPopupState((current) => {
        const nextValue = getLatexPopupValue(view.state);
        if (!nextValue) {
          return current.value
            ? {
                style: {},
                value: null,
              }
            : current;
        }

        if (!openWhenSelected && !current.value) {
          return current;
        }

        return {
          style: buildLatexPopupStyle(
            view,
            nextValue.from,
            nextValue.to,
            latexPopupRef.current,
          ),
          value:
            current.value?.pos === nextValue.pos
              ? {
                  ...nextValue,
                  value: current.value.value,
                }
              : nextValue,
        };
      });
    };

    const runtime = createMilkdownRuntime({
      root: rootRef.current,
      defaultValue: "",
      extensions: getCodeBlockExtensions(isDarkTheme),
      languages: CODE_BLOCK_CODEMIRROR_LANGUAGES,
      renderLanguage: renderCodeBlockLanguage,
      onWriteClipboard: (payload) =>
        onWriteClipboardRef.current?.(payload) ?? Promise.resolve(),
      onUpload: readFileAsDataUrl,
      configureListeners: (listener) => {
        listener.mounted((ctx) => {
          const view = ctx.get(editorViewCtx);
          emitSnapshot(view);
          syncLatexPopupState(view, false);
          syncRenderedHeadingAnchors(
            view.dom,
            runtimeRef.current?.getMarkdown() ?? "",
          );
        });
        listener.focus((ctx) => {
          const view = ctx.get(editorViewCtx);
          emitSnapshot(view);
          syncLatexPopupState(view, false);
        });
        listener.blur((ctx) => {
          const view = ctx.get(editorViewCtx);
          emitSnapshot(view);
          syncLatexPopupState(view, false);
        });
        listener.selectionUpdated((ctx) => {
          const view = ctx.get(editorViewCtx);
          emitSnapshot(view);
          syncLatexPopupState(view, true);
        });
        listener.updated((ctx) => {
          const view = ctx.get(editorViewCtx);
          emitSnapshot(view);
          syncLatexPopupState(view, false);
          syncRenderedHeadingAnchors(
            view.dom,
            runtimeRef.current?.getMarkdown() ?? "",
          );
        });
        listener.markdownUpdated((ctx, markdown) => {
          const view = ctx.get(editorViewCtx);
          emitSnapshot(view);
          syncLatexPopupState(view, false);
          syncRenderedHeadingAnchors(view.dom, markdown);
          if (suppressNextMarkdownUpdateRef.current) {
            suppressNextMarkdownUpdateRef.current = false;
            if (suppressMarkdownTimerRef.current != null) {
              window.clearTimeout(suppressMarkdownTimerRef.current);
              suppressMarkdownTimerRef.current = null;
            }
            return;
          }

          onChangeRef.current(
            joinFrontmatter(frontmatterRef.current, markdown),
          );
        });
      },
    });
    runtimeRef.current = runtime;

    const setMarkdown = (markdown: string) => {
      const parts = splitFrontmatter(markdown);
      frontmatterRef.current = parts.frontmatter;
      beginSilentMarkdownSync();
      setHoveredTarget(null);
      setMenuBlock(null);
      menuTriggerBlockRef.current = null;
      menuTriggerRectRef.current = null;
      setDragState(null);
      setBlockMenuState(EMPTY_BLOCK_MENU_STATE);
      setDropIndicatorState(null);
      runtime.replaceMarkdown(parts.body);
    };

      const getMarkdown = () =>
        joinFrontmatter(frontmatterRef.current, runtime.getMarkdown());

      const getSelectedText = () => {
        const currentView = viewRef.current;
        return currentView ? getSelectedEditorText(currentView) : "";
      };

      const deleteSelection = () => {
        const currentView = viewRef.current;
        if (!currentView) return;
        const { selection } = currentView.state;
        if (!(selection instanceof TextSelection) || selection.empty) return;
        currentView.dispatch(
          currentView.state.tr.deleteSelection().scrollIntoView(),
        );
        currentView.focus();
      };

      const focus = () => {
        runtime.focus();
      };

      const copySelection = () => runtime.copySelection();

      const cutSelection = () => runtime.cutSelection();

    const scrollToHeading = (headingId: string) => {
      const view = viewRef.current;
      if (!view) return false;

      const tocItems = extractToc(getMarkdown());
      const targetIndex = tocItems.findIndex((item) => item.id === headingId);
      if (targetIndex === -1) return false;

      const headingPositions = getHeadingSelectionPositions(view.state);
      const targetPosition = headingPositions[targetIndex];

      if (targetPosition != null) {
        const selection = TextSelection.near(
          view.state.doc.resolve(targetPosition),
        );
        view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
        window.requestAnimationFrame(() => {
          const selector = `[data-toc-id="${escapeTocSelectorValue(headingId)}"]`;
          const stampedElement = view.dom.querySelector<HTMLElement>(selector);
          const fallbackElement = getRenderedHeadingElements(view.dom)[targetIndex];
          const element = stampedElement ?? fallbackElement;
          element?.scrollIntoView({ block: "center", behavior: "smooth" });
        });
        return true;
      }

      const selector = `[data-toc-id="${escapeTocSelectorValue(headingId)}"]`;
      const stampedElement = view.dom.querySelector<HTMLElement>(selector);
      const fallbackElement = getRenderedHeadingElements(view.dom)[targetIndex];
      const element = stampedElement ?? fallbackElement;
      if (!element) return false;

      element.scrollIntoView({ block: "center", behavior: "smooth" });
      return true;
    };

    void runtime.create().then(async () => {
      if (disposed) {
        await runtime.destroy();
        return;
      }

      const view = runtime.action((ctx) => ctx.get(editorViewCtx));
      viewRef.current = view;
      const scrollContainer = rootRef.current?.closest(".editor-container");
      scrollContainerRef.current =
        scrollContainer instanceof HTMLElement ? scrollContainer : null;

      const handleDocumentPointerMove = (event: PointerEvent) => {
        if (dragStateRef.current?.sourceBlock) return;
        const target = event.target as Node | null;
        if (isBlockMenuOverlayTarget(target)) {
          return;
        }

        if (target && view.dom.contains(target)) {
          const nextTarget =
            findBlockTargetAtCoords(view, {
              left: event.clientX,
              top: event.clientY,
            }) ??
            (() => {
              const block = runtime.blockEdit.findBlockFromDom(target);
              if (!block) return null;
              const element = getActiveBlockElement(view, block);
              return element ? { block, element } : null;
            })();
          if (nextTarget) {
            setHoveredTarget(nextTarget);
            scheduleEditorChromeRefresh(view);
          }
          return;
        }
      };

      const handleDocumentPointerDown = (event: PointerEvent) => {
        const target = event.target as Node | null;
        if (
          target &&
          (view.dom.contains(target) || isBlockMenuOverlayTarget(target))
        ) {
          return;
        }

        if (hoveredBlockRef.current) {
          setHoveredTarget(null);
          scheduleEditorChromeRefresh(view);
        }
      };

      const handleDocumentDragOver = (event: DragEvent) => {
        const sourceBlock = dragStateRef.current?.sourceBlock ?? null;
        if (!sourceBlock) return;
        dragPointerRef.current = { x: event.clientX, y: event.clientY };
        startAutoScroll(view);

        const targetNode = event.target as Node | null;
        if (!targetNode || !view.dom.contains(targetNode)) {
          if (dragStateRef.current?.target) {
            setDragState({
              sourceBlock,
              target: null,
            });
            setDropIndicatorState(null);
            scheduleEditorChromeRefresh(view);
          }
          return;
        }

        event.preventDefault();
        const target = runtime.blockEdit.resolveDropTargetAtCoords(
          {
            left: event.clientX,
            top: event.clientY,
          },
          sourceBlock,
        );
        setDragState({
          sourceBlock,
          target,
        });
        scheduleEditorChromeRefresh(view);
      };

      const handleDocumentDrop = (event: DragEvent) => {
        const sourceBlock = dragStateRef.current?.sourceBlock ?? null;
        if (!sourceBlock) return;
        stopAutoScroll();

        const targetNode = event.target as Node | null;
        if (!targetNode || !view.dom.contains(targetNode)) {
          setDragState(null);
          setDropIndicatorState(null);
          scheduleEditorChromeRefresh(view);
          return;
        }

        event.preventDefault();
        const target =
          runtime.blockEdit.resolveDropTargetAtCoords(
            {
              left: event.clientX,
              top: event.clientY,
            },
            sourceBlock,
          ) ??
          dragStateRef.current?.target ??
          null;
        const moved =
          sourceBlock && target
            ? runtime.blockEdit.moveBlockTo(
                sourceBlock,
                target.block,
                target.placement,
              )
            : false;
        setDragState(null);
        setDropIndicatorState(null);
        if (moved) {
          closeBlockMenu(false);
          runtime.focus();
        }
        scheduleEditorChromeRefresh(view);
      };

      const handleDocumentDragEnd = () => {
        if (!dragStateRef.current) return;
        stopAutoScroll();
        setDragState(null);
        setDropIndicatorState(null);
        scheduleEditorChromeRefresh(view);
      };

      document.addEventListener("pointermove", handleDocumentPointerMove, true);
      document.addEventListener("pointerdown", handleDocumentPointerDown, true);
      document.addEventListener("dragover", handleDocumentDragOver, true);
      document.addEventListener("drop", handleDocumentDrop, true);
      document.addEventListener("dragend", handleDocumentDragEnd, true);
      removeEditorListeners = () => {
        document.removeEventListener(
          "pointermove",
          handleDocumentPointerMove,
          true,
        );
        document.removeEventListener(
          "pointerdown",
          handleDocumentPointerDown,
          true,
        );
        document.removeEventListener("dragover", handleDocumentDragOver, true);
        document.removeEventListener("drop", handleDocumentDrop, true);
        document.removeEventListener("dragend", handleDocumentDragEnd, true);
      };

      onReady(
        createTauriEditorAdapter({
          setMarkdown,
          getMarkdown,
          getSelectedText,
          deleteSelection,
          copySelection,
          cutSelection,
          focus,
          scrollToHeading,
          runAction: async (action) => {
            await performEditorAction(runtime, action, true);
          },
        }),
      );

      unlisten = await listenForEditorActions(async (action) => {
        await performEditorAction(runtime, action);
      });

      scheduleEditorChromeRefresh(view);
      syncRenderedHeadingAnchors(view.dom, runtime.getMarkdown());
    });

    return () => {
      disposed = true;
      if (suppressMarkdownTimerRef.current != null) {
        window.clearTimeout(suppressMarkdownTimerRef.current);
      }
      if (editorChromeRefreshFrameRef.current != null) {
        window.cancelAnimationFrame(editorChromeRefreshFrameRef.current);
      }
      stopAutoScroll();
      setHoveredTarget(null);
      setSelectionBlock(null);
      setMenuBlock(null);
      setDragState(null);
      setDropIndicatorState(null);
      runtimeRef.current = null;
      viewRef.current = null;
      onReady(null);
      removeEditorListeners?.();
      unlisten?.();
      void runtime.destroy();
    };
  }, [isDarkTheme, onReady]);

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

  const closeLinkPopup = (focus = true) => {
    setLinkPopupState({
      style: {},
      value: null,
    });
    if (focus) viewRef.current?.focus();
  };

  const closeLatexPopup = (focus = true) => {
    setLatexPopupState({
      style: {},
      value: null,
    });
    if (focus) viewRef.current?.focus();
  };

  const resolveImagePopup = (
    value: EditorImageValue | undefined,
    focus: boolean,
  ) => {
    const resolver = imagePopupResolverRef.current;
    imagePopupResolverRef.current = null;
    imagePopupFileRef.current = null;
    setImagePopupValue(null);
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = "";
    }
    if (focus) viewRef.current?.focus();
    resolver?.(value);
  };

  const closeImagePopup = (focus = true) => {
    resolveImagePopup(undefined, focus);
  };

  const closeBlockMenu = (focus = true) => {
    setMenuBlock(null);
    menuTriggerBlockRef.current = null;
    menuTriggerRectRef.current = null;
    setBlockMenuState(EMPTY_BLOCK_MENU_STATE);
    refreshEditorChrome();
    if (focus) viewRef.current?.focus();
  };

  const openLinkPopup = (view: EditorView) => {
    const value = getLinkPopupValue(view.state);
    setLinkPopupState({
      style: buildLinkPopupStyle(
        view,
        value.from,
        value.to,
        value.showName,
        linkPopupRef.current,
      ),
      value,
    });
  };

  const openLatexPopup = (view: EditorView) => {
    toggleInlineLatex(view);
    const value = getLatexPopupValue(view.state);
    setLatexPopupState({
      style: value
        ? buildLatexPopupStyle(
            view,
            value.from,
            value.to,
            latexPopupRef.current,
          )
        : {},
      value,
    });
  };

  const requestImage = () =>
    new Promise<EditorImageValue | undefined>((resolve) => {
      if (imagePopupResolverRef.current) {
        resolveImagePopup(undefined, false);
      }
      imagePopupResolverRef.current = resolve;
      imagePopupFileRef.current = null;
      closeLinkPopup(false);
      closeLatexPopup(false);
      closeBlockMenu(false);
      setImagePopupValue({
        src: "",
        alt: "",
        fileName: "",
      });
    });

  const browseImagePath = async () => {
    const selected = await open({
      directory: false,
      multiple: false,
      filters: [
        {
          name: "Image",
          extensions: [
            "png",
            "jpg",
            "jpeg",
            "gif",
            "webp",
            "svg",
            "bmp",
            "avif",
          ],
        },
      ],
    });
    if (typeof selected !== "string") return;

    imagePopupFileRef.current = null;
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = "";
    }
    setImagePopupValue((current) =>
      current
        ? {
            ...current,
            src: normalizeImageSrcForMarkdown(selected),
            fileName: "",
          }
        : current,
    );
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

  const submitLatexPopup = () => {
    const view = viewRef.current;
    const value = latexPopupState.value;
    if (!view || !value) return;

    updateInlineLatex(view, value);
    closeLatexPopup();
  };

  const submitImagePopup = async () => {
    const value = imagePopupValue;
    if (!value) return;

    const src = normalizeImageSrcForMarkdown(value.src.trim());
    const alt = value.alt.trim() || undefined;

    if (src) {
      resolveImagePopup({ src, alt }, false);
      return;
    }

    const file = imagePopupFileRef.current;
    if (!file) return;

    resolveImagePopup(
      {
        src: await readFileAsDataUrl(file),
        alt,
      },
      false,
    );
  };

  const handleToolbarAction = async (action: EditorAction) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    await performEditorAction(runtime, action, true);
  };

  const performEditorAction = async (
    runtime: NonNullable<typeof runtimeRef.current>,
    action: EditorAction,
    focusAfter = false,
  ) => {
    await runEditorAction({
      runtime,
      action,
      frontmatterRef,
      onChange: onChangeRef.current,
      openLinkPopup,
      openLatexPopup,
      promptForImage: requestImage,
    });
    runtime.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      if (focusAfter) {
        view.focus();
      }
      scheduleEditorChromeRefresh(view);
      if (action.action === "insertFrontmatter") {
        void emitEditorState(buildEditorState(view));
      }
    });
  };

  const openBlockMenu = () => {
    const activeBlock =
      menuTriggerBlockRef.current ?? getInteractiveHandleBlock();
    const view = viewRef.current;
    if (!activeBlock || !view) return;

    closeLinkPopup(false);
    closeLatexPopup(false);
    setMenuBlock(activeBlock);
    setBlockMenuState({
      visible: true,
      style: {
        left: -9999,
        top: -9999,
        visibility: "hidden",
      },
      activeBlock,
      activeItemKey: blockMenuModel.addItems[0]?.key ?? null,
    });
    menuTriggerBlockRef.current = null;
    menuTriggerRectRef.current = null;
  };

  const handleBlockMenuAction = async (key: BlockMenuItemKey) => {
    const runtime = runtimeRef.current;
    const activeBlock = blockMenuState.activeBlock;
    const view = viewRef.current;
    if (!runtime || !activeBlock || !view) return;

    if (key.startsWith("add:")) {
      await runAddBlockAction({
        runtime,
        key,
        activeBlock,
        frontmatterRef,
        onChange: onChangeRef.current,
        openLinkPopup,
        openLatexPopup,
        promptForImage: requestImage,
      });
    } else if (key.startsWith("change:")) {
      await runChangeBlockAction({
        runtime,
        key,
        activeBlock,
        frontmatterRef,
        onChange: onChangeRef.current,
        openLinkPopup,
        openLatexPopup,
      });
    } else {
      switch (key) {
        case "manage:insertBelow":
          runtime.blockEdit.insertBelow(activeBlock);
          break;
        case "manage:moveUp":
          runtime.blockEdit.selectBlock(activeBlock);
          runtime.blockEdit.moveUp();
          break;
        case "manage:moveDown":
          runtime.blockEdit.selectBlock(activeBlock);
          runtime.blockEdit.moveDown();
          break;
        case "manage:delete":
          runtime.blockEdit.deleteBlock(activeBlock);
          break;
      }
    }

    closeBlockMenu(false);
    runtime.focus();
    const nextView = viewRef.current;
    if (!nextView) return;
    scheduleEditorChromeRefresh(nextView);
  };

  useEffect(() => {
    const handleViewportChange = () => {
      refreshEditorChrome();
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
  }, [
    linkPopupState.value?.from,
    linkPopupState.value?.to,
    linkPopupState.value?.showName,
  ]);

  useEffect(() => {
    if (!latexPopupState.value) return;

    latexInputRef.current?.focus();
    latexInputRef.current?.select();
  }, [latexPopupState.value?.pos]);

  useEffect(() => {
    if (!imagePopupValue) return;

    imagePathInputRef.current?.focus();
    imagePathInputRef.current?.select();
  }, [Boolean(imagePopupValue)]);

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

  useEffect(() => {
    if (!latexPopupState.value) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (latexPopupRef.current?.contains(target)) return;
      closeLatexPopup();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeLatexPopup();
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [latexPopupState.value]);

  useEffect(() => {
    if (!imagePopupValue) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeImagePopup();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [imagePopupValue]);

  useEffect(() => {
    if (!blockMenuState.visible) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (isBlockMenuOverlayTarget(target)) return;
      closeBlockMenu();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [blockMenuState.visible]);

  useEffect(
    () => () => {
      if (imagePopupResolverRef.current) {
        imagePopupResolverRef.current(undefined);
        imagePopupResolverRef.current = null;
      }
    },
    [],
  );

  const handleBlockMenuPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    menuTriggerRectRef.current = event.currentTarget.getBoundingClientRect();
    menuTriggerBlockRef.current =
      handleBlockRef.current ??
      hoveredBlockRef.current ??
      selectionBlockRef.current;
  };

  const handleBlockHandlePointerEnter = () => {
    const activeBlock = getInteractiveHandleBlock();
    if (!activeBlock) return;
    setHoveredBlock(activeBlock);
    if (viewRef.current) {
      scheduleEditorChromeRefresh(viewRef.current);
    }
  };

  const handleBlockDragPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    const activeBlock = getInteractiveHandleBlock();
    if (!activeBlock) return;
    closeBlockMenu(false);
    runtimeRef.current?.blockEdit.selectBlock(activeBlock);
    setHoveredBlock(activeBlock);
    if (viewRef.current) {
      scheduleEditorChromeRefresh(viewRef.current);
    }
  };

  const handleBlockDragStart = (event: ReactDragEvent<HTMLButtonElement>) => {
    const activeBlock = getInteractiveHandleBlock();
    if (!activeBlock) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      BLOCK_DRAG_MIME,
      JSON.stringify({
        pos: activeBlock.pos,
        type: activeBlock.typeName,
      }),
    );
    runtimeRef.current?.blockEdit.selectBlock(activeBlock);
    dragPointerRef.current = null;
    setDragState({
      sourceBlock: activeBlock,
      target: null,
    });
    setHoveredBlock(activeBlock);
  };

  const handleBlockDragEnd = () => {
    stopAutoScroll();
    setDragState(null);
    setDropIndicatorState(null);
    if (viewRef.current) {
      scheduleEditorChromeRefresh(viewRef.current);
    }
  };

  const visibleHandleBlock = blockMenuState.visible
    ? blockMenuState.activeBlock
    : (dragState?.target?.block ??
      dragState?.sourceBlock ??
      hoveredBlock ??
      (toolbarState.editorState.focused ? selectionBlock : null));

  return (
    <>
      <div ref={rootRef} className="milkdown milkdown-host h-full" />
      <BlockEditorOverlay
        blockHandleRef={blockHandleRef}
        blockMenuRef={blockMenuRef}
        handleStyle={handleStyle}
        handleVisible={editorVisible && Boolean(visibleHandleBlock)}
        menuDisabled={blockMenuState.visible}
        menuIcon={handleMenuIcon}
        onOpenMenu={openBlockMenu}
        onMenuPointerDown={handleBlockMenuPointerDown}
        onHandlePointerEnter={handleBlockHandlePointerEnter}
        onDragPointerDown={handleBlockDragPointerDown}
        onDragStart={handleBlockDragStart}
        onDragEnd={handleBlockDragEnd}
        dropIndicatorState={dropIndicatorState}
        blockMenuStyle={blockMenuState.style}
        blockMenuVisible={editorVisible && blockMenuState.visible}
        blockMenuItems={blockMenuModel}
        blockMenuActiveItemKey={blockMenuState.activeItemKey}
        onHoverMenuItem={(key) => {
          setBlockMenuState((current) => ({ ...current, activeItemKey: key }));
        }}
        onActivateMenuItem={handleBlockMenuAction}
        onCloseMenu={closeBlockMenu}
      />
      <SelectionToolbar
        editorState={toolbarState.editorState}
        style={toolbarState.style}
        toolbarRef={toolbarRef}
        visible={
          toolbarState.visible &&
          !linkPopupState.value &&
          !latexPopupState.value &&
          !imagePopupValue &&
          !blockMenuState.visible
        }
        onAction={handleToolbarAction}
        onRefreshPosition={refreshToolbarPosition}
      />
      {typeof document !== "undefined" && imagePopupValue
        ? createPortal(
            <ImagePopup
              popupRef={imagePopupRef}
              pathInputRef={imagePathInputRef}
              altInputRef={imageAltInputRef}
              fileInputRef={imageFileInputRef}
              value={imagePopupValue}
              onChange={(patch) => {
                if (typeof patch.src === "string" && patch.src.trim()) {
                  imagePopupFileRef.current = null;
                  if (imageFileInputRef.current) {
                    imageFileInputRef.current.value = "";
                  }
                  patch = {
                    ...patch,
                    fileName: "",
                  };
                }
                setImagePopupValue((current) =>
                  current
                    ? {
                        ...current,
                        ...patch,
                      }
                    : current,
                );
              }}
              onBrowsePath={() => {
                void browseImagePath();
              }}
              onPickFile={(file) => {
                imagePopupFileRef.current = file ?? null;
                setImagePopupValue((current) =>
                  current
                    ? {
                        ...current,
                        src: "",
                        fileName: file?.name ?? "",
                      }
                    : current,
                );
              }}
              onSubmit={() => {
                void submitImagePopup();
              }}
              onCancel={() => {
                closeImagePopup();
              }}
            />,
            document.body,
          )
        : null}
      <LatexPopup
        popupRef={latexPopupRef}
        inputRef={latexInputRef}
        style={latexPopupState.style}
        value={latexPopupState.value}
        onChange={(patch) => {
          setLatexPopupState((current) =>
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
        onSubmit={submitLatexPopup}
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

function syncRenderedHeadingAnchors(root: HTMLElement, markdown: string): void {
  const headings = getRenderedHeadingElements(root);
  const tocItems = extractToc(markdown);

  for (const heading of headings) {
    delete heading.dataset.tocId;
    delete heading.dataset.tocIndex;
  }

  headings.forEach((heading, index) => {
    const item = tocItems[index];
    if (!item) return;
    heading.dataset.tocId = item.id;
    heading.dataset.tocIndex = String(item.index);
  });
}

function escapeTocSelectorValue(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}

function getRenderedHeadingElements(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
  );
}

function getHeadingSelectionPositions(state: EditorState): number[] {
  const positions: number[] = [];

  state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") {
      return true;
    }

    positions.push(Math.min(pos + 1, state.doc.content.size));
    return true;
  });

  return positions;
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
    isTextSelection &&
    !selection.empty &&
    view.state.doc.textBetween(selection.from, selection.to).length > 0;

  if (
    !isTextSelection ||
    !hasSelectedText ||
    (!view.hasFocus() && !toolbarHasFocus)
  ) {
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
  const left = Math.min(Math.max(center - popupWidth / 2, 8), maxLeft);
  const preferredTop = Math.min(start.top, end.top) - popupHeight;
  const fallbackTop = Math.max(start.bottom, end.bottom) + 12;
  const maxTop = Math.max(topSafeArea, window.innerHeight - popupHeight - 8);
  const top =
    preferredTop >= topSafeArea ? preferredTop : Math.min(fallbackTop, maxTop);

  return {
    editorState,
    style: { left, top },
    visible: true,
  };
}

function getSelectedEditorText(view: EditorView): string {
  const { selection, doc } = view.state;
  if (!(selection instanceof TextSelection) || selection.empty) {
    return "";
  }

  return doc.textBetween(selection.from, selection.to);
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
      : Math.min(
          fallbackTop,
          Math.max(8, window.innerHeight - popupHeight - 8),
        );

  return {
    left,
    top,
  };
}

function getLatexPopupValue(state: EditorState): LatexPopupValue | null {
  const { selection } = state;
  if (!(selection instanceof NodeSelection)) return null;
  if (selection.node.type.name !== "math_inline") return null;

  return {
    from: selection.from,
    to: selection.to,
    pos: selection.from,
    value: String(selection.node.attrs.value ?? ""),
  };
}

function buildLatexPopupStyle(
  view: EditorView,
  from: number,
  to: number,
  popupElement: HTMLFormElement | null,
): CSSProperties {
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);
  const center = (start.left + end.right) / 2;
  const popupWidth = popupElement?.offsetWidth ?? 320;
  const maxLeft = Math.max(8, window.innerWidth - popupWidth - 8);
  const left = Math.min(Math.max(center - popupWidth / 2, 8), maxLeft);
  const popupHeight = 72;
  const preferredTop = Math.min(start.top, end.top) - popupHeight;
  const fallbackTop = Math.max(start.bottom, end.bottom) + 12;
  const top =
    preferredTop >= 8
      ? preferredTop
      : Math.min(
          fallbackTop,
          Math.max(8, window.innerHeight - popupHeight - 8),
        );

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

function applyLink(view: EditorView, value: LinkPopupValue): boolean {
  const { state } = view;
  const type = state.schema.marks.link;
  if (!type) return false;

  const tr = state.tr;

  if (value.showName) {
    const label = value.name || value.href;
    const textNode = state.schema.text(label, [
      type.create({ href: value.href }),
    ]);
    const next = tr.replaceRangeWith(value.from, value.to, textNode);
    view.dispatch(
      next
        .setSelection(TextSelection.create(next.doc, value.from + label.length))
        .scrollIntoView(),
    );
    return true;
  }

  const next = tr
    .removeMark(value.from, value.to, type)
    .addMark(value.from, value.to, type.create({ href: value.href }));
  view.dispatch(
    next
      .setSelection(TextSelection.create(next.doc, value.from, value.to))
      .scrollIntoView(),
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

function updateInlineLatex(view: EditorView, value: LatexPopupValue): boolean {
  const { state } = view;
  const node = state.doc.nodeAt(value.pos);
  if (!node || node.type.name !== "math_inline") return false;

  let next = state.tr.setNodeMarkup(value.pos, undefined, {
    ...node.attrs,
    value: value.value.trim(),
  });
  next = next.setSelection(NodeSelection.create(next.doc, value.pos));
  view.dispatch(next.scrollIntoView());
  return true;
}

function buildBlockMenuStyle(
  anchorRect: DOMRect | null,
  popupElement: HTMLDivElement | null,
): CSSProperties {
  const rect = anchorRect;
  const controlLeft = rect?.right ?? 8;
  const controlTop = rect?.top ?? 48;
  const popupWidth = popupElement?.offsetWidth ?? 248;
  const popupHeight = popupElement?.offsetHeight ?? 360;
  const preferredLeft = controlLeft + 8;
  const maxLeft = Math.max(8, window.innerWidth - popupWidth - 8);
  const fitsRight = preferredLeft <= maxLeft;
  const left = fitsRight
    ? preferredLeft
    : Math.max(
        8,
        Math.min((rect?.left ?? controlLeft) - popupWidth - 8, maxLeft),
      );
  const top = Math.min(
    controlTop,
    Math.max(8, window.innerHeight - popupHeight - 8),
  );
  return { left, top };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
