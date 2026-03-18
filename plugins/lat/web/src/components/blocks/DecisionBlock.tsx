import { useState } from "react";
import type { Block, Annotation } from "../../types";
import type { BlockAnnotateParams } from "../ResponseFeed";

interface DecisionOption {
  label: string;
  text: string;
}

interface DecisionBlockProps {
  block: Block;
  onAnnotate: (params: BlockAnnotateParams) => void;
  pendingAnnotations: Annotation[];
}

export function DecisionBlock({ block, onAnnotate, pendingAnnotations }: DecisionBlockProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const hasPending = pendingAnnotations.length > 0;

  const options = (block.metadata?.options as DecisionOption[]) || [];

  function handleSelect(option: DecisionOption) {
    setSelected(option.label);
    onAnnotate({
      type: "choice",
      blockId: block.id,
      content: option.text,
      metadata: {
        selectedOption: option.label,
        question: block.content,
        comment: comment || undefined,
      },
    });
  }

  return (
    <div className={`relative rounded border border-border bg-surface-raised p-4 ${hasPending ? "ring-1 ring-accent/30" : ""}`}>
      {hasPending && (
        <span
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent"
          title={`${pendingAnnotations.length} pending annotation(s)`}
        />
      )}
      <p className="text-text-bright font-medium mb-3">{block.content}</p>
      <div className="space-y-2">
        {options.map((option) => (
          <button
            key={option.label}
            onClick={() => handleSelect(option)}
            className={`w-full text-left rounded border px-3 py-2.5 text-sm transition-colors flex items-start gap-3 ${
              selected === option.label
                ? "border-accent bg-accent/10 text-text-bright"
                : "border-border hover:border-accent/50 hover:bg-surface text-text"
            }`}
          >
            <span className="shrink-0 font-mono font-bold text-accent text-xs mt-0.5 w-5">{option.label}</span>
            <span>{option.text}</span>
          </button>
        ))}
      </div>
      <div className="mt-3">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment…"
          rows={2}
          className="w-full rounded border border-border bg-bg text-text text-sm p-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted"
        />
      </div>
    </div>
  );
}
