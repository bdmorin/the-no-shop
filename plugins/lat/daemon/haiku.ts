/**
 * LLM Annotation Terminal (LAT) — Haiku Structuring Pipeline
 *
 * Calls claude-haiku-4-5-20251001 to decompose raw markdown responses into
 * typed blocks. Degrades gracefully on any error.
 */

import type { LATResponse, Block } from "./types.ts";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const HAIKU_MAX_TOKENS = 4096;
const CHUNK_THRESHOLD = 8000;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `You are a response structurer for an annotation tool. Given an LLM assistant's markdown response, decompose it into an ordered array of typed blocks.

Block types:
- prose: Regular explanatory text (paragraphs)
- code: Fenced code block (preserve language tag in metadata.language)
- question: The assistant is asking the user to decide something
- decision: Multiple labeled options presented for choice (A/B/C, numbered, etc.)
- diagram: Mermaid block, ASCII art, or other visual content (set metadata.diagramType)
- heading: Section header (set metadata.level to 1-6)
- list: Bulleted or numbered list (preserve items)
- warning: Caveat, caution, or "important" callout
- summary: TL;DR, recap, or overview paragraph

Rules:
- Preserve all content exactly — do not summarize, rephrase, or omit
- Each block gets a sequential ID: b_1, b_2, b_3...
- For "question" blocks: extract the question as clean standalone text
- For "decision" blocks: extract each option with its label into metadata.options array [{label, text}]
- For "code" blocks: include the language in metadata.language
- For "diagram" blocks: include diagramType in metadata (mermaid, ascii, etc.)
- If a paragraph contains both explanation and a question, split into prose + question blocks
- When unsure of type, default to prose

Output ONLY a JSON array of block objects. No commentary outside the JSON. Example:
[
  {"type": "heading", "content": "Setup", "metadata": {"level": 2}},
  {"type": "prose", "content": "I've configured the database."},
  {"type": "question", "content": "Which caching strategy do you prefer?"},
  {"type": "decision", "content": "We have three options:", "metadata": {"options": [{"label": "A", "text": "Redis"}, {"label": "B", "text": "Memcached"}]}}
]`;

interface RawBlock {
  type: Block["type"];
  content: string;
  metadata?: Record<string, unknown>;
}

async function callHaiku(markdown: string, apiKey: string): Promise<RawBlock[]> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: HAIKU_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: markdown }],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "(unreadable)");
    throw new Error(`Haiku API error ${res.status}: ${errorText}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
  };

  const textContent = data.content.find((c) => c.type === "text");
  if (!textContent) {
    throw new Error("No text content in Haiku response");
  }

  // Strip markdown fences if Haiku wrapped output in ```json ... ```
  let jsonText = textContent.text.trim();
  const fenceMatch = jsonText.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim();
  }

  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) {
    throw new Error("Haiku response is not a JSON array");
  }

  return parsed as RawBlock[];
}

function assignBlockIds(rawBlocks: RawBlock[], prefix: string = "b"): Block[] {
  return rawBlocks.map((raw, i) => ({
    id: `${prefix}_${i + 1}`,
    type: raw.type,
    content: raw.content,
    ...(raw.metadata !== undefined ? { metadata: raw.metadata } : {}),
  }));
}

/**
 * Split markdown into chunks by top-level headings (## or #).
 * Returns at least one chunk (the whole string) even if no headings found.
 */
function chunkByHeadings(markdown: string): string[] {
  const lines = markdown.split("\n");
  const chunks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^#{1,2} /.test(line) && current.length > 0) {
      chunks.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    chunks.push(current.join("\n"));
  }

  return chunks.length > 0 ? chunks : [markdown];
}

function makeFailedResponse(
  rawMarkdown: string,
  responseId: string,
  sessionId: string
): LATResponse {
  return {
    responseId,
    sessionId,
    timestamp: Date.now(),
    rawMarkdown,
    structuringStatus: "failed",
    blocks: [],
    attention: { needed: false, reason: null },
  };
}

export async function structureResponse(
  rawMarkdown: string,
  responseId: string,
  sessionId: string
): Promise<LATResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn("[haiku] No ANTHROPIC_API_KEY set — skipping structuring");
    return makeFailedResponse(rawMarkdown, responseId, sessionId);
  }

  try {
    let blocks: Block[];

    if (rawMarkdown.length > CHUNK_THRESHOLD) {
      // Chunk by top-level headings and process in parallel
      const chunks = chunkByHeadings(rawMarkdown);
      const chunkResults = await Promise.all(
        chunks.map((chunk) => callHaiku(chunk, apiKey))
      );

      blocks = chunkResults.flatMap((rawBlocks, chunkIdx) =>
        assignBlockIds(rawBlocks, `b_c${chunkIdx}`)
      );
    } else {
      const rawBlocks = await callHaiku(rawMarkdown, apiKey);
      blocks = assignBlockIds(rawBlocks);
    }

    return {
      responseId,
      sessionId,
      timestamp: Date.now(),
      rawMarkdown,
      structuringStatus: "complete",
      blocks,
      attention: { needed: false, reason: null },
    };
  } catch (err) {
    console.warn("[haiku] Structuring failed, degrading gracefully:", err);
    return makeFailedResponse(rawMarkdown, responseId, sessionId);
  }
}
