import type { CSSProperties } from "react";
import {
  Fragment,
  type NodeType,
  type Node as ProseNode,
} from "@milkdown/kit/prose/model";
import {
  NodeSelection,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";

const EXCLUDED_BLOCK_TYPES = new Set([
  "doc",
  "bullet_list",
  "ordered_list",
  "table_row",
  "table_cell",
  "table_header",
  "math_inline",
]);

const CONTAINER_BLOCK_TYPES = new Set(["blockquote", "list_item"]);
const LIST_TYPES = new Set(["bullet_list", "ordered_list"]);
const DROP_INSIDE_TYPES = new Set(["blockquote", "list_item"]);
const SIDE_CONTROL_WIDTH = 56;
const SIDE_CONTROL_GAP = 6;

export type BlockPlacement = "before" | "inside" | "after";

export interface ActiveBlock {
  depth: number;
  index: number;
  node: ProseNode;
  parent: ProseNode;
  pos: number;
  typeName: string;
}

export interface BlockDropTarget {
  block: ActiveBlock;
  element: HTMLElement;
  placement: BlockPlacement;
}

export interface BlockTarget {
  block: ActiveBlock;
  element: HTMLElement;
}

export function resolveBlockFromSelection(state: EditorState): ActiveBlock | null {
  return resolveBlockAtPos(state, state.selection.$from.pos);
}

export function resolveBlockAtPos(
  state: EditorState,
  pos: number,
): ActiveBlock | null {
  const leafBlock = resolveLeafBlockAtDocPos(state, pos);
  if (leafBlock) return leafBlock;
  return resolveBlockAtDocPos(state.doc, pos);
}

function resolveBlockAtDocPos(doc: ProseNode, pos: number): ActiveBlock | null {
  const bounded = Math.max(0, Math.min(pos, doc.content.size));
  const $pos = doc.resolve(bounded);

  if (hasContext($pos, "math_inline")) {
    return null;
  }

  const tableDepth = findDepth($pos, "table");
  if (tableDepth > 0) {
    return buildActiveBlock($pos, tableDepth);
  }

  const quoteDepth = findDepth($pos, "blockquote");
  if (quoteDepth > 0) {
    return buildActiveBlock($pos, quoteDepth);
  }

  const listItemDepth = findDepth($pos, "list_item");
  if (listItemDepth > 0) {
    return buildActiveBlock($pos, listItemDepth);
  }

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (!node.isBlock || EXCLUDED_BLOCK_TYPES.has(node.type.name)) continue;
    return buildActiveBlock($pos, depth);
  }

  return null;
}

export function findActiveBlock(state: EditorState): ActiveBlock | null {
  return resolveBlockFromSelection(state);
}

export function findBlockAtCoords(
  view: EditorView,
  coords: { left: number; top: number },
): ActiveBlock | null {
  const rect = view.dom.getBoundingClientRect();
  const probePoints = [
    Math.max(rect.left + 24, Math.min(coords.left, rect.right - 24)),
    rect.left + rect.width / 2,
    rect.left + 48,
    rect.left + 96,
  ];

  for (const left of probePoints) {
    const result = view.posAtCoords({ left, top: coords.top });
    const pos = result?.inside ?? result?.pos;
    if (pos == null || pos < 0) continue;

    const block = resolveBlockAtPos(view.state, pos);
    if (block) return block;
  }

  return null;
}

export function findBlockTargetAtCoords(
  view: EditorView,
  coords: { left: number; top: number },
): BlockTarget | null {
  const pointElements = document.elementsFromPoint(coords.left, coords.top);
  for (const pointElement of pointElements) {
    const byDom = findBlockTargetFromElement(view, pointElement);
    if (byDom) return byDom;
  }

  const block = findBlockAtCoords(view, coords);
  if (!block) return null;
  const element = getActiveBlockElement(view, block);
  return element ? { block, element } : null;
}

