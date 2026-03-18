import type { SessionMeta } from "../types";

interface SessionListProps {
  sessions: SessionMeta[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function sessionLabel(session: SessionMeta): string {
  if (session.gitRepo) {
    // Extract last path component of the repo
    return session.gitRepo.split("/").pop() ?? session.gitRepo;
  }
  return session.cwd.split("/").pop() ?? session.cwd;
}

export function SessionList({ sessions, activeSessionId, onSelectSession }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <p className="text-text-muted text-xs mt-2 px-1">No active sessions.</p>
    );
  }

  return (
    <ul className="mt-2 space-y-1">
      {sessions.map((session) => {
        const isActive = session.sessionId === activeSessionId;
        return (
          <li key={session.sessionId}>
            <button
              onClick={() => onSelectSession(session.sessionId)}
              className={[
                "w-full text-left rounded-md px-3 py-2 transition-colors",
                "border",
                isActive
                  ? "bg-surface-raised border-accent text-text-bright"
                  : "bg-transparent border-transparent text-text hover:bg-surface-raised hover:border-border",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">
                  {sessionLabel(session)}
                </span>
                <span
                  className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-bg text-text-muted border border-border font-mono"
                  title={session.model}
                >
                  {session.model.split("-").slice(0, 2).join("-")}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 gap-2">
                {session.gitBranch && (
                  <span className="text-xs text-text-muted truncate">
                    {session.gitBranch}
                  </span>
                )}
                <span className="text-xs text-text-muted ml-auto shrink-0">
                  {relativeTime(session.lastActivity)}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
