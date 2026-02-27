# Foldspace Console — Lessons Learned

**Date**: 2026-02-27
**Project**: The No-Shop / foldspace-console
**Repo**: `bdmorin/the-no-shop` (public)
**Purpose**: Reference document for future sessions. Covers the full arc of the Foldspace Console project from initial spike through parallel feature development.

---

## 1. Session Timeline

### Phase 1: Spike — Plannotator Concept
The project started as an exploration: can a Claude Code hook capture agent output and push it to a browser for human review? The original prototype lived at `/Users/bdmorin/cowork/sidecar/` (3 commits). The core question was whether the hook system provided enough data to build a real-time feedback loop without hacking Claude Code internals.

### Phase 2: Hook Discovery
Two critical discoveries shaped the architecture:
- **Stop hook** receives `last_assistant_message` directly in its stdin JSON. Early attempts tried to parse the transcript JSONL file to extract the last response -- this was unnecessary. The hook hands you the content.
- **UserPromptSubmit hook** injects context via plain stdout. Early versions wrapped output in `hookSpecificOutput` JSON -- wrong. Just print text to stdout and exit 0.
- **`stop_hook_active`** field in Stop hook input prevents the daemon's response capture from triggering another Stop hook, avoiding infinite loops.

### Phase 3: Sidecar Prototype
Built the Bun daemon + single-file SPA pattern. Tested the round-trip: Claude speaks, Stop hook posts to daemon, WebSocket pushes to browser, user annotates, UserPromptSubmit hook fetches annotation, Claude sees it as injected context. Worked on the first try once the hook output format was understood.

### Phase 4: Multi-Session Support
Refactored all state to per-session Maps (`responsesBySession`, `annotationsBySession`). Added session registration via SessionStart hook. Tab bar in the SPA shows all active sessions, switchable by click. Sessions are labeled by git repo name or working directory.

### Phase 5: Typography and System Panel
Added the System sidebar tab showing global Claude Code config -- installed plugins, hooks, MCP servers, skills, token usage stats from `~/.claude/stats-cache.json`, and Claude Code version.

### Phase 6: The No-Shop Marketplace
Published as a Claude Code plugin marketplace. Repo: `bdmorin/the-no-shop`. Marketplace manifest at `.claude-plugin/marketplace.json`. Owner: Brian Morin (personal, not ProvisionIAM). One plugin: `foldspace-console`.

### Phase 7: Ixian Retheme
Complete visual overhaul. Brian's design directive: "Subterranean Precision." The debate was brutalist (Harkonnen) vs. concealed complexity (Ixian). Ixian won. The aesthetic became deep blue-black backgrounds, amber as a brand accent used sparingly, teal as the signal/interaction color, Instrument Sans body text, IBM Plex Mono for code and data, and SVG noise overlay at 0.012 opacity for depth.

Brian's defining quote: "Brutalist gets you Harkonnen. Ixian is the thing that looks deceptively simple until you realize it just replaced a Guild Navigator."

### Phase 8: Contrast/Readability Fix
Post-retheme, text was too dark and too small. Root cause: optimizing for aesthetic over readability. Fixed by bumping `--text` from `#6a7a8d` to `#94a0b4`, `--text-muted` from `#4a5a6d` to `#647080`, and base font from 14px to 15px. Lesson: dark themes need higher contrast than you think, especially for humans over 35.

Commit: `3554ce4` -- "fix: increase contrast and font sizes for readability"

### Phase 9: Parallel Feature Development
Dispatched a 6-agent team using Claude Code worktrees. Each agent got its own worktree under `.claude/worktrees/agent-*`, its own branch forked from `main` at `3554ce4`, and a single feature assignment. All 6 features completed. One (shadcn) was tabled by design.

---

## 2. Claude Code Hook System — What We Learned

The hook system is the engine that makes Foldspace Console possible. Four hooks drive the entire feedback loop.

