import { useState, useEffect, useRef, useCallback } from "react";
import {
  realmPlugin,
  addComposerChild$,
  activeEditor$,
  convertSelectionToNode$,
  applyListType$,
  insertTable$,
  openNewImageDialog$,
  insertCodeBlock$,
  openLinkEditDialog$,
} from "@mdxeditor/editor";
import { useCellValues, usePublisher } from "@mdxeditor/editor";
import {
  $createParagraphNode,
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
} from "lexical";
import {
  $createHeadingNode,
  $createQuoteNode,
  type HeadingTagType,
} from "@lexical/rich-text";

function getBlockIcon(opBlock: Element): string {
  if (
    opBlock.tagName.toLowerCase() === "ul" &&
    opBlock.querySelector('input[type="checkbox"]')
  ) {
    return "☐";
  }
  if (
    opBlock.tagName.toLowerCase() === "div" &&
    opBlock.querySelector(".cm-editor")
  ) {
    return "</>";
  }
  if (opBlock.tagName.toLowerCase() === "p" && opBlock.querySelector("img")) {
    return "🖼";
  }
  switch (opBlock.tagName.toLowerCase()) {
    case "h1":
      return "H1";
    case "h2":
      return "H2";
    case "h3":
      return "H3";
    case "h4":
      return "H4";
    case "h5":
      return "H5";
    case "h6":
      return "H6";
    case "blockquote":
      return "❝";
    case "ul":
      return "•";
    case "ol":
      return "1.";
    default:
      return "¶";
  }
}

function getBlockType(opBlock: Element): string {
  if (
    opBlock.tagName.toLowerCase() === "ul" &&
    opBlock.querySelector('input[type="checkbox"]')
  ) {
    return "check";
  }
  if (
    opBlock.tagName.toLowerCase() === "div" &&
    opBlock.querySelector(".cm-editor")
  ) {
    return "codeblock";
  }
  if (opBlock.tagName.toLowerCase() === "p" && opBlock.querySelector("img")) {
    return "image";
  }
  switch (opBlock.tagName.toLowerCase()) {
    case "h1":
      return "h1";
    case "h2":
      return "h2";
    case "h3":
      return "h3";
    case "h4":
      return "h4";
    case "h5":
      return "h5";
    case "h6":
      return "h6";
    case "blockquote":
      return "quote";
    case "ul":
      return "bullet";
    case "ol":
      return "number";
    case "table":
      return "table";
    default:
      return "paragraph";
  }
}

function getBlockLabel(opBlock: Element): string {
  if (
    opBlock.tagName.toLowerCase() === "ul" &&
    opBlock.querySelector('input[type="checkbox"]')
  ) {
    return "Check List";
  }
  if (
    opBlock.tagName.toLowerCase() === "div" &&
    opBlock.querySelector(".cm-editor")
  ) {
    return "Code Block";
  }
  if (opBlock.tagName.toLowerCase() === "p" && opBlock.querySelector("img")) {
    return "Image";
  }
  switch (opBlock.tagName.toLowerCase()) {
    case "h1":
      return "Heading 1";
    case "h2":
      return "Heading 2";
    case "h3":
      return "Heading 3";
    case "h4":
      return "Heading 4";
    case "h5":
      return "Heading 5";
    case "h6":
      return "Heading 6";
    case "blockquote":
      return "Quote";
    case "ul":
      return "Bullet List";
    case "ol":
      return "Numbered List";
    case "table":
      return "Table";
    default:
      return "Paragraph";
  }
}

