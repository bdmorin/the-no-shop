import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Block, Annotation } from "../../types";
import type { BlockAnnotateParams } from "../ResponseFeed";

interface ProseBlockProps {
  block: Block;
  onAnnotate: (params: BlockAnnotateParams) => void;
  pendingAnnotations: Annotation[];
}

export function ProseBlock({ block, pendingAnnotations }: ProseBlockProps) {
  const hasPending = pendingAnnotations.length > 0;

  return (
    <div className={`relative ${hasPending ? "ring-1 ring-accent/30 rounded" : ""}`}>
      {hasPending && (
        <span
          className="absolute top-0 right-0 w-2 h-2 rounded-full bg-accent"
          title={`${pendingAnnotations.length} pending annotation(s)`}
        />
      )}
      <div className="prose prose-sm max-w-none text-text [&_a]:text-accent [&_code]:text-accent [&_code]:bg-surface-raised [&_code]:px-1 [&_code]:rounded [&_pre]:bg-surface-raised [&_pre]:p-3 [&_pre]:rounded [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-text-muted">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {block.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
