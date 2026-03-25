import type { CSSProperties, FormEvent, RefObject } from "react";

export interface LinkPopupValue {
  from: number;
  to: number;
  href: string;
  name: string;
  showName: boolean;
}

interface LinkPopupProps {
  popupRef: RefObject<HTMLFormElement | null>;
  hrefInputRef: RefObject<HTMLInputElement | null>;
  nameInputRef: RefObject<HTMLInputElement | null>;
  style: CSSProperties;
  value: LinkPopupValue | null;
  onChange: (patch: Partial<LinkPopupValue>) => void;
  onSubmit: () => void;
}

export function LinkPopup({
  popupRef,
  hrefInputRef,
  nameInputRef,
  style,
  value,
  onChange,
  onSubmit,
}: LinkPopupProps) {
  if (!value) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      ref={popupRef}
      className="link-popup"
      style={style}
      onSubmit={handleSubmit}
    >
      {value.showName && (
        <div className="link-popup-island">
          <input
            ref={nameInputRef}
            className="link-popup-input"
            value={value.name}
            placeholder="Link text"
            onChange={(event) => {
              onChange({ name: event.target.value });
            }}
          />
        </div>
      )}

      <div className="link-popup-island link-popup-island-bottom">
        <input
          ref={hrefInputRef}
          className="link-popup-input"
          value={value.href}
          placeholder="https://example.com"
          onChange={(event) => {
            onChange({ href: event.target.value });
          }}
        />
      </div>
    </form>
  );
}