/** Returns the direct child of `root` that contains `target`. */
function getBlockElement(target: Element, root: Element): Element | null {
  let el: Element | null = target;
  while (el && el !== root) {
    if (el.parentElement === root) return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * For vertical positioning: if the operation block is a list, return the
 * specific <li> that contains `target`; otherwise return the block itself.
 */
function getPosElement(opBlock: Element, target: Element): Element {
  const tag = opBlock.tagName.toLowerCase();
  if (tag === "ul" || tag === "ol") {
    let el: Element | null = target;
    while (el && el !== opBlock) {
      if (el.tagName.toLowerCase() === "li") return el;
      el = el.parentElement;
    }
  }
  return opBlock;
}

type HandleState = {
  opBlock: Element;
  /** The <li> for lists, or opBlock itself. Used for selection and positioning. */
  posEl: Element;
  /** Rect used only for the vertical position of the handle. */
  posRect: DOMRect;
};

const TURN_INTO_ITEMS = [
  ["paragraph", "Paragraph"],
  ["h1", "Heading 1"],
  ["h2", "Heading 2"],
  ["h3", "Heading 3"],
  ["h4", "Heading 4"],
  ["h5", "Heading 5"],
  ["h6", "Heading 6"],
  ["quote", "Quote"],
  ["bullet", "Bullet List"],
  ["number", "Numbered List"],
  ["check", "Check List"],
  ["codeblock", "Code Block"],
  ["table", "Table"],
  ["image", "Image"],
  ["link", "Link"],
  ["", "Remove List"],
] as const;

const INSERT_ITEMS = [
  ["paragraph", "Paragraph"],
  ["h1", "Heading 1"],
  ["h2", "Heading 2"],
  ["h3", "Heading 3"],
  ["h4", "Heading 4"],
  ["h5", "Heading 5"],
  ["h6", "Heading 6"],
  ["quote", "Quote"],
  ["bullet", "Bullet List"],
  ["number", "Numbered List"],
  ["check", "Check List"],
  ["codeblock", "Code Block"],
  ["table", "Table"],
  ["image", "Image"],
  ["link", "Link"],
] as const;

function BlockHandleOverlay() {
  const [activeEditor] = useCellValues(activeEditor$);
  const activeEditorRef = useRef(activeEditor);
  useEffect(() => {
    activeEditorRef.current = activeEditor;
  }, [activeEditor]);

  const convertSelectionToNode = usePublisher(convertSelectionToNode$);
  const applyListType = usePublisher(applyListType$);
  const insertTable = usePublisher(insertTable$);
  const openNewImageDialog = usePublisher(openNewImageDialog$);
  const insertCodeBlock = usePublisher(insertCodeBlock$);
  const openLinkEditDialog = usePublisher(openLinkEditDialog$);

  // Separate hover and caret state so they don't fight each other.
  const [hoverState, setHoverState] = useState<HandleState | null>(null);
  const [caretState, setCaretState] = useState<HandleState | null>(null);

  const [popupOpen, setPopupOpen] = useState(false);
  const [popupAnchorRect, setPopupAnchorRect] = useState<DOMRect | null>(null);
  const clickedBlockRef = useRef<Element | null>(null);

  const [openSubmenu, setOpenSubmenu] = useState<"turn-into" | "insert" | null>(
    null,
  );
  const [submenuTriggerRect, setSubmenuTriggerRect] = useState<DOMRect | null>(
    null,
  );
  const submenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Hover tracking ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeEditor) return;
    const root = activeEditor.getRootElement();
    if (!root) return;

    const onMouseMove = (e: MouseEvent) => {
      if (popupOpen) return;
      const target = e.target as Element;
      const opBlock = getBlockElement(target, root);
      if (!opBlock) {
        setHoverState(null);
        return;
      }
      const posEl = getPosElement(opBlock, target);
      setHoverState({ opBlock, posEl, posRect: posEl.getBoundingClientRect() });
    };

    const onMouseLeave = () => {
      if (!popupOpen) setHoverState(null);
    };

    root.addEventListener("mousemove", onMouseMove);
    root.addEventListener("mouseleave", onMouseLeave);
    return () => {
      root.removeEventListener("mousemove", onMouseMove);
      root.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [activeEditor, popupOpen]);

  // Keep hover rect fresh on scroll.
  const hoverOpBlockRef = useRef<Element | null>(null);
  useEffect(() => {
    hoverOpBlockRef.current = hoverState?.opBlock ?? null;
  }, [hoverState]);

  useEffect(() => {
    if (!activeEditor || popupOpen) return;
    const scrollable = activeEditor.getRootElement()?.parentElement;
    if (!scrollable) return;
    const onScroll = () => {
      const opBlock = hoverOpBlockRef.current;
      if (!opBlock) return;
      setHoverState((prev) =>
        prev ? { ...prev, posRect: prev.posEl.getBoundingClientRect() } : null,
      );
    };
    scrollable.addEventListener("scroll", onScroll);
    return () => scrollable.removeEventListener("scroll", onScroll);
  }, [activeEditor, popupOpen]);

  // ── Caret tracking ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeEditor) return;

    return activeEditor.registerUpdateListener(() => {
      const root = activeEditor.getRootElement();
      if (!root) return;

      activeEditor.getEditorState().read(() => {
        const sel = $getSelection();
        if (!$isRangeSelection(sel)) {
          setCaretState(null);
          return;
        }

        const anchorNode = sel.anchor.getNode();
        // Walk up to the root-level block node.
        let opNode = anchorNode;
        while (opNode.getParent() && !$isRootOrShadowRoot(opNode.getParent())) {
          opNode = opNode.getParent()!;
        }

        const opDom = activeEditor.getElementByKey(opNode.getKey());
        if (!opDom) {
          setCaretState(null);
          return;
        }

        // For positioning inside lists, get the <li> that holds the anchor.
        const anchorDom = activeEditor.getElementByKey(anchorNode.getKey());
        const posEl = anchorDom ? getPosElement(opDom, anchorDom) : opDom;

        setCaretState({
          opBlock: opDom,
          posEl,
          posRect: posEl.getBoundingClientRect(),
        });
      });
    });
  }, [activeEditor]);

  // ── Resolved display state ──────────────────────────────────────────────────

  // Prefer hover over caret; suppress both while popup is open.
  const displayState = popupOpen ? null : (hoverState ?? caretState);

  // ── Submenu helpers ─────────────────────────────────────────────────────────

  const openSubmenuFor = useCallback(
    (name: "turn-into" | "insert", e: React.MouseEvent) => {
      if (submenuCloseTimer.current) clearTimeout(submenuCloseTimer.current);
      setOpenSubmenu(name);
      setSubmenuTriggerRect(
        (e.currentTarget as HTMLElement).getBoundingClientRect(),
      );
    },
    [],
  );

  const scheduleCloseSubmenu = useCallback(() => {
    submenuCloseTimer.current = setTimeout(() => setOpenSubmenu(null), 120);
  }, []);

  const cancelCloseSubmenu = useCallback(() => {
    if (submenuCloseTimer.current) clearTimeout(submenuCloseTimer.current);
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const openPopup = useCallback((e: React.MouseEvent, state: HandleState) => {
    e.preventDefault();
    clickedBlockRef.current = state.opBlock;
    setPopupAnchorRect(state.posRect);
    setHoverState(null);
    setPopupOpen(true);

    activeEditorRef.current?.update(() => {
      // Use posEl (the <li> for lists) so selection targets the correct item,
      // not the whole list which would default to the last item.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const node = $getNearestNodeFromDOMNode(
        state.posEl as HTMLElement,
      ) as any;
      node?.select?.();
    });
  }, []);

  const closePopup = useCallback(() => {
    setPopupOpen(false);
    setPopupAnchorRect(null);
    setOpenSubmenu(null);
    clickedBlockRef.current = null;
  }, []);

  const withBlock = useCallback(
    (fn: (block: Element) => void) => {
      const block = clickedBlockRef.current;
      if (block) fn(block);
      closePopup();
    },
    [closePopup],
  );

  const doTurnInto = useCallback(
    (type: string) => {
      if (
        type === "bullet" ||
        type === "number" ||
        type === "check" ||
        type === ""
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        applyListType(type as any);
      } else if (type === "paragraph") {
        convertSelectionToNode(() => $createParagraphNode());
      } else if (type === "quote") {
        convertSelectionToNode(() => $createQuoteNode());
      } else if (type === "codeblock") {
        convertSelectionToNode(() => $createParagraphNode());
        insertCodeBlock({});
      } else if (type === "table") {
        convertSelectionToNode(() => $createParagraphNode());
        insertTable({ rows: 3, columns: 3 });
      } else if (type === "image") {
        convertSelectionToNode(() => $createParagraphNode());
        openNewImageDialog(undefined);
      } else if (type === "link") {
        openLinkEditDialog(undefined);
      } else {
        convertSelectionToNode(() =>
          $createHeadingNode(type as HeadingTagType),
        );
      }
      closePopup();
    },
    [
      convertSelectionToNode,
      applyListType,
      insertCodeBlock,
      insertTable,
      openNewImageDialog,
      openLinkEditDialog,
      closePopup,
    ],
  );

  const doInsertBelowAs = useCallback(
    (type: string) => {
      const isList = type === "bullet" || type === "number" || type === "check";
      const needsParagraphFirst =
        isList ||
        type === "codeblock" ||
        type === "table" ||
        type === "image" ||
        type === "link";
      withBlock((block) => {
        activeEditorRef.current?.update(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const node = $getNearestNodeFromDOMNode(block as HTMLElement) as any;
          if (!node) return;
          let newNode;
          if (type === "quote") {
            newNode = $createQuoteNode();
          } else if (type === "paragraph" || needsParagraphFirst) {
            newNode = $createParagraphNode();
          } else {
            newNode = $createHeadingNode(type as HeadingTagType);
          }
          node.insertAfter(newNode);
          newNode.select();
        });
      });
      if (isList) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        applyListType(type as any);
      } else if (type === "codeblock") {
        insertCodeBlock({});
      } else if (type === "table") {
        insertTable({ rows: 3, columns: 3 });
      } else if (type === "image") {
        openNewImageDialog(undefined);
      } else if (type === "link") {
        openLinkEditDialog(undefined);
      }
    },
    [
      withBlock,
      applyListType,
      insertCodeBlock,
      insertTable,
      openNewImageDialog,
      openLinkEditDialog,
    ],
  );

  const doMoveUp = useCallback(() => {
    withBlock((block) => {
      activeEditorRef.current?.update(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = $getNearestNodeFromDOMNode(block as HTMLElement) as any;
        const prev = node?.getPreviousSibling?.();
        if (prev) prev.insertBefore(node);
      });
    });
  }, [withBlock]);

  const doMoveDown = useCallback(() => {
    withBlock((block) => {
      activeEditorRef.current?.update(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = $getNearestNodeFromDOMNode(block as HTMLElement) as any;
        const next = node?.getNextSibling?.();
        if (next) next.insertAfter(node);
      });
    });
  }, [withBlock]);

  const doDelete = useCallback(() => {
    withBlock((block) => {
      activeEditorRef.current?.update(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = $getNearestNodeFromDOMNode(block as HTMLElement) as any;
        node?.remove?.();
      });
    });
  }, [withBlock]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const rootLeft =
    activeEditor?.getRootElement()?.getBoundingClientRect().left ?? 0;
  const handleLeft = rootLeft + 8;

  const POPUP_MAX_HEIGHT = 300;
  const POPUP_MIN_WIDTH = 200;
  const popupTop = popupAnchorRect
    ? Math.max(
        8,
        Math.min(
          popupAnchorRect.top,
          window.innerHeight - POPUP_MAX_HEIGHT - 8,
        ),
      )
    : 0;
  const popupLeft = Math.min(
    handleLeft + 28,
    window.innerWidth - POPUP_MIN_WIDTH - 8,
  );

  const SUBMENU_MIN_WIDTH = 180;
  const submenuTop = submenuTriggerRect
    ? Math.max(
        8,
        Math.min(
          submenuTriggerRect.top,
          window.innerHeight - POPUP_MAX_HEIGHT - 8,
        ),
      )
    : 0;
  const submenuLeft = Math.min(
    popupLeft + POPUP_MIN_WIDTH + 4,
    window.innerWidth - SUBMENU_MIN_WIDTH - 8,
  );

  return (
    <>
      {/* Handle button */}
      {displayState && (
        <button
          className="block-handle-btn"
          style={{
            top:
              displayState.posRect.top + displayState.posRect.height / 2 - 12,
            left: handleLeft,
          }}
          onMouseDown={(e) => openPopup(e, displayState)}
          tabIndex={-1}
        >
          {getBlockIcon(displayState.opBlock)}
        </button>
      )}

      {/* Popup */}
      {popupOpen && popupAnchorRect && (
        <>
          <div className="block-handle-backdrop" onMouseDown={closePopup} />
          <div
            className="block-handle-popup"
            style={{
              top: popupTop,
              left: popupLeft,
              maxHeight: window.innerHeight - popupTop - 8,
            }}
          >
            {/* Turn into → submenu trigger */}
            <div className="block-popup-section">
              <button
                className="block-popup-item block-popup-item-submenu"
                onMouseEnter={(e) => openSubmenuFor("turn-into", e)}
                onMouseLeave={scheduleCloseSubmenu}
              >
                Turn into <span className="block-popup-arrow">›</span>
              </button>
            </div>

            {/* Direct insert same block type */}
            <div className="block-popup-section">
              <button
                className="block-popup-item"
                onMouseDown={() => {
                  const block = clickedBlockRef.current;
                  if (block) doInsertBelowAs(getBlockType(block));
                }}
                onMouseEnter={scheduleCloseSubmenu}
              >
                Insert{" "}
                {clickedBlockRef.current
                  ? getBlockLabel(clickedBlockRef.current)
                  : "Block"}
              </button>
            </div>

            {/* Insert other type → submenu trigger */}
            <div className="block-popup-section">
              <button
                className="block-popup-item block-popup-item-submenu"
                onMouseEnter={(e) => openSubmenuFor("insert", e)}
                onMouseLeave={scheduleCloseSubmenu}
              >
                Insert <span className="block-popup-arrow">›</span>
              </button>
            </div>

            {/* Move / Delete */}
            <div className="block-popup-section">
              <button
                className="block-popup-item"
                onMouseDown={doMoveUp}
                onMouseEnter={scheduleCloseSubmenu}
              >
                Move Up
              </button>
              <button
                className="block-popup-item"
                onMouseDown={doMoveDown}
                onMouseEnter={scheduleCloseSubmenu}
              >
                Move Down
              </button>
            </div>
            <div className="block-popup-section">
              <button
                className="block-popup-item block-popup-item-danger"
                onMouseDown={doDelete}
                onMouseEnter={scheduleCloseSubmenu}
              >
                Delete Block
              </button>
            </div>
          </div>

          {/* Submenus */}
          {openSubmenu && submenuTriggerRect && (
            <div
              className="block-handle-popup block-popup-submenu"
              style={{
                top: submenuTop,
                left: submenuLeft,
                maxHeight: window.innerHeight - submenuTop - 8,
              }}
              onMouseEnter={cancelCloseSubmenu}
              onMouseLeave={scheduleCloseSubmenu}
            >
              {openSubmenu === "turn-into" &&
                TURN_INTO_ITEMS.map(([type, label]) => (
                  <button
                    key={type === "" ? "remove-list" : type}
                    className="block-popup-item"
                    onMouseDown={() => doTurnInto(type)}
                  >
                    {label}
                  </button>
                ))}
              {openSubmenu === "insert" &&
                INSERT_ITEMS.map(([type, label]) => (
                  <button
                    key={type}
                    className="block-popup-item"
                    onMouseDown={() => doInsertBelowAs(type)}
                  >
                    {label}
                  </button>
                ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export const blockHandlePlugin = realmPlugin({
  init(realm) {
    realm.pub(addComposerChild$, BlockHandleOverlay);
  },
});