### Stop Hook
- **Input**: JSON on stdin containing `last_assistant_message`, `session_id`, `stop_hook_active`, and other fields.
- **Key insight**: The assistant's full response text is provided directly. You do NOT need to parse the transcript JSONL to get it. The early prototype wasted effort doing exactly this.
- **Loop prevention**: When `stop_hook_active` is `true`, the hook was triggered by a Stop hook itself. Exit immediately to prevent infinite recursion. This is provided by Claude Code automatically.
- **Pattern**: Read stdin, check `stop_hook_active`, extract content, POST to daemon, exit 0.

### UserPromptSubmit Hook
- **Input**: JSON on stdin with `session_id` and the user's prompt.
- **Output**: Plain text on stdout. That text is injected as additional context alongside the user's prompt.
- **Key insight**: There is NO JSON wrapper needed. Do not use `hookSpecificOutput`. Just `echo` your text and `exit 0`. Claude Code reads stdout and prepends it to the context.
- **Pattern**: Fetch pending annotations from daemon, format as readable text, print to stdout, clear consumed annotations from daemon, exit 0.

### SessionStart Hook
- **Input**: JSON on stdin with `session_id`, `cwd`, `model`, `permission_mode`, `source`, `transcript_path`.
- **Bootstrap pattern**: The hook checks if the daemon is running (`curl /api/health`). If not, it spawns the daemon with `nohup bun run ... &` and polls for readiness (up to 10 attempts at 300ms intervals). This means the daemon auto-starts on first session with zero manual setup.
- **Resume awareness**: The `source` field can be `"resume"` for resumed sessions. When resuming, the daemon scans the existing transcript JSONL to restore accumulated token counts and turn counts.

### SessionEnd Hook
- **Input**: JSON on stdin with `session_id`, `reason`, `transcript_path`.
- **Final scan**: On session end, the daemon does a final transcript scan to capture accurate token totals for the entire session.
- **Cleanup**: Git status polling stops for repo roots that no longer have active sessions.

### General Hook Rules
- **Exit code 0** is required. Non-zero kills the hook silently.
- **Stdout text** from UserPromptSubmit becomes injected context. Stdout from other hooks is ignored.
- **Timeout**: Each hook has a configured timeout in `hooks.json` (3-8 seconds). Keep hooks fast. The SessionStart hook has the longest timeout (8s) because it may need to spawn and wait for the daemon.
- **`${CLAUDE_PLUGIN_ROOT}`**: Use this env var for path resolution in hook commands. It resolves to the plugin's root directory when installed via marketplace.
- **Graceful degradation**: Every hook checks daemon health first and exits 0 silently if the daemon is unavailable. The hooks never block Claude Code operation.

---

## 3. Architecture Decisions

### Single HTML File
The entire SPA is one file: `plugins/foldspace-console/web/index.html` (~920 lines). CSS, JS, and markup all inline. CDN imports for marked.js and highlight.js. The daemon serves it with a single `Bun.file()` call.

Why this matters:
- **Zero build step**. Edit HTML, refresh browser. No Vite, no Webpack, no node_modules, no `bun install`.
- **Trivial deployment**. The plugin is "clone and run." The SessionStart hook auto-starts the daemon. The daemon serves the file. Done.
- **Frictionless marketplace install**. Users install the plugin and it works immediately. No build artifacts, no dist directory, no post-install scripts.
- This was explicitly identified as a competitive advantage for a Claude Code plugin. See the shadcn evaluation (Section 5) for the full analysis of why a build step was rejected.

### Bun Daemon
The daemon is a Bun HTTP + WebSocket server (`daemon/index.ts`, ~660 lines). Bun was chosen because:
- Native TypeScript execution. No compilation step.
- Built-in HTTP server, WebSocket server, file serving, and shell command execution (`Bun.$`).
- `Bun.spawn` for subprocess management (git status polling with kill timeouts).
- `Bun.Glob` for filesystem scanning (skills directory enumeration).
- Fast startup -- the daemon needs to be ready within ~3 seconds of the SessionStart hook spawning it.

### WebSocket for Real-Time Push
The daemon pushes all state changes to connected browsers via WebSocket broadcast:
- `session_started` / `session_ended`
- `new_response`
- `annotation_added`
- `session_git_status`
- `init` (full state dump on WebSocket connect)

