import { useEffect, useRef, useState, useCallback } from "react";
import type { SessionMeta, LATResponse, WSEvent } from "../types";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

export type AnnotationEvent = Extract<
  WSEvent,
  { type: "annotation_added" | "annotation_removed" | "annotations_consumed" }
>;

export interface UseWebSocketResult {
  sessions: SessionMeta[];
  responses: Record<string, LATResponse[]>;
  connectionStatus: ConnectionStatus;
  onAnnotationEvent: (handler: (event: AnnotationEvent) => void) => () => void;
}

const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

export function useWebSocket(): UseWebSocketResult {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [responses, setResponses] = useState<Record<string, LATResponse[]>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const annotationHandlersRef = useRef<Set<(event: AnnotationEvent) => void>>(new Set());
  const unmountedRef = useRef(false);

  const emitAnnotationEvent = useCallback((event: AnnotationEvent) => {
    for (const handler of annotationHandlersRef.current) {
      handler(event);
    }
  }, []);

  const onAnnotationEvent = useCallback((handler: (event: AnnotationEvent) => void) => {
    annotationHandlersRef.current.add(handler);
    return () => {
      annotationHandlersRef.current.delete(handler);
    };
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const url = `ws://${window.location.host}/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      reconnectAttemptRef.current = 0;
      setConnectionStatus("connected");
    };

    ws.onmessage = (event) => {
      if (unmountedRef.current) return;
      let msg: WSEvent;
      try {
        msg = JSON.parse(event.data as string) as WSEvent;
      } catch {
        return;
      }

      switch (msg.type) {
        case "init":
          setSessions(msg.sessions);
          setResponses(msg.responses);
          break;

        case "session_started":
          setSessions((prev) => {
            if (prev.some((s) => s.sessionId === msg.session.sessionId)) return prev;
            return [...prev, msg.session];
          });
          break;

        case "session_ended":
          setSessions((prev) => prev.filter((s) => s.sessionId !== msg.sessionId));
          break;

        case "new_response":
          setResponses((prev) => {
            const existing = prev[msg.response.sessionId] ?? [];
            return { ...prev, [msg.response.sessionId]: [...existing, msg.response] };
          });
          break;

        case "response_structured":
          setResponses((prev) => {
            const existing = prev[msg.response.sessionId] ?? [];
            const updated = existing.map((r) =>
              r.responseId === msg.response.responseId ? msg.response : r
            );
            return { ...prev, [msg.response.sessionId]: updated };
          });
          break;

        case "annotation_added":
        case "annotation_removed":
        case "annotations_consumed":
          emitAnnotationEvent(msg);
          break;
      }
    };

    ws.onerror = () => {
      // onclose will handle reconnect
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      wsRef.current = null;

      const attempt = reconnectAttemptRef.current;
      const delay = BACKOFF_DELAYS[Math.min(attempt, BACKOFF_DELAYS.length - 1)];
      reconnectAttemptRef.current = attempt + 1;

      setConnectionStatus(attempt === 0 ? "reconnecting" : "reconnecting");

      reconnectTimerRef.current = setTimeout(() => {
        if (!unmountedRef.current) {
          connect();
        }
      }, delay);
    };
  }, [emitAnnotationEvent]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnectionStatus("disconnected");
    };
  }, [connect]);

  return { sessions, responses, connectionStatus, onAnnotationEvent };
}
