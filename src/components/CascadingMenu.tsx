import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MenuEntry } from "./MenuEntry";

const MENU_SHELL_BASE_CLASS = "card card-frosted frosted-menu-shell fixed p-1";
const MENU_LIST_CLASS = "menu menu-sm menu-frosted w-full p-0";
const HIDDEN_MENU_STYLE: CSSProperties = {
  left: -9999,
  top: -9999,
  visibility: "hidden",
};

export type CascadingMenuItem =
  | {
      type: "item";
      key: string;
      label: ReactNode;
      leading?: ReactNode;
      trailing?: ReactNode;
      active?: boolean;
      disabled?: boolean;
      danger?: boolean;
      onClick?: () => void;
      onMouseEnter?: () => void;
    }
  | {
      type: "submenu";
      key: string;
      label: ReactNode;
      items: CascadingMenuItem[];
      leading?: ReactNode;
      trailing?: ReactNode;
      active?: boolean;
      disabled?: boolean;
      danger?: boolean;
      onClick?: () => void;
      onMouseEnter?: () => void;
      openOnClick?: boolean;
      openOnHover?: boolean;
      triggerProps?: Record<`data-${string}`, string>;
    }
  | { type: "divider"; key: string };

export type CascadingMenuLayerProps = HTMLAttributes<HTMLDivElement> & {
  minWidth?: number;
};

interface CascadingMenuProps {
  visible: boolean;
  items: CascadingMenuItem[];
  openPath: string[];
  onOpenPathChange: (path: string[]) => void;
  rootStyle: CSSProperties;
  menuRef?: MutableRefObject<HTMLDivElement | null>;
  getLayerProps?: (
    depth: number,
  ) => CascadingMenuLayerProps | null | undefined;
}

interface MenuLayer {
  key: string;
  items: CascadingMenuItem[];
}

export function CascadingMenu({
  visible,
  items,
  openPath,
  onOpenPathChange,
  rootStyle,
  menuRef,
  getLayerProps,
}: CascadingMenuProps) {
  const layerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const anchorRectsRef = useRef<Array<DOMRect | null>>([]);
  const [layerStyles, setLayerStyles] = useState<CSSProperties[]>([]);

  const layers = useMemo(() => buildLayers(items, openPath), [items, openPath]);

  useLayoutEffect(() => {
    if (!visible) {
      layerRefs.current = [];
      anchorRectsRef.current = [];
      setLayerStyles((current) => (current.length > 0 ? [] : current));
      return;
    }

    layerRefs.current.length = layers.length;
    anchorRectsRef.current.length = layers.length;

    setLayerStyles((current) => {
      const next: CSSProperties[] = [];

      for (let depth = 1; depth < layers.length; depth += 1) {
        const layerElement = layerRefs.current[depth];
        const anchorRect =
          anchorRectsRef.current[depth] ??
          findTriggerRect(layerRefs.current[depth - 1], openPath[depth - 1]);

        if (!layerElement || !anchorRect) continue;
        next[depth] = buildFlyoutStyle(anchorRect, layerElement);
      }

      return areLayerStylesEqual(current, next) ? current : next;
    });
  }, [layers, openPath, visible]);

  if (!visible) return null;

  const renderLayer = (layer: MenuLayer, depth: number) => {
    const layerProps = getLayerProps?.(depth) ?? {};
    const {
      className,
      minWidth,
      style,
      ...eventProps
    } = layerProps;
    const mergedStyle =
      depth === 0
        ? {
            ...rootStyle,
            ...(minWidth ? { minWidth } : null),
            ...style,
          }
        : {
            ...(layerStyles[depth] ?? HIDDEN_MENU_STYLE),
            ...(minWidth ? { minWidth } : null),
            ...style,
          };

    const menuNode = (
      <div
        key={layer.key}
        ref={(node) => {
          layerRefs.current[depth] = node;
          if (depth === 0 && menuRef) {
            menuRef.current = node;
          }
        }}
        data-cascading-menu-layer=""
        data-cascading-menu-depth={depth}
        className={[MENU_SHELL_BASE_CLASS, className].filter(Boolean).join(" ")}
        style={mergedStyle}
        {...eventProps}
      >
        <ul className={MENU_LIST_CLASS}>
          {layer.items.map((item) => {
            if (item.type === "divider") {
              return <li key={item.key} aria-hidden="true" />;
            }

            if (item.type === "submenu") {
              const isOpen = openPath[depth] === item.key;
              return (
                <li key={item.key}>
                  <MenuEntry
                    label={item.label}
                    leading={item.leading}
                    trailing={item.trailing}
                    active={item.active || isOpen}
                    danger={item.danger}
                    submenu
                    disabled={item.disabled}
                    {...(item.triggerProps as Record<string, string> | undefined)}
                    data-cascading-menu-key={item.key}
                    onMouseEnter={
                      item.disabled
                        ? undefined
                        : (event) => {
                            item.onMouseEnter?.();
                            if (item.openOnHover === false) return;
                            anchorRectsRef.current[depth + 1] =
                              event.currentTarget.getBoundingClientRect();
                            onOpenPathChange([
                              ...openPath.slice(0, depth),
                              item.key,
                            ]);
                          }
                    }
                    onClick={
                      item.disabled
                        ? undefined
                        : (event) => {
                            item.onClick?.();
                            if (item.openOnClick === false) return;
                            anchorRectsRef.current[depth + 1] =
                              event.currentTarget.getBoundingClientRect();
                            onOpenPathChange(
                              isOpen
                                ? openPath.slice(0, depth)
                                : [...openPath.slice(0, depth), item.key],
                            );
                          }
                    }
                  />
                </li>
              );
            }

            return (
              <li key={item.key}>
                <MenuEntry
                  label={item.label}
                  leading={item.leading}
                  trailing={item.trailing}
                  active={item.active}
                  disabled={item.disabled}
                  danger={item.danger}
                  onMouseEnter={item.disabled ? undefined : item.onMouseEnter}
                  onClick={item.disabled ? undefined : item.onClick}
                />
              </li>
            );
          })}
        </ul>
      </div>
    );

    return depth === 0
      ? menuNode
      : createPortal(menuNode, document.body, layer.key);
  };

  return <>{layers.map((layer, depth) => renderLayer(layer, depth))}</>;
}

