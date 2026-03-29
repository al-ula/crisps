import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useFileContext } from "../context/FileContext";
import type { EditorStateSnapshot } from "../editor/types";
import { AboutPopup } from "./AboutPopup";
import {
  CascadingMenu,
  type CascadingMenuItem,
  type CascadingMenuLayerProps,
} from "./CascadingMenu";

const TITLE_BADGE_CLASS =
  "floating-title-badge badge badge-frosted pointer-events-auto h-8 max-w-[min(50vw,24rem)] cursor-grab px-4 text-[12px] font-semibold tracking-[0.08em] text-base-content active:cursor-grabbing";
const ISLAND_CLASS =
  "card card-frosted pointer-events-auto overflow-visible px-1.5 py-1";
const BASE_BTN =
  "btn btn-ghost btn-xs btn-square btn-frosted btn-recessed btn-recessed-interactive h-[22px] min-h-[22px] w-7";
const IDLE_BTN = `${BASE_BTN} opacity-70`;
const ACTIVE_BTN = `${BASE_BTN} btn-active`;
const WINDOW_BTN = `${BASE_BTN} opacity-80`;
const MENU_LAYER_CLASS = "floating-bar-menu-layer overflow-visible";
const MENU_LAYER_BASE_Z_INDEX = 1045;

type MenuItem =
  | {
      type: "item";
      key: string;
      label: string;
      shortcut?: string;
      action?: string;
      activeKey?: keyof EditorStateSnapshot;
    }
  | {
      type: "submenu";
      key: string;
      label: string;
      items: MenuItem[];
    }
  | { type: "divider"; key: string };

type MenuSection = { key: string; label: string; items: MenuItem[] };

const BLOCK_ITEMS: MenuItem[] = [
  {
    type: "item",
    key: "paragraph",
    label: "Paragraph",
    action: "blockType:paragraph",
  },
  {
    type: "item",
    key: "heading-1",
    label: "Heading 1",
    action: "blockType:h1",
  },
  {
    type: "item",
    key: "heading-2",
    label: "Heading 2",
    action: "blockType:h2",
  },
  {
    type: "item",
    key: "heading-3",
    label: "Heading 3",
    action: "blockType:h3",
  },
  {
    type: "item",
    key: "heading-4",
    label: "Heading 4",
    action: "blockType:h4",
  },
  {
    type: "item",
    key: "heading-5",
    label: "Heading 5",
    action: "blockType:h5",
  },
  {
    type: "item",
    key: "heading-6",
    label: "Heading 6",
    action: "blockType:h6",
  },
  { type: "divider", key: "divider-headings" },
  { type: "item", key: "quote", label: "Quote", action: "blockType:quote" },
  { type: "divider", key: "divider-quote" },
  {
    type: "item",
    key: "bullet-list",
    label: "Bullet List",
    action: "bulletList",
  },
  {
    type: "item",
    key: "ordered-list",
    label: "Ordered List",
    action: "orderedList",
  },
  { type: "item", key: "checklist", label: "Checklist", action: "checklist" },
  {
    type: "item",
    key: "remove-list",
    label: "Remove List",
    action: "removeList",
  },
];

