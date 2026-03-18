import { useRef, useLayoutEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { LATResponse, Annotation } from "../types";
import type { AddAnnotationParams } from "../hooks/useAnnotations";
import { BlockRenderer } from "./BlockRenderer";

/**
 * Subset of annotation data that block components supply.
 * sessionId and responseId are injected by ResponseFeed per-response.
 */
export interface BlockAnnotateParams {
  type: Annotation["type"];
  blockId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface ResponseFeedProps {
  responses: LATResponse[];
  /** Full addAnnotation from useAnnotations — requires sessionId + responseId */
  onAnnotate: (params: AddAnnotationParams) => void;
  pendingAnnotations: Annotation[];
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function StructuringStatusBadge({ status }: { status: LATResponse["structuringStatus"] }) {
  if (status === "pending") {
    return <span className="text-text-muted text-xs" title="Structuring…">⟳</span>;
  }
  if (status === "complete") {
    return <span className="text-success text-xs" title="Structured">✓</span>;
  }
  return <span className="text-warning text-xs" title="Structuring failed">⚠</span>;
}

interface ResponseCardProps {
  response: LATResponse;
  /** Full annotate — requires all fields */
  onAnnotate: (params: AddAnnotationParams) => void;
  pendingAnnotations: Annotation[];
}

function ResponseCard({ response, onAnnotate, pendingAnnotations }: ResponseCardProps) {
  const prevStatusRef = useRef<LATResponse["structuringStatus"]>(response.structuringStatus);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const savedScrollRef = useRef<number>(0);

  // Save scroll position synchronously before status transitions to "complete"
  if (prevStatusRef.current !== "complete" && response.structuringStatus === "complete") {
    if (scrollContainerRef.current) {
      savedScrollRef.current = scrollContainerRef.current.scrollTop;
    }
    prevStatusRef.current = "complete";
  } else if (prevStatusRef.current !== response.structuringStatus) {
    prevStatusRef.current = response.structuringStatus;
  }

  // Restore scroll after blocks have rendered
  useLayoutEffect(() => {
    if (
      response.structuringStatus === "complete" &&
      scrollContainerRef.current &&
      savedScrollRef.current > 0
    ) {
      scrollContainerRef.current.scrollTop = savedScrollRef.current;
      savedScrollRef.current = 0;
    }
  });

  // Bind sessionId + responseId for block-level annotations
  const boundAnnotate = useCallback(
    (params: BlockAnnotateParams) =>
      onAnnotate({
        sessionId: response.sessionId,
        responseId: response.responseId,
        ...params,
      }),
    [onAnnotate, response.sessionId, response.responseId]
  );

  const responseAnnotations = pendingAnnotations.filter(
    (a) => a.responseId === response.responseId
  );

  return (
    <div className="border border-border rounded bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface">
        <StructuringStatusBadge status={response.structuringStatus} />
        <span className="text-xs text-text-muted font-mono">
          {formatTimestamp(response.timestamp)}
        </span>
        {response.attention.needed && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium">
            {response.attention.reason || "Attention needed"}
          </span>
        )}
      </div>

      {/* Body */}
      <div
        ref={(el) => {
          scrollContainerRef.current = el;
        }}
        className="p-4"
      >
        {response.structuringStatus === "complete" && response.blocks.length > 0 ? (
          <div className="space-y-4">
            {response.blocks.map((block) => (
              <BlockRenderer
                key={block.id}
                block={block}
                onAnnotate={boundAnnotate}
                pendingAnnotations={responseAnnotations}
              />
            ))}
          </div>
        ) : (
          <div className="prose prose-sm max-w-none text-text [&_a]:text-accent [&_code]:text-accent [&_code]:bg-surface-raised [&_code]:px-1 [&_code]:rounded [&_pre]:bg-surface-raised [&_pre]:p-3 [&_pre]:rounded [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-text-muted">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {response.rawMarkdown}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export function ResponseFeed({ responses, onAnnotate, pendingAnnotations }: ResponseFeedProps) {
  if (responses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted text-sm">No responses yet for this session.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {responses.map((response) => (
        <ResponseCard
          key={response.responseId}
          response={response}
          onAnnotate={onAnnotate}
          pendingAnnotations={pendingAnnotations}
        />
      ))}
    </div>
  );
}
