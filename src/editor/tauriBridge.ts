import { emit, listen } from "@tauri-apps/api/event";
import type {
  EditorAction,
  EditorAdapter,
  EditorId,
  EditorStateSnapshot,
} from "./types";

type TauriEditorActionPayload = {
  action: string;
  block_type?: string;
  blockType?: string;
  rows?: number;
  columns?: number;
  target?: string;
};

export function createTauriEditorAdapter(
  editorId: EditorId,
  options: {
    setMarkdown: (markdown: string) => void;
    getMarkdown: () => string;
    getSelectedText: () => string;
    deleteSelection: () => void;
    copySelection: () => Promise<boolean>;
    cutSelection: () => Promise<boolean>;
    focus: () => void;
    scrollToHeading?: (headingId: string) => boolean;
    runAction: (action: EditorAction) => Promise<void>;
  },
): EditorAdapter {
  return {
    setMarkdown: options.setMarkdown,
    getMarkdown: options.getMarkdown,
    getSelectedText: options.getSelectedText,
    deleteSelection: options.deleteSelection,
    copySelection: options.copySelection,
    cutSelection: options.cutSelection,
    focus: options.focus,
    scrollToHeading: options.scrollToHeading,
    async runAction(action) {
      await options.runAction(action);
    },
    async subscribeState(listener) {
      return listen<EditorStateSnapshot>("editor-state", (event) => {
        if (event.payload.editor === editorId) {
          listener(event.payload);
        }
      });
    },
  };
}

export async function emitEditorState(
  editorId: EditorId,
  state: EditorStateSnapshot,
): Promise<void> {
  await emit("editor-state", { ...state, editor: editorId });
}

export async function listenForEditorActions(
  editorId: EditorId,
  handler: (action: EditorAction) => void | Promise<void>,
): Promise<() => void> {
  return listen<TauriEditorActionPayload>("editor-action", async (event) => {
    const target = event.payload.target;
    if (target && target !== editorId) return;
    await handler({
      action: event.payload.action as EditorAction["action"],
      blockType: (event.payload.blockType ??
        event.payload.block_type) as EditorAction["blockType"],
      rows: event.payload.rows,
      columns: event.payload.columns,
    });
  });
}
