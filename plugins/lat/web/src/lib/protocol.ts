import type { Annotation } from "../types";

export function serializeAnnotationsToXml(
  annotations: Annotation[],
  sessionId: string,
  responseId: string
): string {
  const timestamp = new Date().toISOString();

  const lines: string[] = [
    `<lat-annotations session="${escapeAttr(sessionId)}" response="${escapeAttr(responseId)}" timestamp="${escapeAttr(timestamp)}">`,
  ];

  for (const ann of annotations) {
    switch (ann.type) {
      case "answer": {
        const question = (ann.metadata?.question as string) ?? "";
        lines.push(
          `  <answer block="${escapeAttr(ann.blockId)}" question="${escapeAttr(question)}">${escapeText(ann.content)}</answer>`
        );
        break;
      }
      case "choice": {
        const question = (ann.metadata?.question as string) ?? "";
        const option = (ann.metadata?.option as string) ?? "";
        lines.push(
          `  <choice block="${escapeAttr(ann.blockId)}" question="${escapeAttr(question)}"><selected option="${escapeAttr(option)}">${escapeText(ann.content)}</selected></choice>`
        );
        break;
      }
      case "highlight": {
        const selectedText = (ann.metadata?.selectedText as string) ?? "";
        lines.push(
          `  <highlight block="${escapeAttr(ann.blockId)}" text="${escapeAttr(selectedText)}">${escapeText(ann.content)}</highlight>`
        );
        break;
      }
      case "comment": {
        lines.push(
          `  <comment block="${escapeAttr(ann.blockId)}">${escapeText(ann.content)}</comment>`
        );
        break;
      }
      case "reject": {
        const reason = (ann.metadata?.reason as string) ?? ann.content;
        lines.push(
          `  <reject block="${escapeAttr(ann.blockId)}" reason="${escapeAttr(reason)}" />`
        );
        break;
      }
      case "approve": {
        lines.push(`  <approve block="${escapeAttr(ann.blockId)}" />`);
        break;
      }
    }
  }

  lines.push(`</lat-annotations>`);
  return lines.join("\n");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
