export interface SessionMeta {
  sessionId: string;
  cwd: string;
  model: string;
  permissionMode: string;
  startedAt: number;
  lastActivity: number;
  transcriptPath?: string;
  source?: string;
  gitBranch?: string;
  gitRepo?: string;
}

export interface LATResponse {
  responseId: string;
  sessionId: string;
  timestamp: number;
  rawMarkdown: string;
  structuringStatus: "pending" | "complete" | "failed";
  blocks: Block[];
  attention: { needed: boolean; reason: string | null };
}

export interface Block {
  id: string;
  type: "prose" | "code" | "question" | "decision" | "diagram" | "heading" | "list" | "warning" | "summary";
  content: string;
  metadata?: Record<string, unknown>;
}

export interface Annotation {
  id: string;
  sessionId: string;
  responseId: string;
  blockId: string;
  type: "answer" | "choice" | "highlight" | "comment" | "reject" | "approve";
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}
