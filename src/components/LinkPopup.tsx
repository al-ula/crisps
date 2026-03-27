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
      className="fixed z-[1015] flex min-w-[min(24rem,calc(100vw-16px))] flex-col gap-2.5 max-sm:min-w-[min(20rem,calc(100vw-16px))]"
      style={style}
      onSubmit={handleSubmit}
    >
      {value.showName && (
        <div className="card card-frosted p-2.5">
          <input
            ref={nameInputRef}
            className="input input-ghost input-sm input-frosted w-full"
            value={value.name}
            placeholder="Link text"
            onChange={(event) => {
              onChange({ name: event.target.value });
            }}
          />
        </div>
      )}

      <div className="card card-frosted bg-base-200/90 p-2.5">
        <input
          ref={hrefInputRef}
          className="input input-ghost input-sm input-frosted w-full"
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