export function findBlockFromDom(
  view: EditorView,
  target: EventTarget | null,
): ActiveBlock | null {
  if (!(target instanceof Node)) return null;

  if (target instanceof Element) {
    const quoteElement = target.closest("blockquote");
    if (quoteElement instanceof HTMLElement) {
      const quoteBlock = resolveBlockAroundDom(view, quoteElement);
      if (quoteBlock?.typeName === "blockquote") {
        return quoteBlock;
      }
    }

    const thematicBreakElement = target.closest("hr");
    if (thematicBreakElement instanceof HTMLElement) {
      const thematicBreakBlock = resolveBlockAroundDom(view, thematicBreakElement);
      if (thematicBreakBlock?.typeName === "horizontal_rule") {
        return thematicBreakBlock;
      }
    }
  }

  let current: Node | null = target;
  while (current && current !== view.dom) {
    if (current instanceof HTMLElement) {
      const listItemBlock = current.closest(".milkdown-list-item-block");
      if (listItemBlock instanceof HTMLElement) {
        const block = resolveBlockAroundDom(view, listItemBlock);
        if (block?.typeName === "list_item") {
          return block;
        }
      }

      const leafBlockElement = current.matches(".milkdown-image-block, [data-type=\"image-block\"], hr")
        ? current
        : current.closest(".milkdown-image-block, [data-type=\"image-block\"], hr");
      if (leafBlockElement instanceof HTMLElement) {
        const block = resolveBlockAroundDom(view, leafBlockElement);
        if (block) return block;
      }

      const byRect = findBlockInsideElement(view, current);
      if (byRect) return byRect;

      const block = resolveBlockAroundDom(view, current);
      if (block) return block;
    }

    current = current.parentNode;
  }

  return null;
}

export function getActiveBlockElement(
  view: EditorView,
  block: ActiveBlock | null,
): HTMLElement | null {
  if (!block) return null;

  const resolvedElement = findResolvedBlockElement(view, block);
  if (resolvedElement) {
    return resolvedElement;
  }

  const dom = view.nodeDOM(block.pos);
  if (dom instanceof HTMLElement) {
    return dom;
  }

  const selection = document.getSelection();
  const anchorNode = selection?.anchorNode;
  return findElementForBlock(view, block, anchorNode);
}

export function getBlockControlPosition(
  view: EditorView,
  block: ActiveBlock | null,
): CSSProperties {
  const element = getActiveBlockElement(view, block);
  if (!element) return {};

  const rect = element.getBoundingClientRect();
  const editorRect = view.dom.getBoundingClientRect();
  const left = Math.max(
    8,
    Math.min(editorRect.left - SIDE_CONTROL_WIDTH - SIDE_CONTROL_GAP, window.innerWidth - 8),
  );
  const top = Math.max(48, Math.min(rect.top, window.innerHeight - 40));
  return { left, top };
}

export function getDropIndicatorStyle(
  _view: EditorView,
  target: BlockDropTarget | null,
): CSSProperties | null {
  if (!target) return null;

  const rect = target.element.getBoundingClientRect();
  if (target.placement === "inside") {
    return {
      left: rect.left - 2,
      top: rect.top - 2,
      width: rect.width + 4,
      height: rect.height + 4,
    };
  }

  return {
    left: rect.left,
    top: target.placement === "before" ? rect.top - 1 : rect.bottom - 1,
    width: rect.width,
    height: 2,
  };
}

export function resolveDropTargetAtCoords(
  view: EditorView,
  coords: { left: number; top: number },
  source: ActiveBlock | null,
): BlockDropTarget | null {
  const target = findBlockTargetAtCoords(view, coords);
  if (!target || !source) return null;
  if (target.block.pos === source.pos) return null;
  if (isBlockWithin(source, target.block)) return null;

  const rect = target.element.getBoundingClientRect();
  const relativeY = coords.top - rect.top;
  const insideThreshold = Math.min(16, rect.height * 0.28);
  const canDropInside =
    DROP_INSIDE_TYPES.has(target.block.typeName) &&
    !wouldCreateInvalidInsideTarget(source, target.block);

  if (canDropInside && relativeY > insideThreshold && relativeY < rect.height - insideThreshold) {
    return { block: target.block, element: target.element, placement: "inside" };
  }

  return {
    block: target.block,
    element: target.element,
    placement: relativeY <= rect.height / 2 ? "before" : "after",
  };
}