const MENU_SECTIONS: MenuSection[] = [
  {
    key: "file",
    label: "File",
    items: [
      {
        type: "item",
        key: "new",
        label: "New",
        shortcut: "Ctrl+N",
        action: "new",
      },
      {
        type: "item",
        key: "open",
        label: "Open…",
        shortcut: "Ctrl+O",
        action: "open",
      },
      {
        type: "item",
        key: "save",
        label: "Save",
        shortcut: "Ctrl+S",
        action: "save",
      },
      {
        type: "item",
        key: "save-as",
        label: "Save As…",
        shortcut: "Ctrl+Shift+S",
        action: "saveAs",
      },
      { type: "divider", key: "divider-save" },
      { type: "item", key: "export-pdf", label: "Export as PDF" },
      { type: "item", key: "export-html", label: "Export as HTML" },
      { type: "item", key: "export-markdown", label: "Export as Markdown" },
      { type: "divider", key: "divider-export" },
      { type: "item", key: "print", label: "Print…" },
    ],
  },
  {
    key: "edit",
    label: "Edit",
    items: [
      {
        type: "item",
        key: "undo",
        label: "Undo",
        shortcut: "Ctrl+Z",
        action: "undo",
      },
      {
        type: "item",
        key: "redo",
        label: "Redo",
        shortcut: "Ctrl+Y",
        action: "redo",
      },
      { type: "divider", key: "divider-history" },
      {
        type: "item",
        key: "find",
        label: "Find & Replace",
        shortcut: "Ctrl+F",
      },
      { type: "divider", key: "divider-find" },
      { type: "submenu", key: "block", label: "Block", items: BLOCK_ITEMS },
    ],
  },
  {
    key: "format",
    label: "Format",
    items: [
      {
        type: "item",
        key: "bold",
        label: "Bold",
        shortcut: "Ctrl+B",
        action: "bold",
        activeKey: "bold",
      },
      {
        type: "item",
        key: "italic",
        label: "Italic",
        shortcut: "Ctrl+I",
        action: "italic",
        activeKey: "italic",
      },
      {
        type: "item",
        key: "strikethrough",
        label: "Strikethrough",
        action: "strikethrough",
        activeKey: "strikethrough",
      },
      {
        type: "item",
        key: "inline-code",
        label: "Inline Code",
        action: "code",
        activeKey: "code",
      },
      { type: "divider", key: "divider-inline" },
      {
        type: "item",
        key: "inline-latex",
        label: "Inline Latex",
        action: "latex",
        activeKey: "latex",
      },
    ],
  },
  {
    key: "insert",
    label: "Insert",
    items: [
      { type: "item", key: "image", label: "Image", action: "insertImage" },
      { type: "item", key: "table", label: "Table", action: "insertTable" },
      {
        type: "item",
        key: "code-block",
        label: "Code Block",
        action: "insertCodeBlock",
      },
      { type: "item", key: "link", label: "Link", action: "createLink" },
      {
        type: "item",
        key: "thematic-break",
        label: "Thematic Break",
        action: "insertThematicBreak",
      },
      { type: "divider", key: "divider-insert" },
      {
        type: "item",
        key: "frontmatter",
        label: "Frontmatter",
        action: "insertFrontmatter",
      },
    ],
  },
  {
    key: "view",
    label: "View",
    items: [
      {
        type: "item",
        key: "toggle-sidebar",
        label: "Toggle Sidebar",
        action: "toggle-sidebar",
      },
      { type: "divider", key: "divider-sidebar" },
      {
        type: "item",
        key: "source-mode",
        label: "Source / Preview",
        action: "source-mode",
      },
      {
        type: "submenu",
        key: "theme",
        label: "Theme",
        items: [
          { type: "item", key: "auto", label: "Auto", action: "theme:auto" },
          { type: "item", key: "light", label: "Light", action: "theme:light" },
          { type: "item", key: "dark", label: "Dark", action: "theme:dark" },
        ],
      },
      { type: "item", key: "zen-mode", label: "Zen Mode" },
    ],
  },
  {
    key: "help",
    label: "Help",
    items: [
      { type: "item", key: "keyboard-shortcuts", label: "Keyboard Shortcuts" },
      { type: "item", key: "about", label: "About", action: "about" },
    ],
  },
];

const FILE_ACTIONS = new Set(["new", "open", "save", "saveAs"]);
const FORMAT_ACTIONS = new Set([
  "bold",
  "italic",
  "strikethrough",
  "latex",
  "code",
]);
const INSERT_ACTIONS = new Set([
  "insertImage",
  "insertTable",
  "insertCodeBlock",
  "createLink",
  "insertThematicBreak",
  "insertFrontmatter",
]);
const LIST_ACTIONS = new Set([
  "bulletList",
  "orderedList",
  "checklist",
  "removeList",
]);
const VIEW_ACTIONS = new Set(["toggle-sidebar", "source-mode"]);
const APP_ACTIONS = new Set(["about"]);

