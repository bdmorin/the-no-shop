import { useEffect, useRef, useState, useCallback } from "react";
import type { Annotation } from "../types";
import type { AnnotationEvent } from "./useWebSocket";

export interface AddAnnotationParams {
  sessionId: string;
  responseId: string;
  blockId: string;
  type: Annotation["type"];
  content: string;
  metadata?: Record<string, unknown>;
}

export interface UseAnnotationsResult {
  pendingAnnotations: Annotation[];
  submittedAnnotations: Annotation[];
  addAnnotation: (params: AddAnnotationParams) => Promise<void>;
  removeAnnotation: (id: string, sessionId: string) => Promise<void>;
}

export function useAnnotations(
  onAnnotationEvent: (handler: (event: AnnotationEvent) => void) => () => void
): UseAnnotationsResult {
  const [pendingAnnotations, setPendingAnnotations] = useState<Annotation[]>([]);
  const [submittedAnnotations, setSubmittedAnnotations] = useState<Annotation[]>([]);

  // Track annotation IDs we added locally to avoid double-adding from WS echo
  const locallyAddedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = onAnnotationEvent((event) => {
      switch (event.type) {
        case "annotation_added": {
          const ann = event.annotation;
          // Skip echo of our own adds
          if (locallyAddedIds.current.has(ann.id)) {
            locallyAddedIds.current.delete(ann.id);
            return;
          }
          setPendingAnnotations((prev) => {
            if (prev.some((a) => a.id === ann.id)) return prev;
            return [...prev, ann];
          });
          break;
        }

        case "annotation_removed": {
          const { annotationId } = event;
          setPendingAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
          break;
        }

        case "annotations_consumed": {
          const { annotationIds } = event;
          const idSet = new Set(annotationIds);
          setPendingAnnotations((prev) => {
            const consumed = prev.filter((a) => idSet.has(a.id));
            if (consumed.length > 0) {
              setSubmittedAnnotations((sub) => [...sub, ...consumed]);
            }
            return prev.filter((a) => !idSet.has(a.id));
          });
          break;
        }
      }
    });

    return unsubscribe;
  }, [onAnnotationEvent]);

  const addAnnotation = useCallback(async (params: AddAnnotationParams) => {
    const res = await fetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      throw new Error(`Failed to add annotation: ${res.status} ${res.statusText}`);
    }

    const annotation = (await res.json()) as Annotation;
    locallyAddedIds.current.add(annotation.id);
    setPendingAnnotations((prev) => {
      if (prev.some((a) => a.id === annotation.id)) return prev;
      return [...prev, annotation];
    });
  }, []);

  const removeAnnotation = useCallback(async (id: string, sessionId: string) => {
    const res = await fetch(`/api/annotations/${id}?session=${sessionId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      throw new Error(`Failed to remove annotation: ${res.status} ${res.statusText}`);
    }

    setPendingAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { pendingAnnotations, submittedAnnotations, addAnnotation, removeAnnotation };
}
