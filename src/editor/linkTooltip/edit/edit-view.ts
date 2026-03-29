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
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { appLinkTooltipConfig, appLinkTooltipState, type AppLinkTooltipConfig } from "../slices";
import { LinkTooltipEdit } from "../../../components/tooltip/LinkTooltipEdit";
import { findLinkRange } from "../utils";

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
  private readonly root: Root;
  private readonly provider: TooltipProvider;
  private data: EditData = { ...defaultData };
  private config: AppLinkTooltipConfig;
  private name = "";
  private showName = false;
  private src = "";
  private removeOutsideListeners: (() => void) | null = null;

  constructor(
    private readonly ctx: Ctx,
    view: EditorView,
  ) {
    this.config = this.ctx.get(appLinkTooltipConfig.key);
    this.content = document.createElement("div");
    this.content.className = "app-link-tooltip-root";
    this.root = createRoot(this.content);
    this.render();

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

  private render() {
    this.root.render(
      createElement(LinkTooltipEdit, {
        autoFocusTarget: this.showName ? "name" : "href",
        focusToken: `${this.data.from}:${this.data.to}:${this.showName ? "name" : "href"}`,
        href: this.src,
        inputPlaceholder: this.config.inputPlaceholder,
        name: this.name,
        onCancel: this.reset,
        onConfirm: this.confirmEdit,
        onHrefChange: this.handleHrefChange,
        onNameChange: this.handleNameChange,
        showName: this.showName,
        textPlaceholder: this.config.textPlaceholder,
      }),
    );
  }

  private readonly handleHrefChange = (value: string) => {
    this.src = value;
    this.render();
  };

  private readonly handleNameChange = (value: string) => {
    this.name = value;
    this.render();
  };

  private readonly reset = () => {
    this.provider.hide();
    this.removeOutsideListeners?.();
    this.removeOutsideListeners = null;
    this.ctx.update(appLinkTooltipState.key, (state) => ({
      ...state,
      mode: "preview" as const,
    }));
    this.name = "";
    this.showName = false;
    this.src = "";
    this.data = { ...defaultData };
    this.render();
  };

  private readonly confirmEdit = () => {
    const view = this.ctx.get(editorViewCtx);
    const { from, to, mark, showName } = this.data;
    const type = linkSchema.type(this.ctx);
    const link = DOMPurify.sanitize(this.src).trim();
    if (!link) return;
    if (mark && String(mark.attrs.href ?? "") === link) {
      this.reset();
      return;
    }

    const tr = view.state.tr;
    if (showName) {
      const label = this.name.trim() || link;
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
    this.config = this.ctx.get(appLinkTooltipConfig.key);
    this.name = name;
    this.showName = showName;
    this.src = value;
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
    this.render();
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
    this.root.unmount();
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
