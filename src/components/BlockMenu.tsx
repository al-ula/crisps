import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, MutableRefObject } from "react";
import type {
  BlockMenuItem,
  BlockMenuItemKey,
  BlockMenuModel,
} from "../editor/blockMenuConfig";

type SubmenuKey = "add" | "change";
type TopLevelEntry =
  | { type: "submenu"; key: SubmenuKey; label: string }
  | { type: "item"; item: BlockMenuItem };

interface BlockMenuProps {
  style: CSSProperties;
  visible: boolean;
  items: BlockMenuModel;
  activeItemKey: BlockMenuItemKey | null;
  menuRef: MutableRefObject<HTMLDivElement | null>;
  onHoverItem: (key: BlockMenuItemKey) => void;
  onActivateItem: (key: BlockMenuItemKey) => void;
  onClose: () => void;
}

export function BlockMenu({
  style,
  visible,
  items,
  activeItemKey,
  menuRef,
  onHoverItem,
  onActivateItem,
  onClose,
}: BlockMenuProps) {
  const [openSubmenu, setOpenSubmenu] = useState<SubmenuKey | null>(null);
  const [submenuStyle, setSubmenuStyle] = useState<CSSProperties>({});
  const [hoveredKey, setHoveredKey] = useState<BlockMenuItemKey | null>(null);

  const topLevelEntries = useMemo<TopLevelEntry[]>(
    () => [
      { type: "submenu", key: "add", label: "Add" },
      { type: "submenu", key: "change", label: "Change" },
      ...items.topLevelItems.map((item) => ({ type: "item", item }) as const),
    ],
    [items.topLevelItems],
  );

  const submenuItems =
    openSubmenu === "add" ? items.addItems : items.changeItems;

  useEffect(() => {
    if (!visible) {
      setOpenSubmenu(null);
      setSubmenuStyle({});
      setHoveredKey(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setOpenSubmenu((current) => current ?? "add");
        return;
      }

      if (event.key === "ArrowLeft") {
        if (!openSubmenu) return;
        event.preventDefault();
        setOpenSubmenu(null);
        return;
      }

      if (event.key === "Enter" && activeItemKey) {
        event.preventDefault();
        onActivateItem(activeItemKey);
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [activeItemKey, onActivateItem, onClose, openSubmenu, visible]);

  if (!visible) return null;

  return (
    <div
      ref={(node) => {
        menuRef.current = node;
      }}
      className="block-handle-popup block-popup-menu"
      style={style}
      onMouseDown={(event) => event.preventDefault()}
    >
      {topLevelEntries.map((entry) => {
        if (entry.type === "submenu") {
          const isOpen = openSubmenu === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              className={`block-popup-item block-popup-item-submenu${isOpen ? " is-active" : ""}`}
              onMouseEnter={(event) => {
                setHoveredKey(null);
                setOpenSubmenu(entry.key);
                const rect = event.currentTarget.getBoundingClientRect();
                setSubmenuStyle({
                  left: rect.right + 12,
                  top: Math.max(
                    8,
                    Math.min(rect.top, window.innerHeight - 360),
                  ),
                });
              }}
              onClick={(event) => {
                setHoveredKey(null);
                const rect = event.currentTarget.getBoundingClientRect();
                setOpenSubmenu((current) =>
                  current === entry.key ? null : entry.key,
                );
                setSubmenuStyle({
                  left: rect.right + 12,
                  top: Math.max(
                    8,
                    Math.min(rect.top, window.innerHeight - 360),
                  ),
                });
              }}
            >
              <span className="block-popup-item-label">
                <span className="block-popup-item-check" />
                <span>{entry.label}</span>
              </span>
              <span className="block-popup-arrow">›</span>
            </button>
          );
        }

        return (
          <BlockMenuItemButton
            key={entry.item.key}
            item={entry.item}
            active={hoveredKey === entry.item.key}
            onHoverItem={onHoverItem}
            onActivateItem={onActivateItem}
            onMouseEnter={() => {
              setOpenSubmenu(null);
              setHoveredKey(entry.item.key);
            }}
          />
        );
      })}
      {openSubmenu && submenuItems.length > 0 ? (
        <div
          className="block-handle-popup block-popup-submenu-menu"
          style={submenuStyle}
          onMouseEnter={() => {
            setOpenSubmenu(openSubmenu);
            setHoveredKey(null);
          }}
        >
          {submenuItems.map((item) => (
            <BlockMenuItemButton
              key={item.key}
              item={item}
              active={hoveredKey === item.key}
              onHoverItem={onHoverItem}
              onActivateItem={onActivateItem}
              onMouseEnter={() => setHoveredKey(item.key)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface BlockMenuItemButtonProps {
  item: BlockMenuItem;
  active: boolean;
  onHoverItem: (key: BlockMenuItemKey) => void;
  onActivateItem: (key: BlockMenuItemKey) => void;
  onMouseEnter?: () => void;
}

function BlockMenuItemButton({
  item,
  active,
  onHoverItem,
  onActivateItem,
  onMouseEnter,
}: BlockMenuItemButtonProps) {
  return (
    <button
      type="button"
      className={`block-popup-item${item.danger ? " block-popup-item-danger" : ""}${active ? " is-active" : ""}`}
      onMouseEnter={() => {
        onMouseEnter?.();
        onHoverItem(item.key);
      }}
      onClick={() => onActivateItem(item.key)}
    >
      <span className="block-popup-item-label">
        <span className="block-popup-item-check">{item.active ? "✓" : ""}</span>
        <span>{item.label}</span>
      </span>
    </button>
  );
}