The SPA reconnects automatically on disconnect (2-second retry). No polling. The status bar shows connection state.

### Per-Session Isolation
All mutable state is keyed by `sessionId`:
- `sessions: Map<string, SessionMeta>` -- session metadata (cwd, model, git info, token counts)
- `responsesBySession: Map<string, Response[]>` -- captured assistant responses
- `annotationsBySession: Map<string, Annotation[]>` -- user annotations

This allows multiple Claude Code sessions to run simultaneously, each visible as a separate tab in the SPA, each with its own annotation queue.

### Transcript JSONL as Data Source
Claude Code writes session transcripts as JSONL at `~/.claude/projects/<slug>/<session_uuid>.jsonl`. Each line is a JSON record with `type` (user/assistant), token usage, model, git branch, and tool calls. The daemon scans this on session start (for resume) and session end (for final totals). It does NOT watch the file continuously -- the Stop hook provides real-time response content directly.

### Stats Cache
`~/.claude/stats-cache.json` contains all-time aggregates (total sessions, total messages, first session date, per-model token usage). The daemon reads this on `/api/config` requests and surfaces it in the System panel. This file is maintained by Claude Code itself, not by the daemon.

---

## 4. Design Philosophy

### "Subterranean Precision" — The Ixian Aesthetic

The design language draws from Frank Herbert's Ix: technology that conceals its complexity. The surface is minimal and clean. The depth is in the engineering underneath. This is not brutalism.

Herbert's Ix produces machines that look like nothing -- until you realize they do everything. Villeneuve's Dune adaptation interprets this as brutalist concrete, but the literary source is closer to Swiss precision hidden underground. "Apple meets Swiss watch factory underground."

The danger of a dark monitoring dashboard is defaulting to "brutalist sci-fi" -- harsh lines, aggressive typography, exposed structure. That gives you Harkonnen, not Ixian. The distinction matters because Harkonnen design announces itself. Ixian design disappears until you need it.

### Color Architecture

**Amber (`#b88a3e`)**: Brand accent. Used like a single indicator light on a piece of precision equipment -- one warm dot in a field of cool metal. Appears on the brand hover state and as a signal for "behind" in git sync status. Never used for large surfaces.

**Teal (`#3a9e8f`)**: Signal and interaction color. Active tab borders, status dots, annotation markers, branch names, selection highlight, action buttons, model pills. This is the "something is happening / click here / look here" color. The split between amber-as-brand and teal-as-signal prevents the UI from becoming monotone.

**Why the split matters**: If you use one accent color for both branding and interaction states, you lose the ability to distinguish "this is our identity" from "this requires your attention." The amber/teal separation gives the design two distinct registers without introducing a third color.

### Typography

**Instrument Sans** (body): Clean geometric sans-serif with optical sizing. Weight range 400-700. Not Inter -- Instrument Sans has sharper terminals and tighter spacing at small sizes.

**IBM Plex Mono** (code/data): Mono font with clear character differentiation at small sizes. Weight range 400-600. Used for all code blocks, metadata values, pills, badges, timestamps, and the brand wordmark.

### Readability Lesson

The initial retheme was too dark and too small. `--text` at `#6a7a8d` on `--bg` at `#060810` looked gorgeous in screenshots but was painful to read for extended periods. The fix (`#94a0b4`) increased contrast significantly while preserving the cool metallic tone.

Key numbers after the fix:
- Base font: 15px (was 14px)
- `--text`: `#94a0b4` -- primary content (contrast ratio ~7:1 against `--bg`)
- `--text-bright`: `#cdd3de` -- headings and emphasis
- `--text-muted`: `#647080` -- secondary content, labels
- `--text-dim`: `#3a4558` -- tertiary, decorative

Rule of thumb for dark UIs: if it looks right at midnight on a calibrated display, it is too dark for a normal human in a normal room.

### Visual Details
- Borders: `rgba(255,255,255,0.06)` -- barely perceptible, machined edges
- SVG noise overlay at 0.012 opacity with `mix-blend-mode: overlay` -- adds depth, like looking through facility glass
- All transitions 150ms with `cubic-bezier(0.25, 0.1, 0.25, 1)` -- mechanical feel, no bounce
- Border radius: 4px standard, 6px for elevated containers
- Scrollbar: 4px width, near-invisible track, subtle thumb

