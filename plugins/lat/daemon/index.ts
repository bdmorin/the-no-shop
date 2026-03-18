/**
 * LLM Annotation Terminal (LAT) — Daemon
 *
 * Local HTTP + WebSocket server that:
 * - Receives session metadata from hooks
 * - Receives Claude Code responses and stores per-session
 * - Stores annotations per-session from browser
 * - Pushes updates to connected browsers via WebSocket
 * - Serves annotations to hooks (atomic fetch-and-delete)
 * - Serves the built SPA static files
 */

import type { SessionMeta, LATResponse, Annotation } from "./types.ts";

const PORT = Number(process.env.LAT_PORT) || 4747;
const DAEMON_START_TIME = Date.now();

// --- Per-session state ---

const sessions = new Map<string, SessionMeta>();
const responsesBySession = new Map<string, LATResponse[]>();
const annotationsBySession = new Map<string, Annotation[]>();

// Connected WebSocket clients
const wsClients = new Set<any>();

// --- CORS headers (localhost-only, no auth needed) ---

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// --- Helpers ---

function generateId(prefix: string): string {
  return prefix + crypto.randomUUID().slice(0, 8);
}

function jsonError(message: string, code: string, status: number): Response {
  return Response.json({ error: message, code }, { status, headers: corsHeaders });
}

function ensureSession(sessionId: string): void {
  if (!responsesBySession.has(sessionId)) {
    responsesBySession.set(sessionId, []);
  }
  if (!annotationsBySession.has(sessionId)) {
    annotationsBySession.set(sessionId, []);
  }
}

function broadcast(event: object): void {
  const str = JSON.stringify(event);
  for (const ws of wsClients) {
    ws.send(str);
  }
}

// --- Static file serving ---

const webDistPath = new URL("../web/dist", import.meta.url).pathname;

function getContentType(path: string): string {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".js") || path.endsWith(".mjs")) return "application/javascript";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".ico")) return "image/x-icon";
  if (path.endsWith(".woff2")) return "font/woff2";
  if (path.endsWith(".woff")) return "font/woff";
  return "application/octet-stream";
}

