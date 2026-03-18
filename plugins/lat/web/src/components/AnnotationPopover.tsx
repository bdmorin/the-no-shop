import { useEffect, useRef, useState } from "react";

interface AnnotationPopoverProps {
  position: { x: number; y: number };
  onSubmit: (comment: string) => void;
  onClose: () => void;
}

export function AnnotationPopover({ position, onSubmit, onClose }: AnnotationPopoverProps) {
  const [comment, setComment] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleSubmit() {
    const trimmed = comment.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  }

  return (
    <div
      className="fixed z-50"
      style={{ left: position.x, top: position.y }}
    >
      <div className="bg-surface border border-border rounded-lg shadow-xl p-3 w-64">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-text-bright uppercase tracking-wide">
            Add Comment
          </span>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text text-xs leading-none px-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a comment… (⌘↵ to submit)"
          className="w-full bg-bg border border-border rounded p-2 text-sm text-text placeholder-text-muted resize-none focus:outline-none focus:border-accent"
          rows={3}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-text-muted">Esc to cancel</span>
          <button
            onClick={handleSubmit}
            disabled={!comment.trim()}
            className="px-3 py-1 text-xs font-semibold rounded bg-accent text-bg hover:bg-accent-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
