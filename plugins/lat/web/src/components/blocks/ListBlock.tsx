import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Block, Annotation } from "../../types";
import type { BlockAnnotateParams } from "../ResponseFeed";

interface ListBlockProps {
  block: Block;
  onAnnotate: (params: BlockAnnotateParams) => void;
  pendingAnnotations: Annotation[];
}

function parseListItems(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => /^(\s*[-*+]|\s*\d+[.)]) /.test(line));
}

export function ListBlock({ block, onAnnotate, pendingAnnotations }: ListBlockProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hasPending = pendingAnnotations.length > 0;
  const items = parseListItems(block.content);

  if (items.length > 0) {
    return (
      <div className={`relative ${hasPending ? "ring-1 ring-accent/30 rounded" : ""}`}>
        {hasPending && <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-accent" />}
        <ul className="space-y-1">
          {items.map((item, index) => {
            const text = item.replace(/^\s*[-*+\d.)\s]+/, "").trim();
            return (
              <li
                key={index}
                className="relative flex items-start gap-2 group"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <span className="text-text-muted mt-1 shrink-0">•</span>
                <span className="text-text text-sm flex-1">{text}</span>
                {hoveredIndex === index && (
                  <button
                    onClick={() =>
                      onAnnotate({
                        type: "comment",
                        blockId: block.id,
                        content: "",
                        metadata: { listItemIndex: index, listItemText: text },
                      })
                    }
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-text-muted hover:text-accent px-1.5 py-0.5 rounded hover:bg-surface-raised"
                    title="Comment on this item"
                  >
                    💬
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // Fallback: render full content as markdown
  return (
    <div className={`relative ${hasPending ? "ring-1 ring-accent/30 rounded" : ""}`}>
      {hasPending && <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-accent" />}
      <div className="prose prose-sm max-w-none text-text [&_li]:text-text [&_ul]:list-disc [&_ol]:list-decimal">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {block.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
