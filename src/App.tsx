import { useEffect, useRef, useState } from "react";
import "./App.css";
import { EditorHost } from "./components/EditorHost";
import { FloatingBar } from "./components/FloatingBar";
import { SidebarIsland } from "./components/SidebarIsland";
import { FileProvider, useFileContext } from "./context/FileContext";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";

type SidebarLayoutMode = "overlay" | "docked";

function getSidebarLayoutMode(width: number): SidebarLayoutMode {
  return width >= 1180 ? "overlay" : "docked";
}

function AppInner() {
  const {
    fileState,
    setEditorAdapter,
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleEditorChange,
    loadDocument,
    sourceMode,
    sourceText,
    updateSourceText,
    sidebarOpen,
  } = useFileContext();
  const [sidebarMode, setSidebarMode] = useState<SidebarLayoutMode>(() =>
    getSidebarLayoutMode(window.innerWidth),
  );

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

  useEffect(() => {
    const handleResize = () => {
      setSidebarMode(getSidebarLayoutMode(window.innerWidth));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const showDockedSidebar = sidebarOpen && sidebarMode === "docked";
  const showSidebar = sidebarOpen;

  return (
    <div
      className={`app-shell${showDockedSidebar ? " app-shell-sidebar-docked" : ""}`}
    >
      <div
        className="absolute left-0 top-4 bottom-4 w-1 z-[1040] cursor-ew-resize"
        onMouseDown={() => getCurrentWindow().startResizeDragging("West")}
      />
      <div
        className="absolute right-0 top-4 bottom-4 w-1 z-[1040] cursor-ew-resize"
        onMouseDown={() => getCurrentWindow().startResizeDragging("East")}
      />
      <FloatingBar />
      {showSidebar && (
        <div className="app-sidebar-slot app-sidebar-slot-overlay">
          <SidebarIsland mode={sidebarMode} />
        </div>
      )}
      <div className="app-main">
        {showDockedSidebar && (
          <div className="app-sidebar-spacer" aria-hidden="true" />
        )}
        <div className="app-editor-pane">
          <div
            style={{ display: sourceMode ? "none" : undefined }}
            className="editor-container"
          >
            <EditorHost
              onChange={handleEditorChange}
              onReady={setEditorAdapter}
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
      </div>
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
