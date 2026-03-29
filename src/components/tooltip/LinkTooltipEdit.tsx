import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { ConfirmGlyphButton } from "./TooltipShared";

export interface LinkTooltipEditProps {
  href: string;
  name: string;
  showName: boolean;
  inputPlaceholder: string;
  textPlaceholder: string;
  autoFocusTarget: "name" | "href";
  focusToken: string;
  onHrefChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LinkTooltipEdit({
  href,
  name,
  showName,
  inputPlaceholder,
  textPlaceholder,
  autoFocusTarget,
  focusToken,
  onHrefChange,
  onNameChange,
  onConfirm,
  onCancel,
}: LinkTooltipEditProps) {
  const hrefInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const isCreateMode = showName;
  const panelClassName = [
    "app-link-tooltip",
    "app-link-tooltip-edit",
    isCreateMode ? "app-link-tooltip-edit-create" : "",
    "editor-floating-panel",
    "editor-floating-panel-form",
    isCreateMode ? "editor-floating-panel-wide" : "editor-floating-panel-compact",
  ]
    .filter(Boolean)
    .join(" ");
  const rowsClassName = "editor-floating-rows";
  const rowClassName = "editor-floating-row";
  const actionsClassName = "editor-floating-row editor-floating-actions";

  useEffect(() => {
    const target = autoFocusTarget === "name" ? nameInputRef.current : hrefInputRef.current;
    target?.focus();
    target?.select();
  }, [autoFocusTarget, focusToken]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      onConfirm();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  const handleConfirm = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onConfirm();
  };

  return (
    <div className={panelClassName}>
      <div className={rowsClassName}>
        {showName ? (
          <div className={rowClassName}>
            <input
              ref={nameInputRef}
              className="app-link-tooltip-input editor-floating-input input input-ghost input-sm input-frosted w-full"
              onChange={(event) => {
                onNameChange(event.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder={textPlaceholder}
              value={name}
            />
          </div>
        ) : null}
        <div className={rowClassName}>
          <input
            ref={hrefInputRef}
            className="app-link-tooltip-input editor-floating-input input input-ghost input-sm input-frosted w-full"
            onChange={(event) => {
              onHrefChange(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            value={href}
          />
        </div>
        {href.trim() ? (
          <div className={actionsClassName}>
            <ConfirmGlyphButton
              label="Save link"
              className="app-link-tooltip-confirm"
              onClick={handleConfirm}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
