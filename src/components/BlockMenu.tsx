import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, MutableRefObject } from "react";
import type {
  BlockMenuItem,
  BlockMenuItemKey,
  BlockMenuModel,
} from "../editor/blockMenuConfig";
import {
  CascadingMenu,
  type CascadingMenuItem,
  type CascadingMenuLayerProps,
} from "./CascadingMenu";
import { BlockIconRenderer } from "./BlockIcon";

const BLOCK_MENU_LAYER_CLASS =
  "max-w-[min(248px,calc(100vw-16px))] max-h-[calc(100vh-16px)] overflow-y-auto";
const BLOCK_MENU_LAYER_BASE_Z_INDEX = 1035;
const EMPTY_ICON_SLOT = (
  <span className="inline-flex h-4 min-w-4 shrink-0 opacity-0" aria-hidden="true" />
);

type SubmenuKey = "add" | "change";

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
  const [openPath, setOpenPath] = useState<string[]>([]);
  const openSubmenu = openPath[0] as SubmenuKey | undefined;

  useEffect(() => {
    if (!visible) {
      setOpenPath([]);
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
        setOpenPath((current) => (current.length > 0 ? current : ["add"]));
        return;
      }

      if (event.key === "ArrowLeft") {
        if (!openSubmenu) return;
        event.preventDefault();
        setOpenPath([]);
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

  const menuItems = useMemo<CascadingMenuItem[]>(
    () => [
      {
        type: "submenu",
        key: "add",
        label: "Add",
        leading: EMPTY_ICON_SLOT,
        items: items.addItems.map((item) =>
          buildBlockMenuItem(item, onHoverItem, onActivateItem, () => {
            onHoverItem(item.key);
          }),
        ),
        triggerProps: { "data-submenu-key": "add" },
      },
      {
        type: "submenu",
        key: "change",
        label: "Change",
        leading: EMPTY_ICON_SLOT,
        items: items.changeItems.map((item) =>
          buildBlockMenuItem(item, onHoverItem, onActivateItem, () => {
            onHoverItem(item.key);
          }),
        ),
        triggerProps: { "data-submenu-key": "change" },
      },
      ...items.topLevelItems.map((item) =>
        buildBlockMenuItem(
          item,
          onHoverItem,
          onActivateItem,
          () => {
            setOpenPath([]);
            onHoverItem(item.key);
          },
        ),
      ),
    ],
    [items.addItems, items.changeItems, items.topLevelItems, onActivateItem, onHoverItem],
  );

  const rootStyle: CSSProperties = {
    ...style,
    overflowX: "visible",
    overflowY: "auto",
    width: "min(248px, calc(100vw - 16px))",
  };

  const getLayerProps = (depth: number): CascadingMenuLayerProps => ({
    className:
      depth === 0
        ? BLOCK_MENU_LAYER_CLASS
        : `${BLOCK_MENU_LAYER_CLASS} block-popup-submenu-menu`,
    style: { zIndex: BLOCK_MENU_LAYER_BASE_Z_INDEX + depth },
    minWidth: 200,
    onMouseDown:
      depth === 0 ? (event) => event.preventDefault() : undefined,
  });

  return (
    <CascadingMenu
      visible={visible}
      items={menuItems}
      openPath={openPath}
      onOpenPathChange={setOpenPath}
      rootStyle={rootStyle}
      menuRef={menuRef}
      getLayerProps={getLayerProps}
    />
  );
}

function buildBlockMenuItem(
  item: BlockMenuItem,
  onHoverItem: (key: BlockMenuItemKey) => void,
  onActivateItem: (key: BlockMenuItemKey) => void,
  onMouseEnter: () => void,
): CascadingMenuItem {
  return {
    type: "item",
    key: item.key,
    label: item.label,
    leading:
      item.kind === "topLevel" ? EMPTY_ICON_SLOT : <BlockIconRenderer icon={item.icon} />,
    trailing: (
      <span className="w-3 shrink-0 text-right text-[11px] opacity-70">
        {item.active ? "✓" : ""}
      </span>
    ),
    active: item.active,
    danger: item.danger,
    onMouseEnter: () => {
      onMouseEnter();
      onHoverItem(item.key);
    },
    onClick: () => onActivateItem(item.key),
  };
}
