import type { EditorStateSnapshot } from "./types";

export type BlockMenuItemKind = "add" | "change" | "topLevel";

export type BlockMenuIcon =
  | { type: "text"; value: string }
  | { type: "svg"; name: "table" | "image" | "trash" };

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
  icon: BlockMenuIcon;
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
      {
        key: "add:paragraph",
        kind: "add",
        label: "Paragraph",
        icon: { type: "text", value: "¶" },
      },
      {
        key: "add:h1",
        kind: "add",
        label: "Heading 1",
        icon: { type: "text", value: "H1" },
      },
      {
        key: "add:h2",
        kind: "add",
        label: "Heading 2",
        icon: { type: "text", value: "H2" },
      },
      {
        key: "add:h3",
        kind: "add",
        label: "Heading 3",
        icon: { type: "text", value: "H3" },
      },
      {
        key: "add:h4",
        kind: "add",
        label: "Heading 4",
        icon: { type: "text", value: "H4" },
      },
      {
        key: "add:h5",
        kind: "add",
        label: "Heading 5",
        icon: { type: "text", value: "H5" },
      },
      {
        key: "add:h6",
        kind: "add",
        label: "Heading 6",
        icon: { type: "text", value: "H6" },
      },
      {
        key: "add:quote",
        kind: "add",
        label: "Quote",
        icon: { type: "text", value: "\"" },
      },
      {
        key: "add:bulletList",
        kind: "add",
        label: "Bullet List",
        icon: { type: "text", value: "•" },
      },
      {
        key: "add:orderedList",
        kind: "add",
        label: "Ordered List",
        icon: { type: "text", value: "1." },
      },
      {
        key: "add:checklist",
        kind: "add",
        label: "Checklist",
        icon: { type: "text", value: "[]" },
      },
      {
        key: "add:codeBlock",
        kind: "add",
        label: "Code Block",
        icon: { type: "text", value: "</>" },
      },
      {
        key: "add:table",
        kind: "add",
        label: "Table",
        icon: { type: "svg", name: "table" },
      },
      {
        key: "add:image",
        kind: "add",
        label: "Image",
        icon: { type: "svg", name: "image" },
      },
      {
        key: "add:thematicBreak",
        kind: "add",
        label: "Thematic Break",
        icon: { type: "text", value: "—" },
      },
    ],
    changeItems: [
      {
        key: "change:paragraph",
        kind: "change",
        label: "Paragraph",
        icon: { type: "text", value: "¶" },
        active: activeState.blockType === "paragraph" && !activeState.listType,
      },
      {
        key: "change:h1",
        kind: "change",
        label: "Heading 1",
        icon: { type: "text", value: "H1" },
        active: activeState.blockType === "h1",
      },
      {
        key: "change:h2",
        kind: "change",
        label: "Heading 2",
        icon: { type: "text", value: "H2" },
        active: activeState.blockType === "h2",
      },
      {
        key: "change:h3",
        kind: "change",
        label: "Heading 3",
        icon: { type: "text", value: "H3" },
        active: activeState.blockType === "h3",
      },
      {
        key: "change:h4",
        kind: "change",
        label: "Heading 4",
        icon: { type: "text", value: "H4" },
        active: activeState.blockType === "h4",
      },
      {
        key: "change:h5",
        kind: "change",
        label: "Heading 5",
        icon: { type: "text", value: "H5" },
        active: activeState.blockType === "h5",
      },
      {
        key: "change:h6",
        kind: "change",
        label: "Heading 6",
        icon: { type: "text", value: "H6" },
        active: activeState.blockType === "h6",
      },
      {
        key: "change:quote",
        kind: "change",
        label: "Quote",
        icon: { type: "text", value: "\"" },
        active: activeState.blockType === "quote",
      },
      {
        key: "change:bulletList",
        kind: "change",
        label: "Bullet List",
        icon: { type: "text", value: "•" },
        active: activeState.listType === "bullet",
      },
      {
        key: "change:orderedList",
        kind: "change",
        label: "Ordered List",
        icon: { type: "text", value: "1." },
        active: activeState.listType === "number",
      },
      {
        key: "change:checklist",
        kind: "change",
        label: "Checklist",
        icon: { type: "text", value: "[]" },
        active: activeState.listType === "check",
      },
      {
        key: "change:removeList",
        kind: "change",
        label: "Remove List",
        icon: { type: "text", value: "×" },
      },
      {
        key: "change:codeBlock",
        kind: "change",
        label: "Code Block",
        icon: { type: "text", value: "</>" },
        active: activeState.blockType === "codeblock",
      },
    ],
    topLevelItems: [
      {
        key: "manage:insertBelow",
        kind: "topLevel",
        label: "Insert Below",
        icon: { type: "text", value: "+" },
      },
      {
        key: "manage:moveUp",
        kind: "topLevel",
        label: "Move Up",
        icon: { type: "text", value: "↑" },
      },
      {
        key: "manage:moveDown",
        kind: "topLevel",
        label: "Move Down",
        icon: { type: "text", value: "↓" },
      },
      {
        key: "manage:delete",
        kind: "topLevel",
        label: "Delete Block",
        icon: { type: "svg", name: "trash" },
        danger: true,
      },
    ],
  };
}
