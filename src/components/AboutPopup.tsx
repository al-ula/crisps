import pkg from "../../package.json";
import { OverlayPopup } from "./OverlayPopup";

interface AboutPopupProps {
  onCancel: () => void;
}

export function AboutPopup({ onCancel }: AboutPopupProps) {
  return (
    <OverlayPopup onCancel={onCancel}>
      <section
        className="card card-frosted w-full gap-5 border border-base-content/10 bg-base-100/88 p-5 shadow-[0_22px_80px_rgba(15,23,42,0.22)] sm:p-6"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        aria-label="About Crisps"
      >
        <div className="space-y-2">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-base-content/45">
            About
          </p>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-serif text-2xl leading-tight text-base-content">
                Crisps
              </h2>
              <p className="text-sm text-base-content/65">
                Markdown editor built with Tauri, React, and TypeScript.
              </p>
            </div>
            <div className="badge badge-frosted h-8 shrink-0 px-3 text-[11px] font-semibold tracking-[0.12em]">
              v{pkg.version}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius-box)] border border-base-content/10 bg-base-200/40 px-3 py-3">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-base-content/45">
              Stack
            </p>
            <p className="mt-1 text-sm text-base-content/72">
              Tauri desktop shell with React and Milkdown editing.
            </p>
          </div>
          <div className="rounded-[var(--radius-box)] border border-base-content/10 bg-base-200/40 px-3 py-3">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-base-content/45">
              Documents
            </p>
            <p className="mt-1 text-sm text-base-content/72">
              Markdown-first editing with source and visual modes.
            </p>
          </div>
          <div className="rounded-[var(--radius-box)] border border-base-content/10 bg-base-200/40 px-3 py-3">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-base-content/45">
              UI
            </p>
            <p className="mt-1 text-sm text-base-content/72">
              Custom frosted controls instead of a native desktop menu.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            className="btn btn-soft btn-sm btn-frosted btn-recessed"
            onClick={onCancel}
          >
            Close
          </button>
        </div>
      </section>
    </OverlayPopup>
  );
}
