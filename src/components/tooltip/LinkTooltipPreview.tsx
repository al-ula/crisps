import type { MouseEvent } from "react";
import {
  EditGlyphButton,
  LinkGlyph,
  RemoveGlyphButton,
  preventTooltipMouseDownDefault,
} from "./TooltipShared";

export interface LinkTooltipPreviewProps {
  href: string;
  onOpen: () => void | Promise<void>;
  onEdit: () => void;
  onRemove: () => void;
}

export function LinkTooltipPreview({
  href,
  onOpen,
  onEdit,
  onRemove,
}: LinkTooltipPreviewProps) {
  const handleOpen = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void onOpen();
  };

  const handleEdit = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onEdit();
  };

  const handleRemove = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onRemove();
  };

  return (
    <div className="app-link-tooltip app-link-tooltip-preview editor-floating-panel">
      <LinkGlyph />
      <button
        type="button"
        role="link"
        className="app-link-tooltip-url editor-floating-link"
        title={href}
        onMouseDown={preventTooltipMouseDownDefault}
        onClick={handleOpen}
      >
        {href}
      </button>
      <EditGlyphButton label="Edit link" onClick={handleEdit} />
      <RemoveGlyphButton label="Remove link" onClick={handleRemove} />
    </div>
  );
}
