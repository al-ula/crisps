import { createContext, useContext, type RefObject } from "react";

interface OverlayContextValue {
  overlayRef: RefObject<HTMLDivElement | null>;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function useOverlayContext(): OverlayContextValue {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error(
      "useOverlayContext must be used within an OverlayProvider",
    );
  }
  return context;
}

export function useOverlayRef(): RefObject<HTMLDivElement | null> | null {
  return useContext(OverlayContext)?.overlayRef ?? null;
}

export { OverlayContext };
export type { OverlayContextValue };
