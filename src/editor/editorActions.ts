import type { MutableRefObject } from "react";
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import {
  blockquoteSchema,
  bulletListSchema,
  codeBlockSchema,
  createCodeBlockCommand,
  headingSchema,
  insertHrCommand,
  insertImageCommand,
  liftFirstListItemCommand,
  liftListItemCommand,
  listItemSchema,
  orderedListSchema,
  paragraphSchema,
  setBlockTypeCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import {
  createTable,
  insertTableCommand,
  toggleStrikethroughCommand,
} from "@milkdown/kit/preset/gfm";
import { liftTarget } from "@milkdown/kit/prose/transform";
import { TextSelection } from "@milkdown/kit/prose/state";
import { callCommand } from "@milkdown/kit/utils";
import { redoCommand, undoCommand } from "@milkdown/kit/plugin/history";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { ActiveBlock } from "./blockEdit";
import type { BlockMenuItemKey } from "./blockMenuConfig";
import { DEFAULT_CODE_BLOCK_LANGUAGE } from "./codeBlockLanguages";
import { joinFrontmatter } from "./frontmatter";
import { appLinkTooltipAPI } from "./linkTooltip";
import type { MilkdownRuntime } from "./milkdownRuntime";
import type { EditorAction } from "./types";

export interface EditorImageValue {
  src: string;
  alt?: string;
  title?: string;
}

interface RunEditorActionOptions {
  runtime: MilkdownRuntime;
  action: EditorAction;
  frontmatterRef: MutableRefObject<string>;
  onChange: (markdown: string) => void;
  openLatexPopup: (view: EditorView) => void;
  promptForImage: () => Promise<EditorImageValue | undefined>;
  image?: EditorImageValue;
}

export async function runEditorAction({
  runtime,
  action,
  frontmatterRef,
  onChange,
  openLatexPopup,
  promptForImage,
  image,
}: RunEditorActionOptions) {
  switch (action.action) {
    case "undo":
      runtime.action(callCommand(undoCommand.key));
      return;
    case "redo":
      runtime.action(callCommand(redoCommand.key));
      return;
    case "bold":
      runtime.action(callCommand(toggleStrongCommand.key));
      return;
    case "italic":
      runtime.action(callCommand(toggleEmphasisCommand.key));
      return;
    case "strikethrough":
      runtime.action(callCommand(toggleStrikethroughCommand.key));
      return;
    case "latex":
      runtime.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        openLatexPopup(view);
      });
      return;
    case "code":
      runtime.action(callCommand(toggleInlineCodeCommand.key));
      return;
    case "bulletList":
      runtime.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        const view = ctx.get(editorViewCtx);
        if (!convertSelectedList(view, { kind: "bullet" }, ctx)) {
          commands.call(wrapInBulletListCommand.key);
        }
      });
      return;
    case "orderedList":
      runtime.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        const view = ctx.get(editorViewCtx);
        if (!convertSelectedList(view, { kind: "ordered" }, ctx)) {
          commands.call(wrapInOrderedListCommand.key);
        }
      });
      return;
    case "checklist":
      runtime.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        const view = ctx.get(editorViewCtx);
        if (
          !convertSelectedList(
            view,
            {
              kind: "check",
              checked: false,
            },
            ctx,
          )
        ) {
          commands.call(wrapInBulletListCommand.key);
          convertSelectedList(
            ctx.get(editorViewCtx),
            {
              kind: "check",
              checked: false,
            },
            ctx,
          );
        }
      });
      return;
    case "removeList":
      runtime.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        removeList(commands);
      });
      return;
    case "blockType":
      runtime.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        const view = ctx.get(editorViewCtx);
        switch (action.blockType) {
          case "paragraph":
            liftSelectionOutOfBlockquote(view, ctx);
            commands.call(setBlockTypeCommand.key, {
              nodeType: paragraphSchema.type(ctx),
            });
            break;
          case "quote":
            commands.call(wrapInBlockquoteCommand.key);
            break;
          case "h1":
          case "h2":
          case "h3":
          case "h4":
          case "h5":
          case "h6":
            liftSelectionOutOfBlockquote(view, ctx);
            commands.call(
              wrapInHeadingCommand.key,
              Number(action.blockType.slice(1)),
            );
            break;
        }
      });
      return;
    case "createLink":
      runtime.action((ctx) => {
        ctx.get(appLinkTooltipAPI.key).createLink();
      });
      return;
    case "insertImage": {
      const nextImage = image ?? (await promptForImage());
      if (!nextImage) return;
      runtime.action(callCommand(insertImageCommand.key, nextImage));
      return;
    }
    case "insertTable":
      runtime.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        const view = ctx.get(editorViewCtx);
        if (
          !commands.call(insertTableCommand.key, {
            row: action.rows ?? 3,
            col: action.columns ?? 3,
          })
        ) {
          const table = createTable(ctx, action.rows ?? 3, action.columns ?? 3);
          view.dispatch(
            view.state.tr.replaceSelectionWith(table).scrollIntoView(),
          );
        }
      });
      return;
    case "insertThematicBreak":
      runtime.action(callCommand(insertHrCommand.key));
      return;
    case "insertCodeBlock":
      runtime.action(
        callCommand(createCodeBlockCommand.key, DEFAULT_CODE_BLOCK_LANGUAGE),
      );
      return;
    case "insertFrontmatter":
      if (frontmatterRef.current) return;
      frontmatterRef.current = "---\n---\n\n";
      onChange(joinFrontmatter(frontmatterRef.current, runtime.getMarkdown()));
      return;
  }
}

