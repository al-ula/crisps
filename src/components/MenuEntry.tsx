import type { ButtonHTMLAttributes, ReactNode } from "react";

const MENU_ENTRY_CLASS =
  "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-field border border-transparent bg-[var(--menu-bg-idle,transparent)] px-2.5 py-1 text-left text-xs text-base-content shadow-none transition-[background-color,box-shadow,color,opacity] hover:bg-[var(--menu-bg-hover,transparent)] hover:[box-shadow:var(--menu-shadow-hover,var(--frosted-shadow-hover))] focus-visible:bg-[var(--menu-bg-hover,transparent)] focus-visible:[box-shadow:var(--menu-shadow-hover,var(--frosted-shadow-hover))] active:bg-[var(--menu-bg-active,var(--menu-bg-hover,transparent))] active:[box-shadow:var(--menu-shadow-active,var(--frosted-shadow-pressed))] disabled:bg-[var(--menu-bg-disabled,transparent)] disabled:text-[var(--menu-fg-disabled)] disabled:opacity-50 disabled:shadow-none";

export interface MenuEntryProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  active?: boolean;
  danger?: boolean;
  submenu?: boolean;
}

export function MenuEntry({
  label,
  leading,
  trailing,
  active = false,
  danger = false,
  submenu = false,
  className,
  type = "button",
  ...props
}: MenuEntryProps) {
  const resolvedTrailing =
    trailing === undefined && submenu ? (
      <span
        className="flex h-4 w-3 items-center justify-center text-base-content/50"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 12 12"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.5 2.5 8 6l-3.5 3.5" />
        </svg>
      </span>
    ) : (
      trailing
    );

  return (
    <button
      type={type}
      className={[
        MENU_ENTRY_CLASS,
        active
          ? "bg-(--menu-bg-open,var(--menu-bg-hover,transparent)) [box-shadow:var(--menu-shadow-open,var(--frosted-shadow-open))]"
          : "",
        danger ? "text-error" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {leading}
        <span className="min-w-0 truncate">{label}</span>
      </span>
      {resolvedTrailing ? (
        <span className="flex shrink-0 items-center self-center">
          {resolvedTrailing}
        </span>
      ) : null}
    </button>
  );
}
