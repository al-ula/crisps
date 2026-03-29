import type { Ctx } from "@milkdown/kit/ctx";
import { posToDOMRect } from "@milkdown/kit/prose";
import type { EditorView } from "@milkdown/kit/prose/view";
import { appLinkTooltipState } from "../slices";
import { findMarkPosition, shouldShowPreviewWhenHover } from "../utils";
import { AppLinkPreviewTooltip } from "./preview-view";
import { appLinkPreviewTooltip } from "../tooltips";

export function configureAppLinkPreviewTooltip(ctx: Ctx) {
  let linkPreviewTooltipView: AppLinkPreviewTooltip | null = null;
  const delay = 50;
  let hoverTimer: number | null = null;

  const onMouseMove = (view: EditorView, event: MouseEvent) => {
    if (hoverTimer != null) {
      window.clearTimeout(hoverTimer);
    }
    hoverTimer = window.setTimeout(() => {
      hoverTimer = null;
      if (!linkPreviewTooltipView) return;
      if (ctx.get(appLinkTooltipState.key).mode === "edit") return;

      const result = shouldShowPreviewWhenHover(ctx, view, event);
      if (!result) {
        linkPreviewTooltipView.hide();
        return;
      }

      const position = view.state.doc.resolve(result.pos);
      const markPosition = findMarkPosition(
        result.mark,
        result.node,
        view.state.doc,
        position.before(),
        position.after(),
      );
      const from = markPosition.start;
      const to = markPosition.end;
      linkPreviewTooltipView.show(
        result.mark,
        from,
        to,
        posToDOMRect(view, from, to),
      );
    }, delay);
    return false;
  };

  const onMouseLeave = () => {
    window.setTimeout(() => {
      linkPreviewTooltipView?.hide();
    }, delay);
  };

  ctx.set(appLinkPreviewTooltip.key, {
    props: {
      handleDOMEvents: {
        mouseleave: onMouseLeave,
        mousemove: onMouseMove,
      },
    },
    view: (view) => {
      linkPreviewTooltipView = new AppLinkPreviewTooltip(ctx, view);
      return linkPreviewTooltipView;
    },
  });
}
