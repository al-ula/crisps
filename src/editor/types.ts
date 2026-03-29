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

export type SourceEditorAction = "undo" | "redo";

export interface SourceEditorStateSnapshot {
  canUndo: boolean;
  canRedo: boolean;
  focused: boolean;
}

export interface SourceEditorController {
  focus: () => void;
  getSelectedText: () => string;
  deleteSelection: () => void;
  runAction: (action: SourceEditorAction) => void;
}

export interface EditorAdapter {
  setMarkdown: (markdown: string) => void;
  getMarkdown: () => string;
  getSelectedText: () => string;
  deleteSelection: () => void;
  copySelection: () => Promise<boolean>;
  cutSelection: () => Promise<boolean>;
  focus: () => void;
  scrollToHeading?: (headingId: string) => boolean;
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

export const EMPTY_SOURCE_EDITOR_STATE: SourceEditorStateSnapshot = {
  canUndo: false,
  canRedo: false,
  focused: false,
};
