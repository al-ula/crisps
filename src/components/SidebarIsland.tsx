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
      className={`sidebar-island ${
        mode === "overlay" ? "app-sidebar-overlay" : "app-sidebar-docked"
      }`}
      aria-label="Workspace sidebar"
    >
      <div className="sidebar-island-header">
        <div>
          <p className="sidebar-island-eyebrow">Workspace</p>
          <h2 className="sidebar-island-title">Sidebar shell</h2>
        </div>
        <span className="sidebar-island-badge">
          {mode === "overlay" ? "Overlay" : "Docked"}
        </span>
      </div>

      <p className="sidebar-island-description">
        Placeholder structure for the upcoming workspace panel. This pass only
        establishes the layout and responsive behavior.
      </p>

      <div className="sidebar-island-sections">
        {SECTIONS.map((section) => (
          <section key={section.label} className="sidebar-island-card">
            <p className="sidebar-island-card-label">{section.label}</p>
            <div className="sidebar-island-card-items">
              {section.items.map((item) => (
                <div key={item} className="sidebar-island-list-item">
                  <span className="sidebar-island-list-dot" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
