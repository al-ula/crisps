import type { ActiveBlock } from "../editor/blockEdit";
import type { BlockMenuIcon } from "../editor/blockMenuConfig";

export function getBlockIconForBlock(block: ActiveBlock | null): BlockMenuIcon {
  if (!block) {
    return { type: "text", value: "¶" };
  }

  switch (block.typeName) {
    case "heading":
      return {
        type: "text",
        value: `H${String(block.node.attrs.level ?? 1)}`,
      };
    case "blockquote":
      return { type: "text", value: "\"" };
    case "code_block":
      return { type: "text", value: "</>" };
    case "table":
      return { type: "svg", name: "table" };
    case "image-block":
      return { type: "svg", name: "image" };
    case "horizontal_rule":
      return { type: "text", value: "—" };
    case "list_item":
      if (block.node.attrs.checked != null) {
        return { type: "text", value: "[]" };
      }
      if (block.parent.type.name === "ordered_list") {
        return { type: "text", value: "1." };
      }
      return { type: "text", value: "•" };
    default:
      return { type: "text", value: "¶" };
  }
}

export function BlockIconRenderer({ icon }: { icon: BlockMenuIcon }) {
  if (icon.type === "text") {
    return (
      <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center text-current opacity-80">
        <span className="block translate-y-[0.5px] font-mono text-[10px] leading-none font-semibold">
          {icon.value}
        </span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center text-current opacity-80"
      aria-hidden="true"
    >
      {icon.name === "table" ? (
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path
            d="M20 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H20C21.1 21 22 20.1 22 19V5C22 3.9 21.1 3 20 3ZM20 5V8H5V5H20ZM15 19H10V10H15V19ZM5 10H8V19H5V10ZM17 19V10H20V19H17Z"
            fill="currentColor"
          />
        </svg>
      ) : null}
      {icon.name === "image" ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
          <path
            d="M15.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"
            fill="currentColor"
          />
          <path
            d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm16 0H5v7.92l3.375-2.7a1 1 0 0 1 1.25 0l4.3 3.44 1.368-1.367a1 1 0 0 1 1.414 0L19 14.586V5zM5 19h14v-1.586l-3-3-1.293 1.293a1 1 0 0 1-1.332.074L9 12.28l-4 3.2V19z"
            fill="currentColor"
          />
        </svg>
      ) : null}
      {icon.name === "trash" ? (
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path
            d="M20,6H16V5a3,3,0,0,0-3-3H11A3,3,0,0,0,8,5V6H4A1,1,0,0,0,4,8H5V19a3,3,0,0,0,3,3h8a3,3,0,0,0,3-3V8h1a1,1,0,0,0,0-2ZM10,5a1,1,0,0,1,1-1h2a1,1,0,0,1,1,1V6H10Zm7,14a1,1,0,0,1-1,1H8a1,1,0,0,1-1-1V8H17Z"
            fill="currentColor"
          />
        </svg>
      ) : null}
    </span>
  );
}
