import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import type { EditorAction, EditorAdapter, EditorStateSnapshot } from "./types";

type TauriEditorActionPayload = {
  action: string;
  block_type?: string;
  blockType?: string;
  rows?: number;
  columns?: number;
};

export function createTauriEditorAdapter(options: {
  setMarkdown: (markdown: string) => void;
  getMarkdown: () => string;
  focus: () => void;
}): EditorAdapter {
  return {
    setMarkdown: options.setMarkdown,
    getMarkdown: options.getMarkdown,
    focus: options.focus,
    async runAction(action) {
      await invoke("editor_action", {
        action: action.action,
        blockType: action.blockType,
        rows: action.rows,
        columns: action.columns,
      });
    },
    async subscribeState(listener) {
      return listen<EditorStateSnapshot>("editor-state", (event) => {
        listener(event.payload);
      });
    },
  };
}

export async function emitEditorState(
  state: EditorStateSnapshot,
): Promise<void> {
  await emit("editor-state", state);
}

export async function listenForEditorActions(
  handler: (action: EditorAction) => void | Promise<void>,
): Promise<() => void> {
  return listen<TauriEditorActionPayload>("editor-action", async (event) => {
    await handler({
      action: event.payload.action as EditorAction["action"],
      blockType: (event.payload.blockType ??
        event.payload.block_type) as EditorAction["blockType"],
      rows: event.payload.rows,
      columns: event.payload.columns,
    });
  });
}