function buildLayers(items: CascadingMenuItem[], openPath: string[]): MenuLayer[] {
  const layers: MenuLayer[] = [{ key: "root", items }];
  let currentItems = items;

  for (let depth = 0; depth < openPath.length; depth += 1) {
    const submenu = currentItems.find(
      (item): item is Extract<CascadingMenuItem, { type: "submenu" }> =>
        item.type === "submenu" && item.key === openPath[depth],
    );
    if (!submenu) break;
    layers.push({ key: `${depth + 1}:${submenu.key}`, items: submenu.items });
    currentItems = submenu.items;
  }

  return layers;
}

function findTriggerRect(
  layerElement: HTMLDivElement | null,
  key: string | undefined,
): DOMRect | null {
  if (!layerElement || !key) return null;

  const triggers = layerElement.querySelectorAll<HTMLElement>(
    "[data-cascading-menu-key]",
  );
  for (const trigger of triggers) {
    if (trigger.dataset.cascadingMenuKey === key) {
      return trigger.getBoundingClientRect();
    }
  }

  return null;
}

function buildFlyoutStyle(
  anchorRect: DOMRect,
  menuElement: HTMLDivElement | null,
): CSSProperties {
  const viewportPadding = 8;
  const gap = 12;
  const menuWidth = menuElement?.offsetWidth ?? 200;
  const menuHeight = menuElement?.offsetHeight ?? 0;
  const preferredRight = anchorRect.right + gap;
  const preferredLeft = anchorRect.left - menuWidth - gap;
  const maxRight = window.innerWidth - menuWidth - viewportPadding;
  const left =
    preferredRight <= maxRight
      ? preferredRight
      : Math.max(viewportPadding, preferredLeft);
  const maxTop = Math.max(
    viewportPadding,
    window.innerHeight - menuHeight - viewportPadding,
  );
  const top = Math.max(viewportPadding, Math.min(anchorRect.top, maxTop));

  return { left, top };
}

function areLayerStylesEqual(
  current: CSSProperties[],
  next: CSSProperties[],
): boolean {
  const count = Math.max(current.length, next.length);

  for (let index = 0; index < count; index += 1) {
    if (!areStylesEqual(current[index], next[index])) {
      return false;
    }
  }

  return true;
}

function areStylesEqual(
  current: CSSProperties | undefined,
  next: CSSProperties | undefined,
): boolean {
  if (!current && !next) return true;
  if (!current || !next) return false;

  return (
    current.left === next.left &&
    current.top === next.top &&
    current.right === next.right &&
    current.bottom === next.bottom &&
    current.visibility === next.visibility
  );
}
