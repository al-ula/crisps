import type { Editor } from "@milkdown/kit/core";
import { codeBlockConfig } from "@milkdown/kit/component/code-block";
import { codeBlockSchema } from "@milkdown/kit/preset/commonmark";
import { nodeRule } from "@milkdown/kit/prose";
import { textblockTypeInputRule } from "@milkdown/kit/prose/inputrules";
import {
  $inputRule,
  $nodeSchema,
  $remark,
} from "@milkdown/kit/utils";
import katex from "katex";
import remarkMath from "remark-math";
import { visit } from "unist-util-visit";

const mathInlineId = "math_inline";

const mathInlineSchema = $nodeSchema(mathInlineId, () => ({
  group: "inline",
  inline: true,
  draggable: true,
  atom: true,
  attrs: {
    value: {
      default: "",
    },
  },
  parseDOM: [
    {
      tag: `span[data-type="${mathInlineId}"]`,
      getAttrs: (dom) => ({
        value: (dom as HTMLElement).dataset.value ?? "",
      }),
    },
  ],
  toDOM: (node) => {
    const code = String(node.attrs.value ?? "");
    const dom = document.createElement("span");
    dom.dataset.type = mathInlineId;
    dom.dataset.value = code;
    katex.render(code, dom, {
      throwOnError: false,
    });
    return dom;
  },
  parseMarkdown: {
    match: (node) => node.type === "inlineMath",
    runner: (state, node, type) => {
      state.addNode(type, { value: (node as { value?: string }).value ?? "" });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === mathInlineId,
    runner: (state, node) => {
      state.addNode("inlineMath", undefined, String(node.attrs.value ?? ""));
    },
  },
}));

const blockLatexSchema = codeBlockSchema.extendSchema((prev) => {
  return (ctx) => {
    const baseSchema = prev(ctx);
    return {
      ...baseSchema,
      toMarkdown: {
        match: baseSchema.toMarkdown.match,
        runner: (state, node) => {
          const language = String(node.attrs.language ?? "");
          if (language.toLowerCase() === "latex") {
            state.addNode(
              "math",
              undefined,
              node.content.firstChild?.text ?? "",
            );
            return;
          }

          return baseSchema.toMarkdown.runner(state, node);
        },
      },
    };
  };
});

const mathInlineInputRule = $inputRule(
  (ctx) =>
    nodeRule(/(?:\$)([^$]+)(?:\$)$/, mathInlineSchema.type(ctx), {
      getAttr: (match) => ({
        value: match[1] ?? "",
      }),
    }),
);

const mathBlockInputRule = $inputRule(
  (ctx) =>
    textblockTypeInputRule(/^\$\$[\s\n]$/, codeBlockSchema.type(ctx), () => ({
      language: "LaTeX",
    })),
);

const remarkMathPlugin = $remark("remarkMath", () => remarkMath);

const remarkMathBlockPlugin = $remark("remarkMathBlock", () => () => {
  return (tree: unknown) => {
    visit(
      tree as Parameters<typeof visit>[0],
      "math",
      (
        node: { value?: string },
        index: number | undefined,
        parent: { children: unknown[] } | undefined,
      ) => {
        if (index == null || !parent) return;

        parent.children.splice(index, 1, {
          type: "code",
          lang: "LaTeX",
          value: node.value ?? "",
        });
      },
    );
  };
});

function renderLatex(content: string) {
  return katex.renderToString(content, {
    throwOnError: false,
    displayMode: true,
  });
}

export function useLatexFeature(editor: Editor) {
  editor
    .config((ctx) => {
      ctx.update(codeBlockConfig.key, (value) => ({
        ...value,
        renderPreview: (language, content, applyPreview) => {
          if (language.toLowerCase() === "latex" && content.length > 0) {
            return renderLatex(content);
          }

          return value.renderPreview(language, content, applyPreview);
        },
      }));
    })
    .use(remarkMathPlugin)
    .use(remarkMathBlockPlugin)
    .use(mathInlineSchema)
    .use(mathInlineInputRule)
    .use(mathBlockInputRule)
    .use(blockLatexSchema);
}