export function selectBlock(
  view: EditorView,
  block = findActiveBlock(view.state),
): boolean {
  if (!block) return false;

  const next = setBlockSelection(view.state.tr, block.pos, block.node);
  view.dispatch(next.scrollIntoView());
  view.focus();
  return true;
}

export function insertParagraphBelow(
  view: EditorView,
  block = findActiveBlock(view.state),
): boolean {
  if (!block) return false;

  const paragraph = view.state.schema.nodes.paragraph?.create();
  if (!paragraph) return false;

  const listItem = view.state.schema.nodes.list_item;
  const insertNode =
    block.typeName === "list_item" && listItem
      ? listItem.createChecked(null, Fragment.from(paragraph))
      : paragraph;
  const insertPos = block.pos + block.node.nodeSize;
  const next = view.state.tr.insert(insertPos, insertNode);
  const selectionPos =
    block.typeName === "list_item"
      ? Math.min(insertPos + 2, next.doc.content.size)
      : Math.min(insertPos + 1, next.doc.content.size);

  view.dispatch(
    next.setSelection(TextSelection.create(next.doc, selectionPos)).scrollIntoView(),
  );
  return true;
}

export function deleteActiveBlock(
  view: EditorView,
  block = findActiveBlock(view.state),
): boolean {
  if (!block) return false;

  let from = block.pos;
  let to = block.pos + block.node.nodeSize;

  if (block.typeName === "list_item" && LIST_TYPES.has(block.parent.type.name) && block.parent.childCount === 1) {
    const parentDepth = block.depth - 1;
    const $pos = view.state.doc.resolve(block.pos + 1);
    from = $pos.before(parentDepth);
    to = $pos.after(parentDepth);
  }

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

export function canDropBlock(
  source: ActiveBlock | null,
  target: ActiveBlock | null,
): source is ActiveBlock & { parent: ProseNode } {
  if (!source || !target) return false;
  if (source.pos === target.pos) return false;
  return source.depth === target.depth && source.parent === target.parent;
}

export function moveBlockTo(
  view: EditorView,
  source: ActiveBlock,
  target: ActiveBlock,
  placement: BlockPlacement,
): boolean {
  if (source.pos === target.pos) return false;
  if (isBlockWithin(source, target)) return false;

  const sourceFrom = source.pos;
  const sourceTo = source.pos + source.node.nodeSize;
  const state = view.state;
  let insertPos = getInsertPos(target, placement);
  const insertionContext = getInsertionContext(target, placement);
  if (!insertionContext || isTableContext(insertionContext.parent)) return false;

  if (source.typeName === "list_item" && insertionContext.parent.type.name === "list_item") {
    const nestedListMove = moveListItemToNestedList(state, source, target, placement);
    if (!nestedListMove) return false;

    view.dispatch(nestedListMove.scrollIntoView());
    view.focus();
    return true;
  }

  const content = buildInsertContent(state.tr, source, insertionContext.parent, placement);
  if (!content) return false;

  let next = state.tr.delete(sourceFrom, sourceTo);
  insertPos = next.mapping.map(insertPos, placement === "after" ? 1 : -1);

  try {
    next = next.insert(insertPos, content);
  } catch {
    return false;
  }

  next = setInsertedSelection(next, insertPos, content);
  view.dispatch(next.scrollIntoView());
  view.focus();
  return true;
}

function moveListItemToNestedList(
  state: EditorState,
  source: ActiveBlock,
  target: ActiveBlock,
  placement: BlockPlacement,
): Transaction | null {
  if (!LIST_TYPES.has(source.parent.type.name)) return null;

  const sourceFrom = source.pos;
  const sourceTo = source.pos + source.node.nodeSize;
  const nestedListType = source.parent.type;
  const nestedListAttrs = source.parent.attrs;
  const boundaryPos = getNestedListBoundaryPos(target, placement);
  let next = state.tr.delete(sourceFrom, sourceTo);
  const mappedBoundaryPos = next.mapping.map(boundaryPos, placement === "before" ? -1 : 1);
  if (!isNestedListBoundary(next.doc, mappedBoundaryPos)) return null;

  const insertedItemPos = insertListItemAtBoundary(
    next,
    mappedBoundaryPos,
    source.node,
    nestedListType,
    nestedListAttrs,
  );
  if (insertedItemPos == null) return null;

  return setBlockSelection(next, insertedItemPos, source.node);
}

function getNestedListBoundaryPos(
  target: ActiveBlock,
  placement: BlockPlacement,
): number {
  if (placement === "inside") {
    return target.pos + target.node.nodeSize - 1;
  }

  return placement === "before"
    ? target.pos
    : target.pos + target.node.nodeSize;
}

function isNestedListBoundary(doc: ProseNode, pos: number): boolean {
  const boundedPos = Math.max(0, Math.min(pos, doc.content.size));
  return findDepth(doc.resolve(boundedPos), "list_item") > 0;
}

function insertListItemAtBoundary(
  tr: Transaction,
  boundaryPos: number,
  item: ProseNode,
  listType: NodeType,
  listAttrs: Record<string, unknown>,
): number | null {
  const $boundary = tr.doc.resolve(boundaryPos);

  if ($boundary.nodeBefore?.type === listType) {
    const insertPos = boundaryPos - 1;
    tr.insert(insertPos, item);
    return insertPos;
  }

  if ($boundary.nodeAfter?.type === listType) {
    const insertPos = boundaryPos + 1;
    tr.insert(insertPos, item);
    return insertPos;
  }

  const nestedList = listType.create(listAttrs, Fragment.from(item));
  tr.insert(boundaryPos, nestedList);
  return boundaryPos + 1;
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

  const siblingPos =
    direction === "up"
      ? block.pos - block.parent.child(siblingIndex).nodeSize
      : block.pos + block.node.nodeSize;
  const target = resolveBlockAtPos(view.state, siblingPos);
  if (!target) return false;

  if (!canDropBlock(block, target)) return false;
  return moveBlockTo(view, block, target, direction === "up" ? "before" : "after");
}

function buildActiveBlock(
  $pos: EditorState["selection"]["$from"],
  depth: number,
): ActiveBlock {
  const node = $pos.node(depth);
  return {
    depth,
    index: $pos.index(depth - 1),
    node,
    parent: $pos.node(depth - 1),
    pos: depth === 1 ? $pos.before(1) : $pos.before(depth),
    typeName: node.type.name,
  };
}

function findDepth(
  $pos: EditorState["selection"]["$from"],
  typeName: string,
): number {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === typeName) {
      return depth;
    }
  }
  return -1;
}

