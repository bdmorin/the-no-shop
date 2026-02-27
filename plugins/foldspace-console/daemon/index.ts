/**
 * Foldspace Console — Daemon
 *
 * Multi-session local server that:
 * - Receives session metadata from SessionStart hook
 * - Receives Claude Code output from Stop hook (per-session)
 * - Pushes responses to connected browsers via WebSocket
 * - Stores pending annotations per-session from browser
 * - Serves annotations to UserPromptSubmit hook (per-session)
 * - Reads filesystem metadata (settings, plugins, skills, git)
 * - Serves the web SPA
 */

import { $ } from "bun";

const PORT = Number(process.env.FOLDSPACE_PORT) || 3377;

// --- Types ---

interface SessionMeta {
  sessionId: string;
  cwd: string;
  model: string;
  permissionMode: string;
  startedAt: number;
  claudeVersion?: string;
  gitBranch?: string;
  gitRemote?: string;
  gitRepo?: string;
  projectSlug?: string;
  transcriptPath?: string;
  source?: string;
  lastActivity: number;
  totalTokensIn: number;
  totalTokensOut: number;
  turnCount: number;
}

interface Response {
  id: string;
  sessionId: string;
  timestamp: number;
  role: string;
  content: string;
}

interface Annotation {
  id: string;
  sessionId: string;
  responseId: string;
  selectedText: string;
  comment: string;
  timestamp: number;
}

// --- Per-session stores ---

const sessions = new Map<string, SessionMeta>();
const responsesBySession = new Map<string, Response[]>();
const annotationsBySession = new Map<string, Annotation[]>();

// Connected WebSocket clients
const wsClients = new Set<any>();

// Load the SPA HTML
const spaPath = new URL("../web/index.html", import.meta.url).pathname;

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function ensureSession(sessionId: string): void {
  if (!responsesBySession.has(sessionId)) {
    responsesBySession.set(sessionId, []);
  }
  if (!annotationsBySession.has(sessionId)) {
    annotationsBySession.set(sessionId, []);
  }
}

function broadcast(msg: object): void {
  const str = JSON.stringify(msg);
  for (const ws of wsClients) {
    ws.send(str);
  }
}

// Extract git info from a working directory
async function getGitInfo(cwd: string): Promise<{ branch?: string; remote?: string; repo?: string }> {
  try {
    const branch = await $`git -C ${cwd} rev-parse --abbrev-ref HEAD 2>/dev/null`.text();
    const remote = await $`git -C ${cwd} remote get-url origin 2>/dev/null`.text();
    const repoMatch = remote.trim().match(/[:/]([^/]+\/[^/.]+?)(?:\.git)?$/);
    return {
      branch: branch.trim() || undefined,
      remote: remote.trim() || undefined,
      repo: repoMatch ? repoMatch[1] : undefined,
    };
  } catch {
    return {};
  }
}

// Read global Claude Code config
async function getGlobalConfig(): Promise<object> {
  try {
    const settingsPath = `${process.env.HOME}/.claude/settings.json`;
    const settings = await Bun.file(settingsPath).json();

    const pluginsPath = `${process.env.HOME}/.claude/plugins/installed_plugins.json`;
    let plugins: any[] = [];
    try { plugins = await Bun.file(pluginsPath).json(); } catch {}

    let statsCache: any = {};
    try { statsCache = await Bun.file(`${process.env.HOME}/.claude/stats-cache.json`).json(); } catch {}

    let claudeVersion = "";
    try {
      claudeVersion = (await $`claude --version 2>/dev/null`.text()).trim();
    } catch {}

    // Scan for global skills
    let globalSkills: string[] = [];
    try {
      const glob = new Bun.Glob("*.md");
      const skillsDir = `${process.env.HOME}/.claude/skills`;
      for await (const file of glob.scan(skillsDir)) {
        globalSkills.push(file.replace(/\.md$/, ""));
      }
    } catch {}

    // Scan for MCP servers from settings
    const mcpServers = settings.mcpServers
      ? Object.keys(settings.mcpServers)
      : [];

    // Hook details
    const hookDetails: Record<string, number> = {};
    if (settings.hooks) {
      for (const [event, hookArr] of Object.entries(settings.hooks as Record<string, any[]>)) {
        let count = 0;
        for (const entry of hookArr) {
          count += (entry.hooks || [entry]).length;
        }
        hookDetails[event] = count;
      }
    }

    return {
      settings: {
        enabledPlugins: settings.enabledPlugins || {},
        hooks: hookDetails,
        env: settings.env || {},
        permissionDefaults: settings.skipDangerousModePermissionPrompt,
        mcpServers,
      },
      plugins,
      globalSkills,
      stats: {
        totalSessions: statsCache.totalSessions,
        totalMessages: statsCache.totalMessages,
        firstSessionDate: statsCache.firstSessionDate,
        modelUsage: statsCache.modelUsage,
      },
      claudeVersion,
    };
  } catch {
    return {};
  }
}

