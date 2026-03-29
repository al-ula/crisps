import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { EditorHost } from "./components/EditorHost";
import { FloatingBar } from "./components/FloatingBar";
import { SidebarIsland } from "./components/SidebarIsland";
import { SourceEditor } from "./components/SourceEditor";
import { AppToastHost } from "./components/AppToastHost";
import { FileProvider, useFileContext } from "./context/FileContext";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";

type SidebarLayoutMode = "overlay" | "docked";

const SIDEBAR_OVERLAY_BREAKPOINT = 1430;
const SIDEBAR_MIN_WIDTH = 128;
const SIDEBAR_MAX_WIDTH = 480;
const COPY_SUCCESS_TOAST_DURATION_MS = 1800;
const COPY_ERROR_TOAST_DURATION_MS = 3500;

type AppToast = {
  id: number;
  kind: "success" | "error";
  message: string;
};

function getSidebarLayoutMode(width: number): SidebarLayoutMode {
  return width >= SIDEBAR_OVERLAY_BREAKPOINT ? "overlay" : "docked";
}

function clampSidebarWidth(width: number): number {
  const maxWidth = Math.max(
    SIDEBAR_MIN_WIDTH,
    Math.min(SIDEBAR_MAX_WIDTH, window.innerWidth - 48),
  );
  return Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), maxWidth);
}

