import type { Ctx, Slice } from "@milkdown/kit/ctx";
import { TooltipProvider } from "@milkdown/kit/plugin/tooltip";
import type { Mark } from "@milkdown/kit/prose/model";
import type { PluginView } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { flip, offset, shift } from "@floating-ui/dom";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { appLinkTooltipAPI, appLinkTooltipConfig, appLinkTooltipState, type AppLinkTooltipConfig, type AppLinkTooltipState } from "../slices";
import { LinkTooltipPreview } from "../../../components/tooltip/LinkTooltipPreview";

const SAFE_AREA = {
  top: 52,
  right: 8,
  bottom: 8,
  left: 8,
} as const;

export class AppLinkPreviewTooltip implements PluginView {
  private readonly content: HTMLElement;
  private readonly root: Root;
  private readonly provider: TooltipProvider;
  private slice: Slice<AppLinkTooltipState>;
  private config: AppLinkTooltipConfig;
  private href = "";
  private onOpen: () => void | Promise<void> = () => {};
  private onEdit: () => void = () => {};
  private onRemove: () => void = () => {};
  private readonly editorView: EditorView;
  private hovering = false;

  constructor(
    private readonly ctx: Ctx,
    view: EditorView,
  ) {
    this.editorView = view;
    this.config = this.ctx.get(appLinkTooltipConfig.key);
    this.content = document.createElement("div");
    this.content.className = "app-link-tooltip-root";
    this.root = createRoot(this.content);
    this.render();

    this.provider = new TooltipProvider({
      content: this.content,
      debounce: 0,
      shouldShow: () => false,
      floatingUIOptions: {
        middleware: [
          flip({ padding: SAFE_AREA }),
          offset(10),
          shift({ padding: SAFE_AREA }),
        ],
      },
    });
    this.provider.update(view);

    this.slice = ctx.use(appLinkTooltipState.key);
    this.slice.on(this.handleStateChange);
  }

  private render() {
    this.root.render(
      createElement(LinkTooltipPreview, {
        href: this.href,
        onEdit: this.onEdit,
        onOpen: this.onOpen,
        onRemove: this.onRemove,
      }),
    );
  }

  private readonly handleStateChange = ({ mode }: AppLinkTooltipState) => {
    if (mode === "edit") {
      this.hideNow();
    }
  };

  private readonly handleMouseEnter = () => {
    this.hovering = true;
  };

  private readonly handleMouseLeave = () => {
    this.hovering = false;
  };

  private hideNow() {
    this.provider.hide();
    this.provider.element.removeEventListener("mouseenter", this.handleMouseEnter);
    this.provider.element.removeEventListener("mouseleave", this.handleMouseLeave);
  }

  show(mark: Mark, from: number, to: number, rect: DOMRect) {
    this.config = this.ctx.get(appLinkTooltipConfig.key);
    this.href = String(mark.attrs.href ?? "");
    this.onOpen = async () => {
      const href = this.href.trim();
      if (!href) return;
      try {
        await Promise.resolve(this.config.openLink(href));
      } catch (error) {
        console.error(error);
      }
    };
    this.onEdit = () => {
      this.ctx.get(appLinkTooltipAPI.key).editLink(mark, from, to);
    };
    this.onRemove = () => {
      this.ctx.get(appLinkTooltipAPI.key).removeLink(from, to);
      this.hideNow();
    };
    this.render();

    this.provider.show(
      {
        getBoundingClientRect: () => rect,
      },
      this.editorView,
    );
    this.provider.element.addEventListener("mouseenter", this.handleMouseEnter);
    this.provider.element.addEventListener("mouseleave", this.handleMouseLeave);
  }

  hide() {
    if (this.hovering) return;
    this.hideNow();
  }

  update() {}

  destroy() {
    this.root.unmount();
    this.slice.off(this.handleStateChange);
    this.provider.destroy();
    this.content.remove();
  }
}
