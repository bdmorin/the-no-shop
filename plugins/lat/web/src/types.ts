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

export interface Block {
  id: string;
  type:
    | "prose"
    | "code"
    | "question"
    | "decision"
    | "diagram"
    | "heading"
    | "list"
    | "warning"
    | "summary";
  content: string;
  metadata?: Record<string, unknown>;
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

// WebSocket event types from the daemon
export type WSEvent =
  | { type: "init"; sessions: SessionMeta[]; responses: Record<string, LATResponse[]>; annotations: Annotation[] }
  | { type: "session_started"; session: SessionMeta }
  | { type: "session_ended"; sessionId: string }
  | { type: "new_response"; response: LATResponse }
  | { type: "response_structured"; response: LATResponse }
  | { type: "annotation_added"; annotation: Annotation }
  | { type: "annotation_removed"; annotationId: string; sessionId: string }
  | { type: "annotations_consumed"; sessionId: string; annotationIds: string[] };
