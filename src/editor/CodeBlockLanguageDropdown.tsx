import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

const DEFAULT_TRIGGER_CLASS =
  "btn btn-ghost btn-xs btn-frosted btn-recessed dropdown-frosted-trigger h-[26px] min-h-[26px] w-auto max-w-36 justify-between gap-1.5 px-2 font-normal";
const DEFAULT_MENU_CLASS =
  "dropdown-content card card-frosted frosted-menu-shell absolute left-0 top-full z-[1020] mt-1 flex flex-col overflow-hidden p-1 shadow-none";
const DEFAULT_MENU_MAX_HEIGHT = 450;
const MENU_ROW_WRAPPER_CLASS =
  "w-full rounded-field border border-transparent bg-[var(--menu-bg-idle,transparent)] shadow-none transition-[background-color,box-shadow,color,opacity] hover:bg-[var(--menu-bg-hover,transparent)] hover:[box-shadow:var(--menu-shadow-hover,var(--frosted-shadow-hover))] focus-within:bg-[var(--menu-bg-hover,transparent)] focus-within:[box-shadow:var(--menu-shadow-hover,var(--frosted-shadow-hover))] data-[highlighted=true]:bg-[var(--menu-bg-hover,transparent)] data-[highlighted=true]:[box-shadow:var(--menu-shadow-hover,var(--frosted-shadow-hover))] active:bg-[var(--menu-bg-active,var(--menu-bg-hover,transparent))] active:[box-shadow:var(--menu-shadow-active,var(--frosted-shadow-pressed))]";
const MENU_ENTRY_CLASS =
  "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-field border border-transparent bg-transparent px-2.5 py-1 text-left text-xs text-base-content shadow-none transition-[color,opacity] disabled:text-[var(--menu-fg-disabled)] disabled:opacity-50 disabled:shadow-none";

export interface CodeBlockLanguageDropdownItem<T extends string> {
  value: T;
  label: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
  searchText?: string | readonly string[];
}

interface CodeBlockLanguageDropdownProps<T extends string> {
  value: T;
  items: CodeBlockLanguageDropdownItem<T>[];
  ariaLabel: string;
  disabled?: boolean;
  title?: string;
  menuWidthClassName?: string;
  triggerClassName?: string;
  menuClassName?: string;
  align?: "start" | "end";
  onSelect: (value: T) => void | Promise<void>;
  onOpenChange?: (open: boolean) => void;
  renderTriggerLabel?: (item: CodeBlockLanguageDropdownItem<T> | undefined) => ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchInputAriaLabel?: string;
  emptyText?: ReactNode;
  menuMaxHeight?: number;
}

interface CodeBlockMenuEntryProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  active?: boolean;
  danger?: boolean;
  submenu?: boolean;
}

