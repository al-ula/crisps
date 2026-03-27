import type { ButtonHTMLAttributes, ReactNode } from "react";

const MENU_ENTRY_CLASS =
  "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-field bg-[var(--menu-bg-idle,transparent)] px-2.5 py-1 text-left text-xs text-base-content shadow-none transition-[background-color,box-shadow,color,opacity] hover:bg-[var(--menu-bg-hover,transparent)] hover:[box-shadow:var(--menu-shadow-hover,var(--frosted-shadow-hover))] focus-visible:bg-[var(--menu-bg-hover,transparent)] focus-visible:[box-shadow:var(--menu-shadow-hover,var(--frosted-shadow-hover))] active:bg-[var(--menu-bg-active,var(--menu-bg-hover,transparent))] active:[box-shadow:var(--menu-shadow-active,var(--frosted-shadow-pressed))] disabled:bg-[var(--menu-bg-disabled,transparent)] disabled:text-[var(--menu-fg-disabled)] disabled:opacity-50 disabled:shadow-none";

export interface MenuEntryProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
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
      <span className="text-[15px] leading-none opacity-50" aria-hidden="true">
        ›
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
          ? "bg-[var(--menu-bg-open,var(--menu-bg-hover,transparent))] [box-shadow:var(--menu-shadow-open,var(--frosted-shadow-open))]"
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
      {resolvedTrailing ?? null}
    </button>
  );
}
