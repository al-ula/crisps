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
      className="fixed z-[1200] w-[min(320px,calc(100vw-16px))]"
      style={style}
      onSubmit={handleSubmit}
    >
      <div className="card card-frosted p-2.5">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            className="input input-ghost input-sm input-frosted flex-1"
            value={value.value}
            placeholder="x^2 + y^2"
            onChange={(event) => {
              onChange({ value: event.target.value });
            }}
          />
          <button type="submit" className="btn btn-soft btn-xs btn-frosted btn-recessed">
            Apply
          </button>
        </div>
      </div>
    </form>
  );
}
