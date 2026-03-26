import type { EditorStateSnapshot } from "./types";

export type BlockMenuItemKind = "add" | "change" | "topLevel";

export type BlockMenuItemKey =
  | "add:paragraph"
  | "add:h1"
  | "add:h2"
  | "add:h3"
  | "add:h4"
  | "add:h5"
  | "add:h6"
  | "add:quote"
  | "add:bulletList"
  | "add:orderedList"
  | "add:checklist"
  | "add:codeBlock"
  | "add:table"
  | "add:image"
  | "add:thematicBreak"
  | "change:paragraph"
  | "change:h1"
  | "change:h2"
  | "change:h3"
  | "change:h4"
  | "change:h5"
  | "change:h6"
  | "change:quote"
  | "change:bulletList"
  | "change:orderedList"
  | "change:checklist"
  | "change:removeList"
  | "change:codeBlock"
  | "manage:insertBelow"
  | "manage:moveUp"
  | "manage:moveDown"
  | "manage:delete";

export interface BlockMenuItem {
  key: BlockMenuItemKey;
  kind: BlockMenuItemKind;
  label: string;
  active?: boolean;
  danger?: boolean;
}

export interface BlockMenuModel {
  addItems: BlockMenuItem[];
  changeItems: BlockMenuItem[];
  topLevelItems: BlockMenuItem[];
}

export function buildBlockMenuModel(
  activeState: EditorStateSnapshot,
): BlockMenuModel {
  return {
    addItems: [
      { key: "add:paragraph", kind: "add", label: "Paragraph" },
      { key: "add:h1", kind: "add", label: "Heading 1" },
      { key: "add:h2", kind: "add", label: "Heading 2" },
      { key: "add:h3", kind: "add", label: "Heading 3" },
      { key: "add:h4", kind: "add", label: "Heading 4" },
      { key: "add:h5", kind: "add", label: "Heading 5" },
      { key: "add:h6", kind: "add", label: "Heading 6" },
      { key: "add:quote", kind: "add", label: "Quote" },
      { key: "add:bulletList", kind: "add", label: "Bullet List" },
      { key: "add:orderedList", kind: "add", label: "Ordered List" },
      { key: "add:checklist", kind: "add", label: "Checklist" },
      { key: "add:codeBlock", kind: "add", label: "Code Block" },
      { key: "add:table", kind: "add", label: "Table" },
      { key: "add:image", kind: "add", label: "Image" },
      { key: "add:thematicBreak", kind: "add", label: "Thematic Break" },
    ],
    changeItems: [
      {
        key: "change:paragraph",
        kind: "change",
        label: "Paragraph",
        active: activeState.blockType === "paragraph" && !activeState.listType,
      },
      {
        key: "change:h1",
        kind: "change",
        label: "Heading 1",
        active: activeState.blockType === "h1",
      },
      {
        key: "change:h2",
        kind: "change",
        label: "Heading 2",
        active: activeState.blockType === "h2",
      },
      {
        key: "change:h3",
        kind: "change",
        label: "Heading 3",
        active: activeState.blockType === "h3",
      },
      {
        key: "change:h4",
        kind: "change",
        label: "Heading 4",
        active: activeState.blockType === "h4",
      },
      {
        key: "change:h5",
        kind: "change",
        label: "Heading 5",
        active: activeState.blockType === "h5",
      },
      {
        key: "change:h6",
        kind: "change",
        label: "Heading 6",
        active: activeState.blockType === "h6",
      },
      {
        key: "change:quote",
        kind: "change",
        label: "Quote",
        active: activeState.blockType === "quote",
      },
      {
        key: "change:bulletList",
        kind: "change",
        label: "Bullet List",
        active: activeState.listType === "bullet",
      },
      {
        key: "change:orderedList",
        kind: "change",
        label: "Ordered List",
        active: activeState.listType === "number",
      },
      {
        key: "change:checklist",
        kind: "change",
        label: "Checklist",
        active: activeState.listType === "check",
      },
      {
        key: "change:removeList",
        kind: "change",
        label: "Remove List",
      },
      {
        key: "change:codeBlock",
        kind: "change",
        label: "Code Block",
        active: activeState.blockType === "codeblock",
      },
    ],
    topLevelItems: [
      {
        key: "manage:insertBelow",
        kind: "topLevel",
        label: "Insert Below",
      },
      { key: "manage:moveUp", kind: "topLevel", label: "Move Up" },
      { key: "manage:moveDown", kind: "topLevel", label: "Move Down" },
      {
        key: "manage:delete",
        kind: "topLevel",
        label: "Delete Block",
        danger: true,
      },
    ],
  };
}
