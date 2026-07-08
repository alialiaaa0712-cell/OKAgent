import type { SessionMeta } from "../api";

interface Props {
  sessions: SessionMeta[];
  activeId: string | null;
  onNew: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SessionSidebar({ sessions, activeId, onNew, onLoad, onDelete }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Sessions</span>
        <button className="btn-new" onClick={onNew}>+ New</button>
      </div>
      <ul className="session-list">
        {sessions.length === 0 && (
          <li className="session-empty">No sessions yet</li>
        )}
        {sessions.map((s) => (
          <li
            key={s.id}
            className={`session-item ${s.id === activeId ? "session-item-active" : ""}`}
            onClick={() => onLoad(s.id)}
          >
            <span className="session-preview">{s.preview || "(empty)"}</span>
            <span className="session-date">{new Date(s.createdAt).toLocaleDateString()}</span>
            <button
              className="session-delete"
              onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
              title="Delete session"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
