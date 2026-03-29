import type { Ctx, Slice } from "@milkdown/kit/ctx";
import { TooltipProvider } from "@milkdown/kit/plugin/tooltip";
import type { Mark } from "@milkdown/kit/prose/model";
import type { PluginView } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { flip, offset, shift } from "@floating-ui/dom";
import { createApp, ref, type App, type Ref } from "vue";
import { appLinkTooltipAPI, appLinkTooltipConfig, appLinkTooltipState, type AppLinkTooltipConfig, type AppLinkTooltipState } from "../slices";
import { PreviewLink } from "./component";

const SAFE_AREA = {
  top: 52,
  right: 8,
  bottom: 8,
  left: 8,
} as const;

export class AppLinkPreviewTooltip implements PluginView {
  private readonly content: HTMLElement;
  private readonly provider: TooltipProvider;
  private slice: Slice<AppLinkTooltipState>;
  private readonly config: Ref<AppLinkTooltipConfig>;
  private readonly href = ref("");
  private readonly onOpen = ref<() => void | Promise<void>>(() => {});
  private readonly onEdit = ref<() => void>(() => {});
  private readonly onRemove = ref<() => void>(() => {});
  private readonly app: App;
  private readonly editorView: EditorView;
  private hovering = false;

  constructor(
    private readonly ctx: Ctx,
    view: EditorView,
  ) {
    this.editorView = view;
    this.config = ref(this.ctx.get(appLinkTooltipConfig.key));
    this.app = createApp(PreviewLink, {
      config: this.config,
      href: this.href,
      onOpen: this.onOpen,
      onEdit: this.onEdit,
      onRemove: this.onRemove,
    });
    this.content = document.createElement("div");
    this.content.className = "app-link-tooltip-root";
    this.app.mount(this.content);

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
    this.config.value = this.ctx.get(appLinkTooltipConfig.key);
    this.href.value = String(mark.attrs.href ?? "");
    this.onOpen.value = async () => {
      const href = this.href.value.trim();
      if (!href) return;
      try {
        await Promise.resolve(this.config.value.openLink(href));
      } catch (error) {
        console.error(error);
      }
    };
    this.onEdit.value = () => {
      this.ctx.get(appLinkTooltipAPI.key).editLink(mark, from, to);
    };
    this.onRemove.value = () => {
      this.ctx.get(appLinkTooltipAPI.key).removeLink(from, to);
      this.hideNow();
    };

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
    this.app.unmount();
    this.slice.off(this.handleStateChange);
    this.provider.destroy();
    this.content.remove();
  }
}
