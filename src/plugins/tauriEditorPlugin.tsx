import { useEffect, useRef, useState } from "react";
import {
  realmPlugin,
  addComposerChild$,
  activeEditor$,
  applyFormat$,
  applyListType$,
  convertSelectionToNode$,
  insertThematicBreak$,
  insertCodeBlock$,
  insertTable$,
  openLinkEditDialog$,
  openNewImageDialog$,
  currentFormat$,
  currentBlockType$,
  currentListType$,
  inFocus$,
  insertFrontmatter$,
} from "@mdxeditor/editor";
import { useCellValues, usePublisher } from "@mdxeditor/editor";
import { listen, emit, type UnlistenFn } from "@tauri-apps/api/event";
import {
  UNDO_COMMAND,
  REDO_COMMAND,
  CAN_UNDO_COMMAND,
  CAN_REDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  IS_BOLD,
  IS_ITALIC,
  IS_UNDERLINE,
  IS_STRIKETHROUGH,
  IS_CODE,
} from "lexical";
import {
  $createHeadingNode,
  $createQuoteNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import { $createParagraphNode } from "lexical";

type EditorActionPayload = {
  action: string;
  blockType?: "paragraph" | "quote" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  rows?: number;
  columns?: number;
};

function TauriEditorBridge() {
  const [
    activeEditor,
    currentFormat,
    currentBlockType,
    currentListType,
    focused,
  ] = useCellValues(
    activeEditor$,
    currentFormat$,
    currentBlockType$,
    currentListType$,
    inFocus$,
  );

  const activeEditorRef = useRef(activeEditor);
  useEffect(() => {
    activeEditorRef.current = activeEditor;
  }, [activeEditor]);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (!activeEditor) return;
    const unregisterUndo = activeEditor.registerCommand(
      CAN_UNDO_COMMAND,
      (payload) => {
        setCanUndo(payload);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
    const unregisterRedo = activeEditor.registerCommand(
      CAN_REDO_COMMAND,
      (payload) => {
        setCanRedo(payload);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
    return () => {
      unregisterUndo();
      unregisterRedo();
    };
  }, [activeEditor]);

  const applyFormat = usePublisher(applyFormat$);
  const applyListType = usePublisher(applyListType$);
  const convertSelectionToNode = usePublisher(convertSelectionToNode$);
  const publishInsertThematicBreak = usePublisher(insertThematicBreak$);
  const publishInsertCodeBlock = usePublisher(insertCodeBlock$);
  const publishInsertTable = usePublisher(insertTable$);
  const publishOpenLinkEditDialog = usePublisher(openLinkEditDialog$);
  const publishOpenNewImageDialog = usePublisher(openNewImageDialog$);
  const publishInsertFrontmatter = usePublisher(insertFrontmatter$);

  // Emit editor state whenever it changes
  useEffect(() => {
    emit("editor-state", {
      bold: (currentFormat & IS_BOLD) !== 0,
      italic: (currentFormat & IS_ITALIC) !== 0,
      underline: (currentFormat & IS_UNDERLINE) !== 0,
      strikethrough: (currentFormat & IS_STRIKETHROUGH) !== 0,
      code: (currentFormat & IS_CODE) !== 0,
      blockType: currentBlockType,
      listType: currentListType,
      focused,
      canUndo,
      canRedo,
    });
  }, [
    currentFormat,
    currentBlockType,
    currentListType,
    focused,
    canUndo,
    canRedo,
  ]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: UnlistenFn | undefined;

    listen<EditorActionPayload>("editor-action", (event) => {
      const editor = activeEditorRef.current;
      const {
        action,
        block_type: blockType,
        rows,
        columns,
      } = event.payload as {
        action: string;
        block_type?: string;
        rows?: number;
        columns?: number;
      };

      switch (action) {
        case "undo":
          editor?.dispatchCommand(UNDO_COMMAND, void 0);
          break;
        case "redo":
          editor?.dispatchCommand(REDO_COMMAND, void 0);
          break;
        case "bold":
        case "italic":
        case "underline":
        case "strikethrough":
        case "subscript":
        case "superscript":
        case "code":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          applyFormat(action as any);
          break;
        case "bulletList":
          applyListType("bullet");
          break;
        case "orderedList":
          applyListType("number");
          break;
        case "checklist":
          applyListType("check");
          break;
        case "removeList":
          applyListType("");
          break;
        case "blockType":
          if (!blockType) break;
          if (blockType === "paragraph") {
            convertSelectionToNode(() => $createParagraphNode());
          } else if (blockType === "quote") {
            convertSelectionToNode(() => $createQuoteNode());
          } else {
            convertSelectionToNode(() =>
              $createHeadingNode(blockType as HeadingTagType),
            );
          }
          break;
        case "createLink":
          publishOpenLinkEditDialog(void 0);
          break;
        case "insertImage":
          publishOpenNewImageDialog(void 0);
          break;
        case "insertTable":
          publishInsertTable({ rows: rows ?? 3, columns: columns ?? 3 });
          break;
        case "insertThematicBreak":
          publishInsertThematicBreak(void 0);
          break;
        case "insertCodeBlock":
          publishInsertCodeBlock({});
          break;
        case "insertFrontmatter":
          publishInsertFrontmatter(void 0);
          break;
      }
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export const tauriEditorPlugin = realmPlugin({
  init(realm) {
    realm.pub(addComposerChild$, TauriEditorBridge);
  },
});
