import { useEffect, useRef } from "react";
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  tablePlugin,
  imagePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  frontmatterPlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import "./App.css";
import { tauriEditorPlugin } from "./plugins/tauriEditorPlugin";
import { blockHandlePlugin } from "./plugins/blockHandlePlugin";
import { selectionFormatPlugin } from "./plugins/selectionFormatPlugin";
import { FloatingBar } from "./components/FloatingBar";
import { FileProvider, useFileContext } from "./context/FileContext";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";

if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
  document.body.classList.add("dark-theme");
}

function AppInner() {
  const {
    editorRef,
    fileState,
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleEditorChange,
    loadDocument,
    sourceMode,
    sourceText,
    updateSourceText,
  } = useFileContext();

  // Load file passed via CLI argument on startup
  useEffect(() => {
    invoke<string | null>("get_cli_file").then((path) => {
      if (!path) return;
      invoke<string>("read_file", { path }).then((content) => {
        loadDocument(content, path);
      });
    });
  }, [loadDocument]);

  // Update window title when file state changes
  useEffect(() => {
    const name = fileState.currentPath
      ? (fileState.currentPath.split(/[\\/]/).pop() ?? "Untitled")
      : "Untitled";
    getCurrentWindow().setTitle(
      `${fileState.isDirty ? "* " : ""}${name} — markdown-editor`,
    );
  }, [fileState.currentPath, fileState.isDirty]);

  // Keep a ref so the close handler always sees the latest isDirty without re-registering
  const isDirtyRef = useRef(fileState.isDirty);
  useEffect(() => {
    isDirtyRef.current = fileState.isDirty;
  }, [fileState.isDirty]);

  // Warn on close when there are unsaved changes
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    listen("close-requested", async () => {
      if (
        !isDirtyRef.current ||
        (await confirm("You have unsaved changes. Close without saving?"))
      ) {
        invoke("force_close");
      }
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      switch (e.key) {
        case "s":
          e.preventDefault();
          if (e.shiftKey) handleSaveAs();
          else handleSave();
          break;
        case "o":
          e.preventDefault();
          handleOpen();
          break;
        case "n":
          e.preventDefault();
          handleNew();
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNew, handleOpen, handleSave, handleSaveAs]);

  return (
    <div className="relative h-full w-full">
      <div
        className="absolute left-0 top-4 bottom-4 w-1 z-[1040] cursor-ew-resize"
        onMouseDown={() => getCurrentWindow().startResizeDragging("West")}
      />
      <div
        className="absolute right-0 top-4 bottom-4 w-1 z-[1040] cursor-ew-resize"
        onMouseDown={() => getCurrentWindow().startResizeDragging("East")}
      />
      <FloatingBar />
      <div
        style={{ display: sourceMode ? "none" : undefined }}
        className="editor-container h-full overflow-auto"
      >
        <MDXEditor
          ref={editorRef}
          markdown=""
          contentEditableClassName="prose max-w-full"
          onChange={handleEditorChange}
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            tablePlugin(),
            imagePlugin({
              imageUploadHandler: async (file) => {
                return new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
                });
              },
            }),
            frontmatterPlugin(),
            codeBlockPlugin({ defaultCodeBlockLanguage: "txt" }),
            codeMirrorPlugin({
              codeBlockLanguages: {
                js: "JavaScript",
                ts: "TypeScript",
                tsx: "TypeScript (React)",
                jsx: "JavaScript (React)",
                css: "CSS",
                html: "HTML",
                json: "JSON",
                rust: "Rust",
                py: "Python",
                txt: "Plain text",
              },
            }),
            markdownShortcutPlugin(),
            tauriEditorPlugin(),
            blockHandlePlugin(),
            selectionFormatPlugin(),
          ]}
        />
      </div>
      {sourceMode && (
        <textarea
          className="source-mode-editor"
          value={sourceText}
          onChange={(e) => {
            updateSourceText(e.target.value);
          }}
          spellCheck={false}
          autoFocus
        />
      )}
    </div>
  );
}

function App() {
  return (
    <FileProvider>
      <AppInner />
    </FileProvider>
  );
}

export default App;
