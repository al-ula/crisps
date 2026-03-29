import { useFileContext } from "../context/FileContext";

interface SidebarIslandProps {
  mode: "overlay" | "docked";
  width: number | null;
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
}

export function SidebarIsland({
  mode,
  width,
  onResizeStart,
}: SidebarIslandProps) {
  const { tocItems, sourceMode, navigateToHeading } = useFileContext();

  return (
    <aside
      className="card card-frosted pointer-events-auto relative mt-(--sidebar-top-offset) ml-(--sidebar-gap) overflow-hidden p-0 text-base-content"
      style={{
        width:
          width == null
            ? mode === "overlay"
              ? "var(--sidebar-width-overlay)"
              : "var(--sidebar-width-docked)"
            : `${width}px`,
        height:
          "calc(100vh - var(--sidebar-top-offset) - var(--sidebar-bottom-offset))",
      }}
      aria-label="Workspace sidebar"
    >
      <div className="card-body h-full min-h-0 gap-2 p-4 text-sm">
        <h2 className="text-xl font-semibold">Table of contents</h2>

        <div className="sidebar-toc-scroll min-h-0 flex-1">
          {tocItems.length === 0 ? (
            <div className="border-base-content/12 bg-base-100/50 text-base-content/62 flex min-h-full items-center justify-center rounded-box border border-dashed p-4 text-center">
              No headings yet
            </div>
          ) : (
            <nav aria-label="Table of contents" className="sidebar-toc-nav">
              {tocItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar-toc-item sidebar-toc-item-frosted btn btn-ghost justify-start px-3 py-2 normal-case ${
                    sourceMode ? "btn-disabled text-base-content/52" : ""
                  }`}
                  style={
                    {
                      "--toc-level": String(item.level),
                    } as React.CSSProperties
                  }
                  onClick={() => {
                    navigateToHeading(item.id);
                  }}
                  disabled={sourceMode}
                  title={item.text}
                >
                  <span
                    className="bg-primary shadow-primary/14 h-2 w-2 shrink-0 rounded-full shadow-[0_0_0_4px]"
                    aria-hidden="true"
                  />
                  <span className="shrink-0 whitespace-nowrap">
                    {item.text}
                  </span>
                </button>
              ))}
            </nav>
          )}
        </div>
      </div>
      <div
        className="sidebar-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={onResizeStart}
      />
    </aside>
  );
}
