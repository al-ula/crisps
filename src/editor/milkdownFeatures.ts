import type { LanguageDescription } from "@codemirror/language";
import {
  codeBlockComponent,
  codeBlockConfig,
} from "@milkdown/kit/component/code-block";
import {
  imageBlockComponent,
  imageBlockConfig,
} from "@milkdown/kit/component/image-block";
import {
  imageInlineComponent,
  inlineImageConfig,
} from "@milkdown/kit/component/image-inline";
import {
  listItemBlockComponent,
  listItemBlockConfig,
} from "@milkdown/kit/component/list-item-block";
import {
  tableBlock,
  tableBlockConfig,
  type RenderType,
} from "@milkdown/kit/component/table-block";
import type { Ctx } from "@milkdown/kit/ctx";
import { findParent } from "@milkdown/kit/prose";
import type { Node } from "@milkdown/kit/prose/model";
import type { Selection } from "@milkdown/kit/prose/state";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import {
  cursor as cursorPlugin,
  dropIndicatorConfig,
} from "@milkdown/kit/plugin/cursor";
import {
  $ctx,
  $prose,
} from "@milkdown/kit/utils";
import type { Editor } from "@milkdown/kit/core";
import { latex } from "@milkdown/crepe/feature/latex";

const appRuntimeCtx = $ctx(
  {
    readonly: false,
  },
  "appRuntimeCtx",
);

export function setReadonlyState(ctx: Ctx, readonly: boolean) {
  ctx.update(appRuntimeCtx.key, (value) => ({
    ...value,
    readonly,
  }));
}

export interface AppCodeMirrorConfig {
  languages: LanguageDescription[];
  renderLanguage: (language: string, selected: boolean) => string;
}

export function useCodeMirrorFeature(editor: Editor, config: AppCodeMirrorConfig) {
  editor
    .config((ctx) => {
      ctx.update(codeBlockConfig.key, (defaultConfig) => ({
        ...defaultConfig,
        languages: config.languages,
        renderLanguage: config.renderLanguage,
      }));
    })
    .use(codeBlockComponent);
}

export function useCursorFeature(editor: Editor) {
  editor
    .config((ctx) => {
      ctx.update(dropIndicatorConfig.key, () => ({
        class: "crepe-drop-cursor",
        width: 4,
        color: "#89dceb",
      }));
    })
    .use(cursorPlugin);
}

export function useImageFeature(
  editor: Editor,
  onUpload: (file: File) => Promise<string>,
) {
  editor
    .config((ctx) => {
      ctx.update(inlineImageConfig.key, (value) => ({
        ...value,
        uploadButton: "Upload",
        confirmButton: "Confirm",
        uploadPlaceholderText: "or paste link",
        onUpload,
      }));
      ctx.update(imageBlockConfig.key, (value) => ({
        ...value,
        uploadButton: "Upload file",
        confirmButton: "Confirm",
        captionPlaceholderText: "Write Image Caption",
        uploadPlaceholderText: "or paste link",
        onUpload,
      }));
    })
    .use(imageBlockComponent)
    .use(imageInlineComponent);
}

export function useListItemFeature(editor: Editor) {
  editor
    .config((ctx) => {
      ctx.set(listItemBlockConfig.key, {
        renderLabel: ({ label, listType, checked }) => {
          if (checked == null) {
            return listType === "bullet" ? "*" : label;
          }

          return checked ? "[x]" : "[ ]";
        },
      });
    })
    .use(listItemBlockComponent);
}

export function useTableFeature(editor: Editor) {
  editor
    .config((ctx) => {
      ctx.update(tableBlockConfig.key, (defaultConfig) => ({
        ...defaultConfig,
        renderButton: (renderType: RenderType) => {
          switch (renderType) {
            case "add_row":
            case "add_col":
              return "+";
            case "delete_row":
            case "delete_col":
              return "-";
            case "align_col_left":
              return "L";
            case "align_col_center":
              return "C";
            case "align_col_right":
              return "R";
            case "col_drag_handle":
            case "row_drag_handle":
              return "::";
          }
        },
      }));
    })
    .use(tableBlock);
}

interface PlaceholderConfig {
  text: string;
  mode: "doc" | "block";
}

const placeholderConfig = $ctx(
  {
    text: "Please enter...",
    mode: "block",
  } as PlaceholderConfig,
  "placeholderConfigCtx",
);

const placeholderPlugin = $prose((ctx) => {
  return new Plugin({
    key: new PluginKey("APP_PLACEHOLDER"),
    props: {
      decorations: (state) => {
        if (ctx.get(appRuntimeCtx.key).readonly) return null;

        const config = ctx.get(placeholderConfig.key);
        if (config.mode === "doc" && !isDocEmpty(state.doc)) return null;
        if (isInCodeBlock(state.selection) || isInList(state.selection)) {
          return null;
        }

        const decoration = createPlaceholderDecoration(state, config.text);
        if (!decoration) return null;
        return DecorationSet.create(state.doc, [decoration]);
      },
    },
  });
});

export function usePlaceholderFeature(editor: Editor) {
  editor
    .use(appRuntimeCtx)
    .use(placeholderConfig)
    .use(placeholderPlugin);
}

export function useLatexFeature(editor: Editor) {
  latex(editor);
}

function isDocEmpty(doc: Node) {
  return doc.childCount <= 1 && !doc.firstChild?.content.size;
}

function isInCodeBlock(selection: Selection) {
  return selection.$from.parent.type.name === "code_block";
}

function isInList(selection: Selection) {
  return selection.$from.node(selection.$from.depth - 1)?.type.name === "list_item";
}

function createPlaceholderDecoration(
  state: import("@milkdown/kit/prose/state").EditorState,
  placeholderText: string,
) {
  if (!state.selection.empty) return null;

  const $pos = state.selection.$anchor;
  const node = $pos.parent;
  if (node.content.size > 0) return null;

  const inTable = findParent((node) => node.type.name === "table")($pos);
  if (inTable) return null;

  const before = $pos.before();
  return Decoration.node(before, before + node.nodeSize, {
    class: "crepe-placeholder",
    "data-placeholder": placeholderText,
  });
}