interface BaseBlockMenuActionOptions {
  runtime: MilkdownRuntime;
  key: BlockMenuItemKey;
  activeBlock: ActiveBlock;
  frontmatterRef: MutableRefObject<string>;
  onChange: (markdown: string) => void;
  openLatexPopup: (view: EditorView) => void;
}

interface AddBlockMenuActionOptions extends BaseBlockMenuActionOptions {
  promptForImage: () => Promise<EditorImageValue | undefined>;
}

export async function runAddBlockAction({
  runtime,
  key,
  activeBlock,
  frontmatterRef,
  onChange,
  openLatexPopup,
  promptForImage,
}: AddBlockMenuActionOptions) {
  if (key === "add:image") {
    const image = await promptForImage();
    if (!image) return;
    runtime.blockEdit.insertBelow(activeBlock);
    await runEditorAction({
      runtime,
      action: { action: "insertImage" },
      frontmatterRef,
      onChange,
      openLatexPopup,
      promptForImage,
      image,
    });
    return;
  }

  runtime.blockEdit.insertBelow(activeBlock);
  await runEditorAction({
    runtime,
    action: mapAddAction(key),
    frontmatterRef,
    onChange,
    openLatexPopup,
    promptForImage,
  });
}

export async function runChangeBlockAction({
  runtime,
  key,
  activeBlock,
}: BaseBlockMenuActionOptions) {
  runtime.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    focusBlock(view, activeBlock);
    const commands = ctx.get(commandsCtx);

    switch (key) {
      case "change:paragraph":
        removeList(commands);
        liftSelectionOutOfBlockquote(view, ctx);
        commands.call(setBlockTypeCommand.key, {
          nodeType: paragraphSchema.type(ctx),
        });
        return;
      case "change:h1":
      case "change:h2":
      case "change:h3":
      case "change:h4":
      case "change:h5":
      case "change:h6":
        removeList(commands);
        liftSelectionOutOfBlockquote(view, ctx);
        commands.call(setBlockTypeCommand.key, {
          nodeType: headingSchema.type(ctx),
          attrs: {
            level: Number(key.slice(-1)),
          },
        });
        return;
      case "change:quote":
        removeList(commands);
        commands.call(wrapInBlockquoteCommand.key);
        return;
      case "change:bulletList":
        if (!convertSelectedList(view, { kind: "bullet" }, ctx)) {
          commands.call(wrapInBulletListCommand.key);
        }
        return;
      case "change:orderedList":
        if (!convertSelectedList(view, { kind: "ordered" }, ctx)) {
          commands.call(wrapInOrderedListCommand.key);
        }
        return;
      case "change:checklist":
        if (!convertSelectedList(view, { kind: "check", checked: false }, ctx)) {
          commands.call(wrapInBulletListCommand.key);
          convertSelectedList(view, { kind: "check", checked: false }, ctx);
        }
        return;
      case "change:removeList":
        removeList(commands);
        return;
      case "change:codeBlock":
        removeList(commands);
        liftSelectionOutOfBlockquote(view, ctx);
        commands.call(setBlockTypeCommand.key, {
          nodeType: codeBlockSchema.type(ctx),
          attrs: {
            language: DEFAULT_CODE_BLOCK_LANGUAGE,
          },
        });
        return;
    }
  });
}

