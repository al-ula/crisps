import type {
  CSSProperties,
  DragEvent as ReactDragEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { BlockMenuIcon } from "../editor/blockMenuConfig";
import { BlockIconRenderer } from "./BlockIcon";

interface BlockHandleProps {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  style: CSSProperties;
  visible: boolean;
  menuIcon: BlockMenuIcon;
  onOpenMenu: () => void;
  onMenuPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerEnter: () => void;
  onDragPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDragStart: (event: ReactDragEvent<HTMLButtonElement>) => void;
  onDragEnd: (event: ReactDragEvent<HTMLButtonElement>) => void;
}

export function BlockHandle({
  containerRef,
  style,
  visible,
  menuIcon,
  onOpenMenu,
  onMenuPointerDown,
  onPointerEnter,
  onDragPointerDown,
  onDragStart,
  onDragEnd,
}: BlockHandleProps) {
  return (
    <div
      ref={(node) => {
        containerRef.current = node;
      }}
      className={`block-side-controls${visible ? " is-visible" : ""}`}
      style={style}
      onPointerEnter={onPointerEnter}
    >
      <div className="block-handle-rail">
        <button
          type="button"
          className="block-handle-btn"
          aria-label="Block menu"
          data-role="block-menu-trigger"
          onPointerDown={onMenuPointerDown}
          onPointerUp={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpenMenu();
          }}
        >
          <BlockMenuButtonIcon icon={menuIcon} />
        </button>
        <button
          type="button"
          className="block-handle-btn"
          aria-label="Drag block"
          draggable
          onPointerDown={onDragPointerDown}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <BlockDragHandleIcon />
        </button>
      </div>
    </div>
  );
}

function BlockMenuButtonIcon({ icon }: { icon: BlockMenuIcon }) {
  return <BlockIconRenderer icon={icon} />;
}

function BlockDragHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M11 18C11 19.1 10.1 20 9 20C7.9 20 7 19.1 7 18C7 16.9 7.9 16 9 16C10.1 16 11 16.9 11 18ZM9 10C7.9 10 7 10.9 7 12C7 13.1 7.9 14 9 14C10.1 14 11 13.1 11 12C11 10.9 10.1 10 9 10ZM9 4C7.9 4 7 4.9 7 6C7 7.1 7.9 8 9 8C10.1 8 11 7.1 11 6C11 4.9 10.1 4 9 4ZM15 8C16.1 8 17 7.1 17 6C17 4.9 16.1 4 15 4C13.9 4 13 4.9 13 6C13 7.1 13.9 8 15 8ZM15 10C13.9 10 13 10.9 13 12C13 13.1 13.9 14 15 14C16.1 14 17 13.1 17 12C17 10.9 16.1 10 15 10ZM15 16C13.9 16 13 16.9 13 18C13 19.1 13.9 20 15 20C16.1 20 17 19.1 17 18C17 16.9 16.1 16 15 16Z"
        fill="currentColor"
      />
    </svg>
  );
}
