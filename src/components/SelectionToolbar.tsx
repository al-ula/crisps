import type { CSSProperties, ReactNode, RefObject } from "react";
import { FrostedDropdown } from "./FrostedDropdown";
import type {
  EditorAction,
  EditorBlockType,
  EditorStateSnapshot,
} from "../editor/types";

const BLOCK_TYPE_OPTIONS: Array<{
  value: EditorBlockType;
  label: string;
}> = [
  { value: "paragraph", label: "Paragraph" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" },
  { value: "h5", label: "Heading 5" },
  { value: "h6", label: "Heading 6" },
  { value: "quote", label: "Quote" },
];

const TOOLBAR_BTN =
  "btn btn-ghost btn-xs btn-square btn-frosted btn-recessed h-[26px] min-h-[26px] w-7";
const TOOLBAR_BTN_ACTIVE = `${TOOLBAR_BTN} btn-active btn-recessed-open`;
interface SelectionToolbarProps {
  editorState: EditorStateSnapshot;
  style: CSSProperties;
  toolbarRef: RefObject<HTMLDivElement | null>;
  visible: boolean;
  onAction: (action: EditorAction) => void | Promise<void>;
  onRefreshPosition: () => void;
}

export function SelectionToolbar({
  editorState,
  style,
  toolbarRef,
  visible,
  onAction,
  onRefreshPosition,
}: SelectionToolbarProps) {
  if (!visible) return null;

  const blockTypeValue = normalizeBlockType(editorState.blockType);

  return (
    <div
      ref={toolbarRef}
      className="card card-frosted fixed z-1010 overflow-visible p-1"
      style={style}
      role="toolbar"
      aria-label="Selection formatting"
      onFocus={onRefreshPosition}
      onBlur={onRefreshPosition}
    >
      <div className="flex items-center gap-0.5">
        <FrostedDropdown
          value={blockTypeValue}
          items={BLOCK_TYPE_OPTIONS}
          ariaLabel="Block type"
          onSelect={(blockType) =>
            onAction({
              action: "blockType",
              blockType,
            })
          }
        />

        <span className="mx-0.75 h-4 w-px shrink-0 bg-base-content/10" />

        <FormatButton
          active={editorState.bold}
          label="Bold"
          title="Bold"
          onAction={() => onAction({ action: "bold" })}
        >
          B
        </FormatButton>
        <FormatButton
          active={editorState.italic}
          label="Italic"
          title="Italic"
          onAction={() => onAction({ action: "italic" })}
        >
          I
        </FormatButton>
        <FormatButton
          active={editorState.strikethrough}
          label="Strikethrough"
          title="Strikethrough"
          onAction={() => onAction({ action: "strikethrough" })}
        >
          S
        </FormatButton>
        <FormatButton
          active={editorState.latex}
          label="Inline latex"
          title="Inline latex"
          onAction={() => onAction({ action: "latex" })}
        >
          fx
        </FormatButton>
        <FormatButton
          active={editorState.code}
          label="Inline code"
          title="Inline code"
          onAction={() => onAction({ action: "code" })}
        >
          {"</>"}
        </FormatButton>

        <span className="mx-0.75 h-4 w-px shrink-0 bg-base-content/10" />

        <FormatButton
          label="Link"
          title="Link"
          onAction={() => onAction({ action: "createLink" })}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 192 192"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M84 128.6H54.6C36.6 128.6 22 114 22 96c0-9 3.7-17.2 9.6-23.1 5.9-5.9 14.1-9.6 23.1-9.6H84m24 65.3h29.4c9 0 17.2-3.7 23.1-9.6 5.9-5.9 9.6-14.1 9.6-23.1 0-18-14.6-32.6-32.6-32.6H108M67.9 96h56.2"
              stroke="currentColor"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </FormatButton>
      </div>
    </div>
  );
}

function FormatButton(props: {
  active?: boolean;
  children: ReactNode;
  label: string;
  title: string;
  onAction: () => void | Promise<void>;
}) {
  const { active = false, children, label, title, onAction } = props;

  return (
    <button
      type="button"
      className={active ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN}
      aria-label={label}
      title={title}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={() => {
        void onAction();
      }}
    >
      {children}
    </button>
  );
}

function normalizeBlockType(blockType: string): EditorBlockType {
  switch (blockType) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
    case "quote":
      return blockType;
    default:
      return "paragraph";
  }
}
