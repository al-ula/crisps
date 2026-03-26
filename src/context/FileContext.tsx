import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import {
  EMPTY_EDITOR_STATE,
  type EditorAction,
  type EditorAdapter,
  type EditorStateSnapshot,
} from "../editor/types";

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
  editorState: EditorStateSnapshot;
  setEditorAdapter: (adapter: EditorAdapter | null) => void;
  sourceMode: boolean;
  sourceText: string;
  updateSourceText: (text: string) => void;
  handleEditorChange: (markdown: string) => void;
  handleEditorAction: (action: EditorAction) => Promise<void>;
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
  const editorAdapterRef = useRef<EditorAdapter | null>(null);
  const editorSubscriptionRef = useRef<(() => void) | null>(null);
  const adapterVersionRef = useRef(0);
  const [editorState, setEditorState] = useState(EMPTY_EDITOR_STATE);
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
      currentContentRef.current = markdown;
      setDirtyState(markdown);
    },
    [setDirtyState],
  );

  const setEditorAdapter = useCallback((adapter: EditorAdapter | null) => {
    adapterVersionRef.current += 1;
    const version = adapterVersionRef.current;

    editorSubscriptionRef.current?.();
    editorSubscriptionRef.current = null;
    editorAdapterRef.current = adapter;
    setEditorState(EMPTY_EDITOR_STATE);

    if (!adapter) return;

    adapter.setMarkdown(currentContentRef.current);
    void adapter
      .subscribeState((state) => {
        if (adapterVersionRef.current === version) {
          setEditorState(state);
        }
      })
      .then((unsubscribe) => {
        if (adapterVersionRef.current === version) {
          editorSubscriptionRef.current = unsubscribe;
        } else {
          unsubscribe();
        }
      });
  }, []);

  useEffect(() => {
    return () => {
      editorSubscriptionRef.current?.();
    };
  }, []);

  const getCurrentContent = useCallback(() => {
    if (sourceMode) {
      currentContentRef.current = sourceText;
      return sourceText;
    }

    const markdown = editorAdapterRef.current?.getMarkdown();
    if (markdown != null) {
      currentContentRef.current = markdown;
      return markdown;
    }

    return currentContentRef.current;
  }, [sourceMode, sourceText]);

  const loadDocument = useCallback(
    (content: string, path: string | null) => {
      currentContentRef.current = content;
      savedContentRef.current = content;
      editorAdapterRef.current?.setMarkdown(content);
      editorAdapterRef.current?.focus();
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
      setSourceText(getCurrentContent());
      setSourceMode(true);
    } else {
      currentContentRef.current = sourceText;
      editorAdapterRef.current?.setMarkdown(sourceText);
      setDirtyState(sourceText);
      setSourceMode(false);
      editorAdapterRef.current?.focus();
    }
  }

  const handleEditorAction = useCallback(async (action: EditorAction) => {
    await editorAdapterRef.current?.runAction(action);
  }, []);

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
    const content = getCurrentContent();
    await invoke("write_file", { path: fileState.currentPath, content });
    savedContentRef.current = content;
    dispatch({ type: "MARK_CLEAN" });
  }

  async function handleSaveAs(): Promise<void> {
    const path = await invoke<string | null>("save_file_dialog", {
      defaultPath: fileState.currentPath,
    });
    if (!path) return;
    const content = getCurrentContent();
    await invoke("write_file", { path, content });
    savedContentRef.current = content;
    dispatch({ type: "SET_PATH", path });
  }

  return (
    <FileContext.Provider
      value={{
        fileState,
        dispatch,
        editorState,
        setEditorAdapter,
        sourceMode,
        sourceText,
        updateSourceText,
        handleEditorChange,
        handleEditorAction,
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
