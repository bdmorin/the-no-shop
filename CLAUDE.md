# The No-Shop — Foldspace Console

## Project Overview
Claude Code plugin marketplace. One plugin: **foldspace-console** — browser viewer + annotation feedback loop for Claude Code sessions.

## Architecture
- **Daemon**: `plugins/foldspace-console/daemon/index.ts` — Bun HTTP + WebSocket server, port 3377
- **SPA**: `plugins/foldspace-console/web/index.html` — SINGLE self-contained HTML file (vanilla JS, marked.js, highlight.js from CDN)
- **Hooks**: 4 shell scripts in `plugins/foldspace-console/scripts/` (SessionStart, Stop, UserPromptSubmit, SessionEnd)
- **Zero build step** — daemon serves raw HTML via `Bun.file()`. This is a critical architectural advantage. Do not introduce build tooling without explicit approval.

## Design Aesthetic: "Subterranean Precision"
- **NOT brutalist.** Concealed complexity. "Apple meets Swiss watch factory underground."
- Fonts: **Instrument Sans** (body) + **IBM Plex Mono** (code/data). Never Inter.
- Amber: brand accent ONLY, used sparingly. Teal: signal/interaction color.
- Borders: `rgba(255,255,255,0.06)` — barely there, machined edges.
- SVG noise overlay at 0.012 opacity for depth.
- All transitions 150ms ease, mechanical feel, no bounce.
- Brian's words: "Brutalist gets you Harkonnen. Ixian is the thing that looks deceptively simple until you realize it just replaced a Guild Navigator."

## Hook Mechanics (critical knowledge)
- `Stop` hook: receives `last_assistant_message` and `session_id` directly in stdin JSON. No transcript parsing needed.
- `UserPromptSubmit` hook: plain text stdout + exit 0 = injected context. No JSON wrapper needed.
- `stop_hook_active` field in Stop hook input prevents infinite loops.
- `SessionStart` hook auto-starts daemon if not running (bootstrap pattern).

## Key Paths
- Transcript JSONL: `~/.claude/projects/<slug>/<session_uuid>.jsonl`
- Stats cache: `~/.claude/stats-cache.json`
- Plugin hooks use `${CLAUDE_PLUGIN_ROOT}` for path resolution when installed via marketplace.

## Branch Strategy
Feature branches use worktree isolation. All fork from main. Integration requires manual merge since all features touch `web/index.html`.

## Ownership
Personal project of Brian Morin. NOT associated with ProvisionIAM. Do not use company email or branding.

## Lessons Learned
See `ai/research/2026-02-27-foldspace-lessons-learned.md` for detailed session context.
