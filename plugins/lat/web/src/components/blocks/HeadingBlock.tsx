import { useState } from "react";
import type { Block, Annotation } from "../../types";
import type { BlockAnnotateParams } from "../ResponseFeed";

interface HeadingBlockProps {
  block: Block;
  onAnnotate: (params: BlockAnnotateParams) => void;
  pendingAnnotations: Annotation[];
}

export function HeadingBlock({ block, pendingAnnotations }: HeadingBlockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const level = (block.metadata?.level as number) || 2;
  const hasPending = pendingAnnotations.length > 0;

  const Tag = level <= 2 ? "h2" : "h3";
  const textClass =
    level <= 2
      ? "text-text-bright text-lg font-semibold"
      : "text-text-bright text-base font-medium";

  return (
    <div className={`relative ${hasPending ? "ring-1 ring-accent/30 rounded px-1" : ""}`}>
      {hasPending && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent" />}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 w-full text-left group border-b border-border pb-1 mb-2 hover:border-accent/50 transition-colors"
        aria-expanded={!collapsed}
      >
        <span
          className="text-text-muted text-xs transition-transform duration-150"
          style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", display: "inline-block" }}
          aria-hidden="true"
        >
          ▾
        </span>
        <Tag className={textClass}>{block.content}</Tag>
      </button>
      {collapsed && (
        <span className="text-xs text-text-muted italic">— collapsed —</span>
      )}
    </div>
  );
}
