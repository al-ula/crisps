interface SidebarIslandProps {
  mode: "overlay" | "docked";
}

const SECTIONS = [
  {
    label: "Pinned",
    items: ["Recently opened documents", "Working draft snapshot"],
  },
  {
    label: "Workspace",
    items: ["Project outline placeholder", "Shared references placeholder"],
  },
  {
    label: "Notes",
    items: ["Scratch area placeholder", "Quick actions placeholder"],
  },
];

export function SidebarIsland({ mode }: SidebarIslandProps) {
  return (
    <aside
      className="card card-frosted pointer-events-auto mt-(--sidebar-top-offset) ml-(--sidebar-gap) text-base-content"
      style={{
        width:
          mode === "overlay"
            ? "var(--sidebar-width-overlay)"
            : "var(--sidebar-width-docked)",
        height:
          "calc(100vh - var(--sidebar-top-offset) - var(--sidebar-bottom-offset))",
      }}
      aria-label="Workspace sidebar"
    >
      <div className="card-body h-full min-h-0 gap-4 p-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 flex-none text-[0.68rem] font-bold uppercase tracking-[0.16em] text-base-content/55">
              Workspace
            </p>
            <h2 className="text-xl leading-[1.15] font-semibold">
              Sidebar shell
            </h2>
          </div>
          <span className="badge badge-soft badge-sm badge-frosted whitespace-nowrap uppercase tracking-[0.08em]">
            {mode === "overlay" ? "Overlay" : "Docked"}
          </span>
        </div>

        <p className="flex-none text-[0.93rem] leading-6 text-base-content/78">
          Placeholder structure for the upcoming workspace panel. This pass only
          establishes the layout and responsive behavior.
        </p>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-3 [scrollbar-gutter:stable]">
          {SECTIONS.map((section) => (
            <section
              key={section.label}
              className="card card-frosted card-sm shrink-0 bg-base-100/55"
            >
              <div className="card-body flex-none gap-3 p-4">
                <p className="flex-none text-[0.74rem] font-bold uppercase tracking-[0.12em] text-base-content/60">
                  {section.label}
                </p>
                <div className="flex flex-col gap-[0.55rem] text-[0.95rem] leading-[1.4]">
                  {section.items.map((item) => (
                    <div key={item} className="flex items-start gap-[0.55rem]">
                      <span
                        className="mt-[0.4rem] size-[0.45rem] shrink-0 rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-primary)_18%,transparent)]"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </aside>
  );
}
