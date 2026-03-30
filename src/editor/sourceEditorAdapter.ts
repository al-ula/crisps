import { redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { createTauriEditorAdapter } from "./tauriBridge";
import { EMPTY_EDITOR_STATE, type EditorAdapter, type EditorStateSnapshot } from "./types";

export function createSourceEditorAdapter(options: {
  view: () => EditorView | null;
  getValue: () => string;
  setValue: (text: string) => void;
  onWriteClipboard?: (text: string) => Promise<void>;
}): EditorAdapter {
  const getSelectedText = (): string => {
    const view = options.view();
    if (!view) return "";
    const { from, to } = view.state.selection.main;
    return from === to ? "" : view.state.sliceDoc(from, to);
  };

  const deleteSelection = (): void => {
    const view = options.view();
    if (!view) return;
    const { from, to } = view.state.selection.main;
    if (from === to) return;
    view.dispatch({
      changes: { from, to, insert: "" },
      selection: { anchor: from },
    });
  };

  const writeToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (options.onWriteClipboard) {
        await options.onWriteClipboard(text);
      } else {
        await navigator.clipboard.writeText(text);
      }
      return true;
    } catch {
      return false;
    }
  };

  return createTauriEditorAdapter("source", {
    setMarkdown: (md) => options.setValue(md),
    getMarkdown: () => options.getValue(),
    getSelectedText,
    deleteSelection,
    copySelection: async () => {
      const text = getSelectedText();
      if (!text) return false;
      return writeToClipboard(text);
    },
    cutSelection: async () => {
      const text = getSelectedText();
      if (!text) return false;
      const copied = await writeToClipboard(text);
      if (copied) deleteSelection();
      return copied;
    },
    focus: () => options.view()?.focus(),
    runAction: async (action) => {
      const view = options.view();
      if (!view) return;
      if (action.action === "undo") {
        undo(view);
        return;
      }
      if (action.action === "redo") {
        redo(view);
        return;
      }
      // All other actions are no-ops in source mode
    },
  });
}

export function buildSourceEditorState(view: EditorView): EditorStateSnapshot {
  return {
    ...EMPTY_EDITOR_STATE,
    editor: "source",
    canUndo: undoDepth(view.state) > 0,
    canRedo: redoDepth(view.state) > 0,
    focused: view.hasFocus,
  };
}
