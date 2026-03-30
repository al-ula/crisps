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
import { extractToc, type TocItem } from "../editor/toc";

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
  themeMode: "auto" | "light" | "dark";
  isDarkTheme: boolean;
  setEditorAdapter: (adapter: EditorAdapter | null) => void;
  setSourceAdapter: (adapter: EditorAdapter | null) => void;
  sourceMode: boolean;
  sourceText: string;
  documentMarkdown: string;
  tocItems: TocItem[];
  getSelection: () => string;
  deleteSelection: () => void;
  copySelection: () => Promise<boolean>;
  cutSelection: () => Promise<boolean>;
  updateSourceText: (text: string) => void;
  handleEditorChange: (markdown: string) => void;
  handleEditorAction: (action: EditorAction) => Promise<void>;
  loadDocument: (content: string, path: string | null) => void;
  toggleSourceMode: () => void;
  setThemeMode: (mode: "auto" | "light" | "dark") => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  navigateToHeading: (headingId: string) => boolean;
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
  const sourceAdapterRef = useRef<EditorAdapter | null>(null);
  const editorSubscriptionRef = useRef<(() => void) | null>(null);
  const sourceSubscriptionRef = useRef<(() => void) | null>(null);
  const adapterVersionRef = useRef(0);
  const sourceAdapterVersionRef = useRef(0);
  const systemThemeMediaRef = useRef<MediaQueryList | null>(null);
  if (!systemThemeMediaRef.current) {
    systemThemeMediaRef.current = window.matchMedia(
      "(prefers-color-scheme: dark)",
    );
  }
  const [editorState, setEditorState] = useState(EMPTY_EDITOR_STATE);
  const [sourceEditorState, setSourceEditorState] =
    useState<EditorStateSnapshot>({ ...EMPTY_EDITOR_STATE, editor: "source" });
  const [themeMode, setThemeMode] = useState<"auto" | "light" | "dark">(
    "light",
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    systemThemeMediaRef.current.matches,
  );
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const currentContentRef = useRef("");
  const savedContentRef = useRef("");
  const sourceModeRef = useRef(false);
  sourceModeRef.current = sourceMode;

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

  const setSourceAdapter = useCallback((adapter: EditorAdapter | null) => {
    sourceAdapterVersionRef.current += 1;
    const version = sourceAdapterVersionRef.current;

    sourceSubscriptionRef.current?.();
    sourceSubscriptionRef.current = null;
    sourceAdapterRef.current = adapter;
    setSourceEditorState({ ...EMPTY_EDITOR_STATE, editor: "source" });

    if (!adapter) return;

    void adapter
      .subscribeState((state) => {
        if (sourceAdapterVersionRef.current === version) {
          setSourceEditorState(state);
        }
      })
      .then((unsubscribe) => {
        if (sourceAdapterVersionRef.current === version) {
          sourceSubscriptionRef.current = unsubscribe;
        } else {
          unsubscribe();
        }
      });
  }, []);

  useEffect(() => {
    const mediaQuery = systemThemeMediaRef.current;
    if (!mediaQuery) return;

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const isDarkTheme =
    themeMode === "dark" || (themeMode === "auto" && systemPrefersDark);

  useEffect(() => {
    const themeName = isDarkTheme ? "catppuccin-mocha" : "catppuccin-latte";
    document.documentElement.setAttribute("data-theme", themeName);
    document.body.setAttribute("data-theme", themeName);
    document.body.classList.toggle("dark-theme", isDarkTheme);
  }, [isDarkTheme]);

  useEffect(() => {
    return () => {
      editorSubscriptionRef.current?.();
      sourceSubscriptionRef.current?.();
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
      setSourceText(content);
      if (sourceModeRef.current) {
        sourceAdapterRef.current?.focus();
      } else {
        editorAdapterRef.current?.focus();
      }
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
    setSidebarOpen((current) => {
      const next = !current;
      if (next) {
        setTocItems(extractToc(getCurrentContent()));
      }
      return next;
    });
  }

  function toggleSourceMode() {
    if (!sourceMode) {
      setSourceText(getCurrentContent());
      setSourceMode(true);
      void invoke("set_active_editor", { editor: "source" });
    } else {
      currentContentRef.current = sourceText;
      editorAdapterRef.current?.setMarkdown(sourceText);
      setDirtyState(sourceText);
      setSourceMode(false);
      editorAdapterRef.current?.focus();
      void invoke("set_active_editor", { editor: "milkdown" });
    }
  }

  const handleEditorAction = useCallback(
    async (action: EditorAction) => {
      const adapter = sourceMode
        ? sourceAdapterRef.current
        : editorAdapterRef.current;
      await adapter?.runAction(action);
    },
    [sourceMode],
  );

  const activeEditorState = sourceMode ? sourceEditorState : editorState;
  const documentMarkdown = sourceMode
    ? sourceText
    : currentContentRef.current;

  const getSelection = useCallback(
    () => {
      const adapter = sourceModeRef.current
        ? sourceAdapterRef.current
        : editorAdapterRef.current;
      return adapter?.getSelectedText() ?? "";
    },
    [],
  );
  const deleteSelection = useCallback(() => {
    const adapter = sourceModeRef.current
      ? sourceAdapterRef.current
      : editorAdapterRef.current;
    adapter?.deleteSelection();
  }, []);
  const copySelection = useCallback(
    () => {
      const adapter = sourceModeRef.current
        ? sourceAdapterRef.current
        : editorAdapterRef.current;
      return adapter?.copySelection() ?? Promise.resolve(false);
    },
    [],
  );
  const cutSelection = useCallback(
    () => {
      const adapter = sourceModeRef.current
        ? sourceAdapterRef.current
        : editorAdapterRef.current;
      return adapter?.cutSelection() ?? Promise.resolve(false);
    },
    [],
  );

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

  const navigateToHeading = useCallback(
    (headingId: string) => {
      if (sourceMode) return false;
      return editorAdapterRef.current?.scrollToHeading?.(headingId) ?? false;
    },
    [sourceMode],
  );

  return (
    <FileContext.Provider
      value={{
        fileState,
        dispatch,
        editorState: activeEditorState,
        themeMode,
        isDarkTheme,
        setEditorAdapter,
        setSourceAdapter,
        sourceMode,
        sourceText,
        documentMarkdown,
        tocItems,
        getSelection,
        deleteSelection,
        copySelection,
        cutSelection,
        updateSourceText,
        handleEditorChange,
        handleEditorAction,
        loadDocument,
        toggleSourceMode,
        setThemeMode,
        sidebarOpen,
        toggleSidebar,
        navigateToHeading,
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