function hasContext(
  $pos: EditorState["selection"]["$from"],
  typeName: string,
): boolean {
  return findDepth($pos, typeName) > 0;
}

function findBlockInsideElement(
  view: EditorView,
  element: HTMLElement,
): ActiveBlock | null {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const probe = view.posAtCoords({
    left: rect.left + Math.min(rect.width / 2, 24),
    top: rect.top + Math.min(Math.max(1, rect.height / 2), rect.height - 1),
  });
  const pos = probe?.inside ?? probe?.pos;
  if (pos == null) return null;

  return (
    resolveLeafBlockAtDocPos(view.state, pos) ??
    resolveBlockAtPos(view.state, pos)
  );
}

function resolveBlockAroundDom(
  view: EditorView,
  node: Node,
): ActiveBlock | null {
  const probePositions: number[] = [];

  try {
    const pos = view.posAtDOM(node, 0);
    probePositions.push(pos, pos + 1, pos - 1);
  } catch {
    return null;
  }

  for (const pos of probePositions) {
    if (pos < 0 || pos > view.state.doc.content.size) continue;

    const block = resolveBlockAtPos(view.state, pos);
    if (block) return block;
  }

  return null;
}

function resolveLeafBlockAtDocPos(
  state: EditorState,
  pos: number,
): ActiveBlock | null {
  const bounded = Math.max(0, Math.min(pos, state.doc.content.size));
  const candidatePositions = Array.from(
    new Set([bounded, bounded - 1, bounded + 1]),
  ).filter(
    (candidatePos) =>
      candidatePos >= 0 && candidatePos <= state.doc.content.size,
  );

  for (const candidatePos of candidatePositions) {
    const node = state.doc.nodeAt(candidatePos);
    if (
      node?.type.name !== "image-block" &&
      node?.type.name !== "horizontal_rule"
    ) {
      continue;
    }

    const block = buildActiveBlockAtResolvedPos(state.doc, candidatePos);
    if (
      block?.typeName === "image-block" ||
      block?.typeName === "horizontal_rule"
    ) {
      return block;
    }
  }

  return null;
}

