import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MenuEntry } from "./MenuEntry";

const DEFAULT_TRIGGER_CLASS =
  "btn btn-ghost btn-xs btn-frosted btn-recessed dropdown-frosted-trigger h-[26px] min-h-[26px] w-auto max-w-36 justify-between gap-1.5 px-2 font-normal";
const DEFAULT_MENU_CLASS =
  "dropdown-content card card-frosted frosted-menu-shell absolute left-0 top-full z-[1020] mt-1 overflow-y-auto overflow-x-hidden p-1 shadow-none";
const DEFAULT_MENU_MAX_HEIGHT = 450;

export interface FrostedDropdownItem<T extends string> {
  value: T;
  label: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
  searchText?: string | readonly string[];
}

interface FrostedDropdownProps<T extends string> {
  value: T;
  items: FrostedDropdownItem<T>[];
  ariaLabel: string;
  disabled?: boolean;
  title?: string;
  menuWidthClassName?: string;
  triggerClassName?: string;
  menuClassName?: string;
  align?: "start" | "end";
  onSelect: (value: T) => void | Promise<void>;
  onOpenChange?: (open: boolean) => void;
  renderTriggerLabel?: (item: FrostedDropdownItem<T> | undefined) => ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchInputAriaLabel?: string;
  emptyText?: ReactNode;
  menuMaxHeight?: number;
}

export function FrostedDropdown<T extends string>({
  value,
  items,
  ariaLabel,
  disabled = false,
  title,
  menuWidthClassName = "w-44",
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
}: FrostedDropdownProps<T>) {
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
  const enabledVisibleItems = useMemo(
    () => visibleItems.filter((item) => !item.disabled),
    [visibleItems],
  );

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!rootRef.current?.contains(document.activeElement)) return;

      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
        buttonRef.current?.focus();
        return;
      }

      if (enabledVisibleItems.length === 0) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setHighlightedValue((current) =>
          getNextHighlightedValue(enabledVisibleItems, current, direction),
        );
        return;
      }

      if (event.key === "Enter") {
        if (!highlightedValue) return;
        const activeItem = enabledVisibleItems.find(
          (item) => item.value === highlightedValue,
        );
        if (!activeItem) return;
        event.preventDefault();
        setOpen(false);
        setQuery("");
        onOpenChange?.(false);
        void onSelect(activeItem.value);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabledVisibleItems, highlightedValue, onOpenChange, onSelect, open]);

  useEffect(() => {
    if (!open) {
      setHighlightedValue(null);
      return;
    }

    const nextHighlighted =
      enabledVisibleItems.find((item) => item.value === value)?.value ??
      enabledVisibleItems[0]?.value ??
      null;
    setHighlightedValue(nextHighlighted);
  }, [enabledVisibleItems, open, value]);

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

  const selectItem = (item: FrostedDropdownItem<T>) => {
    if (item.disabled) return;
    setOpen(false);
    setQuery("");
    onOpenChange?.(false);
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
        style={{ maxHeight: `${menuMaxHeight}px` }}
      >
        <div className="flex flex-col">
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
                  onKeyDown={(event) => {
                    if (event.key === "Tab") {
                      setOpen(false);
                      setQuery("");
                      onOpenChange?.(false);
                    }
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

          <ul className="menu menu-sm menu-frosted flex w-full flex-col flex-nowrap p-0">
            {visibleItems.length > 0 ? (
              visibleItems.map((item) => (
                <li
                  key={item.value}
                  ref={(node) => {
                    itemRefs.current.set(item.value, node);
                  }}
                >
                  <MenuEntry
                    role="menuitemradio"
                    aria-checked={item.value === value}
                    active={item.value === value}
                    disabled={item.disabled}
                    data-highlighted={
                      item.value === highlightedValue &&
                      item.value !== value &&
                      !item.disabled
                        ? "true"
                        : undefined
                    }
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
  items: FrostedDropdownItem<T>[],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;

  return items.filter((item) =>
    buildSearchText(item).some((value) => value.includes(normalizedQuery)),
  );
}

function buildSearchText<T extends string>(item: FrostedDropdownItem<T>) {
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

function getNextHighlightedValue<T extends string>(
  items: FrostedDropdownItem<T>[],
  current: T | null,
  direction: 1 | -1,
) {
  if (items.length === 0) return null;
  if (!current) return items[0]?.value ?? null;

  const index = items.findIndex((item) => item.value === current);
  if (index === -1) return items[0]?.value ?? null;

  return items[(index + direction + items.length) % items.length]?.value ?? null;
}