async function serveStatic(pathname: string): Promise<Response> {
  // Normalize: strip leading slash, then resolve against dist
  const relative = pathname.replace(/^\//, "") || "index.html";
  const filePath = `${webDistPath}/${relative}`;

  const file = Bun.file(filePath);
  if (await file.exists()) {
    return new Response(file, {
      headers: {
        "Content-Type": getContentType(filePath),
        ...corsHeaders,
      },
    });
  }

  // SPA fallback — serve index.html for client-side routing
  const indexFile = Bun.file(`${webDistPath}/index.html`);
  if (await indexFile.exists()) {
    return new Response(indexFile, {
      headers: { "Content-Type": "text/html", ...corsHeaders },
    });
  }

  return new Response("SPA not built yet.", { status: 404, headers: corsHeaders });
}

// --- Server ---

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined as any;
    }

    // OPTIONS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // --- GET /health ---
    if (url.pathname === "/health" && req.method === "GET") {
      return Response.json(
        { status: "ok", uptime: Math.floor((Date.now() - DAEMON_START_TIME) / 1000) },
        { headers: corsHeaders }
      );
    }

    // --- POST /api/session — register a new session ---
    if (url.pathname === "/api/session" && req.method === "POST") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return jsonError("Invalid JSON body", "INVALID_BODY", 400);
      }

      const sid = body.sessionId;
      if (!sid || typeof sid !== "string" || sid.trim() === "") {
        return jsonError("sessionId must be a non-empty string", "INVALID_SESSION_ID", 400);
      }

      const meta: SessionMeta = {
        sessionId: sid,
        cwd: body.cwd || "",
        model: body.model || "unknown",
        permissionMode: body.permissionMode || "default",
        startedAt: Date.now(),
        lastActivity: Date.now(),
        transcriptPath: body.transcriptPath,
        source: body.source,
        gitBranch: body.gitBranch,
        gitRepo: body.gitRepo,
      };

      sessions.set(sid, meta);
      ensureSession(sid);

      broadcast({ type: "session_started", data: meta });

      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    // --- POST /api/session/:id/end — end a session ---
    const sessionEndMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/end$/);
    if (sessionEndMatch && req.method === "POST") {
      const sid = decodeURIComponent(sessionEndMatch[1]);
      const meta = sessions.get(sid);

      sessions.delete(sid);

      broadcast({ type: "session_ended", data: { sessionId: sid, meta: meta || null } });

      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    // --- POST /api/response — store a response ---
    if (url.pathname === "/api/response" && req.method === "POST") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return jsonError("Invalid JSON body", "INVALID_BODY", 400);
      }

      const sid = body.sessionId;
      if (!sid || typeof sid !== "string" || sid.trim() === "") {
        return jsonError("sessionId must be a non-empty string", "INVALID_SESSION_ID", 400);
      }

      ensureSession(sid);

      const responseId = generateId("r_");
      const entry: LATResponse = {
        responseId,
        sessionId: sid,
        timestamp: Date.now(),
        rawMarkdown: body.rawMarkdown || body.content || "",
        structuringStatus: "pending",
        blocks: body.blocks || [],
        attention: body.attention || { needed: false, reason: null },
      };

      responsesBySession.get(sid)!.push(entry);

      // Update session activity
      const meta = sessions.get(sid);
      if (meta) {
        meta.lastActivity = Date.now();
      }

      broadcast({ type: "new_response", data: entry });

      return Response.json({ responseId }, { headers: corsHeaders });
    }

    // --- POST /api/annotations — create annotation ---
    if (url.pathname === "/api/annotations" && req.method === "POST") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return jsonError("Invalid JSON body", "INVALID_BODY", 400);
      }

      const sid = body.sessionId;
      if (!sid || typeof sid !== "string" || sid.trim() === "") {
        return jsonError("sessionId must be a non-empty string", "INVALID_SESSION_ID", 400);
      }

      ensureSession(sid);

      const id = generateId("a_");
      const annotation: Annotation = {
        id,
        sessionId: sid,
        responseId: body.responseId || "",
        blockId: body.blockId || "",
        type: body.type || "comment",
        content: body.content || "",
        metadata: body.metadata,
        timestamp: Date.now(),
      };

      annotationsBySession.get(sid)!.push(annotation);

      broadcast({ type: "annotation_added", data: annotation });

      return Response.json({ id }, { headers: corsHeaders });
    }

    // --- DELETE /api/annotations/:id?session=:sid — remove a single annotation ---
    const annotationDeleteMatch = url.pathname.match(/^\/api\/annotations\/([^/]+)$/);
    if (annotationDeleteMatch && req.method === "DELETE") {
      const annotationId = decodeURIComponent(annotationDeleteMatch[1]);
      const sid = url.searchParams.get("session");

      if (!sid) {
        return jsonError("session query param required", "MISSING_SESSION", 400);
      }

      const anns = annotationsBySession.get(sid);
      if (!anns) {
        return jsonError("session not found", "SESSION_NOT_FOUND", 404);
      }

      const idx = anns.findIndex((a) => a.id === annotationId);
      if (idx === -1) {
        return jsonError("annotation not found", "NOT_FOUND", 404);
      }

      anns.splice(idx, 1);

      broadcast({ type: "annotation_removed", data: { id: annotationId, sessionId: sid } });

      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    // --- POST /api/annotations/consume?session=:id — atomic fetch-and-delete all annotations ---
    if (url.pathname === "/api/annotations/consume" && req.method === "POST") {
      const sid = url.searchParams.get("session");

      if (!sid) {
        return jsonError("session query param required", "MISSING_SESSION", 400);
      }

      ensureSession(sid);

      const anns = annotationsBySession.get(sid)!;
      const consumed = [...anns];
      anns.length = 0;

      broadcast({ type: "annotations_consumed", data: { sessionId: sid, count: consumed.length } });

      return Response.json(consumed, { headers: corsHeaders });
    }

    // --- Static file serving (SPA catch-all) ---
    if (req.method === "GET") {
      return serveStatic(url.pathname);
    }

    return jsonError("Not found", "NOT_FOUND", 404);
  },

  websocket: {
    open(ws) {
      wsClients.add(ws);

      // Send full state on connect
      const sessionsArr = Array.from(sessions.values());
      const allResponses: Record<string, LATResponse[]> = {};
      const allAnnotations: Record<string, Annotation[]> = {};

      for (const [sid, resps] of responsesBySession) {
        allResponses[sid] = resps;
      }
      for (const [sid, anns] of annotationsBySession) {
        allAnnotations[sid] = anns;
      }

      ws.send(
        JSON.stringify({
          type: "init",
          data: {
            sessions: sessionsArr,
            responses: allResponses,
            annotations: allAnnotations,
          },
        })
      );
    },

    message(ws, message) {
      try {
        const msg = JSON.parse(String(message));
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {}
    },

    close(ws) {
      wsClients.delete(ws);
    },
  },
});

console.log(`LAT daemon listening on http://127.0.0.1:${PORT}`);
