import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useFileContext } from "../context/FileContext";

const BASE_BTN =
  "inline-flex items-center justify-center w-7 h-[22px] rounded border-0 text-base-content cursor-pointer select-none transition-[background,opacity] duration-100";

const IDLE_BTN = `${BASE_BTN} opacity-60 hover:opacity-100 hover:bg-base-300`;
const ACTIVE_BTN = `${BASE_BTN} opacity-100 bg-base-300`;
const WIN_BTN = "inline-flex items-center justify-center w-6 h-[22px] rounded border-0 cursor-pointer select-none transition-[background,opacity,color] duration-100";
const WIN_MIN_BTN = `${WIN_BTN} text-base-content opacity-60 hover:opacity-100 hover:bg-base-300`;
const WIN_MAX_BTN = `${WIN_BTN} text-base-content opacity-60 hover:opacity-100 hover:bg-base-300`;
const WIN_CLOSE_BTN = `${WIN_BTN} text-base-content opacity-60 hover:opacity-100 hover:bg-error/20 hover:text-error`;

type EditorState = {
  canUndo: boolean;
  canRedo: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  code: boolean;
  blockType: string;
  listType: string;
  focused: boolean;
};

type MenuItem =
  | { type: "item"; label: string; shortcut?: string; action?: string; activeKey?: keyof EditorState }
  | { type: "submenu"; label: string; items: MenuItem[] }
  | { type: "divider" };

type MenuSection = { label: string; items: MenuItem[] };

const BLOCK_ITEMS: MenuItem[] = [
  { type: "item", label: "Paragraph", action: "blockType:paragraph", activeKey: undefined },
  { type: "item", label: "Heading 1", action: "blockType:h1" },
  { type: "item", label: "Heading 2", action: "blockType:h2" },
  { type: "item", label: "Heading 3", action: "blockType:h3" },
  { type: "item", label: "Heading 4", action: "blockType:h4" },
  { type: "item", label: "Heading 5", action: "blockType:h5" },
  { type: "item", label: "Heading 6", action: "blockType:h6" },
  { type: "divider" },
  { type: "item", label: "Quote", action: "blockType:quote" },
  { type: "divider" },
  { type: "item", label: "Bullet List", action: "bulletList" },
  { type: "item", label: "Ordered List", action: "orderedList" },
  { type: "item", label: "Checklist", action: "checklist" },
  { type: "item", label: "Remove List", action: "removeList" },
];

const MENU_SECTIONS: MenuSection[] = [
  {
    label: "File",
    items: [
      { type: "item", label: "New", shortcut: "Ctrl+N", action: "new" },
      { type: "item", label: "Open…", shortcut: "Ctrl+O", action: "open" },
      { type: "item", label: "Save", shortcut: "Ctrl+S", action: "save" },
      { type: "item", label: "Save As…", shortcut: "Ctrl+Shift+S", action: "saveAs" },
      { type: "divider" },
      { type: "item", label: "Export as PDF" },
      { type: "item", label: "Export as HTML" },
      { type: "item", label: "Export as Markdown" },
      { type: "divider" },
      { type: "item", label: "Print…" },
    ],
  },
  {
    label: "Edit",
    items: [
      { type: "item", label: "Undo", shortcut: "Ctrl+Z", action: "undo" },
      { type: "item", label: "Redo", shortcut: "Ctrl+Y", action: "redo" },
      { type: "divider" },
      { type: "item", label: "Find & Replace", shortcut: "Ctrl+F" },
      { type: "divider" },
      { type: "submenu", label: "Block", items: BLOCK_ITEMS },
    ],
  },
  {
    label: "Format",
    items: [
      { type: "item", label: "Bold", shortcut: "Ctrl+B", action: "bold", activeKey: "bold" },
      { type: "item", label: "Italic", shortcut: "Ctrl+I", action: "italic", activeKey: "italic" },
      { type: "item", label: "Underline", shortcut: "Ctrl+U", action: "underline", activeKey: "underline" },
      { type: "item", label: "Strikethrough", action: "strikethrough", activeKey: "strikethrough" },
      { type: "item", label: "Inline Code", action: "code", activeKey: "code" },
      { type: "divider" },
      { type: "item", label: "Subscript", action: "subscript" },
      { type: "item", label: "Superscript", action: "superscript" },
    ],
  },
  {
    label: "Insert",
    items: [
      { type: "item", label: "Image", action: "insertImage" },
      { type: "item", label: "Table", action: "insertTable" },
      { type: "item", label: "Code Block", action: "insertCodeBlock" },
      { type: "item", label: "Link", action: "createLink" },
      { type: "item", label: "Thematic Break", action: "insertThematicBreak" },
      { type: "divider" },
      { type: "item", label: "Frontmatter", action: "insertFrontmatter" },
    ],
  },
  {
    label: "View",
    items: [
      { type: "item", label: "Toggle Sidebar" },
      { type: "divider" },
      { type: "item", label: "Source / Preview" },
      { type: "item", label: "Zen Mode" },
    ],
  },
  {
    label: "Help",
    items: [
      { type: "item", label: "Keyboard Shortcuts" },
      { type: "item", label: "About" },
    ],
  },
];

