import type { MouseEvent, MouseEventHandler, ReactNode } from "react";

const LINK_PATH =
  "M84 128.6H54.6C36.6 128.6 22 114 22 96c0-9 3.7-17.2 9.6-23.1 5.9-5.9 14.1-9.6 23.1-9.6H84m24 65.3h29.4c9 0 17.2-3.7 23.1-9.6 5.9-5.9 9.6-14.1 9.6-23.1 0-18-14.6-32.6-32.6-32.6H108M67.9 96h56.2";
const EDIT_PATH = "M44 132l16.5-4.1L128 60.4 111.6 44 44 111.6zm75.6-88L136 60.4";
const REMOVE_PATH = "M56 58h80m-60 0V42h40v16m12 0l-6 92H70l-6-92";
const CONFIRM_PATH = "M40 101.3 72 133l80-79";

export function TooltipIconButton(props: {
  children: ReactNode;
  label: string;
  className?: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      className={[
        "editor-floating-action btn btn-ghost btn-xs btn-square btn-frosted btn-recessed",
        props.className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={props.label}
      title={props.label}
      onMouseDown={preventTooltipMouseDownDefault}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export function TooltipIcon(props: { path: string }) {
  return (
    <svg viewBox="0 0 192 192" aria-hidden="true">
      <path
        d={props.path}
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function preventTooltipMouseDownDefault(event: MouseEvent) {
  event.preventDefault();
}

export function LinkGlyph() {
  return (
    <span className="app-link-tooltip-icon editor-floating-icon" aria-hidden="true">
      <TooltipIcon path={LINK_PATH} />
    </span>
  );
}

export function EditGlyphButton(props: {
  label: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <TooltipIconButton
      label={props.label}
      className="app-link-tooltip-action"
      onClick={props.onClick}
    >
      <TooltipIcon path={EDIT_PATH} />
    </TooltipIconButton>
  );
}

export function RemoveGlyphButton(props: {
  label: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <TooltipIconButton
      label={props.label}
      className="app-link-tooltip-action"
      onClick={props.onClick}
    >
      <TooltipIcon path={REMOVE_PATH} />
    </TooltipIconButton>
  );
}

export function ConfirmGlyphButton(props: {
  label: string;
  className?: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <TooltipIconButton
      label={props.label}
      className={["app-link-tooltip-action", props.className ?? ""].filter(Boolean).join(" ")}
      onClick={props.onClick}
    >
      <TooltipIcon path={CONFIRM_PATH} />
    </TooltipIconButton>
  );
}
