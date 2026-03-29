interface AppToast {
  id: number;
  kind: "success" | "error";
  message: string;
}

interface AppToastHostProps {
  toast: AppToast | null;
  onDismiss: () => void;
}

export function AppToastHost({ toast, onDismiss }: AppToastHostProps) {
  if (!toast) return null;

  const toneClass =
    toast.kind === "success"
      ? "frosted-toast-success"
      : "frosted-toast-error";

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-[1400] toast toast-end toast-top">
      <div
        className={`card card-frosted frosted-toast-shell ${toneClass} pointer-events-auto w-[min(22rem,calc(100vw-2rem))] overflow-hidden px-3.5 py-3`}
      >
        <div className="frosted-toast-glow" aria-hidden="true" />
        <div className="relative z-10 flex items-start gap-3">
          <div className="frosted-toast-mark mt-0.5 shrink-0" aria-hidden="true">
            <div className="frosted-toast-mark-core" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="frosted-toast-label">Clipboard</p>
            <p className="frosted-toast-message">{toast.message}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-frosted frosted-toast-close shrink-0"
            aria-label="Dismiss notification"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
