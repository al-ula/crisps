import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject } from "react";
import { createPortal } from "react-dom";
import type { BlockMenuItem, BlockMenuItemKey, BlockMenuModel } from "../editor/blockMenuConfig";
import { BlockIconRenderer } from "./BlockIcon";

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
  const [submenuStyle, setSubmenuStyle] = useState<CSSProperties | null>(null);
  const [hoveredKey, setHoveredKey] = useState<BlockMenuItemKey | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const submenuAnchorRectRef = useRef<DOMRect | null>(null);

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
      setSubmenuStyle(null);
      setHoveredKey(null);
      submenuAnchorRectRef.current = null;
    }
  }, [visible]);

  useLayoutEffect(() => {
    if (!visible || !openSubmenu || !submenuRef.current) return;

    const anchorRect =
      submenuAnchorRectRef.current ??
      getSubmenuTriggerRect(openSubmenu, menuRef.current);
    if (!anchorRect) return;

    setSubmenuStyle(
      buildSubmenuStyle(
        anchorRect,
        submenuRef.current,
      ),
    );
  }, [menuRef, openSubmenu, submenuItems.length, visible]);

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
        const next = openSubmenu ?? "add";
        submenuAnchorRectRef.current = getSubmenuTriggerRect(
          next,
          menuRef.current,
        );
        setSubmenuStyle(null);
        setOpenSubmenu(next);
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
              data-submenu-key={entry.key}
              onMouseEnter={(event) => {
                setHoveredKey(null);
                submenuAnchorRectRef.current =
                  event.currentTarget.getBoundingClientRect();
                setSubmenuStyle(null);
                setOpenSubmenu(entry.key);
              }}
              onClick={(event) => {
                setHoveredKey(null);
                submenuAnchorRectRef.current =
                  event.currentTarget.getBoundingClientRect();
                setSubmenuStyle(null);
                setOpenSubmenu((current) =>
                  current === entry.key ? null : entry.key,
                );
              }}
            >
              <span className="block-popup-item-label">
                <span className="block-popup-item-icon block-popup-item-icon-placeholder" />
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
      {openSubmenu && submenuItems.length > 0
        ? createPortal(
            <div
              ref={submenuRef}
              className="block-handle-popup block-popup-submenu-menu"
              style={
                submenuStyle ?? {
                  left: -9999,
                  top: -9999,
                  visibility: "hidden",
                }
              }
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function getSubmenuTriggerRect(
  submenuKey: SubmenuKey,
  menuElement: HTMLDivElement | null,
): DOMRect | null {
  const trigger = menuElement?.querySelector<HTMLButtonElement>(
    `[data-submenu-key="${submenuKey}"]`,
  );
  return trigger?.getBoundingClientRect() ?? null;
}

function buildSubmenuStyle(
  anchorRect: DOMRect,
  submenuElement: HTMLDivElement | null,
): CSSProperties {
  const viewportPadding = 8;
  const gap = 12;
  const submenuWidth = submenuElement?.offsetWidth ?? 200;
  const submenuHeight = submenuElement?.offsetHeight ?? 0;
  const preferredRight = anchorRect.right + gap;
  const preferredLeft = anchorRect.left - submenuWidth - gap;
  const maxRight = window.innerWidth - submenuWidth - viewportPadding;
  const fitsRight = preferredRight <= maxRight;
  const left = fitsRight
    ? preferredRight
    : Math.max(viewportPadding, preferredLeft);
  const maxTop = Math.max(
    viewportPadding,
    window.innerHeight - submenuHeight - viewportPadding,
  );
  const top = Math.max(viewportPadding, Math.min(anchorRect.top, maxTop));

  return { left, top };
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
        {item.kind === "topLevel" ? (
        <span className="block-popup-item-icon block-popup-item-icon-placeholder" />
        ) : (
          <BlockIconRenderer icon={item.icon} />
        )}
        <span>{item.label}</span>
      </span>
      <span className="block-popup-item-check">{item.active ? "✓" : ""}</span>
    </button>
  );
}
