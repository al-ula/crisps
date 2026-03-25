import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import {
  NodeSelection,
  TextSelection,
  type EditorState,
} from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";

const EXCLUDED_BLOCK_TYPES = new Set([
  "doc",
  "table_row",
  "table_cell",
  "table_header",
]);

export interface ActiveBlock {
  depth: number;
  index: number;
  node: ProseNode;
  parent: ProseNode;
  pos: number;
}

export function findActiveBlock(state: EditorState): ActiveBlock | null {
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (!node.isBlock || EXCLUDED_BLOCK_TYPES.has(node.type.name)) {
      continue;
    }

    const parent = $from.node(depth - 1);
    return {
      depth,
      index: $from.index(depth - 1),
      node,
      parent,
      pos: depth === 1 ? $from.before(1) : $from.before(depth),
    };
  }

  return null;
}

export function getActiveBlockElement(
  view: EditorView,
  block: ActiveBlock | null,
): HTMLElement | null {
  if (!block) return null;
  const dom = view.nodeDOM(block.pos);
  return dom instanceof HTMLElement ? dom : null;
}

export function insertParagraphBelow(
  view: EditorView,
  block = findActiveBlock(view.state),
): boolean {
  if (!block) return false;

  const paragraph = view.state.schema.nodes.paragraph?.create();
  if (!paragraph) return false;

  const insertPos = block.pos + block.node.nodeSize;
  const next = view.state.tr.insert(insertPos, paragraph);
  view.dispatch(
    next.setSelection(TextSelection.create(next.doc, insertPos + 1)).scrollIntoView(),
  );
  return true;
}

export function deleteActiveBlock(
  view: EditorView,
  block = findActiveBlock(view.state),
): boolean {
  if (!block) return false;

  const from = block.pos;
  const to = from + block.node.nodeSize;
  let next = view.state.tr.delete(from, to);

  if (next.doc.childCount === 0) {
    const paragraph = view.state.schema.nodes.paragraph?.create();
    if (!paragraph) return false;
    next = next.insert(0, paragraph);
    view.dispatch(
      next.setSelection(TextSelection.create(next.doc, 1)).scrollIntoView(),
    );
    return true;
  }

  const selectionPos = Math.max(1, Math.min(from, next.doc.content.size));
  view.dispatch(
    next.setSelection(TextSelection.create(next.doc, selectionPos)).scrollIntoView(),
  );
  return true;
}

export function moveActiveBlock(
  view: EditorView,
  direction: "up" | "down",
  block = findActiveBlock(view.state),
): boolean {
  if (!block) return false;

  const siblingIndex = direction === "up" ? block.index - 1 : block.index + 1;
  if (siblingIndex < 0 || siblingIndex >= block.parent.childCount) {
    return false;
  }

  const sibling = block.parent.child(siblingIndex);
  const currentSize = block.node.nodeSize;
  const siblingPos =
    direction === "up" ? block.pos - sibling.nodeSize : block.pos + currentSize;

  let next = view.state.tr.delete(block.pos, block.pos + currentSize);
  const insertPos =
    direction === "up" ? siblingPos : block.pos + sibling.nodeSize;
  next = next.insert(insertPos, block.node);
  view.dispatch(selectMovedBlock(next, insertPos, block.node).scrollIntoView());
  return true;
}

function selectMovedBlock(
  tr: EditorState["tr"],
  pos: number,
  node: ProseNode,
) {
  if (node.isTextblock) {
    return tr.setSelection(TextSelection.create(tr.doc, pos + 1));
  }

  return tr.setSelection(NodeSelection.create(tr.doc, pos));
}
