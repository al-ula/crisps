import { createPortal } from "react-dom";
import type {
  CSSProperties,
  DragEvent as ReactDragEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import type {
  BlockMenuIcon,
  BlockMenuItemKey,
  BlockMenuModel,
} from "../editor/blockMenuConfig";
import type { BlockDropTarget } from "../editor/blockEdit";
import { BlockHandle } from "./BlockHandle";
import { BlockMenu } from "./BlockMenu";

interface BlockEditorOverlayProps {
  blockHandleRef: RefObject<HTMLDivElement | null>;
  blockMenuRef: RefObject<HTMLDivElement | null>;
  handleStyle: CSSProperties;
  handleVisible: boolean;
  menuDisabled: boolean;
  menuIcon: BlockMenuIcon;
  onOpenMenu: () => void;
  onMenuPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onHandlePointerEnter: () => void;
  onDragPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDragStart: (event: ReactDragEvent<HTMLButtonElement>) => void;
  onDragEnd: (event: ReactDragEvent<HTMLButtonElement>) => void;
  dropIndicatorState: {
    placement: BlockDropTarget["placement"];
    style: CSSProperties;
  } | null;
  blockMenuStyle: CSSProperties;
  blockMenuVisible: boolean;
  blockMenuItems: BlockMenuModel;
  blockMenuActiveItemKey: BlockMenuItemKey | null;
  onHoverMenuItem: (key: BlockMenuItemKey) => void;
  onActivateMenuItem: (key: BlockMenuItemKey) => void;
  onCloseMenu: () => void;
}

export function BlockEditorOverlay({
  blockHandleRef,
  blockMenuRef,
  handleStyle,
  handleVisible,
  menuDisabled,
  menuIcon,
  onOpenMenu,
  onMenuPointerDown,
  onHandlePointerEnter,
  onDragPointerDown,
  onDragStart,
  onDragEnd,
  dropIndicatorState,
  blockMenuStyle,
  blockMenuVisible,
  blockMenuItems,
  blockMenuActiveItemKey,
  onHoverMenuItem,
  onActivateMenuItem,
  onCloseMenu,
}: BlockEditorOverlayProps) {
  return (
    <>
      {typeof document !== "undefined"
        ? createPortal(
            <BlockHandle
              containerRef={blockHandleRef}
              style={handleStyle}
              visible={handleVisible}
              menuDisabled={menuDisabled}
              menuIcon={menuIcon}
              onOpenMenu={onOpenMenu}
              onMenuPointerDown={onMenuPointerDown}
              onPointerEnter={onHandlePointerEnter}
              onDragPointerDown={onDragPointerDown}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />,
            document.body,
          )
        : null}
      {dropIndicatorState ? (
        <div
          className={`block-drop-indicator block-drop-indicator-${dropIndicatorState.placement}`}
          style={dropIndicatorState.style}
        />
      ) : null}
      <BlockMenu
        style={blockMenuStyle}
        visible={blockMenuVisible}
        items={blockMenuItems}
        activeItemKey={blockMenuActiveItemKey}
        menuRef={blockMenuRef}
        onHoverItem={onHoverMenuItem}
        onActivateItem={onActivateMenuItem}
        onClose={onCloseMenu}
      />
    </>
  );
}