function AppInner() {
  const {
    editorState,
    fileState,
    setEditorAdapter,
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleEditorChange,
    loadDocument,
    sourceMode,
    sourceEditorState,
    copyEditorSelection,
    cutEditorSelection,
    sourceText,
    getSourceSelection,
    deleteSourceSelection,
    updateSourceText,
    registerSourceEditor,
    updateSourceEditorState,
    sidebarOpen,
    isDarkTheme,
  } = useFileContext();
  const [sidebarWidth, setSidebarWidth] = useState<number | null>(null);
  const [toast, setToast] = useState<AppToast | null>(null);
  const [sidebarMode, setSidebarMode] = useState<SidebarLayoutMode>(() =>
    getSidebarLayoutMode(window.innerWidth),
  );
  const sidebarDragCleanupRef = useRef<(() => void) | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const dismissToast = () => {
    if (toastTimeoutRef.current != null) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToast(null);
  };

  const showToast = (kind: AppToast["kind"], message: string) => {
    if (toastTimeoutRef.current != null) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    const id = Date.now();
    setToast({ id, kind, message });

    toastTimeoutRef.current = window.setTimeout(
      () => {
        setToast((current) => (current?.id === id ? null : current));
        if (toastTimeoutRef.current != null) {
          toastTimeoutRef.current = null;
        }
      },
      kind === "success"
        ? COPY_SUCCESS_TOAST_DURATION_MS
        : COPY_ERROR_TOAST_DURATION_MS,
    );
  };

  const copyText = useCallback(
    async (text: string, successMessage = "Code copied") => {
      try {
        await navigator.clipboard.writeText(text);
        showToast("success", successMessage);
      } catch (error) {
        console.error(error);
        showToast("error", "Could not copy text to clipboard");
        throw error;
      }
    },
    [],
  );

  const writeClipboard = useCallback(
    async ({
      text,
      operation,
      source,
    }: {
      text: string;
      operation: "copy" | "cut";
      source: "selection" | "code-block";
    }) => {
      const successMessage =
        source === "code-block"
          ? "Code copied"
          : operation === "cut"
            ? "Cut from editor"
            : "Copied from editor";
      await copyText(text, successMessage);
    },
    [copyText],
  );

  // Load file passed via CLI argument on startup
  useEffect(() => {
    let cancelled = false;

    const loadCliFile = async () => {
      const path = await invoke<string | null>("get_cli_file");
      if (cancelled || !path) return;
      const content = await invoke<string>("read_file", { path });
      if (cancelled) return;
      loadDocument(content, path);
    };

    void loadCliFile();

    return () => {
      cancelled = true;
    };
  }, [loadDocument]);

  // Update window title when file state changes
  useEffect(() => {
    const name = fileState.currentPath
      ? (fileState.currentPath.split(/[\\/]/).pop() ?? "Untitled")
      : "Untitled";
    getCurrentWindow().setTitle(
      `${fileState.isDirty ? "* " : ""}${name} — Crisps`,
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
        case "c":
          if (sourceMode) {
            if (!sourceEditorState.focused) break;
            const selectedText = getSourceSelection();
            if (!selectedText) break;
            e.preventDefault();
            void copyText(selectedText, "Copied from source mode");
            break;
          }
          if (!editorState.focused) break;
          e.preventDefault();
          void copyEditorSelection().catch(() => {});
          break;
        case "x":
          if (sourceMode) {
            if (!sourceEditorState.focused) break;
            const selectedText = getSourceSelection();
            if (!selectedText) break;
            e.preventDefault();
            void copyText(selectedText, "Cut from source mode")
              .then(() => {
                deleteSourceSelection();
              })
              .catch(() => {});
            break;
          }
          if (!editorState.focused) break;
          e.preventDefault();
          void cutEditorSelection().catch(() => {});
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    copyText,
    copyEditorSelection,
    cutEditorSelection,
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    editorState.focused,
    getSourceSelection,
    deleteSourceSelection,
    sourceEditorState.focused,
    sourceMode,
  ]);

  useEffect(() => {
    const handleResize = () => {
      setSidebarMode(getSidebarLayoutMode(window.innerWidth));
      setSidebarWidth((currentWidth) =>
        currentWidth == null ? currentWidth : clampSidebarWidth(currentWidth),
      );
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    return () => {
      sidebarDragCleanupRef.current?.();
      if (toastTimeoutRef.current != null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  function handleSidebarResizeStart(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();

    const sidebarRect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!sidebarRect) return;

    const updateSidebarWidth = (clientX: number) => {
      setSidebarWidth(clampSidebarWidth(clientX - sidebarRect.left));
    };

    updateSidebarWidth(event.clientX);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    sidebarDragCleanupRef.current?.();

    const onPointerMove = (moveEvent: PointerEvent) => {
      updateSidebarWidth(moveEvent.clientX);
    };

    const onPointerUp = () => {
      sidebarDragCleanupRef.current?.();
    };

    const cleanupSidebarDrag = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (sidebarDragCleanupRef.current === cleanupSidebarDrag) {
        sidebarDragCleanupRef.current = null;
      }
    };

    sidebarDragCleanupRef.current = cleanupSidebarDrag;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  const showDockedSidebar = sidebarOpen && sidebarMode === "docked";
  const showSidebar = sidebarOpen;

  return (
    <div
      className={`relative h-full w-full overflow-hidden${showDockedSidebar ? " app-shell-sidebar-docked" : ""}`}
    >
      <AppToastHost toast={toast} onDismiss={dismissToast} />
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
        <div className="pointer-events-none absolute left-0 top-0 z-[1025] min-h-0">
          <SidebarIsland
            mode={sidebarMode}
            width={sidebarWidth}
            onResizeStart={handleSidebarResizeStart}
          />
        </div>
      )}
      <div className="relative flex h-full w-full min-w-0 bg-base-100">
        <div className="relative h-full min-w-0 flex-1 overflow-hidden">
          <div
            style={{ display: sourceMode ? "none" : undefined }}
            className="editor-container relative h-full overflow-auto"
          >
            <EditorHost
              isDarkTheme={isDarkTheme}
              onChange={handleEditorChange}
              onWriteClipboard={writeClipboard}
              onReady={setEditorAdapter}
            />
          </div>
          {sourceMode && (
            <div className="editor-container source-mode relative h-full overflow-auto">
              <SourceEditor
                value={sourceText}
                onChange={updateSourceText}
                onReady={registerSourceEditor}
                onStateChange={updateSourceEditorState}
                isDarkTheme={isDarkTheme}
                autoFocus
              />
            </div>
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
