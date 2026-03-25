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
import {
  deleteActiveBlock,
  findActiveBlock,
  getActiveBlockElement,
  insertParagraphBelow,
  moveActiveBlock,
  type ActiveBlock,
} from "./blockEdit";
import {
  setReadonlyState,
  useCodeMirrorFeature,
  useCursorFeature,
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
    insertBelow: () => boolean;
    moveUp: () => boolean;
    moveDown: () => boolean;
    deleteBlock: () => boolean;
  };
}

export interface MilkdownRuntimeOptions {
  root: Node | string;
  defaultValue?: string;
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
    languages: options.languages,
    renderLanguage: options.renderLanguage,
  });
  useCursorFeature(editor);
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
      insertBelow: () =>
        editor.action((ctx) => insertParagraphBelow(ctx.get(editorViewCtx))),
      moveUp: () =>
        editor.action((ctx) => moveActiveBlock(ctx.get(editorViewCtx), "up")),
      moveDown: () =>
        editor.action((ctx) => moveActiveBlock(ctx.get(editorViewCtx), "down")),
      deleteBlock: () =>
        editor.action((ctx) => deleteActiveBlock(ctx.get(editorViewCtx))),
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
