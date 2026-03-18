import { useState } from "react";
import type { Annotation } from "../types";
import { serializeAnnotationsToXml } from "../lib/protocol";

const TYPE_ICONS: Record<Annotation["type"], string> = {
  answer: "💬",
  choice: "☑",
  highlight: "✏",
  comment: "📝",
  reject: "✗",
  approve: "✓",
};

interface AnnotationBarProps {
  pendingAnnotations: Annotation[];
  submittedAnnotations: Annotation[];
  onRemove: (id: string, sessionId: string) => void;
}

export function AnnotationBar({
  pendingAnnotations,
  submittedAnnotations,
  onRemove,
}: AnnotationBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [xmlPreview, setXmlPreview] = useState<string | null>(null);

  const hasPending = pendingAnnotations.length > 0;
  const hasSubmitted = submittedAnnotations.length > 0;

  function toggleXmlPreview() {
    if (xmlPreview !== null) {
      setXmlPreview(null);
      return;
    }
    if (pendingAnnotations.length === 0) return;
    const first = pendingAnnotations[0];
    const xml = serializeAnnotationsToXml(
      pendingAnnotations,
      first.sessionId,
      first.responseId
    );
    setXmlPreview(xml);
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-text-bright hover:text-accent transition-colors"
            aria-expanded={expanded}
          >
            <span
              className="text-xs transition-transform"
              style={{ display: "inline-block", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              ▶
            </span>
            {hasPending ? (
              <span>{pendingAnnotations.length} annotation{pendingAnnotations.length !== 1 ? "s" : ""} pending</span>
            ) : (
              <span className="text-text-muted">No pending annotations</span>
            )}
          </button>
          {hasPending && (
            <span className="text-xs text-text-muted">
              Will inject on your next prompt
            </span>
          )}
        </div>

        {hasPending && (
          <button
            onClick={toggleXmlPreview}
            className="text-xs text-accent hover:text-text-bright transition-colors"
          >
            {xmlPreview !== null ? "Hide XML" : "Preview XML"}
          </button>
        )}
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-border max-h-64 overflow-y-auto">
          {/* Pending annotations */}
          {pendingAnnotations.map((ann) => (
            <div
              key={ann.id}
              className="flex items-start gap-2 px-4 py-2 border-b border-border last:border-b-0 hover:bg-surface-raised transition-colors"
            >
              <span className="shrink-0 text-sm mt-0.5" title={ann.type}>
                {TYPE_ICONS[ann.type]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-text-muted truncate">
                    {ann.blockId}
                  </span>
                  <span className="text-xs px-1 rounded bg-surface-raised text-text-muted capitalize">
                    {ann.type}
                  </span>
                </div>
                <p className="text-sm text-text truncate">
                  {ann.content.length > 80
                    ? ann.content.slice(0, 80) + "…"
                    : ann.content}
                </p>
              </div>
              <button
                onClick={() => onRemove(ann.id, ann.sessionId)}
                className="shrink-0 text-text-muted hover:text-danger text-sm leading-none px-1 mt-0.5 transition-colors"
                aria-label="Remove annotation"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Submitted annotations (dimmed) */}
          {hasSubmitted &&
            submittedAnnotations.map((ann) => (
              <div
                key={ann.id}
                className="flex items-start gap-2 px-4 py-2 border-b border-border last:border-b-0 opacity-50"
              >
                <span className="shrink-0 text-sm mt-0.5" title={ann.type}>
                  {TYPE_ICONS[ann.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-text-muted truncate">
                      {ann.blockId}
                    </span>
                    <span className="text-xs text-success font-semibold">✓ Sent</span>
                  </div>
                  <p className="text-sm text-text truncate">
                    {ann.content.length > 80
                      ? ann.content.slice(0, 80) + "…"
                      : ann.content}
                  </p>
                </div>
              </div>
            ))}

          {!hasPending && !hasSubmitted && (
            <div className="px-4 py-3 text-sm text-text-muted">
              No annotations yet.
            </div>
          )}
        </div>
      )}

      {/* XML Preview */}
      {xmlPreview !== null && (
        <div className="border-t border-border bg-bg p-4 max-h-48 overflow-y-auto">
          <pre className="text-xs font-mono text-text whitespace-pre-wrap break-all">
            {xmlPreview}
          </pre>
        </div>
      )}
    </div>
  );
}
