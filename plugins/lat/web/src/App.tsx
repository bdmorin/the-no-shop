import { useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useAnnotations } from "./hooks/useAnnotations";
import { SessionList } from "./components/SessionList";
import { ResponseFeed } from "./components/ResponseFeed";
import type { ConnectionStatus } from "./hooks/useWebSocket";

function StatusDot({ status }: { status: ConnectionStatus }) {
  const colorClass =
    status === "connected"
      ? "bg-success"
      : status === "reconnecting"
      ? "bg-warning"
      : "bg-danger";

  const label =
    status === "connected"
      ? "Connected"
      : status === "reconnecting"
      ? "Reconnecting…"
      : "Disconnected";

  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span
        className={`inline-block w-2 h-2 rounded-full ${colorClass}`}
        aria-label={label}
      />
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}

function App() {
  const { sessions, responses, connectionStatus, onAnnotationEvent } = useWebSocket();
  const { pendingAnnotations, addAnnotation, removeAnnotation } = useAnnotations(onAnnotationEvent);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // removeAnnotation used by future tasks
  void removeAnnotation;

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="flex h-screen">
        {/* Left sidebar */}
        <aside className="w-64 shrink-0 border-r border-border bg-surface flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="text-text-bright font-semibold text-sm uppercase tracking-wide">
              Sessions
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <SessionList
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={setActiveSessionId}
            />
          </div>
        </aside>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface shrink-0">
            <span className="text-text-bright font-medium text-sm">
              {activeSessionId ? `Session: ${activeSessionId}` : "LAT Monitor"}
            </span>
            <div className="flex items-center gap-3">
              {pendingAnnotations.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-bg font-semibold">
                  {pendingAnnotations.length} pending
                </span>
              )}
              <StatusDot status={connectionStatus} />
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {activeSessionId === null ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-text-muted text-sm">Select a session to view responses.</p>
              </div>
            ) : (
              <ResponseFeed
                responses={responses[activeSessionId] || []}
                onAnnotate={addAnnotation}
                pendingAnnotations={pendingAnnotations}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
