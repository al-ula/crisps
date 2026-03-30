import { useEffect, useRef } from "react";
import { catppuccinLatte, catppuccinMocha } from "@catppuccin/codemirror";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { search, searchKeymap } from "@codemirror/search";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import type { EditorAdapter, EditorStateSnapshot } from "../editor/types";
import {
  createSourceEditorAdapter,
  buildSourceEditorState,
} from "../editor/sourceEditorAdapter";
import { emitEditorState, listenForEditorActions } from "../editor/tauriBridge";

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  onReady: (adapter: EditorAdapter | null) => void;
  onWriteClipboard?: (text: string) => Promise<void>;
  isDarkTheme: boolean;
  autoFocus?: boolean;
}

export function SourceEditor({
  value,
  onChange,
  onReady,
  onWriteClipboard,
  isDarkTheme,
  autoFocus = false,
}: SourceEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartmentRef = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const suppressNextChangeRef = useRef(false);
  const lastStateRef = useRef<EditorStateSnapshot | null>(null);
  const onWriteClipboardRef = useRef(onWriteClipboard);

  onChangeRef.current = onChange;
  onWriteClipboardRef.current = onWriteClipboard;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let actionUnlisten: (() => void) | undefined;

    const emitState = (view: EditorView) => {
      const nextState = buildSourceEditorState(view);
      const previousState = lastStateRef.current;
      if (
        previousState?.canUndo === nextState.canUndo &&
        previousState?.canRedo === nextState.canRedo &&
        previousState?.focused === nextState.focused
      ) {
        return;
      }
      lastStateRef.current = nextState;
      void emitEditorState("source", nextState);
    };

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          EditorState.readOnly.of(false),
          themeCompartmentRef.current.of(
            isDarkTheme ? catppuccinMocha : catppuccinLatte,
          ),
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          indentOnInput(),
          bracketMatching(),
          search(),
          markdown(),
          EditorView.lineWrapping,
          keymap.of([
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              if (suppressNextChangeRef.current) {
                suppressNextChangeRef.current = false;
              } else {
                onChangeRef.current(update.state.doc.toString());
              }
            }

            if (update.docChanged || update.focusChanged) {
              emitState(update.view);
            }
          }),
        ],
      }),
      parent: container,
    });

    viewRef.current = view;

    const adapter = createSourceEditorAdapter({
      view: () => viewRef.current,
      getValue: () => view.state.doc.toString(),
      setValue: (text: string) => {
        const currentValue = view.state.doc.toString();
        if (currentValue === text) return;
        suppressNextChangeRef.current = true;
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: text,
          },
        });
      },
      onWriteClipboard: async (text: string) => {
        if (onWriteClipboardRef.current) {
          await onWriteClipboardRef.current(text);
        } else {
          await navigator.clipboard.writeText(text);
        }
      },
    });

    onReady(adapter);
    emitState(view);

    // Listen for editor actions via Tauri events, same as Milkdown
    void listenForEditorActions("source", async (action) => {
      await adapter.runAction(action);
    }).then((fn) => {
      actionUnlisten = fn;
    });

    if (autoFocus) {
      view.focus();
    }

    return () => {
      lastStateRef.current = null;
      onReady(null);
      void emitEditorState("source", {
        ...buildSourceEditorState(view),
        canUndo: false,
        canRedo: false,
        focused: false,
      });
      actionUnlisten?.();
      view.destroy();
      viewRef.current = null;
    };
  }, [autoFocus, onReady]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure(
        isDarkTheme ? catppuccinMocha : catppuccinLatte,
      ),
    });
  }, [isDarkTheme]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentValue = view.state.doc.toString();
    if (currentValue === value) return;

    suppressNextChangeRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value,
      },
    });
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    viewRef.current?.focus();
  }, [autoFocus]);

  return <div ref={containerRef} className="source-editor-host" />;
}
