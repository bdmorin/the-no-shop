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
 * - Reads mise tool/environment configuration
 * - Serves the web SPA
 */

import { $ } from "bun";
import * as os from "os";

const PORT = Number(process.env.FOLDSPACE_PORT) || 3377;
const DAEMON_START_TIME = Date.now();

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
  gitStatus?: GitStatus | null;
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

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: number;
  modified: number;
  untracked: number;
  conflicted: number;
}

// --- Per-session stores ---

const sessions = new Map<string, SessionMeta>();
const responsesBySession = new Map<string, Response[]>();
const annotationsBySession = new Map<string, Annotation[]>();

// Connected WebSocket clients
const wsClients = new Set<any>();

// Git status cache: keyed by repo root path
const gitStatusCache = new Map<string, GitStatus>();
// Map from cwd -> resolved git repo root (or null if not a repo)
const cwdToRepoRoot = new Map<string, string | null>();
// Active polling intervals keyed by repo root
const gitPollingIntervals = new Map<string, Timer>();

// --- CPU snapshot for delta calculation ---
// os.cpus() returns instantaneous tick counts; we need two snapshots to compute usage %
let prevCpuSnapshot: os.CpuInfo[] | null = null;

interface SystemStats {
  cpu: {
    count: number;
    model: string;
    usage: number[];      // per-core percentages (0-100)
    overall: number;      // average across all cores
  };
  memory: {
    total: number;
    used: number;
    free: number;
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
  uptime: number;
  platform: string;
  arch: string;
  nodeVersion: string;
  loadAvg: number[];
}

function computeSystemStats(): SystemStats {
  const cpus = os.cpus();
  const usage: number[] = [];

  if (prevCpuSnapshot && prevCpuSnapshot.length === cpus.length) {
    for (let i = 0; i < cpus.length; i++) {
      const prev = prevCpuSnapshot[i].times;
      const curr = cpus[i].times;
      const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
      const currTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq;
      const totalDelta = currTotal - prevTotal;
      const idleDelta = curr.idle - prev.idle;
      if (totalDelta > 0) {
        usage.push(Math.round((1 - idleDelta / totalDelta) * 10000) / 100);
      } else {
        usage.push(0);
      }
    }
  } else {
    // First call — no delta available, report 0
    for (let i = 0; i < cpus.length; i++) usage.push(0);
  }
  prevCpuSnapshot = cpus;

  const overall = usage.length > 0
    ? Math.round(usage.reduce((a, b) => a + b, 0) / usage.length * 100) / 100
    : 0;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsage = process.memoryUsage();

  return {
    cpu: {
      count: cpus.length,
      model: cpus[0]?.model || "unknown",
      usage,
      overall,
    },
    memory: {
      total: totalMem,
      used: totalMem - freeMem,
      free: freeMem,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
    },
    uptime: Math.floor((Date.now() - DAEMON_START_TIME) / 1000),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    loadAvg: os.loadavg(),
  };
}

// --- Mise cache ---
// 30-second TTL: mise config rarely changes mid-session
let miseCache: { data: any; ts: number } | null = null;
const MISE_CACHE_TTL = 30_000;

// --- Context docs types and cache ---

interface ContextFile {
  path: string;
  shortPath: string;
  readCount: number;
  firstRead: string;
  lastRead: string;
  tool: string;  // "Read" | "Glob" | "Grep" | "Bash" | "Edit" | "Write"
}

interface ContextDocsResult {
  files: ContextFile[];
  totalReads: number;
  uniqueFiles: number;
}

// Cache per session: { result, ts, fileSize }
// Active sessions: 10s TTL. Ended sessions: cached indefinitely.
const contextDocsCache = new Map<string, { result: ContextDocsResult; ts: number; fileSize: number }>();
const CONTEXT_DOCS_TTL = 10_000;

// Secret masking: any env key matching these patterns gets masked
const SECRET_KEY_PATTERN = /KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|API/i;

function maskSecret(value: string): string {
  if (value.length < 12) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

// Run a command with timeout, returning stdout or null on failure
async function runWithTimeout(cmd: string[], timeoutMs: number): Promise<string | null> {
  try {
    const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
    const timer = setTimeout(() => proc.kill(), timeoutMs);
    const exitCode = await proc.exited;
    clearTimeout(timer);
    if (exitCode !== 0) return null;
    return await new Response(proc.stdout).text();
  } catch {
    return null;
  }
}

// Gather mise data: installed tools, env vars, config files
async function fetchMiseData(): Promise<any> {
  if (miseCache && (Date.now() - miseCache.ts) < MISE_CACHE_TTL) {
    return miseCache.data;
  }

  const versionOut = await runWithTimeout(["mise", "--version"], 5000);
  if (versionOut === null) {
    const result = { available: false };
    miseCache = { data: result, ts: Date.now() };
    return result;
  }

  const [toolsRaw, envRaw] = await Promise.all([
    runWithTimeout(["mise", "ls", "--json"], 5000),
    runWithTimeout(["mise", "env", "--json"], 5000),
  ]);

  let tools: Record<string, any[]> = {};
  if (toolsRaw) {
    try { tools = JSON.parse(toolsRaw); } catch {}
  }

  let env: Record<string, string> = {};
  let envMasked: Record<string, { value: string; masked: boolean }> = {};
  if (envRaw) {
    try { env = JSON.parse(envRaw); } catch {}
  }
  for (const [key, val] of Object.entries(env)) {
    if (key === "PATH") continue;
    const isSensitive = SECRET_KEY_PATTERN.test(key);
    envMasked[key] = {
      value: isSensitive ? maskSecret(val) : val,
      masked: isSensitive,
    };
  }

  let configFiles: Record<string, string> = {};
  const cwds = new Set<string>();
  for (const meta of sessions.values()) {
    if (meta.cwd) cwds.add(meta.cwd);
  }
  cwds.add(process.cwd());

  for (const cwd of cwds) {
    for (const filename of [".mise.toml", ".mise.local.toml"]) {
      if (configFiles[filename]) continue;
      try {
        const content = await Bun.file(`${cwd}/${filename}`).text();
        if (content) configFiles[filename] = content;
      } catch {}
    }
  }

  const result = {
    available: true,
    version: versionOut.trim(),
    tools,
    env: envMasked,
    configFiles,
  };

  miseCache = { data: result, ts: Date.now() };
  return result;
}

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

// Resolve the git repo root for a directory, with caching
async function resolveRepoRoot(cwd: string): Promise<string | null> {
  if (cwdToRepoRoot.has(cwd)) return cwdToRepoRoot.get(cwd)!;
  try {
    const proc = Bun.spawn(["git", "-C", cwd, "rev-parse", "--show-toplevel"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const timeout = setTimeout(() => proc.kill(), 5000);
    const exitCode = await proc.exited;
    clearTimeout(timeout);
    if (exitCode !== 0) {
      cwdToRepoRoot.set(cwd, null);
      return null;
    }
    const root = (await new Response(proc.stdout).text()).trim();
    cwdToRepoRoot.set(cwd, root);
    return root;
  } catch {
    cwdToRepoRoot.set(cwd, null);
    return null;
  }
}

// Parse git status --porcelain=v2 --branch output into a GitStatus object
function parseGitStatusOutput(output: string): GitStatus {
  const status: GitStatus = {
    branch: "",
    ahead: 0,
    behind: 0,
    staged: 0,
    modified: 0,
    untracked: 0,
    conflicted: 0,
  };

  for (const line of output.split("\n")) {
    if (!line) continue;

    // Branch headers
    if (line.startsWith("# branch.head ")) {
      status.branch = line.slice("# branch.head ".length);
    } else if (line.startsWith("# branch.ab ")) {
      const match = line.match(/# branch\.ab \+(\d+) -(\d+)/);
      if (match) {
        status.ahead = parseInt(match[1], 10);
        status.behind = parseInt(match[2], 10);
      }
    }
    // Ordinary changed entries: "1 XY ..." or renamed "2 XY ..."
    else if (line.startsWith("1 ") || line.startsWith("2 ")) {
      const xy = line.split(" ")[1];
      if (xy && xy.length === 2) {
        const [x, y] = xy;
        // X = index (staged), Y = worktree (modified)
        if (x !== ".") status.staged++;
        if (y !== ".") status.modified++;
      }
    }
    // Unmerged (conflicted) entries
    else if (line.startsWith("u ")) {
      status.conflicted++;
    }
    // Untracked
    else if (line.startsWith("? ")) {
      status.untracked++;
    }
  }

  return status;
}

// Compare two git status objects for equality
function gitStatusEqual(a: GitStatus | null | undefined, b: GitStatus | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.branch === b.branch &&
    a.ahead === b.ahead &&
    a.behind === b.behind &&
    a.staged === b.staged &&
    a.modified === b.modified &&
    a.untracked === b.untracked &&
    a.conflicted === b.conflicted
  );
}

// Fetch current git status for a repo root, with a 5-second timeout
async function fetchGitStatus(repoRoot: string): Promise<GitStatus | null> {
  try {
    const proc = Bun.spawn(
      ["git", "-C", repoRoot, "status", "--porcelain=v2", "--branch"],
      { stdout: "pipe", stderr: "pipe" }
    );
    const timeout = setTimeout(() => proc.kill(), 5000);
    const exitCode = await proc.exited;
    clearTimeout(timeout);
    if (exitCode !== 0) return null;
    const output = await new Response(proc.stdout).text();
    return parseGitStatusOutput(output);
  } catch {
    return null;
  }
}

// Start polling git status for a given repo root (if not already polling)
function startGitPolling(repoRoot: string): void {
  if (gitPollingIntervals.has(repoRoot)) return;

  // Run immediately on first registration
  pollGitStatus(repoRoot);

  const interval = setInterval(() => pollGitStatus(repoRoot), 10_000);
  gitPollingIntervals.set(repoRoot, interval);
}

// Single poll cycle: fetch, compare, broadcast if changed
async function pollGitStatus(repoRoot: string): Promise<void> {
  const newStatus = await fetchGitStatus(repoRoot);
  if (!newStatus) return;

  const cached = gitStatusCache.get(repoRoot);
  if (gitStatusEqual(cached, newStatus)) return;

  gitStatusCache.set(repoRoot, newStatus);

  // Update all sessions whose cwd maps to this repo root
  for (const [sid, meta] of sessions) {
    const root = cwdToRepoRoot.get(meta.cwd);
    if (root === repoRoot) {
      meta.gitStatus = newStatus;
      broadcast({ type: "session_git_status", data: { sessionId: sid, gitStatus: newStatus } });
    }
  }
}

// Stop polling for a repo root if no sessions reference it anymore
function maybeStopGitPolling(repoRoot: string): void {
  for (const meta of sessions.values()) {
    if (cwdToRepoRoot.get(meta.cwd) === repoRoot) return; // still referenced
  }
  const interval = gitPollingIntervals.get(repoRoot);
  if (interval) {
    clearInterval(interval);
    gitPollingIntervals.delete(repoRoot);
  }
  gitStatusCache.delete(repoRoot);
}

// Parse YAML-ish frontmatter from a skill markdown file
// Handles simple key: value pairs between --- delimiters
function parseFrontmatter(content: string): Record<string, string> {
  const fm: Record<string, string> = {};
  if (!content.startsWith("---")) return fm;
  const endIdx = content.indexOf("---", 3);
  if (endIdx === -1) return fm;
  const block = content.slice(3, endIdx).trim();
  for (const line of block.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    fm[key] = val;
  }
  return fm;
}

// Scan a skills directory for SKILL.md files (plugin skills live in subdirs)
async function scanSkillsDir(dir: string, source: string): Promise<any[]> {
  const skills: any[] = [];
  try {
    const glob = new Bun.Glob("**/SKILL.md");
    for await (const file of glob.scan(dir)) {
      try {
        const content = await Bun.file(`${dir}/${file}`).text();
        const fm = parseFrontmatter(content);
        const dirName = file.replace(/\/SKILL\.md$/, "").replace(/\.md$/, "");
        skills.push({
          name: fm.name || dirName,
          description: fm.description || "",
          modelInvocable: fm["disable-model-invocation"] !== "true",
          path: `${dir}/${file}`,
          source,
          argumentHint: fm["argument-hint"] || "",
        });
      } catch {}
    }
    // Also scan for top-level .md files (user skills like vet-assumptions.md)
    const mdGlob = new Bun.Glob("*.md");
    for await (const file of mdGlob.scan(dir)) {
      const fullPath = `${dir}/${file}`;
      // Skip if already found as SKILL.md
      if (skills.some(s => s.path === fullPath)) continue;
      try {
        const content = await Bun.file(fullPath).text();
        const fm = parseFrontmatter(content);
        if (fm.name || fm.description) {
          skills.push({
            name: fm.name || file.replace(/\.md$/, ""),
            description: fm.description || "",
            modelInvocable: fm["disable-model-invocation"] !== "true",
            path: fullPath,
            source,
            argumentHint: fm["argument-hint"] || "",
          });
        } else {
          // Markdown without frontmatter — still list it
          skills.push({
            name: file.replace(/\.md$/, ""),
            description: "",
            modelInvocable: true,
            path: fullPath,
            source,
            argumentHint: "",
          });
        }
      } catch {}
    }
  } catch {}
  return skills;
}

// Read global Claude Code config with rich introspection data
async function getGlobalConfig(): Promise<object> {
  try {
    const settingsPath = `${process.env.HOME}/.claude/settings.json`;
    const settings = await Bun.file(settingsPath).json();

    const pluginsPath = `${process.env.HOME}/.claude/plugins/installed_plugins.json`;
    let pluginsData: any = {};
    try { pluginsData = await Bun.file(pluginsPath).json(); } catch {}

    let statsCache: any = {};
    try { statsCache = await Bun.file(`${process.env.HOME}/.claude/stats-cache.json`).json(); } catch {}

    let claudeVersion = "";
    try {
      claudeVersion = (await $`claude --version 2>/dev/null`.text()).trim();
    } catch {}

    // --- Rich Skills ---
    // Global user skills
    const userSkillsDir = `${process.env.HOME}/.claude/skills`;
    const allSkills = await scanSkillsDir(userSkillsDir, "user");

    // --- Rich Plugins ---
    const enabledPlugins = settings.enabledPlugins || {};
    const pluginRegistry = pluginsData.plugins || {};
    const richPlugins: any[] = [];

    for (const [fullName, enabled] of Object.entries(enabledPlugins)) {
      const [name, marketplace] = fullName.split("@");
      const entry: any = {
        name,
        fullName,
        marketplace: marketplace || "local",
        enabled: !!enabled,
        version: "",
        author: "",
        description: "",
        homepage: "",
        skills: [] as string[],
        hooks: {} as Record<string, number>,
      };

      // Look up install record
      const installRecords = pluginRegistry[fullName];
      if (installRecords && Array.isArray(installRecords) && installRecords.length > 0) {
        const rec = installRecords[0];
        entry.installPath = rec.installPath || "";
        entry.version = rec.version || "";
        entry.installedAt = rec.installedAt || "";
        entry.lastUpdated = rec.lastUpdated || "";

        // Read plugin.json for metadata
        if (rec.installPath) {
          try {
            const pjson = await Bun.file(`${rec.installPath}/.claude-plugin/plugin.json`).json();
            entry.description = pjson.description || "";
            entry.author = typeof pjson.author === "object" ? pjson.author.name || "" : pjson.author || "";
            entry.homepage = pjson.homepage || pjson.repository || "";
            if (pjson.version) entry.version = pjson.version;
          } catch {}

          // Scan for plugin skills
          try {
            const skillsDir = `${rec.installPath}/skills`;
            const pluginSkills = await scanSkillsDir(skillsDir, fullName);
            entry.skills = pluginSkills.map((s: any) => s.name);
            // Add plugin skills to global list
            allSkills.push(...pluginSkills);
          } catch {}

          // Read plugin hooks
          try {
            const hooksJson = await Bun.file(`${rec.installPath}/hooks/hooks.json`).json();
            const hooks = hooksJson.hooks || {};
            for (const [event, hookArr] of Object.entries(hooks as Record<string, any[]>)) {
              let count = 0;
              for (const h of hookArr) {
                count += ((h as any).hooks || [h]).length;
              }
              entry.hooks[event] = count;
            }
          } catch {}
        }
      }

      richPlugins.push(entry);
    }

    // --- Rich Hooks ---
    // Collect all hooks with full details, grouped by event
    const richHooks: Record<string, any[]> = {};
    if (settings.hooks) {
      for (const [event, hookArr] of Object.entries(settings.hooks as Record<string, any[]>)) {
        richHooks[event] = [];
        for (const entry of hookArr) {
          const hooks = (entry as any).hooks || [entry];
          for (const h of hooks) {
            richHooks[event].push({
              command: h.command || "",
              timeout: h.timeout || null,
              type: h.type || "command",
              matcher: (entry as any).matcher || "",
              source: "global",
            });
          }
        }
      }
    }
    // Also collect plugin hooks with source attribution
    for (const plugin of richPlugins) {
      if (plugin.installPath) {
        try {
          const hooksJson = await Bun.file(`${plugin.installPath}/hooks/hooks.json`).json();
          const hooks = hooksJson.hooks || {};
          for (const [event, hookArr] of Object.entries(hooks as Record<string, any[]>)) {
            if (!richHooks[event]) richHooks[event] = [];
            for (const entry of hookArr) {
              const hList = (entry as any).hooks || [entry];
              for (const h of hList) {
                richHooks[event].push({
                  command: h.command || "",
                  timeout: h.timeout || null,
                  type: h.type || "command",
                  matcher: (entry as any).matcher || "",
                  source: plugin.fullName,
                });
              }
            }
          }
        } catch {}
      }
    }

    // --- Rich MCP Servers ---
    const mcpServers: any[] = [];
    if (settings.mcpServers) {
      for (const [name, config] of Object.entries(settings.mcpServers as Record<string, any>)) {
        mcpServers.push({
          name,
          command: config.command || "",
          args: config.args || [],
          env: config.env ? Object.keys(config.env) : [],
          type: config.type || "stdio",
        });
      }
    }

    // Legacy format for backward compatibility
    const hookCounts: Record<string, number> = {};
    for (const [event, hooks] of Object.entries(richHooks)) {
      hookCounts[event] = hooks.length;
    }

    return {
      settings: {
        enabledPlugins: settings.enabledPlugins || {},
        hooks: hookCounts,
        env: settings.env || {},
        permissionDefaults: settings.skipDangerousModePermissionPrompt,
        mcpServers: mcpServers.map(s => s.name),
      },
      plugins: richPlugins,
      globalSkills: allSkills.filter(s => s.source === "user").map(s => s.name),
      richSkills: allSkills,
      richHooks,
      richMcpServers: mcpServers,
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

// Resolve transcript path for a session.
// Prefers the stored transcriptPath; falls back to slug-based derivation.
function resolveTranscriptPath(meta: SessionMeta): string | null {
  if (meta.transcriptPath) return meta.transcriptPath;

  // Derive slug from cwd: /Users/foo/bar -> -Users-foo-bar
  if (!meta.cwd) return null;
  const slug = meta.cwd.replace(/\//g, "-");
  return `${process.env.HOME}/.claude/projects/${slug}/${meta.sessionId}.jsonl`;
}

// Parse a transcript JSONL file to extract all file-accessing tool calls.
// Extracts: Read (file_path), Glob (pattern results), Grep (path), Edit (file_path), Write (file_path)
async function parseContextDocs(transcriptPath: string, cwd: string): Promise<ContextDocsResult> {
  const fileMap = new Map<string, { readCount: number; firstRead: string; lastRead: string; tool: string }>();

  function trackFile(filePath: string, tool: string, timestamp: string) {
    // Normalize path: resolve and deduplicate
    const normalized = filePath.trim();
    if (!normalized || normalized === "-" || normalized.length < 2) return;

    const existing = fileMap.get(normalized);
    if (existing) {
      existing.readCount++;
      if (timestamp < existing.firstRead) existing.firstRead = timestamp;
      if (timestamp > existing.lastRead) existing.lastRead = timestamp;
      // Prefer Read over other tools for the display label
      if (tool === "Read" && existing.tool !== "Read") existing.tool = tool;
    } else {
      fileMap.set(normalized, { readCount: 1, firstRead: timestamp, lastRead: timestamp, tool });
    }
  }

  function makeShortPath(fullPath: string): string {
    if (cwd && fullPath.startsWith(cwd + "/")) {
      return fullPath.slice(cwd.length + 1);
    }
    // Fall back: strip home directory
    const home = process.env.HOME || "";
    if (home && fullPath.startsWith(home + "/")) {
      return "~/" + fullPath.slice(home.length + 1);
    }
    return fullPath;
  }

  try {
    const text = await Bun.file(transcriptPath).text();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        const timestamp = record.timestamp || new Date().toISOString();

        // Extract tool_use blocks from assistant messages
        if (record.type === "assistant" && record.message?.content) {
          const content = record.message.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type !== "tool_use") continue;
              const input = block.input || {};

              switch (block.name) {
                case "Read":
                  if (input.file_path) trackFile(input.file_path, "Read", timestamp);
                  break;
                case "Glob":
                  // Glob input has "pattern" but files come in the result; we'll get those from tool_result
                  // Track the base path if provided
                  if (input.path) trackFile(input.path, "Glob", timestamp);
                  break;
                case "Grep":
                  if (input.path) trackFile(input.path, "Grep", timestamp);
                  break;
                case "Edit":
                  if (input.file_path) trackFile(input.file_path, "Edit", timestamp);
                  break;
                case "Write":
                  if (input.file_path) trackFile(input.file_path, "Write", timestamp);
                  break;
              }
            }
          }
        }

        // Extract file paths from tool_result blocks in user messages
        // Glob results are newline-separated file paths in the result text
        if (record.type === "user" && record.message?.content) {
          const content = record.message.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type !== "tool_result") continue;
              // We need to know which tool this result is for.
              // The tool_result has tool_use_id but we'd need to correlate.
              // Instead, parse the result text heuristically:
              // Glob results are file paths (one per line, starting with /)
              const resultText = typeof block.content === "string"
                ? block.content
                : Array.isArray(block.content)
                  ? block.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n")
                  : "";

              if (!resultText) continue;

              // Check if this looks like Glob output (lines of absolute paths)
              const lines = resultText.split("\n");
              const pathLines = lines.filter((l: string) => l.startsWith("/") && !l.includes(" ") && l.length < 500);
              // If most lines are paths, treat as file list
              if (pathLines.length > 0 && pathLines.length >= lines.filter((l: string) => l.trim()).length * 0.5) {
                for (const p of pathLines) {
                  trackFile(p.trim(), "Glob", timestamp);
                }
              }

              // Check Grep results: lines matching "filepath:linenum:content" or just file paths
              // Grep in files_with_matches mode returns plain file paths
              const grepFileLines = lines.filter((l: string) => l.startsWith("/") && l.includes(":") && l.length < 500);
              for (const grepLine of grepFileLines) {
                const filePart = grepLine.split(":")[0];
                if (filePart && filePart.startsWith("/")) {
                  trackFile(filePart.trim(), "Grep", timestamp);
                }
              }
            }
          }
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // File not found or unreadable
  }

  // Build result sorted by most recent read first
  const files: ContextFile[] = Array.from(fileMap.entries()).map(([path, data]) => ({
    path,
    shortPath: makeShortPath(path),
    readCount: data.readCount,
    firstRead: data.firstRead,
    lastRead: data.lastRead,
    tool: data.tool,
  })).sort((a, b) => b.lastRead.localeCompare(a.lastRead));

  const totalReads = files.reduce((sum, f) => sum + f.readCount, 0);

  return { files, totalReads, uniqueFiles: files.length };
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

      // Start git status polling for this session's working directory
      const repoRoot = await resolveRepoRoot(meta.cwd || ".");
      if (repoRoot) {
        // Seed from cache if available
        const cached = gitStatusCache.get(repoRoot);
        if (cached) meta.gitStatus = cached;
        startGitPolling(repoRoot);
      }

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

    // --- Mise tool/environment data ---
    if (url.pathname === "/api/mise" && req.method === "GET") {
      const data = await fetchMiseData();
      return Response.json(data, { headers: corsHeaders });
    }

    // --- System stats (CPU, memory, uptime) ---
    if (url.pathname === "/api/stats/system" && req.method === "GET") {
      const stats = computeSystemStats();
      return Response.json(stats, { headers: corsHeaders });
    }

    // --- Context documents (files read into model context) ---
    if (url.pathname === "/api/context-docs" && req.method === "GET") {
      const sid = url.searchParams.get("session");
      if (!sid) {
        return Response.json({ error: "missing session param" }, { status: 400, headers: corsHeaders });
      }

      const meta = sessions.get(sid);
      if (!meta) {
        return Response.json({ files: [], totalReads: 0, uniqueFiles: 0 }, { headers: corsHeaders });
      }

      const transcriptPath = resolveTranscriptPath(meta);
      if (!transcriptPath) {
        return Response.json({ files: [], totalReads: 0, uniqueFiles: 0 }, { headers: corsHeaders });
      }

      // Check cache
      const cached = contextDocsCache.get(sid);

      if (cached) {
        const age = Date.now() - cached.ts;
        if (age < CONTEXT_DOCS_TTL) {
          // Within TTL: serve cache unless file grew (transcript still being written)
          try {
            const currentSize = Bun.file(transcriptPath).size;
            if (currentSize === cached.fileSize) {
              return Response.json(cached.result, { headers: corsHeaders });
            }
          } catch {
            // File inaccessible; serve stale cache
            return Response.json(cached.result, { headers: corsHeaders });
          }
        }
      }

      // Parse transcript
      const result = await parseContextDocs(transcriptPath, meta.cwd || "");

      // Cache result with file size
      let fileSize = 0;
      try { fileSize = Bun.file(transcriptPath).size; } catch {}
      contextDocsCache.set(sid, { result, ts: Date.now(), fileSize });

      return Response.json(result, { headers: corsHeaders });
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

      // Clean up git polling if no other sessions share this repo root
      if (meta) {
        const root = cwdToRepoRoot.get(meta.cwd);
        if (root) {
          // Remove this session so maybeStopGitPolling sees it as gone
          sessions.delete(sid);
          maybeStopGitPolling(root);
          // Put it back (ended sessions may still be viewed)
          sessions.set(sid, meta);
        }
      }

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

// Take an initial CPU snapshot so the first heartbeat has a valid delta
prevCpuSnapshot = os.cpus();

setInterval(async () => {
  if (wsClients.size === 0) return; // No browsers connected, skip work

  // Broadcast system resource stats on every heartbeat
  const systemStats = computeSystemStats();
  broadcast({ type: "system_stats", data: systemStats });

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
