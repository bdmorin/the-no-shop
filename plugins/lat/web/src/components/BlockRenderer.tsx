import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Block, Annotation } from "../types";
import type { BlockAnnotateParams } from "./ResponseFeed";
import { ProseBlock } from "./blocks/ProseBlock";
import { CodeBlock } from "./blocks/CodeBlock";
import { QuestionBlock } from "./blocks/QuestionBlock";
import { DecisionBlock } from "./blocks/DecisionBlock";
import { DiagramBlock } from "./blocks/DiagramBlock";
import { WarningBlock } from "./blocks/WarningBlock";
import { ListBlock } from "./blocks/ListBlock";
import { HeadingBlock } from "./blocks/HeadingBlock";

interface BlockRendererProps {
  block: Block;
  onAnnotate: (params: BlockAnnotateParams) => void;
  pendingAnnotations: Annotation[];
}

function SummaryBlock({ block, pendingAnnotations }: { block: Block; pendingAnnotations: Annotation[] }) {
  const hasPending = pendingAnnotations.length > 0;
  return (
    <div className={`relative rounded bg-accent/10 border border-accent/30 p-4 ${hasPending ? "ring-1 ring-accent/40" : ""}`}>
      {hasPending && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent" />
      )}
      <div className="text-xs font-semibold text-accent uppercase tracking-wide mb-2">Summary</div>
      <div className="prose prose-sm max-w-none text-text">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
      </div>
    </div>
  );
}

export function BlockRenderer({ block, onAnnotate, pendingAnnotations }: BlockRendererProps) {
  const blockAnnotations = pendingAnnotations.filter((a) => a.blockId === block.id);

  switch (block.type) {
    case "prose":
      return <ProseBlock block={block} onAnnotate={onAnnotate} pendingAnnotations={blockAnnotations} />;
    case "code":
      return <CodeBlock block={block} onAnnotate={onAnnotate} pendingAnnotations={blockAnnotations} />;
    case "question":
      return <QuestionBlock block={block} onAnnotate={onAnnotate} pendingAnnotations={blockAnnotations} />;
    case "decision":
      return <DecisionBlock block={block} onAnnotate={onAnnotate} pendingAnnotations={blockAnnotations} />;
    case "diagram":
      return <DiagramBlock block={block} onAnnotate={onAnnotate} pendingAnnotations={blockAnnotations} />;
    case "warning":
      return <WarningBlock block={block} onAnnotate={onAnnotate} pendingAnnotations={blockAnnotations} />;
    case "list":
      return <ListBlock block={block} onAnnotate={onAnnotate} pendingAnnotations={blockAnnotations} />;
    case "heading":
      return <HeadingBlock block={block} onAnnotate={onAnnotate} pendingAnnotations={blockAnnotations} />;
    case "summary":
      return <SummaryBlock block={block} pendingAnnotations={blockAnnotations} />;
    default:
      return (
        <div className="text-xs text-text-muted italic">
          Unknown block type: {(block as Block).type}
        </div>
      );
  }
}
