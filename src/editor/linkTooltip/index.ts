import type { MilkdownPlugin } from "@milkdown/kit/ctx";
import { appLinkTooltipAPI, appLinkTooltipConfig, appLinkTooltipState } from "./slices";
import { appLinkEditTooltip, appLinkPreviewTooltip } from "./tooltips";
export { configureAppLinkTooltip } from "./configure";
export { appLinkTooltipAPI, appLinkTooltipConfig } from "./slices";

export const appLinkTooltipPlugin: MilkdownPlugin[] = [
  appLinkTooltipState,
  appLinkTooltipAPI,
  appLinkTooltipConfig,
  appLinkPreviewTooltip,
  appLinkEditTooltip,
].flat();