export function FloatingBar() {
  const {
    fileState,
    editorState,
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleEditorAction,
    themeMode,
    isDarkTheme,
    sourceMode,
    toggleSourceMode,
    setThemeMode,
    sidebarOpen,
    toggleSidebar,
  } = useFileContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [mainPopupStyle, setMainPopupStyle] = useState<CSSProperties>({});
  const [openPath, setOpenPath] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeSubmenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const currentWindow = getCurrentWindow();
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const syncMaximizedState = async () => {
      const maximized = await currentWindow.isMaximized();
      if (!cancelled) setIsMaximized(maximized);
    };

    void syncMaximizedState();

    currentWindow
      .onResized(() => {
        void syncMaximizedState();
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const handler = (event: MouseEvent) => {
      const target = event.target;
      if (containerRef.current?.contains(target as Node)) return;
      if (
        target instanceof Element &&
        target.closest(".floating-bar-menu-layer")
      ) {
        return;
      }
      closeMenu();
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  function handleMenuButtonClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (menuOpen) {
      closeMenu();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setMainPopupStyle({ top: rect.bottom + 4, left: rect.left });
    setOpenPath([]);
    setMenuOpen(true);
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      setOpenPath([]);
    }, 150);
  }

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleCloseSubmenu() {
    cancelCloseSubmenu();
    closeSubmenuTimer.current = setTimeout(() => {
      setOpenPath((current) => current.slice(0, 1));
    }, 150);
  }

  function cancelCloseSubmenu() {
    if (closeSubmenuTimer.current) {
      clearTimeout(closeSubmenuTimer.current);
      closeSubmenuTimer.current = null;
    }
  }

  useEffect(() => {
    return () => {
      cancelClose();
      cancelCloseSubmenu();
    };
  }, []);

  async function handleMinimize() {
    await getCurrentWindow().minimize();
  }

  async function handleToggleMaximize() {
    const currentWindow = getCurrentWindow();
    await currentWindow.toggleMaximize();
    setIsMaximized(await currentWindow.isMaximized());
  }

  async function handleClose() {
    await getCurrentWindow().close();
  }

  function isItemEnabled(item: MenuItem): boolean {
    if (item.type === "divider") return false;
    if (item.type === "submenu") return true;
    const action = item.action;
    if (!action) return false;
    if (
      sourceMode &&
      (FORMAT_ACTIONS.has(action) ||
        LIST_ACTIONS.has(action) ||
        INSERT_ACTIONS.has(action) ||
        action.startsWith("blockType:"))
    ) {
      return false;
    }
    if (action === "undo") return editorState.canUndo;
    if (action === "redo") return editorState.canRedo;
    if (FILE_ACTIONS.has(action)) return true;
    if (VIEW_ACTIONS.has(action)) return true;
    if (APP_ACTIONS.has(action)) return true;
    if (action.startsWith("theme:")) return true;
    if (FORMAT_ACTIONS.has(action)) return true;
    if (action.startsWith("blockType:")) return true;
    if (LIST_ACTIONS.has(action)) return true;
    if (INSERT_ACTIONS.has(action)) return true;
    return false;
  }

  function isSectionEnabled(section: MenuSection): boolean {
    return section.items.some((item) =>
      item.type === "submenu" ? true : isItemEnabled(item),
    );
  }

  function isItemActive(item: MenuItem): boolean {
    if (item.type !== "item") return false;
    const { action, activeKey } = item;
    if (activeKey && editorState[activeKey] === true) return true;
    if (action?.startsWith("blockType:")) {
      const blockType = action.split(":")[1];
      return editorState.blockType === blockType && !editorState.listType;
    }
    if (action === "bulletList") return editorState.listType === "bullet";
    if (action === "orderedList") return editorState.listType === "number";
    if (action === "checklist") return editorState.listType === "check";
    if (action === "toggle-sidebar") return sidebarOpen;
    if (action === "source-mode") return sourceMode;
    if (action === "theme:auto") return themeMode === "auto";
    if (action === "theme:light") return themeMode === "light" && !isDarkTheme;
    if (action === "theme:dark") return themeMode === "dark" && isDarkTheme;
    return false;
  }

  function closeMenu() {
    cancelClose();
    cancelCloseSubmenu();
    setMenuOpen(false);
    setOpenPath([]);
  }

  function handleMenuItemClick(action: string | undefined) {
    closeMenu();
    if (!action) return;

    switch (action) {
      case "new":
        handleNew();
        return;
      case "open":
        handleOpen();
        return;
      case "save":
        handleSave();
        return;
      case "saveAs":
        handleSaveAs();
        return;
      case "toggle-sidebar":
        toggleSidebar();
        return;
      case "source-mode":
        toggleSourceMode();
        return;
      case "theme:auto":
        setThemeMode("auto");
        return;
      case "theme:light":
        setThemeMode("light");
        return;
      case "theme:dark":
        setThemeMode("dark");
        return;
      case "about":
        setAboutOpen(true);
        return;
    }

    if (action === "undo" || action === "redo") {
      void handleEditorAction({
        action: action as "undo" | "redo",
      });
      return;
    }

    if (action.startsWith("blockType:")) {
      const blockType = action.split(":")[1];
      void handleEditorAction({
        action: "blockType",
        blockType: blockType as
          | "paragraph"
          | "quote"
          | "h1"
          | "h2"
          | "h3"
          | "h4"
          | "h5"
          | "h6",
      });
      return;
    }

    if (action === "insertTable") {
      void handleEditorAction({ action: "insertTable", rows: 3, columns: 3 });
      return;
    }

    void handleEditorAction({
      action: action as Parameters<typeof handleEditorAction>[0]["action"],
    });
  }

  const menuItems: CascadingMenuItem[] = MENU_SECTIONS.map((section) => ({
    type: "submenu",
    key: section.key,
    label: section.label,
    items: buildSectionMenuItems(
      section.items,
      isItemEnabled,
      isItemActive,
      handleMenuItemClick,
      cancelCloseSubmenu,
      scheduleCloseSubmenu,
    ),
    disabled: !isSectionEnabled(section),
    onMouseEnter: () => {
      cancelClose();
      cancelCloseSubmenu();
    },
    openOnClick: false,
  }));

  const getLayerProps = (depth: number): CascadingMenuLayerProps => {
    if (depth === 0) {
      return {
        className: MENU_LAYER_CLASS,
        minWidth: 120,
        style: { zIndex: MENU_LAYER_BASE_Z_INDEX + depth },
        onMouseLeave: scheduleClose,
      };
    }

    if (depth === 1) {
      return {
        className: MENU_LAYER_CLASS,
        minWidth: 200,
        style: { zIndex: MENU_LAYER_BASE_Z_INDEX + depth },
        onMouseEnter: cancelClose,
        onMouseLeave: scheduleClose,
      };
    }

    return {
      className: MENU_LAYER_CLASS,
      minWidth: 160,
      style: { zIndex: MENU_LAYER_BASE_Z_INDEX + depth },
      onMouseEnter: () => {
        cancelClose();
        cancelCloseSubmenu();
      },
      onMouseLeave: scheduleCloseSubmenu,
    };
  };

  const titleName = fileState.currentPath
    ? (fileState.currentPath.split(/[\\/]/).pop() ?? "Untitled")
    : "Untitled";
  const titleLabel = `${fileState.isDirty ? "• " : ""}${titleName}`;

  return (
    <div className="absolute inset-x-0 top-0 z-1030 flex h-11 items-start justify-between px-3 pt-1.5">
      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        data-tauri-drag-region
      />
      <div className="pointer-events-none absolute left-1/2 top-1.5 z-10 -translate-x-1/2">
        <div
          className={TITLE_BADGE_CLASS}
          data-tauri-drag-region
          title={titleLabel}
        >
          <span className="truncate">{titleLabel}</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="pointer-events-auto relative z-10 flex items-center gap-2"
      >
        <div className={ISLAND_CLASS}>
          <div className="flex items-center gap-px">
            <button
              className={sidebarOpen ? ACTIVE_BTN : IDLE_BTN}
              aria-label="Toggle Sidebar"
              aria-pressed={sidebarOpen}
              onClick={toggleSidebar}
            >
              {sidebarOpen ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <path d="M17 16l-4-4 4-4" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <path d="M13 8l4 4-4 4" />
                </svg>
              )}
            </button>
            <span className="mx-0.75 h-3.5 w-px shrink-0 bg-base-content/10" />
            <button
              className={menuOpen ? ACTIVE_BTN : IDLE_BTN}
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={handleMenuButtonClick}
            >
              <svg width="14" height="4" viewBox="0 0 14 4">
                <circle cx="2" cy="2" r="1.5" fill="currentColor" />
                <circle cx="7" cy="2" r="1.5" fill="currentColor" />
                <circle cx="12" cy="2" r="1.5" fill="currentColor" />
              </svg>
            </button>
          </div>

          <CascadingMenu
            visible={menuOpen}
            items={menuItems}
            openPath={openPath}
            onOpenPathChange={setOpenPath}
            rootStyle={mainPopupStyle}
            getLayerProps={getLayerProps}
          />
        </div>
      </div>

      <div className="relative z-10 flex items-start gap-2">
        <div className={ISLAND_CLASS}>
          <div className="flex items-center gap-px">
            <button
              className={sourceMode ? ACTIVE_BTN : IDLE_BTN}
              aria-label="Toggle source mode"
              aria-pressed={sourceMode}
              onClick={toggleSourceMode}
              title="Source mode"
            >
              <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                <path
                  d="M5 1L1 5l4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M11 1l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line
                  x1="9.5"
                  y1="0.5"
                  x2="6.5"
                  y2="9.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className={ISLAND_CLASS}>
          <div className="flex items-center gap-px">
            <button
              className={WINDOW_BTN}
              aria-label="Minimize window"
              onClick={handleMinimize}
              title="Minimize"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 6h8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              className={WINDOW_BTN}
              aria-label={isMaximized ? "Restore window" : "Maximize window"}
              onClick={handleToggleMaximize}
              title={isMaximized ? "Restore down" : "Maximize"}
            >
              {isMaximized ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4.25 2.25h4a1.5 1.5 0 0 1 1.5 1.5v4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <rect
                    x="2.25"
                    y="4.25"
                    width="5.5"
                    height="5.5"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M5 2.25h1.75a1 1 0 0 1 1 1V5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="2.25"
                    y="2.25"
                    width="7.5"
                    height="7.5"
                    rx="1.25"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              )}
            </button>
            <button
              className={WINDOW_BTN}
              aria-label="Close window"
              onClick={handleClose}
              title="Close"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 3l6 6M9 3L3 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {aboutOpen ? <AboutPopup onCancel={() => setAboutOpen(false)} /> : null}
    </div>
  );
}

