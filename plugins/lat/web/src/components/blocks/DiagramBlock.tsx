import { useEffect, useRef, useState } from "react";
import type { Block, Annotation } from "../../types";
import type { BlockAnnotateParams } from "../ResponseFeed";

interface DiagramBlockProps {
  block: Block;
  onAnnotate: (params: BlockAnnotateParams) => void;
  pendingAnnotations: Annotation[];
}

let mermaidInitialized = false;

export function DiagramBlock({ block, pendingAnnotations }: DiagramBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const diagramType = (block.metadata?.diagramType as string) || "mermaid";
  const hasPending = pendingAnnotations.length > 0;

  useEffect(() => {
    if (diagramType !== "mermaid") return;
    if (!containerRef.current) return;

    const el = containerRef.current;
    const id = `mermaid-${block.id.replace(/[^a-zA-Z0-9]/g, "_")}`;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;

        if (!mermaidInitialized) {
          mermaid.initialize({ startOnLoad: false, theme: "dark", darkMode: true });
          mermaidInitialized = true;
        }

        // mermaid.render() returns sanitized SVG generated entirely by the
        // mermaid library — not derived from arbitrary user input.
        const { svg } = await mermaid.render(id, block.content);
        if (el) {
          el.innerHTML = svg; // safe: library-generated SVG
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Diagram rendering failed");
      }
    }

    render();
  }, [block.id, block.content, diagramType]);

  function handleCopy() {
    navigator.clipboard.writeText(block.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (diagramType !== "mermaid" || error) {
    return (
      <div className={`relative rounded border border-border bg-surface-raised overflow-hidden ${hasPending ? "ring-1 ring-accent/30" : ""}`}>
        {hasPending && <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-accent z-10" />}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface">
          <span className="text-xs text-text-muted">{diagramType}</span>
          <button
            onClick={handleCopy}
            className="text-xs text-text-muted hover:text-text transition-colors px-2 py-0.5 rounded hover:bg-surface-raised"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        {error && <p className="text-xs text-warning px-3 pt-2">Render error: {error}</p>}
        <pre className="text-sm text-text font-mono p-3 overflow-x-auto whitespace-pre-wrap">{block.content}</pre>
      </div>
    );
  }

  return (
    <div className={`relative rounded border border-border bg-surface-raised p-4 overflow-x-auto ${hasPending ? "ring-1 ring-accent/30" : ""}`}>
      {hasPending && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent" />}
      <div ref={containerRef} className="flex justify-center" />
    </div>
  );
}
