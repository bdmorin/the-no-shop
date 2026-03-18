import { useState } from "react";
import { ShikiHighlighter } from "react-shiki";
import type { Block, Annotation } from "../../types";
import type { BlockAnnotateParams } from "../ResponseFeed";

interface CodeBlockProps {
  block: Block;
  onAnnotate: (params: BlockAnnotateParams) => void;
  pendingAnnotations: Annotation[];
}

export function CodeBlock({ block, pendingAnnotations }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const language = (block.metadata?.language as string) || "text";
  const hasPending = pendingAnnotations.length > 0;

  function handleCopy() {
    navigator.clipboard.writeText(block.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className={`relative rounded bg-surface-raised border border-border overflow-hidden ${hasPending ? "ring-1 ring-accent/30" : ""}`}>
      {hasPending && (
        <span
          className="absolute top-1 left-1 w-2 h-2 rounded-full bg-accent z-10"
          title={`${pendingAnnotations.length} pending annotation(s)`}
        />
      )}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface">
        <span className="text-xs text-text-muted font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-text-muted hover:text-text transition-colors px-2 py-0.5 rounded hover:bg-surface-raised"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <ShikiHighlighter
          language={language}
          theme="github-dark-dimmed"
          addDefaultStyles={false}
          showLanguage={false}
          className="text-sm p-3 m-0"
        >
          {block.content}
        </ShikiHighlighter>
      </div>
    </div>
  );
}