function buildSectionMenuItems(
  items: MenuItem[],
  isItemEnabled: (item: MenuItem) => boolean,
  isItemActive: (item: MenuItem) => boolean,
  onItemClick: (action: string | undefined) => void,
  cancelCloseSubmenu: () => void,
  scheduleCloseSubmenu: () => void,
  depth = 1,
): CascadingMenuItem[] {
  return items.map((item) => {
    if (item.type === "divider") {
      return {
        type: "divider",
        key: item.key,
      };
    }

    if (item.type === "submenu") {
      return {
        type: "submenu",
        key: item.key,
        label: item.label,
        leading: renderMenuCheckmark(false),
        items: buildSectionMenuItems(
          item.items,
          isItemEnabled,
          isItemActive,
          onItemClick,
          cancelCloseSubmenu,
          scheduleCloseSubmenu,
          depth + 1,
        ),
        disabled: !isItemEnabled(item),
        onMouseEnter: cancelCloseSubmenu,
        openOnClick: false,
      };
    }

    const active = isItemActive(item);
    return {
      type: "item",
      key: item.key,
      label: item.label,
      leading: renderMenuCheckmark(active),
      trailing: item.shortcut ? (
        <span className="font-mono text-[11px] text-base-content/60">
          {item.shortcut}
        </span>
      ) : undefined,
      active,
      disabled: !isItemEnabled(item),
      onMouseEnter: depth === 1 ? scheduleCloseSubmenu : undefined,
      onClick: () => onItemClick(item.action),
    };
  });
}

function renderMenuCheckmark(active: boolean) {
  return (
    <span
      className={`w-3 shrink-0 text-right text-[11px] ${active ? "opacity-70" : "opacity-0"}`}
      aria-hidden="true"
    >
      {active ? "✓" : ""}
    </span>
  );
}