function CodeBlockMenuEntry({
  label,
  leading,
  trailing,
  active: _active = false,
  danger = false,
  submenu = false,
  className,
  type = "button",
  ...props
}: CodeBlockMenuEntryProps) {
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

export function CodeBlockLanguageDropdown<T extends string>({
  value,
  items,
  ariaLabel,
  disabled = false,
  title,
  menuWidthClassName = "w-60",
  triggerClassName,
  menuClassName,
  align = "start",
  onSelect,
  onOpenChange,
  renderTriggerLabel,
  searchable = false,
  searchPlaceholder = "Search",
  searchInputAriaLabel,
  emptyText = "No results",
  menuMaxHeight = DEFAULT_MENU_MAX_HEIGHT,
}: CodeBlockLanguageDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedValue, setHighlightedValue] = useState<T | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef(new Map<T, HTMLLIElement | null>());
  const menuId = useId();
  const selectedItem = items.find((item) => item.value === value);
  const visibleItems = useMemo(
    () => filterItems(items, searchable ? query : ""),
    [items, query, searchable],
  );

  const closeMenu = (focusTrigger = false) => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && rootRef.current?.contains(activeElement)) {
      activeElement.blur();
    }
    setOpen(false);
    setQuery("");
    onOpenChange?.(false);
    if (focusTrigger) {
      window.setTimeout(() => {
        buttonRef.current?.focus();
      }, 0);
    }
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) {
      setHighlightedValue(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !searchable) return;
    const timer = window.setTimeout(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open, searchable]);

  useEffect(() => {
    if (!highlightedValue) return;

    const node = itemRefs.current.get(highlightedValue);
    node?.scrollIntoView({ block: "nearest" });
  }, [highlightedValue]);

  const selectItem = (item: CodeBlockLanguageDropdownItem<T>) => {
    if (item.disabled) return;
    closeMenu();
    void onSelect(item.value);
  };

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
        disabled={disabled}
        className={[
          DEFAULT_TRIGGER_CLASS,
          triggerClassName,
          open ? "btn-active" : "",
          disabled ? "cursor-default opacity-55" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={ariaLabel}
        aria-disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={title ?? ariaLabel}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => {
            const next = !current;
            if (!next) {
              setQuery("");
            }
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
        aria-hidden={!open}
        style={{
          maxHeight: `${menuMaxHeight}px`,
          pointerEvents: open ? undefined : "none",
          visibility: open ? undefined : "hidden",
        }}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {searchable ? (
          <div className="px-1 pb-1">
            <label className="flex items-center gap-2 rounded-field border border-base-content/10 bg-base-100/65 px-2.5 py-1.5 text-xs text-base-content/70 shadow-none focus-within:border-base-content/20">
              <svg
                width="12"
                height="12"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                className="shrink-0 opacity-60"
              >
                <circle
                  cx="9"
                  cy="9"
                  r="5.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M13.5 13.5 17 17"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={query}
                aria-label={searchInputAriaLabel ?? `${ariaLabel} search`}
                placeholder={searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-xs text-base-content outline-none placeholder:text-base-content/40"
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
              />
              {query ? (
                <button
                  type="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-base-content/45 transition-colors hover:text-base-content/75"
                  aria-label={`Clear ${ariaLabel} search`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              ) : null}
            </label>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2">
          <ul className="menu menu-sm menu-frosted flex w-full flex-col flex-nowrap p-0">
            {visibleItems.length > 0 ? (
              visibleItems.map((item) => (
                <li
                  key={item.value}
                  ref={(node) => {
                    itemRefs.current.set(item.value, node);
                  }}
                >
                  <div
                    className={[
                      MENU_ROW_WRAPPER_CLASS,
                      item.value === value
                        ? "bg-[var(--menu-bg-open,var(--menu-bg-hover,transparent))] [box-shadow:var(--menu-shadow-open,var(--frosted-shadow-open))]"
                        : "",
                      item.disabled
                        ? "bg-[var(--menu-bg-disabled,transparent)] text-[var(--menu-fg-disabled)] opacity-50 shadow-none"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    data-highlighted={
                      item.value === highlightedValue &&
                      item.value !== value &&
                      !item.disabled
                        ? "true"
                        : undefined
                    }
                  >
                    <CodeBlockMenuEntry
                      role="menuitemradio"
                      aria-checked={item.value === value}
                      active={item.value === value}
                      disabled={item.disabled}
                      leading={item.leading}
                      label={item.label}
                      trailing={item.trailing}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onMouseEnter={() => {
                        if (!item.disabled) {
                          setHighlightedValue(item.value);
                        }
                      }}
                      onClick={() => {
                        selectItem(item);
                      }}
                    />
                  </div>
                </li>
              ))
            ) : (
              <li className="px-1">
                <div className="px-2.5 py-2 text-xs text-base-content/55">
                  {emptyText}
                </div>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function filterItems<T extends string>(
  items: CodeBlockLanguageDropdownItem<T>[],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;

  return items.filter((item) =>
    buildSearchText(item).some((value) => value.includes(normalizedQuery)),
  );
}

function buildSearchText<T extends string>(item: CodeBlockLanguageDropdownItem<T>) {
  const provided = item.searchText
    ? Array.isArray(item.searchText)
      ? item.searchText
      : [item.searchText]
    : [];
  const labelText = typeof item.label === "string" ? [item.label] : [];

  return [item.value, ...labelText, ...provided].map((value) =>
    value.trim().toLowerCase(),
  );
}