// Scan transcript for token usage and metadata
async function scanTranscript(transcriptPath: string): Promise<{
  totalTokensIn: number;
  totalTokensOut: number;
  turnCount: number;
  model?: string;
  claudeVersion?: string;
  gitBranch?: string;
}> {
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let turnCount = 0;
  let model: string | undefined;
  let claudeVersion: string | undefined;
  let gitBranch: string | undefined;

  try {
    const text = await Bun.file(transcriptPath).text();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        if (record.version) claudeVersion = record.version;
        if (record.gitBranch) gitBranch = record.gitBranch;

        if (record.type === "user") {
          turnCount++;
        }
        if (record.type === "assistant" && record.message?.usage) {
          const u = record.message.usage;
          totalTokensIn += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0);
          totalTokensOut += u.output_tokens || 0;
          if (record.message.model && record.message.model !== "<synthetic>") {
            model = record.message.model;
          }
        }
      } catch {}
    }
  } catch {}

  return { totalTokensIn, totalTokensOut, turnCount, model, claudeVersion, gitBranch };
}

const server = Bun.serve({
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

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- Session registration (SessionStart hook) ---
    if (url.pathname === "/api/session" && req.method === "POST") {
      const body = await req.json();
      const sid = body.sessionId;
      if (!sid) return Response.json({ ok: false, error: "missing sessionId" }, { status: 400, headers: corsHeaders });

      const git = await getGitInfo(body.cwd || ".");

      const meta: SessionMeta = {
        sessionId: sid,
        cwd: body.cwd || "",
        model: body.model || "unknown",
        permissionMode: body.permissionMode || "default",
        startedAt: Date.now(),
        source: body.source,
        transcriptPath: body.transcriptPath,
        gitBranch: git.branch,
        gitRemote: git.remote,
        gitRepo: git.repo,
        lastActivity: Date.now(),
        totalTokensIn: 0,
        totalTokensOut: 0,
        turnCount: 0,
      };

      // If resuming, scan existing transcript for accumulated stats
      if (body.source === "resume" && body.transcriptPath) {
        const stats = await scanTranscript(body.transcriptPath);
        meta.totalTokensIn = stats.totalTokensIn;
        meta.totalTokensOut = stats.totalTokensOut;
        meta.turnCount = stats.turnCount;
        meta.claudeVersion = stats.claudeVersion;
        if (stats.model) meta.model = stats.model;
        if (stats.gitBranch) meta.gitBranch = stats.gitBranch;
      }

      sessions.set(sid, meta);
      ensureSession(sid);

      broadcast({ type: "session_started", data: meta });

      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    // --- Response from Stop hook (per-session) ---
    if (url.pathname === "/api/response" && req.method === "POST") {
      const body = await req.json();
      const sid = body.sessionId || "unknown";
      ensureSession(sid);

      const entry: Response = {
        id: generateId(),
        sessionId: sid,
        timestamp: Date.now(),
        role: body.role || "assistant",
        content: body.content || "",
      };
      responsesBySession.get(sid)!.push(entry);

      // Update session activity
      const meta = sessions.get(sid);
      if (meta) {
        meta.lastActivity = Date.now();
        meta.turnCount++;
      }

      broadcast({ type: "new_response", data: entry });

      return Response.json({ ok: true, id: entry.id }, { headers: corsHeaders });
    }

    // --- Responses (per-session or all) ---
    if (url.pathname === "/api/responses" && req.method === "GET") {
      const sid = url.searchParams.get("session");
      if (sid) {
        return Response.json(responsesBySession.get(sid) || [], { headers: corsHeaders });
      }
      const all: Response[] = [];
      for (const resps of responsesBySession.values()) {
        all.push(...resps);
      }
      all.sort((a, b) => a.timestamp - b.timestamp);
      return Response.json(all, { headers: corsHeaders });
    }

    // --- Sessions list ---
    if (url.pathname === "/api/sessions" && req.method === "GET") {
      const list = Array.from(sessions.values()).sort((a, b) => b.lastActivity - a.lastActivity);
      return Response.json(list, { headers: corsHeaders });
    }

    // --- Annotate (per-session) ---
    if (url.pathname === "/api/annotate" && req.method === "POST") {
      const body = await req.json();
      const sid = body.sessionId || "unknown";
      ensureSession(sid);

      const annotation: Annotation = {
        id: generateId(),
        sessionId: sid,
        responseId: body.responseId,
        selectedText: body.selectedText,
        comment: body.comment,
        timestamp: Date.now(),
      };
      annotationsBySession.get(sid)!.push(annotation);

      broadcast({ type: "annotation_added", data: annotation });

      return Response.json({ ok: true, id: annotation.id }, { headers: corsHeaders });
    }

    // --- Get annotations (per-session) ---
    if (url.pathname === "/api/annotations" && req.method === "GET") {
      const sid = url.searchParams.get("session");
      if (sid) {
        return Response.json(annotationsBySession.get(sid) || [], { headers: corsHeaders });
      }
      const all: Annotation[] = [];
      for (const anns of annotationsBySession.values()) {
        all.push(...anns);
      }
      return Response.json(all, { headers: corsHeaders });
    }

    // --- Clear annotations (per-session) ---
    if (url.pathname === "/api/annotations" && req.method === "DELETE") {
      const sid = url.searchParams.get("session");
      if (sid) {
        const anns = annotationsBySession.get(sid);
        const cleared = anns ? anns.length : 0;
        if (anns) anns.length = 0;
        return Response.json({ ok: true, cleared }, { headers: corsHeaders });
      }
      let cleared = 0;
      for (const anns of annotationsBySession.values()) {
        cleared += anns.length;
        anns.length = 0;
      }
      return Response.json({ ok: true, cleared }, { headers: corsHeaders });
    }

    // --- Delete single annotation ---
    if (url.pathname === "/api/annotations" && req.method === "POST" && url.searchParams.get("action") === "delete") {
      const body = await req.json();
      for (const anns of annotationsBySession.values()) {
        const idx = anns.findIndex(a => a.id === body.id);
        if (idx !== -1) {
          anns.splice(idx, 1);
          break;
        }
      }
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    // --- Global config ---
    if (url.pathname === "/api/config" && req.method === "GET") {
      const config = await getGlobalConfig();
      return Response.json(config, { headers: corsHeaders });
    }

    // --- Health ---
    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        sessions: sessions.size,
        clients: wsClients.size,
      }, { headers: corsHeaders });
    }

    // --- Session end ---
    if (url.pathname === "/api/session/end" && req.method === "POST") {
      const body = await req.json();
      const sid = body.sessionId;
      const meta = sessions.get(sid);
      if (meta && body.transcriptPath) {
        const stats = await scanTranscript(body.transcriptPath);
        meta.totalTokensIn = stats.totalTokensIn;
        meta.totalTokensOut = stats.totalTokensOut;
        meta.turnCount = stats.turnCount;
        if (stats.claudeVersion) meta.claudeVersion = stats.claudeVersion;
      }
      broadcast({ type: "session_ended", data: { sessionId: sid, reason: body.reason } });
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    // Serve the SPA
    try {
      const html = await Bun.file(spaPath).text();
      return new Response(html, {
        headers: { "Content-Type": "text/html", ...corsHeaders },
      });
    } catch {
      return new Response("SPA not found.", { status: 404, headers: corsHeaders });
    }
  },

  websocket: {
    open(ws) {
      wsClients.add(ws);
      // Send full state on connect
      const sessionsArr = Array.from(sessions.values());
      const allResponses: Record<string, Response[]> = {};
      const allAnnotations: Record<string, Annotation[]> = {};
      for (const [sid, resps] of responsesBySession) {
        allResponses[sid] = resps;
      }
      for (const [sid, anns] of annotationsBySession) {
        allAnnotations[sid] = anns;
      }
      ws.send(JSON.stringify({
        type: "init",
        data: { sessions: sessionsArr, responses: allResponses, annotations: allAnnotations }
      }));
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

// --- Session stats heartbeat ---
// Every 8 seconds, re-scan active session transcripts and push updates if changed

const HEARTBEAT_INTERVAL = 8000;

setInterval(async () => {
  if (wsClients.size === 0) return; // No browsers connected, skip work

  for (const [sid, meta] of sessions) {
    if (!meta.transcriptPath) continue;

    try {
      const stats = await scanTranscript(meta.transcriptPath);
      const changed =
        stats.totalTokensIn !== meta.totalTokensIn ||
        stats.totalTokensOut !== meta.totalTokensOut ||
        stats.turnCount !== meta.turnCount;

      if (changed) {
        meta.totalTokensIn = stats.totalTokensIn;
        meta.totalTokensOut = stats.totalTokensOut;
        meta.turnCount = stats.turnCount;
        if (stats.model) meta.model = stats.model;
        if (stats.claudeVersion) meta.claudeVersion = stats.claudeVersion;
        meta.lastActivity = Date.now();

        broadcast({
          type: "session_stats_update",
          data: {
            sessionId: sid,
            totalTokensIn: meta.totalTokensIn,
            totalTokensOut: meta.totalTokensOut,
            turnCount: meta.turnCount,
          },
        });
      }
    } catch {
      // Transcript might not exist yet or be mid-write; silently skip
    }
  }
}, HEARTBEAT_INTERVAL);

console.log(`Foldspace Console daemon on http://localhost:${PORT}`);
console.log(`WebSocket on ws://localhost:${PORT}/ws`);
console.log(`Open http://localhost:${PORT} in your browser`);