const FILE_ACTIONS = new Set(["new", "open", "save", "saveAs"]);
const FORMAT_ACTIONS = new Set(["bold", "italic", "underline", "strikethrough", "code", "subscript", "superscript"]);
const INSERT_ACTIONS = new Set(["insertImage", "insertTable", "insertCodeBlock", "createLink", "insertThematicBreak", "insertFrontmatter"]);
const LIST_ACTIONS = new Set(["bulletList", "orderedList", "checklist", "removeList"]);

export function FloatingBar() {
  const { handleNew, handleOpen, handleSave, handleSaveAs, sourceMode, toggleSourceMode, sidebarOpen, toggleSidebar } = useFileContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mainPopupStyle, setMainPopupStyle] = useState<React.CSSProperties>({});
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [submenuStyle, setSubmenuStyle] = useState<React.CSSProperties>({});
  const [activeSubmenuItem, setActiveSubmenuItem] = useState<string | null>(null);
  const [subsubmenuStyle, setSubsubmenuStyle] = useState<React.CSSProperties>({});
  const [editorState, setEditorState] = useState<EditorState>({
    canUndo: false,
    canRedo: false,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    code: false,
    blockType: "paragraph",
    listType: "",
    focused: false,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeSubmenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    listen<EditorState>("editor-state", (e) => {
      if (!cancelled) setEditorState(e.payload);
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const menuItemClickRef = useRef(handleMenuItemClick);
  useEffect(() => { menuItemClickRef.current = handleMenuItemClick; });

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    listen<string>("menu-action", (e) => {
      if (!cancelled) menuItemClickRef.current(e.payload);
    }).then((fn) => {
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
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
        setActiveSection(null);
        setActiveSubmenuItem(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  function handleMenuButtonClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (menuOpen) {
      setMenuOpen(false);
      setActiveSection(null);
      setActiveSubmenuItem(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setMainPopupStyle({ top: rect.bottom + 4, left: rect.left });
      setMenuOpen(true);
    }
  }

  function handleSectionEnter(label: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveSection(label);
    setSubmenuStyle({ top: rect.top, left: rect.right + 4 });
    setActiveSubmenuItem(null);
  }

  function scheduleClose() {
    closeTimer.current = setTimeout(() => {
      setActiveSection(null);
      setActiveSubmenuItem(null);
    }, 150);
  }

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function handleSubmenuItemEnter(label: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (closeSubmenuTimer.current) {
      clearTimeout(closeSubmenuTimer.current);
      closeSubmenuTimer.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveSubmenuItem(label);
    const spaceBelow = window.innerHeight - rect.top;
    const style: React.CSSProperties = { left: rect.right + 4 };
    if (spaceBelow < 320) {
      style.bottom = window.innerHeight - rect.bottom;
    } else {
      style.top = rect.top;
    }
    setSubsubmenuStyle(style);
  }

  function handleNonSubmenuItemEnter() {
    closeSubmenuTimer.current = setTimeout(() => setActiveSubmenuItem(null), 150);
  }

  function cancelCloseSubmenu() {
    if (closeSubmenuTimer.current) {
      clearTimeout(closeSubmenuTimer.current);
      closeSubmenuTimer.current = null;
    }
  }

  function isItemEnabled(item: MenuItem): boolean {
    if (item.type === "divider") return false;
    if (item.type === "submenu") return true;
    const action = item.action;
    if (!action) return false;
    if (action === "undo") return editorState.canUndo;
    if (action === "redo") return editorState.canRedo;
    if (FILE_ACTIONS.has(action)) return true;
    if (FORMAT_ACTIONS.has(action)) return true;
    if (action.startsWith("blockType:")) return true;
    if (LIST_ACTIONS.has(action)) return true;
    if (INSERT_ACTIONS.has(action)) return true;
    return false;
  }

  function isItemActive(item: MenuItem): boolean {
    if (item.type !== "item") return false;
    const { action, activeKey } = item;
    if (activeKey && editorState[activeKey] === true) return true;
    if (action?.startsWith("blockType:")) {
      const bt = action.split(":")[1];
      return editorState.blockType === bt && !editorState.listType;
    }
    if (action === "bulletList") return editorState.listType === "bullet";
    if (action === "orderedList") return editorState.listType === "number";
    if (action === "checklist") return editorState.listType === "check";
    return false;
  }

  function closeMenu() {
    setMenuOpen(false);
    setActiveSection(null);
    setActiveSubmenuItem(null);
  }

  function handleMenuItemClick(action: string | undefined) {
    closeMenu();
    if (!action) return;
    switch (action) {
      case "new": handleNew(); return;
      case "open": handleOpen(); return;
      case "save": handleSave(); return;
      case "saveAs": handleSaveAs(); return;
      case "toggle-sidebar": toggleSidebar(); return;
      case "source-mode": toggleSourceMode(); return;
    }
    if (action.startsWith("blockType:")) {
      const blockType = action.split(":")[1];
      invoke("editor_action", { action: "blockType", blockType });
    } else if (action === "insertTable") {
      invoke("editor_action", { action: "insertTable", rows: 3, columns: 3 });
    } else {
      invoke("editor_action", { action });
    }
  }

  const activeSectionData = MENU_SECTIONS.find((s) => s.label === activeSection);
  const activeSubmenuData = activeSectionData?.items.find(
    (it) => it.type === "submenu" && it.label === activeSubmenuItem
  ) as Extract<MenuItem, { type: "submenu" }> | undefined;

  function renderItem(item: MenuItem, i: number, inSubsub = false) {
    if (item.type === "divider") {
      return (
        <div
          key={i}
          style={{ height: 1, background: "var(--color-base-300)", margin: "3px 0" }}
        />
      );
    }
    if (item.type === "submenu") {
      const isOpen = activeSubmenuItem === item.label;
      return (
        <button
          key={i}
          className="block-popup-item block-popup-item-submenu"
          style={isOpen ? { background: "var(--color-base-200)" } : undefined}
          onMouseEnter={(e) => handleSubmenuItemEnter(item.label, e)}
        >
          <span>{item.label}</span>
          <span className="block-popup-arrow">›</span>
        </button>
      );
    }
    const enabled = isItemEnabled(item);
    const active = isItemActive(item);
    return (
      <button
        key={i}
        className="block-popup-item block-popup-item-submenu"
        disabled={!enabled}
        style={{
          opacity: enabled ? 1 : 0.4,
          cursor: enabled ? "pointer" : "default",
        }}
        onMouseEnter={!inSubsub ? handleNonSubmenuItemEnter : undefined}
        onClick={() => handleMenuItemClick(item.action)}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, fontSize: 11, flexShrink: 0 }}>{active ? "✓" : ""}</span>
          {item.label}
        </span>
        {item.shortcut && (
          <span style={{ fontSize: 11, opacity: 0.6, fontFamily: "monospace" }}>
            {item.shortcut}
          </span>
        )}
      </button>
    );
  }

  return (
    <div data-tauri-drag-region className="absolute inset-x-0 top-0 z-[1030] h-10 flex items-start justify-between px-2 pt-1.5">
      <div
        ref={containerRef}
        className="pointer-events-auto relative flex items-center gap-px bg-base-200/80 backdrop-blur-sm rounded px-1.5 py-1 shadow-sm"
      >
        {/* Sidebar toggle */}
        <button
          className={sidebarOpen ? ACTIVE_BTN : IDLE_BTN}
          aria-label="Toggle Sidebar"
          aria-pressed={sidebarOpen}
          onClick={toggleSidebar}
        >
          {sidebarOpen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <path d="M17 16l-4-4 4-4" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <path d="M13 8l4 4-4 4" />
            </svg>
          )}
        </button>
        <span className="w-px h-3.5 bg-base-300 mx-[3px] shrink-0" />

        {/* Menu button */}
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

        {/* Main dropdown — section list */}
        {menuOpen && (
          <div
            className="block-handle-popup"
            style={{ ...mainPopupStyle, position: "fixed", overflow: "visible", minWidth: 120, zIndex: 1020 }}
            onMouseLeave={scheduleClose}
          >
            {MENU_SECTIONS.map((section) => (
              <button
                key={section.label}
                className="block-popup-item block-popup-item-submenu"
                style={activeSection === section.label ? { background: "var(--color-base-200)" } : undefined}
                onMouseEnter={(e) => handleSectionEnter(section.label, e)}
              >
                <span>{section.label}</span>
                <span className="block-popup-arrow">›</span>
              </button>
            ))}
          </div>
        )}

        {/* Level-2: section items */}
        {menuOpen && activeSectionData && (
          <div
            className="block-handle-popup"
            style={{ ...submenuStyle, position: "fixed", minWidth: 200, zIndex: 1020 }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            {activeSectionData.items.map((item, i) => renderItem(item, i))}
          </div>
        )}

        {/* Level-3: nested submenu (Block) */}
        {menuOpen && activeSubmenuData && (
          <div
            className="block-handle-popup"
            style={{ ...subsubmenuStyle, position: "fixed", minWidth: 160, zIndex: 1020 }}
            onMouseEnter={() => { cancelClose(); cancelCloseSubmenu(); }}
            onMouseLeave={() => {
              closeSubmenuTimer.current = setTimeout(() => setActiveSubmenuItem(null), 150);
            }}
          >
            {activeSubmenuData.items.map((item, i) => renderItem(item, i, true))}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2">
        {/* Source mode island */}
        <div className="pointer-events-auto flex items-center gap-px bg-base-200/80 backdrop-blur-sm rounded px-1.5 py-1 shadow-sm">
          <button
            className={sourceMode ? ACTIVE_BTN : IDLE_BTN}
            aria-label="Toggle source mode"
            aria-pressed={sourceMode}
            onClick={toggleSourceMode}
            title="Source mode"
          >
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
              <path d="M5 1L1 5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M11 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="9.5" y1="0.5" x2="6.5" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Window controls island */}
        <div className="pointer-events-auto flex items-center gap-px bg-base-200/80 backdrop-blur-sm rounded px-1.5 py-1 shadow-sm">
          <button
            className={WIN_MIN_BTN}
            aria-label="Minimize"
            title="Minimize"
            onClick={() => getCurrentWindow().minimize()}
          >
            <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
              <line x1="0" y1="1" x2="10" y2="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className={WIN_MAX_BTN}
            aria-label="Maximize"
            title="Maximize"
            onClick={() => getCurrentWindow().toggleMaximize()}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="1" y="1" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
          <button
            className={WIN_CLOSE_BTN}
            aria-label="Close"
            title="Close"
            onClick={() => getCurrentWindow().close()}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
