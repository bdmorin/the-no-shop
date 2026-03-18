import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Block, Annotation } from "../../types";
import type { BlockAnnotateParams } from "../ResponseFeed";

interface WarningBlockProps {
  block: Block;
  onAnnotate: (params: BlockAnnotateParams) => void;
  pendingAnnotations: Annotation[];
}

export function WarningBlock({ block, pendingAnnotations }: WarningBlockProps) {
  const hasPending = pendingAnnotations.length > 0;

  return (
    <div
      className={`relative rounded bg-surface-raised border border-warning/30 p-4 flex gap-3 ${hasPending ? "ring-1 ring-accent/30" : ""}`}
      style={{ borderLeftWidth: "3px", borderLeftColor: "var(--color-warning, #f59e0b)" }}
    >
      {hasPending && (
        <span
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent"
          title={`${pendingAnnotations.length} pending annotation(s)`}
        />
      )}
      <span className="text-warning shrink-0 mt-0.5" aria-label="Warning">⚠</span>
      <div className="prose prose-sm max-w-none text-text [&_a]:text-accent [&_code]:text-accent [&_code]:bg-bg [&_code]:px-1 [&_code]:rounded">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {block.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
