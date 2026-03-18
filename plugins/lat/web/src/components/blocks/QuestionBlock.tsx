import { useState } from "react";
import type { Block, Annotation } from "../../types";
import type { BlockAnnotateParams } from "../ResponseFeed";

interface QuestionBlockProps {
  block: Block;
  onAnnotate: (params: BlockAnnotateParams) => void;
  pendingAnnotations: Annotation[];
}

export function QuestionBlock({ block, onAnnotate, pendingAnnotations }: QuestionBlockProps) {
  const [inputValue, setInputValue] = useState("");
  const hasPending = pendingAnnotations.length > 0;

  function handleSubmit() {
    if (!inputValue.trim()) return;
    onAnnotate({
      type: "answer",
      blockId: block.id,
      content: inputValue.trim(),
      metadata: { question: block.content },
    });
    setInputValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  }

  return (
    <div
      className={`relative rounded border border-warning/40 bg-surface-raised p-4 ${hasPending ? "ring-1 ring-accent/30" : ""}`}
      style={{ borderLeftWidth: "3px", borderLeftColor: "var(--color-warning, #f59e0b)" }}
    >
      {hasPending && (
        <span
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent"
          title={`${pendingAnnotations.length} pending annotation(s)`}
        />
      )}
      <p className="text-text-bright text-base font-medium mb-3">{block.content}</p>
      <textarea
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your answer… (Cmd+Enter to submit)"
        rows={3}
        className="w-full rounded border border-border bg-bg text-text text-sm p-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted"
      />
      <div className="mt-2 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!inputValue.trim()}
          className="px-3 py-1.5 text-sm rounded bg-accent text-bg font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          Submit Answer
        </button>
      </div>
    </div>
  );
}
