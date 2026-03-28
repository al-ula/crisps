import type { MouseEvent, ReactNode } from "react";

interface OverlayPopupProps {
  children: ReactNode;
  onCancel: () => void;
}

export function OverlayPopup({ children, onCancel }: OverlayPopupProps) {
  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    onCancel();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-12 z-1300 bg-base-content/20 backdrop-blur-sm">
      <div
        className="flex h-full items-center overflow-y-auto px-4 py-6"
        onMouseDown={handleBackdropMouseDown}
      >
        <div className="mx-auto w-full max-w-136">{children}</div>
      </div>
    </div>
  );
}
