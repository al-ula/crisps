import { useEffect, useRef } from "react";
import { catppuccinLatte, catppuccinMocha } from "@catppuccin/codemirror";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  redoDepth,
  undo,
  undoDepth,
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
import type {
  SourceEditorAction,
  SourceEditorController,
  SourceEditorStateSnapshot,
} from "../editor/types";

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  onReady: (controller: SourceEditorController | null) => void;
  onStateChange: (state: SourceEditorStateSnapshot) => void;
  isDarkTheme: boolean;
  autoFocus?: boolean;
}

export function SourceEditor({
  value,
  onChange,
  onReady,
  onStateChange,
  isDarkTheme,
  autoFocus = false,
}: SourceEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartmentRef = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const onStateChangeRef = useRef(onStateChange);
  const suppressNextChangeRef = useRef(false);
  const lastStateRef = useRef<SourceEditorStateSnapshot | null>(null);

  onChangeRef.current = onChange;
  onStateChangeRef.current = onStateChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const emitState = (view: EditorView) => {
      const nextState = getSourceEditorState(view);
      const previousState = lastStateRef.current;
      if (
        previousState?.canUndo === nextState.canUndo &&
        previousState?.canRedo === nextState.canRedo &&
        previousState?.focused === nextState.focused
      ) {
        return;
      }
      lastStateRef.current = nextState;
      onStateChangeRef.current(nextState);
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
    onReady({
      focus: () => view.focus(),
      getSelectedText: () => {
        const { from, to } = view.state.selection.main;
        return from === to ? "" : view.state.sliceDoc(from, to);
      },
      deleteSelection: () => {
        const { from, to } = view.state.selection.main;
        if (from === to) return;
        view.dispatch({
          changes: { from, to, insert: "" },
          selection: { anchor: from },
        });
      },
      runAction: (action: SourceEditorAction) => {
        if (action === "undo") {
          undo(view);
          return;
        }
        redo(view);
      },
    });
    emitState(view);

    if (autoFocus) {
      view.focus();
    }

    return () => {
      lastStateRef.current = null;
      onReady(null);
      onStateChangeRef.current({
        canUndo: false,
        canRedo: false,
        focused: false,
      });
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

function getSourceEditorState(view: EditorView): SourceEditorStateSnapshot {
  return {
    canUndo: undoDepth(view.state) > 0,
    canRedo: redoDepth(view.state) > 0,
    focused: view.hasFocus,
  };
}
