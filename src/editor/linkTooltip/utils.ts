import type { Ctx } from "@milkdown/kit/ctx";
import type { Mark, Node as ProseNode } from "@milkdown/kit/prose/model";
import type { EditorState } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { linkSchema } from "@milkdown/kit/preset/commonmark";

export function findMarkPosition(
  mark: Mark,
  node: ProseNode,
  doc: ProseNode,
  from: number,
  to: number,
) {
  let markPos = { start: -1, end: -1 };

  doc.nodesBetween(from, to, (nextNode, pos) => {
    if (markPos.start > -1) return false;

    if (mark.isInSet(nextNode.marks) && nextNode === node) {
      markPos = {
        start: pos,
        end: pos + Math.max(nextNode.textContent.length, 1),
      };
    }

    return undefined;
  });

  return markPos;
}

export function shouldShowPreviewWhenHover(
  ctx: Ctx,
  view: EditorView,
  event: MouseEvent,
) {
  const linkType = linkSchema.mark.type(ctx);
  const targetResult = resolveHoveredLinkFromTarget(view, event, linkType);
  if (targetResult) return targetResult;

  const position = view.posAtCoords({
    left: event.clientX,
    top: event.clientY,
  });
  if (!position) return;

  return resolveLinkAtPos(view, position.pos, linkType);
}

export function findLinkRange(state: EditorState): {
  from: number;
  to: number;
  href: string;
  mark: Mark;
} | null {
  const markType = state.schema.marks.link;
  if (!markType) return null;

  const { selection, doc } = state;
  const scanFrom = Math.max(0, selection.from - (selection.empty ? 1 : 0));
  const scanTo = Math.min(doc.content.size, selection.to + 1);
  let start = -1;
  let end = -1;
  let activeMark: Mark | null = null;

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
    activeMark = mark;
  });

  if (start === -1 || end === -1 || !activeMark) return null;
  const mark = activeMark as Mark;

  return {
    from: start,
    to: end,
    href: String(mark.attrs.href ?? ""),
    mark,
  };
}

function resolveHoveredLinkFromTarget(
  view: EditorView,
  event: MouseEvent,
  linkType: Mark["type"],
) {
  const eventTarget = event.target;
  if (!(eventTarget instanceof globalThis.Node)) return;

  const anchor =
    eventTarget instanceof Element
      ? eventTarget.closest("a")
      : eventTarget.parentNode instanceof Element
        ? eventTarget.parentNode.closest("a")
        : undefined;
  if (!anchor || !view.dom.contains(anchor)) return;

  const domTarget = anchor.firstChild ?? anchor;

  try {
    const pos = view.posAtDOM(domTarget, 0);
    return resolveLinkAtPos(view, pos, linkType);
  } catch {
    return undefined;
  }
}

function resolveLinkAtPos(
  view: EditorView,
  pos: number,
  linkType: Mark["type"],
) {
  const doc = view.state.doc;
  const resolved = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  const candidates: Array<{ node: ProseNode; pos: number }> = [];
  const exactNode = doc.nodeAt(pos);

  if (exactNode) {
    candidates.push({ node: exactNode, pos });
  }
  if (resolved.nodeAfter) {
    candidates.push({ node: resolved.nodeAfter, pos: resolved.pos });
  }
  if (resolved.nodeBefore) {
    candidates.push({
      node: resolved.nodeBefore,
      pos: resolved.pos - resolved.nodeBefore.nodeSize,
    });
  }

  for (const candidate of candidates) {
    const mark = candidate.node.marks.find((item) => item.type === linkType);
    if (!mark) continue;

    return {
      mark,
      node: candidate.node,
      pos: candidate.pos,
      show: true,
    };
  }

  return;
}