---

## 5. Feature Branch Inventory

All branches fork from `main` at `3554ce4`. All use worktree isolation under `.claude/worktrees/agent-*`.

| Branch | Commit | Worktree | Status | Files Modified | Summary |
|--------|--------|----------|--------|----------------|---------|
| `feat/git-status` | `ec3baa7` | root repo | Ready | daemon + SPA | 10s git poll, 5s timeout, porcelain v2 parsing, cache-compare, compact branch/sync/files UI. Daemon code partially applied to main already. |
| `feat/animated-numbers` | `729b8a8` | `agent-a2048a4e` | Ready | daemon + SPA | ease-out cubic tweening for all numeric displays, 8s daemon heartbeat broadcasting session stats, `tabular-nums` CSS for stable digit widths |
| `feat/tab-management` | `a5e9ceb` | `agent-a1a984eb` | Ready | SPA only | Sort tabs by last activity, 6-hour expiry with visual dimming, +N overflow indicator, 3 visual states (active/idle/ended), major `renderTabs()` rewrite |
| `feat/rich-components` | `5cdbd47` | `agent-a28018c7` | Ready | SPA only | 5 sidecar components: mermaid diagrams, enhanced tables, unified diffs, collapsible JSON, progress bars. Extends `renderer.code` in marked.js |
| `feat/mise-component` | `87a158f` | `agent-aae55e1b` | Ready | daemon + SPA | `/api/mise` endpoint using `mise ls --json`, tool/env/config display in System panel, secret value masking, TOML config modal viewer |
| `spike/shadcn-evaluation` | `c69f1a5` | `agent-a261b411` | TABLED | docs only | `ARCHITECTURE.md` evaluating shadcn/ui vs Lit vs vanilla. Verdict: don't migrate. Recommends Lit for future component extraction. No code to integrate. |

### shadcn Decision Detail
The shadcn evaluation (`ARCHITECTURE.md` at `plugins/foldspace-console/web/ARCHITECTURE.md` in the spike worktree) concluded:
- shadcn is technically feasible (Ixian palette maps cleanly to shadcn CSS variables)
- But it adds a build step, `node_modules`, and React's 45KB runtime
- This breaks the zero-build, single-file deployment that makes the plugin frictionless
- **Recommendation**: Use Lit web components when component extraction becomes necessary, migrate to React+shadcn only if Lit's limitations become blocking
- **Brian's annotation**: "Table shadcn, keep the research"

---

## 6. Integration Strategy

All 5 ready branches modify `web/index.html`. Three also modify `daemon/index.ts`. They WILL conflict on merge. The recommended integration order minimizes conflict complexity:

### Merge Order

**1. `feat/git-status` (first)**
- Daemon changes have already been partially applied to main (linter/user edits)
- Integrating this first reconciles the daemon drift
- SPA changes add the git status UI row in the session header
- Smallest SPA diff of the 5 features

**2. `feat/animated-numbers` (second)**
- Adds daemon heartbeat endpoint (8s interval broadcasting session stats)
- SPA adds `animateValue()` function and `tabular-nums` CSS
- Modifies session header metric display and system panel numbers
- Should be applied after git-status because it animates the same metric areas

**3. `feat/tab-management` (third)**
- SPA-only change, but a major rewrite of `renderTabs()`
- Adds sorting, expiry, overflow, and visual states
- No daemon changes, so this is a clean SPA-only merge
- Goes after animated-numbers because tab badges use the animated number system

**4. `feat/rich-components` (fourth)**
- SPA-only change extending `renderer.code` in the marked.js configuration
- Adds 5 component types with shared CSS
- Isolated from other features -- it extends the renderer, doesn't modify existing rendering
- Can go late in the order because it doesn't interact with the other features' DOM areas

**5. `feat/mise-component` (last)**
- Daemon: adds `/api/mise` endpoint
- SPA: adds mise section to System panel, plus a TOML config modal
- Goes last because it extends the System panel which is touched by animated-numbers (for stat animation) and could conflict with system panel rendering
- Has the most self-contained scope of the daemon changes

