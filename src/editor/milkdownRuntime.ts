import type { CSSProperties } from "react";
import type { Ctx } from "@milkdown/kit/ctx";
import {
  defaultValueCtx,
  Editor,
  EditorStatus,
  editorViewCtx,
  editorViewOptionsCtx,
  rootCtx,
} from "@milkdown/kit/core";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { history } from "@milkdown/kit/plugin/history";
import { indent, indentConfig } from "@milkdown/kit/plugin/indent";
import {
  listener,
  listenerCtx,
  type ListenerManager,
} from "@milkdown/kit/plugin/listener";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { getMarkdown, replaceAll } from "@milkdown/kit/utils";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { LanguageDescription } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import {
  type BlockPlacement,
  canDropBlock,
  type BlockDropTarget,
  deleteActiveBlock,
  findActiveBlock,
  findBlockAtCoords,
  findBlockFromDom,
  getBlockControlPosition,
  getDropIndicatorStyle,
  getActiveBlockElement,
  insertParagraphBelow,
  moveBlockTo,
  moveActiveBlock,
  resolveDropTargetAtCoords,
  selectBlock,
  type ActiveBlock,
} from "./blockEdit";
import {
  setReadonlyState,
  useCodeMirrorFeature,
  useImageFeature,
  useLatexFeature,
  useListItemFeature,
  usePlaceholderFeature,
  useTableFeature,
} from "./milkdownFeatures";

export interface MilkdownRuntime {
  editor: Editor;
  create: () => Promise<Editor>;
  destroy: () => Promise<Editor>;
  action: <T>(action: (ctx: Ctx) => T) => T;
  getMarkdown: () => string;
  replaceMarkdown: (markdown: string) => void;
  focus: () => void;
  setReadonly: (value: boolean) => void;
  blockEdit: {
    getActiveBlock: () => ActiveBlock | null;
    getActiveBlockElement: () => HTMLElement | null;
    getBlockControlPosition: (block: ActiveBlock | null) => CSSProperties;
    findBlockFromDom: (target: EventTarget | null) => ActiveBlock | null;
    findBlockAtCoords: (coords: { left: number; top: number }) => ActiveBlock | null;
    resolveDropTargetAtCoords: (
      coords: { left: number; top: number },
      source: ActiveBlock | null,
    ) => BlockDropTarget | null;
    getDropIndicatorStyle: (target: BlockDropTarget | null) => CSSProperties | null;
    selectBlock: (block?: ActiveBlock | null) => boolean;
    insertBelow: (block?: ActiveBlock | null) => boolean;
    moveUp: () => boolean;
    moveDown: () => boolean;
    moveBlockTo: (
      source: ActiveBlock,
      target: ActiveBlock,
      placement: BlockPlacement,
    ) => boolean;
    canDropBlock: (source: ActiveBlock | null, target: ActiveBlock | null) => boolean;
    deleteBlock: (block?: ActiveBlock | null) => boolean;
  };
}

export interface MilkdownRuntimeOptions {
  root: Node | string;
  defaultValue?: string;
  extensions: Extension[];
  languages: LanguageDescription[];
  renderLanguage: (language: string, selected: boolean) => string;
  onUpload: (file: File) => Promise<string>;
  configureListeners?: (listener: ListenerManager) => void;
}

export function createMilkdownRuntime(
  options: MilkdownRuntimeOptions,
): MilkdownRuntime {
  let editable = true;

  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, options.root);
      ctx.set(defaultValueCtx, options.defaultValue ?? "");
      ctx.set(editorViewOptionsCtx, {
        editable: () => editable,
      });
      ctx.update(indentConfig.key, (value) => ({
        ...value,
        size: 4,
      }));
    })
    .use(commonmark)
    .use(listener)
    .use(history)
    .use(indent)
    .use(trailing)
    .use(clipboard)
    .use(gfm);

  useCodeMirrorFeature(editor, {
    extensions: options.extensions,
    languages: options.languages,
    renderLanguage: options.renderLanguage,
  });
  useImageFeature(editor, options.onUpload);
  useLatexFeature(editor);
  useListItemFeature(editor);
  usePlaceholderFeature(editor);
  useTableFeature(editor);

  if (options.configureListeners) {
    editor.config((ctx) => {
      options.configureListeners?.(ctx.get(listenerCtx));
    });
  }

  return {
    editor,
    create: () => editor.create(),
    destroy: () => editor.destroy(),
    action: <T,>(action: (ctx: Ctx) => T) => editor.action(action),
    getMarkdown: () => editor.action(getMarkdown()),
    replaceMarkdown: (markdown: string) => {
      editor.action(replaceAll(markdown, true));
    },
    focus: () => {
      editor.action((ctx) => {
        ctx.get(editorViewCtx).focus();
      });
    },
    blockEdit: {
      getActiveBlock: () =>
        editor.action((ctx) => findActiveBlock(ctx.get(editorViewCtx).state)),
      getActiveBlockElement: () =>
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          return getActiveBlockElement(view, findActiveBlock(view.state));
        }),
      getBlockControlPosition: (block) =>
        editor.action((ctx) =>
          getBlockControlPosition(ctx.get(editorViewCtx), block),
        ),
      findBlockFromDom: (target) =>
        editor.action((ctx) => findBlockFromDom(ctx.get(editorViewCtx), target)),
      findBlockAtCoords: (coords) =>
        editor.action((ctx) => findBlockAtCoords(ctx.get(editorViewCtx), coords)),
      resolveDropTargetAtCoords: (coords, source) =>
        editor.action((ctx) =>
          resolveDropTargetAtCoords(ctx.get(editorViewCtx), coords, source),
        ),
      getDropIndicatorStyle: (target) =>
        editor.action((ctx) =>
          getDropIndicatorStyle(ctx.get(editorViewCtx), target),
        ),
      selectBlock: (block) =>
        editor.action((ctx) => selectBlock(ctx.get(editorViewCtx), block ?? undefined)),
      insertBelow: (block) =>
        editor.action((ctx) => insertParagraphBelow(ctx.get(editorViewCtx), block ?? undefined)),
      moveUp: () =>
        editor.action((ctx) => moveActiveBlock(ctx.get(editorViewCtx), "up")),
      moveDown: () =>
        editor.action((ctx) => moveActiveBlock(ctx.get(editorViewCtx), "down")),
      moveBlockTo: (source, target, placement) =>
        editor.action((ctx) =>
          moveBlockTo(ctx.get(editorViewCtx), source, target, placement),
        ),
      canDropBlock: (source, target) => canDropBlock(source, target),
      deleteBlock: (block) =>
        editor.action((ctx) => deleteActiveBlock(ctx.get(editorViewCtx), block ?? undefined)),
    },
    setReadonly: (value: boolean) => {
      editable = !value;
      editor.action((ctx) => {
        setReadonlyState(ctx, value);
        if (editor.status !== EditorStatus.Created) return;
        const view = ctx.get(editorViewCtx);
        view.setProps({
          editable: () => !value,
        });
      });
    },
  };
}

export function getEditorView(ctx: Ctx): EditorView {
  return ctx.get(editorViewCtx);
}
