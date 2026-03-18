# LAT — LLMAnnotationTerminal

## What It Is

LAT is a browser sidecar for Claude Code that captures responses, structures them via Haiku LLM into typed annotation blocks, renders them with annotation affordances, and injects structured XML annotations back into Claude's context. It bridges the gap between freeform Claude output and actionable, machine-readable feedback.

## Prerequisites

- **Bun** — JavaScript runtime for running the daemon and web build
- **ANTHROPIC_API_KEY** — Required for Haiku LLM calls that structure annotations

## Installation

```bash
cd /path/to/plugins/lat
bun install
```

The `postinstall` script automatically builds the web UI.

## Usage

LAT is controlled via three commands:

- `/lat` or `/lat on` — Enable LAT. Starts the daemon if needed, opens the browser at `http://127.0.0.1:4747`
- `/lat off` — Disable LAT. Daemon stays running; annotations will not inject on the next prompt
- `/lat status` — Show whether LAT is active and if the daemon is running

When LAT is active, Claude's responses appear in the browser with markdown rendering, code highlighting, and annotation affordances. Create annotations, and they inject as structured XML context on your next prompt.

## Annotation Types

LAT supports six annotation types:

- **answer** — Provide a direct answer to a question in the response
- **choice** — Select among options or decision points
- **highlight** — Mark important sections for emphasis
- **comment** — Add commentary or notes
- **approve** — Signal acceptance or validation
- **reject** — Flag issues or objections

## Statusline Integration

Add LAT status to your shell prompt (fish/tmux/starship):

```bash
bash /path/to/plugins/lat/scripts/statusline.sh
```

Outputs "LAT" if active and the daemon is healthy; otherwise empty.

## Architecture

```
Claude Code
     ↓
   hooks (SessionStart, UserPromptSubmit, SessionEnd, Stop)
     ↓
  daemon (Node.js via Bun, port 4747)
     ↓
  Haiku LLM (structure responses into blocks)
     ↓
  browser (web UI at localhost:4747)
     ↓
  annotations (user creates via UI)
     ↓
  structured XML (injects back to Claude context)
```

## Troubleshooting

**Port conflict**: LAT uses port 4747 by default. Override with:
```bash
export LAT_PORT=5000
```

**API key missing**: Ensure `ANTHROPIC_API_KEY` is set in your environment:
```bash
echo $ANTHROPIC_API_KEY
```

**Daemon not starting**: Check logs and manually start:
```bash
bun run /path/to/plugins/lat/daemon/index.ts
```

**Stale daemon process**: Kill any orphaned process and restart:
```bash
lsof -i :4747
kill -9 <PID>
```

Then run `/lat` again to restart the daemon.