function mapAddAction(key: BlockMenuItemKey): EditorAction {
  switch (key) {
    case "add:paragraph":
      return { action: "blockType", blockType: "paragraph" };
    case "add:h1":
    case "add:h2":
    case "add:h3":
    case "add:h4":
    case "add:h5":
    case "add:h6":
      return {
        action: "blockType",
        blockType: key.slice(4) as EditorAction["blockType"],
      };
    case "add:quote":
      return { action: "blockType", blockType: "quote" };
    case "add:bulletList":
      return { action: "bulletList" };
    case "add:orderedList":
      return { action: "orderedList" };
    case "add:checklist":
      return { action: "checklist" };
    case "add:codeBlock":
      return { action: "insertCodeBlock" };
    case "add:table":
      return { action: "insertTable", rows: 3, columns: 3 };
    case "add:thematicBreak":
      return { action: "insertThematicBreak" };
    default:
      return { action: "blockType", blockType: "paragraph" };
  }
}

function removeList(commands: { call: (...args: any[]) => boolean }) {
  for (let i = 0; i < 8; i += 1) {
    const lifted =
      commands.call(liftListItemCommand.key) ||
      commands.call(liftFirstListItemCommand.key);
    if (!lifted) break;
  }
}

function focusBlock(view: EditorView, block: ActiveBlock) {
  const from = block.pos + 1;
  const to = Math.max(from, block.pos + block.node.nodeSize - 1);
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)),
  );
  view.focus();
}

export function convertSelectedList(
  view: EditorView,
  options: {
    kind: "bullet" | "ordered" | "check";
    checked?: boolean | null;
  },
  ctx: Parameters<typeof bulletListSchema.type>[0],
): boolean {
  const { state } = view;
  const { from, to } = state.selection;
  const bulletList = bulletListSchema.type(ctx);
  const orderedList = orderedListSchema.type(ctx);
  const listItem = listItemSchema.type(ctx);
  let tr = state.tr;
  let changed = false;

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type === bulletList || node.type === orderedList) {
      const nextType = options.kind === "ordered" ? orderedList : bulletList;
      if (node.type !== nextType) {
        const nextAttrs =
          nextType === orderedList
            ? {
                order:
                  typeof node.attrs.order === "number" ? node.attrs.order : 1,
                spread: Boolean(node.attrs.spread),
              }
            : {
                spread: Boolean(node.attrs.spread),
              };
        tr = tr.setNodeMarkup(pos, nextType, nextAttrs);
        changed = true;
      }
      return;
    }

    if (node.type !== listItem) return;

    const nextChecked =
      options.kind === "check" ? (options.checked ?? false) : null;
    if (node.attrs.checked !== nextChecked) {
      tr = tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        checked: nextChecked,
      });
      changed = true;
    }
  });

  if (!changed) return false;
  view.dispatch(tr.scrollIntoView());
  return true;
}

export function liftSelectionOutOfBlockquote(
  view: EditorView,
  ctx: Parameters<typeof blockquoteSchema.type>[0],
): boolean {
  const { state } = view;
  const { $from, $to } = state.selection;
  const blockquote = blockquoteSchema.type(ctx);
  const range = $from.blockRange($to, (node) => node.type === blockquote);
  const target = range ? liftTarget(range) : null;

  if (range == null || target == null) return false;

  view.dispatch(state.tr.lift(range, target).scrollIntoView());
  return true;
}
