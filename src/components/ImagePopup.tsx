import type { SubmitEvent, RefObject } from "react";

import { OverlayPopup } from "./OverlayPopup";

export interface ImagePopupValue {
  src: string;
  alt: string;
  fileName: string;
}

interface ImagePopupProps {
  popupRef: RefObject<HTMLFormElement | null>;
  pathInputRef: RefObject<HTMLInputElement | null>;
  altInputRef: RefObject<HTMLInputElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  value: ImagePopupValue | null;
  onChange: (patch: Partial<ImagePopupValue>) => void;
  onBrowsePath: () => void;
  onPickFile: (file: File | undefined) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ImagePopup({
  popupRef,
  pathInputRef,
  altInputRef,
  fileInputRef,
  value,
  onChange,
  onBrowsePath,
  onPickFile,
  onSubmit,
  onCancel,
}: ImagePopupProps) {
  if (!value) return null;

  const tintedInputClass =
    "input input-ghost input-md input-frosted w-full border border-base-content/12 bg-base-200/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <OverlayPopup onCancel={onCancel}>
      <form
        ref={popupRef}
        className="card card-frosted w-full gap-4 border border-base-content/10 bg-base-100/88 p-4 shadow-[0_22px_80px_rgba(15,23,42,0.22)] sm:p-5"
        onSubmit={handleSubmit}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="space-y-1">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-base-content/45">
            Insert Image
          </p>
          <h2 className="font-serif text-xl leading-tight text-base-content">
            Path first, embed when needed
          </h2>
          <p className="text-sm text-base-content/65">
            Use a path or URL for normal insertion, or embed a local image as
            base64.
          </p>
        </div>

        <label className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-base-content/55">
            Path or URL
          </span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={pathInputRef}
              className={tintedInputClass}
              value={value.src}
              placeholder="images/cover.png or https://example.com/cover.png"
              onChange={(event) => {
                onChange({ src: event.target.value });
              }}
            />
            <button
              type="button"
              className="btn btn-soft btn-md btn-frosted btn-recessed shrink-0"
              onClick={onBrowsePath}
            >
              Browse
            </button>
          </div>
        </label>

        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-base-content/55">
            Embed
          </span>
          <div className="rounded-2xl border border-dashed border-base-content/12 bg-base-200/45 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="input input-ghost input-md input-frosted flex-1 items-center">
                <span className="truncate text-sm text-base-content/60">
                  {value.fileName || "Embed local file as base64"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {value.fileName ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-frosted"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                      onPickFile(undefined);
                    }}
                  >
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-soft btn-sm btn-frosted btn-recessed shrink-0"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                >
                  Select file
                </button>
              </div>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              onPickFile(event.target.files?.[0]);
            }}
          />
        </div>

        <label className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-base-content/55">
            Alt text
          </span>
          <input
            ref={altInputRef}
            className={tintedInputClass}
            value={value.alt}
            placeholder="Optional description"
            onChange={(event) => {
              onChange({ alt: event.target.value });
            }}
          />
        </label>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-frosted block-handle-ghost-btn text-(--color-warning) hover:text-(--color-warning-content) focus-visible:text-(--color-warning-content) active:text-(--color-warning-content) [--btn-bg-hover:color-mix(in_oklch,var(--color-warning)_22%,transparent)] [--btn-bg-open:color-mix(in_oklch,var(--color-warning)_28%,transparent)] [--btn-bg-pressed:color-mix(in_oklch,var(--color-warning)_34%,transparent)] [--btn-border-hover:transparent] [--btn-border-open:transparent] [--btn-border-active:transparent]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-soft btn-sm btn-frosted btn-recessed"
          >
            Insert image
          </button>
        </div>
      </form>
    </OverlayPopup>
  );
}
