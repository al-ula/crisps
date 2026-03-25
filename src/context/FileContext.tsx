import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
  useState,
} from "react";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";

interface FileState {
  currentPath: string | null;
  isDirty: boolean;
}

type FileAction =
  | { type: "SET_PATH"; path: string }
  | { type: "MARK_DIRTY" }
  | { type: "MARK_CLEAN" }
  | { type: "RESET" };

function fileReducer(state: FileState, action: FileAction): FileState {
  switch (action.type) {
    case "SET_PATH":
      return { currentPath: action.path, isDirty: false };
    case "MARK_DIRTY":
      return { ...state, isDirty: true };
    case "MARK_CLEAN":
      return { ...state, isDirty: false };
    case "RESET":
      return { currentPath: null, isDirty: false };
  }
}

interface FileContextValue {
  fileState: FileState;
  dispatch: React.Dispatch<FileAction>;
  editorRef: React.RefObject<MDXEditorMethods | null>;
  sourceMode: boolean;
  sourceText: string;
  updateSourceText: (text: string) => void;
  handleEditorChange: (markdown: string) => void;
  loadDocument: (content: string, path: string | null) => void;
  toggleSourceMode: () => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  handleNew: () => Promise<void>;
  handleOpen: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleSaveAs: () => Promise<void>;
}

const FileContext = createContext<FileContextValue | null>(null);

export function useFileContext(): FileContextValue {
  const ctx = useContext(FileContext);
  if (!ctx) throw new Error("useFileContext must be used within FileProvider");
  return ctx;
}

export function FileProvider({ children }: { children: React.ReactNode }) {
  const [fileState, dispatch] = useReducer(fileReducer, {
    currentPath: null,
    isDirty: false,
  });
  const editorRef = useRef<MDXEditorMethods>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentContentRef = useRef("");
  const savedContentRef = useRef("");

  const setDirtyState = useCallback((content: string) => {
    dispatch({
      type: content === savedContentRef.current ? "MARK_CLEAN" : "MARK_DIRTY",
    });
  }, []);

  const handleEditorChange = useCallback(
    (markdown: string) => {
      console.log("[DEBUG]\n" + markdown);
      currentContentRef.current = markdown;
      setDirtyState(markdown);
    },
    [setDirtyState],
  );

  const loadDocument = useCallback(
    (content: string, path: string | null) => {
      currentContentRef.current = content;
      savedContentRef.current = content;
      editorRef.current?.setMarkdown(content);
      setSourceText(content);
      if (path) {
        dispatch({ type: "SET_PATH", path });
      } else {
        dispatch({ type: "RESET" });
      }
      handleEditorChange(content);
    },
    [handleEditorChange],
  );

  function updateSourceText(text: string) {
    setSourceText(text);
    currentContentRef.current = text;
    setDirtyState(text);
  }

  function toggleSidebar() {
    setSidebarOpen((v) => !v);
  }

  function toggleSourceMode() {
    if (!sourceMode) {
      setSourceText(currentContentRef.current);
      setSourceMode(true);
    } else {
      currentContentRef.current = sourceText;
      editorRef.current?.setMarkdown(sourceText);
      setDirtyState(sourceText);
      setSourceMode(false);
    }
  }

  async function guardUnsaved(): Promise<boolean> {
    if (!fileState.isDirty) return true;
    return confirm("You have unsaved changes. Continue?");
  }

  async function handleNew(): Promise<void> {
    if (!(await guardUnsaved())) return;
    loadDocument("", null);
  }

  async function handleOpen(): Promise<void> {
    if (!(await guardUnsaved())) return;
    const path = await invoke<string | null>("open_file_dialog");
    if (!path) return;
    const content = await invoke<string>("read_file", { path });
    loadDocument(content, path);
  }

  async function handleSave(): Promise<void> {
    if (!fileState.currentPath) {
      await handleSaveAs();
      return;
    }
    const content = sourceMode ? sourceText : currentContentRef.current;
    await invoke("write_file", { path: fileState.currentPath, content });
    savedContentRef.current = content;
    dispatch({ type: "MARK_CLEAN" });
  }

  async function handleSaveAs(): Promise<void> {
    const path = await invoke<string | null>("save_file_dialog", {
      defaultPath: fileState.currentPath,
    });
    if (!path) return;
    const content = sourceMode ? sourceText : currentContentRef.current;
    await invoke("write_file", { path, content });
    savedContentRef.current = content;
    dispatch({ type: "SET_PATH", path });
  }

  return (
    <FileContext.Provider
      value={{
        fileState,
        dispatch,
        editorRef,
        sourceMode,
        sourceText,
        updateSourceText,
        handleEditorChange,
        loadDocument,
        toggleSourceMode,
        sidebarOpen,
        toggleSidebar,
        handleNew,
        handleOpen,
        handleSave,
        handleSaveAs,
      }}
    >
      {children}
    </FileContext.Provider>
  );
}
