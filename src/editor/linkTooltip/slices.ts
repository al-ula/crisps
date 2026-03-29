import { openUrl } from "@tauri-apps/plugin-opener";
import type { Mark } from "@milkdown/kit/prose/model";
import { $ctx } from "@milkdown/kit/utils";

export interface AppLinkTooltipState {
  mode: "preview" | "edit";
}

export const appLinkTooltipState = $ctx(
  {
    mode: "preview",
  } as AppLinkTooltipState,
  "appLinkTooltipStateCtx",
);

export interface AppLinkTooltipAPI {
  createLink: () => void;
  editLink: (mark: Mark, from: number, to: number) => void;
  removeLink: (from: number, to: number) => void;
}

export const appLinkTooltipAPI = $ctx(
  {
    createLink: () => {},
    editLink: () => {},
    removeLink: () => {},
  } as AppLinkTooltipAPI,
  "appLinkTooltipAPICtx",
);

export interface AppLinkTooltipConfig {
  inputPlaceholder: string;
  textPlaceholder: string;
  openLink: (href: string) => Promise<void> | void;
}

export const appLinkTooltipConfig = $ctx(
  {
    inputPlaceholder: "https://example.com",
    textPlaceholder: "Link text",
    openLink: (href: string) => openUrl(href),
  } as AppLinkTooltipConfig,
  "appLinkTooltipConfigCtx",
);