function buildActiveBlockAtResolvedPos(
  doc: ProseNode,
  nodePos: number,
): ActiveBlock | null {
  let match: ActiveBlock | null = null;

  const visit = (parent: ProseNode, parentPos: number, depth: number): boolean => {
    let found = false;

    parent.forEach((node, offset, index) => {
      if (found) return;

      const childPos = depth === 0 ? offset : parentPos + 1 + offset;
      if (childPos === nodePos) {
        match = {
          depth: depth + 1,
          index,
          node,
          parent,
          pos: childPos,
          typeName: node.type.name,
        };
        found = true;
        return;
      }

      if (!node.isLeaf && nodePos > childPos && nodePos < childPos + node.nodeSize) {
        found = visit(node, childPos, depth + 1);
      }
    });

    return found;
  };

  visit(doc, 0, 0);
  return match;
}

function findElementForBlock(
  view: EditorView,
  block: ActiveBlock,
  anchorNode: Node | null | undefined,
): HTMLElement | null {
  if (!(anchorNode instanceof Node)) return null;

  let current: Node | null = anchorNode;
  while (current && current !== view.dom) {
    if (current instanceof HTMLElement) {
      const resolved = findBlockFromDom(view, current);
      if (resolved?.pos === block.pos) return current;
    }
    current = current.parentNode;
  }

  return null;
}

function findResolvedBlockElement(
  view: EditorView,
  block: ActiveBlock,
): HTMLElement | null {
  const candidates: Node[] = [];
  const directDom = view.nodeDOM(block.pos);
  if (directDom) {
    candidates.push(directDom);
  }

  if (block.pos + 1 <= view.state.doc.content.size) {
    try {
      const innerDom = view.domAtPos(Math.min(block.pos + 1, view.state.doc.content.size)).node;
      candidates.push(innerDom);
    } catch {
      // Ignore positions without a DOM mapping.
    }
  }

  let matched: HTMLElement | null = null;
  for (const candidate of candidates) {
    const semanticElement = findSemanticBlockElement(block.typeName, candidate);
    if (semanticElement) {
      const resolved = findBlockFromDom(view, semanticElement);
      if (resolved?.pos === block.pos) {
        return semanticElement;
      }
    }

    let current: Node | null = candidate;
    while (current && current !== view.dom) {
      if (current instanceof HTMLElement) {
        const resolved = findBlockFromDom(view, current);
        if (resolved?.pos === block.pos) {
          matched = current;
          if (!requiresOuterAnchor(block.typeName)) {
            return current;
          }
        }
      }
      current = current.parentNode;
    }
  }

  return matched;
}

function findBlockTargetFromElement(
  view: EditorView,
  target: Element,
): BlockTarget | null {
  const block = findBlockFromDom(view, target);
  if (!block) return null;

  const element = findResolvedBlockElementFromTarget(view, block, target);
  return element ? { block, element } : null;
}

function findResolvedBlockElementFromTarget(
  view: EditorView,
  block: ActiveBlock,
  target: Element,
): HTMLElement | null {
  const semanticElement = findSemanticBlockElement(block.typeName, target);
  if (semanticElement) {
    const resolved = findBlockFromDom(view, semanticElement);
    if (resolved?.pos === block.pos) {
      return semanticElement;
    }
  }

  return findResolvedBlockElement(view, block);
}

function findSemanticBlockElement(
  typeName: string,
  target: Node | null,
): HTMLElement | null {
  if (!(target instanceof Element)) return null;

  switch (typeName) {
    case "blockquote":
      return target.closest("blockquote");
    case "horizontal_rule":
      return target.closest("hr");
    case "list_item":
      return target.closest(".milkdown-list-item-block");
    case "table":
      return target.closest("table");
    case "image-block":
      return target.closest(".milkdown-image-block, [data-type=\"image-block\"]");
    default:
      return null;
  }
}

