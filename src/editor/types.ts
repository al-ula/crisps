export type EditorBlockType =
  | "paragraph"
  | "quote"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6";

export type EditorActionName =
  | "undo"
  | "redo"
  | "bold"
  | "italic"
  | "strikethrough"
  | "latex"
  | "subscript"
  | "superscript"
  | "code"
  | "bulletList"
  | "orderedList"
  | "checklist"
  | "removeList"
  | "blockType"
  | "createLink"
  | "insertImage"
  | "insertTable"
  | "insertThematicBreak"
  | "insertCodeBlock"
  | "insertFrontmatter";

export interface EditorAction {
  action: EditorActionName;
  blockType?: EditorBlockType;
  rows?: number;
  columns?: number;
}

export interface EditorStateSnapshot {
  canUndo: boolean;
  canRedo: boolean;
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  latex: boolean;
  code: boolean;
  blockType: string;
  listType: string;
  focused: boolean;
}

export interface EditorAdapter {
  setMarkdown: (markdown: string) => void;
  getMarkdown: () => string;
  focus: () => void;
  runAction: (action: EditorAction) => Promise<void>;
  subscribeState: (
    listener: (state: EditorStateSnapshot) => void,
  ) => Promise<() => void>;
}

export const EMPTY_EDITOR_STATE: EditorStateSnapshot = {
  canUndo: false,
  canRedo: false,
  bold: false,
  italic: false,
  strikethrough: false,
  latex: false,
  code: false,
  blockType: "paragraph",
  listType: "",
  focused: false,
};
