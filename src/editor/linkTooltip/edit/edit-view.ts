import DOMPurify from "dompurify";
import { flip, offset, shift } from "@floating-ui/dom";
import { editorViewCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import { TooltipProvider } from "@milkdown/kit/plugin/tooltip";
import { linkSchema } from "@milkdown/kit/preset/commonmark";
import type { Mark } from "@milkdown/kit/prose/model";
import { posToDOMRect } from "@milkdown/kit/prose";
import { TextSelection, type PluginView } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { createApp, ref, type App, type Ref } from "vue";
import { appLinkTooltipConfig, appLinkTooltipState, type AppLinkTooltipConfig } from "../slices";
import { findLinkRange } from "../utils";
import { EditLink } from "./component";

interface EditData {
  from: number;
  to: number;
  mark: Mark | null;
  showName: boolean;
}

const defaultData: EditData = {
  from: -1,
  mark: null,
  showName: false,
  to: -1,
};

const SAFE_AREA = {
  top: 52,
  right: 8,
  bottom: 8,
  left: 8,
} as const;

export class AppLinkEditTooltip implements PluginView {
  private readonly content: HTMLElement;
  private readonly provider: TooltipProvider;
  private data: EditData = { ...defaultData };
  private readonly app: App;
  private readonly config: Ref<AppLinkTooltipConfig>;
  private readonly name = ref("");
  private readonly showName = ref(false);
  private readonly src = ref("");
  private removeOutsideListeners: (() => void) | null = null;

  constructor(
    private readonly ctx: Ctx,
    view: EditorView,
  ) {
    this.config = ref(this.ctx.get(appLinkTooltipConfig.key));
    this.content = document.createElement("div");
    this.content.className = "app-link-tooltip-root";

    this.app = createApp(EditLink, {
      config: this.config,
      onCancel: this.reset,
      onConfirm: this.confirmEdit,
      name: this.name,
      showName: this.showName,
      src: this.src,
    });
    this.app.mount(this.content);

    this.provider = new TooltipProvider({
      content: this.content,
      debounce: 0,
      floatingUIOptions: {
        middleware: [
          flip({ padding: SAFE_AREA }),
          offset(10),
          shift({ padding: SAFE_AREA }),
        ],
      },
      shouldShow: () => false,
    });
    this.provider.onHide = () => {
      requestAnimationFrame(() => {
        view.dom.focus({ preventScroll: true });
      });
    };
    this.provider.update(view);
  }

  private readonly reset = () => {
    this.provider.hide();
    this.removeOutsideListeners?.();
    this.removeOutsideListeners = null;
    this.ctx.update(appLinkTooltipState.key, (state) => ({
      ...state,
      mode: "preview" as const,
    }));
    this.name.value = "";
    this.showName.value = false;
    this.src.value = "";
    this.data = { ...defaultData };
  };

  private readonly confirmEdit = (payload: { href: string; name: string }) => {
    const view = this.ctx.get(editorViewCtx);
    const { from, to, mark, showName } = this.data;
    const type = linkSchema.type(this.ctx);
    const link = DOMPurify.sanitize(payload.href).trim();
    if (!link) return;
    if (mark && String(mark.attrs.href ?? "") === link) {
      this.reset();
      return;
    }

    const tr = view.state.tr;
    if (showName) {
      const label = payload.name.trim() || link;
      const textNode = view.state.schema.text(label, [type.create({ href: link })]);
      const next = tr.replaceRangeWith(from, to, textNode);
      view.dispatch(
        next
          .setSelection(TextSelection.create(next.doc, from + label.length))
          .scrollIntoView(),
      );
      this.reset();
      return;
    }

    if (mark) {
      tr.removeMark(from, to, mark);
    }
    tr.addMark(from, to, type.create({ href: link }));
    view.dispatch(tr);
    this.reset();
  };

  private enterEditMode(value: string, from: number, to: number, showName = false, name = "") {
    this.config.value = this.ctx.get(appLinkTooltipConfig.key);
    this.name.value = name;
    this.showName.value = showName;
    this.src.value = value;
    this.ctx.update(appLinkTooltipState.key, (state) => ({
      ...state,
      mode: "edit" as const,
    }));

    const view = this.ctx.get(editorViewCtx);
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)),
    );
    this.provider.show(
      {
        getBoundingClientRect: () => posToDOMRect(view, from, to),
      },
      view,
    );

    this.installOutsideListeners();
    requestAnimationFrame(() => {
      const selector = this.showName.value
        ? "input:first-of-type"
        : "input";
      this.content.querySelector<HTMLInputElement>(selector)?.focus();
    });
  }

  private installOutsideListeners() {
    this.removeOutsideListeners?.();

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && this.content.contains(target)) return;
      this.reset();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.reset();
    };

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    this.removeOutsideListeners = () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }

  update(view: EditorView) {
    const { selection } = view.state;
    if (!(selection instanceof TextSelection)) return;
    const { from, to } = selection;
    if (from === this.data.from && to === this.data.to) return;
    this.reset();
  }

  destroy() {
    this.app.unmount();
    this.provider.destroy();
    this.content.remove();
  }

  editLink(mark: Mark, from: number, to: number) {
    this.data = {
      from,
      mark,
      showName: false,
      to,
    };
    this.enterEditMode(String(mark.attrs.href ?? ""), from, to);
  }

  createLink() {
    const view = this.ctx.get(editorViewCtx);
    const existing = findLinkRange(view.state);
    if (existing) {
      this.editLink(existing.mark, existing.from, existing.to);
      return;
    }

    const { selection, doc } = view.state;
    const hasSelectedText =
      selection instanceof TextSelection &&
      !selection.empty &&
      doc.textBetween(selection.from, selection.to).length > 0;

    this.data = {
      from: selection.from,
      mark: null,
      showName: !hasSelectedText,
      to: selection.to,
    };
    this.enterEditMode("", selection.from, selection.to, !hasSelectedText);
  }

  removeLink(from: number, to: number) {
    const view = this.ctx.get(editorViewCtx);
    const tr = view.state.tr;
    tr.removeMark(from, to, linkSchema.type(this.ctx));
    view.dispatch(tr);
    this.reset();
  }
}
