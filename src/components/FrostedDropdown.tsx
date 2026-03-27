import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MenuEntry } from "./MenuEntry";

const DEFAULT_TRIGGER_CLASS =
  "btn btn-ghost btn-xs btn-frosted btn-recessed dropdown-frosted-trigger h-[26px] min-h-[26px] w-auto max-w-36 justify-between gap-1.5 px-2 font-normal";
const DEFAULT_MENU_CLASS =
  "dropdown-content card card-frosted frosted-menu-shell absolute left-0 top-full z-[1020] mt-1 p-1 shadow-none";

export interface FrostedDropdownItem<T extends string> {
  value: T;
  label: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
}

interface FrostedDropdownProps<T extends string> {
  value: T;
  items: FrostedDropdownItem<T>[];
  ariaLabel: string;
  title?: string;
  menuWidthClassName?: string;
  triggerClassName?: string;
  menuClassName?: string;
  align?: "start" | "end";
  onSelect: (value: T) => void | Promise<void>;
  onOpenChange?: (open: boolean) => void;
  renderTriggerLabel?: (item: FrostedDropdownItem<T> | undefined) => ReactNode;
}

export function FrostedDropdown<T extends string>({
  value,
  items,
  ariaLabel,
  title,
  menuWidthClassName = "w-44",
  triggerClassName,
  menuClassName,
  align = "start",
  onSelect,
  onOpenChange,
  renderTriggerLabel,
}: FrostedDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  const selectedItem = items.find((item) => item.value === value);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={[
        "dropdown dropdown-bottom dropdown-frosted",
        align === "end" ? "dropdown-end" : "dropdown-start",
        open ? "dropdown-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        ref={buttonRef}
        type="button"
        className={[DEFAULT_TRIGGER_CLASS, triggerClassName, open ? "btn-active" : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={title ?? ariaLabel}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={() => {
          setOpen((current) => {
            const next = !current;
            onOpenChange?.(next);
            return next;
          });
        }}
      >
        <span className="truncate">
          {renderTriggerLabel?.(selectedItem) ?? selectedItem?.label ?? null}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className={[
            "shrink-0 opacity-70 transition-transform duration-150",
            open ? "rotate-180" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <path
            d="M5 7.5 10 12.5 15 7.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        id={menuId}
        role="menu"
        aria-label={`${ariaLabel} options`}
        className={[DEFAULT_MENU_CLASS, menuWidthClassName, menuClassName]
          .filter(Boolean)
          .join(" ")}
      >
        <ul className="menu menu-sm menu-frosted w-full p-0">
          {items.map((item) => (
            <li key={item.value}>
              <MenuEntry
                role="menuitemradio"
                aria-checked={item.value === value}
                active={item.value === value}
                disabled={item.disabled}
                label={item.label}
                trailing={item.trailing}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  onOpenChange?.(false);
                  void onSelect(item.value);
                }}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
