import type { CSSProperties, SubmitEvent, RefObject } from "react";

export interface LatexPopupValue {
  from: number;
  to: number;
  pos: number;
  value: string;
}

interface LatexPopupProps {
  popupRef: RefObject<HTMLFormElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  style: CSSProperties;
  value: LatexPopupValue | null;
  onChange: (patch: Partial<LatexPopupValue>) => void;
  onSubmit: () => void;
}

export function LatexPopup({
  popupRef,
  inputRef,
  style,
  value,
  onChange,
  onSubmit,
}: LatexPopupProps) {
  if (!value) return null;

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      ref={popupRef}
      className="fixed z-1200 w-[min(320px,calc(100vw-16px))]"
      style={style}
      onSubmit={handleSubmit}
    >
      <div className="editor-floating-panel editor-floating-panel-form editor-floating-panel-compact card card-frosted p-2.5">
        <div className="editor-floating-rows">
          <div className="editor-floating-row">
            <input
              ref={inputRef}
              className="editor-floating-input input input-ghost input-sm input-frosted w-full"
              value={value.value}
              placeholder="x^2 + y^2"
              onChange={(event) => {
                onChange({ value: event.target.value });
              }}
            />
          </div>
          <div className="editor-floating-row editor-floating-actions">
            <button
              type="submit"
              className="editor-floating-action btn btn-soft btn-xs btn-frosted btn-recessed"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
