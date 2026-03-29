import type { Ctx } from "@milkdown/kit/ctx";
import { configureAppLinkEditTooltip } from "./edit/edit-configure";
import { configureAppLinkPreviewTooltip } from "./preview/preview-configure";

export function configureAppLinkTooltip(ctx: Ctx) {
  configureAppLinkPreviewTooltip(ctx);
  configureAppLinkEditTooltip(ctx);
}