function requiresOuterAnchor(typeName: string): boolean {
  return (
    typeName === "blockquote" ||
    typeName === "horizontal_rule" ||
    typeName === "list_item" ||
    typeName === "table" ||
    typeName === "image-block"
  );
}

function getInsertPos(target: ActiveBlock, placement: BlockPlacement): number {
  switch (placement) {
    case "before":
      return target.pos;
    case "after":
      return target.pos + target.node.nodeSize;
    case "inside":
      return target.pos + target.node.nodeSize - 1;
  }
}

function getInsertionContext(
  target: ActiveBlock,
  placement: BlockPlacement,
): { parent: ProseNode; index: number } | null {
  if (placement === "inside") {
    if (!DROP_INSIDE_TYPES.has(target.typeName)) return null;
    return {
      parent: target.node,
      index: target.node.childCount,
    };
  }

  return {
    parent: target.parent,
    index: target.index + (placement === "after" ? 1 : 0),
  };
}

function buildInsertContent(
  tr: Transaction,
  source: ActiveBlock,
  parent: ProseNode,
  placement: BlockPlacement,
): ProseNode | Fragment | null {
  const schema = tr.doc.type.schema;
  const listItem = schema.nodes.list_item;
  const parentName = parent.type.name;

  if (placement === "inside" && source.typeName === "list_item" && parentName === "list_item") {
    return source.node.content;
  }

  if (LIST_TYPES.has(parentName)) {
    if (source.typeName === "list_item") {
      return source.node;
    }

    if (!listItem) return null;
    return listItem.createChecked(null, Fragment.from(source.node));
  }

  if (parentName === "list_item") {
    if (source.typeName === "list_item") {
      return source.node.content;
    }

    return source.node;
  }

  if (source.typeName === "list_item") {
    if (LIST_TYPES.has(source.parent.type.name)) {
      return source.parent.type.create(source.parent.attrs, Fragment.from(source.node));
    }

    return source.node.content;
  }

  return source.node;
}

function setInsertedSelection(
  tr: Transaction,
  pos: number,
  content: ProseNode | Fragment,
): Transaction {
  const firstNode = content instanceof Fragment ? content.firstChild : content;
  if (!firstNode) return tr;

  if (LIST_TYPES.has(firstNode.type.name) && firstNode.firstChild?.type.name === "list_item") {
    return setBlockSelection(tr, pos + 1, firstNode.firstChild);
  }

  return setBlockSelection(tr, pos, firstNode);
}

function setBlockSelection(
  tr: Transaction,
  pos: number,
  node: ProseNode,
): Transaction {
  if (node.isTextblock) {
    const from = Math.min(pos + 1, tr.doc.content.size);
    const to = Math.max(from, Math.min(pos + node.nodeSize - 1, tr.doc.content.size));
    return tr.setSelection(TextSelection.create(tr.doc, from, to));
  }

  if (CONTAINER_BLOCK_TYPES.has(node.type.name)) {
    try {
      return tr.setSelection(NodeSelection.create(tr.doc, pos));
    } catch {
      const from = Math.min(pos + 1, tr.doc.content.size);
      const to = Math.max(from, Math.min(pos + node.nodeSize - 1, tr.doc.content.size));
      return tr.setSelection(TextSelection.create(tr.doc, from, to));
    }
  }

  try {
    return tr.setSelection(NodeSelection.create(tr.doc, pos));
  } catch {
    const $from = tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size));
    const innerSelection = Selection.findFrom($from, 1, true);
    if (innerSelection && innerSelection.from < pos + node.nodeSize) {
      return tr.setSelection(innerSelection);
    }
    return tr;
  }
}

function isBlockWithin(source: ActiveBlock, target: ActiveBlock): boolean {
  return target.pos > source.pos && target.pos < source.pos + source.node.nodeSize;
}

function isTableContext(parent: ProseNode): boolean {
  return ["table", "table_row", "table_cell", "table_header"].includes(parent.type.name);
}

function wouldCreateInvalidInsideTarget(
  source: ActiveBlock,
  target: ActiveBlock,
): boolean {
  return source.typeName === "list_item" && target.typeName === "blockquote";
}
