import type { CSSProperties, FormEvent, RefObject } from "react";

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      ref={popupRef}
      className="latex-popup"
      style={style}
      onSubmit={handleSubmit}
    >
      <div className="latex-popup-island">
        <input
          ref={inputRef}
          className="latex-popup-input"
          value={value.value}
          placeholder="x^2 + y^2"
          onChange={(event) => {
            onChange({ value: event.target.value });
          }}
        />
        <button type="submit" className="latex-popup-submit">
          Apply
        </button>
      </div>
    </form>
  );
}
