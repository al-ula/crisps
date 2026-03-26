import type {
  CSSProperties,
  DragEvent as ReactDragEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from "react";

interface BlockHandleProps {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  style: CSSProperties;
  visible: boolean;
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
          <BlockMenuIcon />
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

function BlockMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M5 5.75A1.75 1.75 0 0 1 6.75 4h10.5A1.75 1.75 0 0 1 19 5.75v3.5A1.75 1.75 0 0 1 17.25 11H6.75A1.75 1.75 0 0 1 5 9.25Zm0 9A1.75 1.75 0 0 1 6.75 13h4.5A1.75 1.75 0 0 1 13 14.75v3.5A1.75 1.75 0 0 1 11.25 20h-4.5A1.75 1.75 0 0 1 5 18.25Zm9 0A1.75 1.75 0 0 1 15.75 13h1.5A1.75 1.75 0 0 1 19 14.75v3.5A1.75 1.75 0 0 1 17.25 20h-1.5A1.75 1.75 0 0 1 14 18.25Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BlockDragHandleIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M3.5 9.83366C3.35833 9.83366 3.23961 9.78571 3.14383 9.68983C3.04794 9.59394 3 9.47516 3 9.33349C3 9.19171 3.04794 9.07299 3.14383 8.97733C3.23961 8.88155 3.35833 8.83366 3.5 8.83366H12.5C12.6417 8.83366 12.7604 8.8816 12.8562 8.97749C12.9521 9.07338 13 9.19216 13 9.33383C13 9.4756 12.9521 9.59433 12.8562 9.68999C12.7604 9.78577 12.6417 9.83366 12.5 9.83366H3.5ZM3.5 7.16699C3.35833 7.16699 3.23961 7.11905 3.14383 7.02316C3.04794 6.92727 3 6.80849 3 6.66683C3 6.52505 3.04794 6.40633 3.14383 6.31066C3.23961 6.21488 3.35833 6.16699 3.5 6.16699H12.5C12.6417 6.16699 12.7604 6.21494 12.8562 6.31083C12.9521 6.40671 13 6.52549 13 6.66716C13 6.80894 12.9521 6.92766 12.8562 7.02333C12.7604 7.1191 12.6417 7.16699 12.5 7.16699H3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
