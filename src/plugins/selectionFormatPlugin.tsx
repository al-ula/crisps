import { useState, useEffect, useCallback } from "react";
import {
  realmPlugin,
  addComposerChild$,
  activeEditor$,
  applyFormat$,
  convertSelectionToNode$,
  currentFormat$,
  currentBlockType$,
  insertCodeBlock$,
  insertTable$,
  openLinkEditDialog$,
} from "@mdxeditor/editor";
import { useCellValues, usePublisher } from "@mdxeditor/editor";
import { $getSelection, $isRangeSelection, IS_BOLD, IS_ITALIC, IS_UNDERLINE, IS_STRIKETHROUGH, IS_CODE, IS_SUBSCRIPT, IS_SUPERSCRIPT, $createParagraphNode } from "lexical";
import { $createHeadingNode, $createQuoteNode, type HeadingTagType } from "@lexical/rich-text";

const POPUP_W = 240;
const POPUP_H = 64;

type PopupPos = { top: number; left: number };

function SelectionFormatOverlay() {
  const [activeEditor, currentFormat, currentBlockType] =
    useCellValues(activeEditor$, currentFormat$, currentBlockType$);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFormat = usePublisher(applyFormat$) as (fmt: any) => void;
  const convertSelectionToNode = usePublisher(convertSelectionToNode$);
  const insertCodeBlock = usePublisher(insertCodeBlock$);
  const insertTable = usePublisher(insertTable$);
  const openLinkEditDialog = usePublisher(openLinkEditDialog$);

  const [pos, setPos] = useState<PopupPos | null>(null);

  useEffect(() => {
    if (!activeEditor) return;
    return activeEditor.registerUpdateListener(() => {
      activeEditor.getEditorState().read(() => {
        const sel = $getSelection();
        if (!$isRangeSelection(sel) || sel.isCollapsed()) {
          setPos(null);
          return;
        }
        const domSel = window.getSelection();
        if (!domSel || domSel.rangeCount === 0) {
          setPos(null);
          return;
        }
        const rect = domSel.getRangeAt(0).getBoundingClientRect();
        if (!rect.width) {
          setPos(null);
          return;
        }
        let left = rect.left + rect.width / 2 - POPUP_W / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - POPUP_W - 8));
        let top = rect.top - POPUP_H - 8;
        if (top < 8) top = rect.bottom + 8;

        setPos({ top, left });
      });
    });
  }, [activeEditor]);

  const doBlockType = useCallback(
    (type: string) => {
      if (type === "paragraph")   convertSelectionToNode(() => $createParagraphNode());
      else if (type === "quote")     convertSelectionToNode(() => $createQuoteNode());
      else if (type === "codeblock") { convertSelectionToNode(() => $createParagraphNode()); insertCodeBlock({}); }
      else if (type === "table")     { convertSelectionToNode(() => $createParagraphNode()); insertTable({ rows: 3, columns: 3 }); }
      else if (type === "link")      openLinkEditDialog(undefined);
      else convertSelectionToNode(() => $createHeadingNode(type as HeadingTagType));
    },
    [convertSelectionToNode, insertCodeBlock, insertTable, openLinkEditDialog],
  );

  if (!pos) return null;

  const bold          = (currentFormat & IS_BOLD)          !== 0;
  const italic        = (currentFormat & IS_ITALIC)        !== 0;
  const underline     = (currentFormat & IS_UNDERLINE)     !== 0;
  const strikethrough = (currentFormat & IS_STRIKETHROUGH) !== 0;
  const code          = (currentFormat & IS_CODE)          !== 0;
  const subscript     = (currentFormat & IS_SUBSCRIPT)     !== 0;
  const superscript   = (currentFormat & IS_SUPERSCRIPT)   !== 0;

  const fmt = (key: string, active: boolean, label: React.ReactNode) => (
    <button
      key={key}
      className={`selection-format-btn${active ? " active" : ""}`}
      onMouseDown={(e) => { e.preventDefault(); applyFormat(key); }}
      aria-label={key}
    >
      {label}
    </button>
  );

  return (
    <div className="selection-format-popup" style={{ top: pos.top, left: pos.left }}>
      <div className="selection-format-row">
        <select
          className="selection-format-select"
          value={currentBlockType ?? "paragraph"}
          aria-label="Block type"
          onChange={(e) => doBlockType(e.target.value)}
        >
          <option value="paragraph">¶ Paragraph</option>
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
          <option value="h4">H4</option>
          <option value="h5">H5</option>
          <option value="h6">H6</option>
          <option value="quote">❝ Quote</option>
          <option value="codeblock">⌥ Code</option>
          <option value="table">⊞ Table</option>
          <option value="link">🔗 Link</option>
        </select>
      </div>
      <div className="selection-format-row">
        {fmt("bold",          bold,          <b>B</b>)}
        {fmt("italic",        italic,        <i>I</i>)}
        {fmt("underline",     underline,     <u>U</u>)}
        {fmt("strikethrough", strikethrough, <s>S</s>)}
        {fmt("code",          code,          <code>`</code>)}
        {fmt("subscript",     subscript,     <sub>x</sub>)}
        {fmt("superscript",   superscript,   <sup>x</sup>)}
      </div>
    </div>
  );
}

export const selectionFormatPlugin = realmPlugin({
  init(realm) {
    realm.pub(addComposerChild$, SelectionFormatOverlay);
  },
});