### Integration Notes
- After each merge, test the daemon startup (SessionStart hook), response capture (Stop hook), annotation round-trip (UserPromptSubmit hook), and WebSocket reconnection
- The `spike/shadcn-evaluation` branch has no code to merge -- keep `ARCHITECTURE.md` as a reference document
- All branches assume `main` at `3554ce4` -- if main has drifted (e.g., the git-status daemon code that was applied directly), the first merge may need manual reconciliation

---

## 7. Unfinished Backlog

Features identified but not yet assigned or implemented:

| Feature | Description | Touches |
|---------|-------------|---------|
| Process CPU/memory stats | Core developer metric -- show agent process resource consumption in System panel | daemon + SPA |
| Context document enumeration | List all files/documents currently loaded in the model's context window | daemon + SPA |
| Clickable system details (task #6) | Skills, plugins, and hooks should be clickable for introspection (view content, toggle, etc.) | SPA |
| Layout modes / theme switcher (task #7) | Multiple layout arrangements, light/dark theme toggle, status bar enhancement | SPA |
| Rich output mode (task #1) | Append-only output style for sidecar -- responses stream in without replacing | SPA |
| Lit web components migration | Extract SPA into Lit custom elements (`<foldspace-tabs>`, `<foldspace-response>`, etc.) when the file exceeds ~1500 lines | SPA |

---

## 8. Errors and Fixes

### Stop Hook: Transcript Parsing (wrong approach)
**Error**: Early version tried to read and parse the transcript JSONL to extract the last assistant message.
**Fix**: The Stop hook provides `last_assistant_message` directly in its stdin JSON. No file parsing needed.
**Lesson**: Read the hook input schema before building workarounds.

### UserPromptSubmit: hookSpecificOutput JSON (wrong format)
**Error**: Early version wrapped output in `{"hookSpecificOutput": {...}}` JSON.
**Fix**: Just print plain text to stdout and exit 0. Claude Code reads stdout directly.
**Lesson**: The hook output mechanism is simpler than expected. Plain text wins.

### jq Parse Errors with Shell String Literals
**Error**: Shell strings containing literal `\n` characters caused jq to choke when constructing JSON payloads.
**Fix**: Use `jq -n` with `--arg` flags to safely construct JSON, letting jq handle escaping.
**Lesson**: Never hand-build JSON in bash. Always use `jq -n` with `--arg`.

### Port 3377 Conflicts
**Error**: Leftover daemon processes from crashed sessions held port 3377 open. New sessions failed to start the daemon.
**Fix**: The SessionStart hook checks `/api/health` first. If it responds, the daemon is already running and the hook reuses it. If the port is held by a zombie, `kill $(lsof -ti:3377)` manually.
**Lesson**: The health check pattern is sufficient for the common case. A PID file approach was considered but adds complexity without enough benefit.

### Fish Shell `&` Chaining
**Error**: Fish shell uses `&` differently than bash for background processes and command chaining.
**Fix**: All hook scripts are explicitly invoked with `bash` in `hooks.json` (`"command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/..."`) so the user's login shell is irrelevant.
**Lesson**: Never assume the user's shell. Hook commands should specify the interpreter.

### `./tmp` Directory for nohup Redirect
**Error**: `nohup` redirect to `./tmp/daemon.log` failed because the `./tmp` directory did not exist.
**Fix**: Redirect to `/dev/null` instead. The daemon logs to stdout, which is only visible if run manually.
**Lesson**: Brian's rule: always use `./tmp` relative to project dir, never `/tmp`. But for daemon background output that nobody reads, `/dev/null` is correct.

### No Submit Button UX Confusion
**Error**: Users did not realize that annotations auto-inject on the next prompt. There is no explicit "send annotations to Claude" button.
**Fix**: The sidebar hint text was updated: "Annotations inject as context on your next prompt." Still not fully solved -- a visual indicator that annotations are queued would help.
**Lesson**: Invisible feedback loops need visible status indicators.

---

## 9. Key Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Marketplace owner: Brian Morin (personal) | NOT ProvisionIAM. This is a personal project. Do not use company email or branding. | 2026-02-27 |
| shadcn: TABLED | Build step kills plugin deployment simplicity. Keep `ARCHITECTURE.md` research. Recommend Lit for future component extraction. | 2026-02-27 |
| Design: Ixian, not Harkonnen | Concealed complexity, not brutalism. Herbert's literary Ix, not Villeneuve's cinematic concrete. | 2026-02-27 |
| Daemon auto-start: SessionStart hook | Hook checks `/api/health`, spawns daemon if absent, polls for readiness. Zero manual setup. | 2026-02-27 |
| Single HTML file: no build step | Competitive advantage for Claude Code plugin. "Clone and run." Daemon serves one file. | 2026-02-27 |
| Annotations as context injection | UserPromptSubmit stdout = injected context. Annotations are consumed (cleared) after injection. | 2026-02-27 |
| Per-session state isolation | All Maps keyed by sessionId. Multiple concurrent Claude Code sessions supported. | 2026-02-27 |
| Git status: porcelain v2 polling | 10s poll interval, 5s timeout per git command, cache-compare to avoid redundant broadcasts. | 2026-02-27 |
| Transcript scan on resume | When `source === "resume"`, daemon scans existing JSONL to restore token/turn counts. | 2026-02-27 |
| Bun as runtime | Native TS execution, built-in HTTP/WS, fast startup for hook-spawned daemon. No compilation. | 2026-02-27 |

---

## Appendix: File Map

```
the-no-shop/
  .claude-plugin/
    marketplace.json          # Marketplace manifest (name, owner, plugins list)
  plugins/
    foldspace-console/
      daemon/
        index.ts              # Bun HTTP + WebSocket server (~660 lines)
      web/
        index.html            # Self-contained SPA (~920 lines)
      hooks/
        hooks.json            # Hook configuration (4 hooks)
      scripts/
        session-start.sh      # SessionStart: register session, auto-start daemon
        session-end.sh        # SessionEnd: final transcript scan
        stop.sh               # Stop: capture last_assistant_message
        prompt.sh             # UserPromptSubmit: inject annotations as context
      skills/
        foldspace/
          SKILL.md            # Plugin skill definition
  CLAUDE.md                   # Project-level instructions for agents
  ai/
    research/
      2026-02-27-foldspace-lessons-learned.md  # This document
```

### Worktree Layout (feature development)
```
.claude/worktrees/
  agent-a1a984eb/   # feat/tab-management    (a5e9ceb)
  agent-a2048a4e/   # feat/animated-numbers  (729b8a8)
  agent-a261b411/   # spike/shadcn-evaluation (c69f1a5) -- ARCHITECTURE.md here
  agent-a28018c7/   # feat/rich-components   (5cdbd47)
  agent-aae55e1b/   # feat/mise-component    (87a158f)
```

---

## Appendix: Hook Data Flow

```
Claude Code Session
  |
  |-- [SessionStart] --> session-start.sh
  |     |-- Check daemon health
  |     |-- If down: nohup bun daemon/index.ts &
  |     |-- POST /api/session {sessionId, cwd, model, ...}
  |
  |-- [Stop] --> stop.sh (after each assistant turn)
  |     |-- Check stop_hook_active (exit if true)
  |     |-- Extract last_assistant_message from stdin JSON
  |     |-- POST /api/response {content, sessionId}
  |     |-- Daemon broadcasts via WebSocket to all browsers
  |
  |-- [UserPromptSubmit] --> prompt.sh (before each user turn)
  |     |-- GET /api/annotations?session={sessionId}
  |     |-- If annotations exist: format as text, print to stdout
  |     |-- DELETE /api/annotations?session={sessionId}
  |     |-- Claude sees annotation text as injected context
  |
  |-- [SessionEnd] --> session-end.sh
        |-- POST /api/session/end {sessionId, transcriptPath}
        |-- Daemon scans transcript for final token totals
        |-- Daemon broadcasts session_ended
        |-- Git polling cleanup for orphaned repo roots
```
