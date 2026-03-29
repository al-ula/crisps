import type { Ctx } from "@milkdown/kit/ctx";
import { appLinkTooltipAPI } from "../slices";
import { appLinkEditTooltip } from "../tooltips";
import { AppLinkEditTooltip } from "./edit-view";

export function configureAppLinkEditTooltip(ctx: Ctx) {
  let linkEditTooltipView: AppLinkEditTooltip | null = null;

  ctx.update(appLinkTooltipAPI.key, (api) => ({
    ...api,
    createLink: () => {
      linkEditTooltipView?.createLink();
    },
    editLink: (mark, from, to) => {
      linkEditTooltipView?.editLink(mark, from, to);
    },
    removeLink: (from, to) => {
      linkEditTooltipView?.removeLink(from, to);
    },
  }));

  ctx.set(appLinkEditTooltip.key, {
    view: (view) => {
      linkEditTooltipView = new AppLinkEditTooltip(ctx, view);
      return linkEditTooltipView;
    },
  });
}
