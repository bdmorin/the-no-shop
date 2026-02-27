---
name: foldspace-console
description: Rich browser viewer for Claude Code output with annotation feedback loop. Renders responses as beautiful markdown, allows text selection and annotation that feeds back as context on your next prompt.
disable-model-invocation: true
---

# Foldspace Console

A browser-based viewer for Claude Code sessions with a bidirectional feedback loop.

## What it does

- **Stop hook** captures every assistant response and sends it to a local daemon
- **Daemon** (Bun HTTP + WebSocket) stores responses per-session and pushes them to the browser in real-time
- **Browser SPA** renders markdown with syntax highlighting, code copy buttons, and session metadata
- **Annotations**: select any text in a response, add a comment — the annotation is stored per-session
- **UserPromptSubmit hook** fetches pending annotations for the current session and injects them as context before your next prompt reaches the model

## Architecture

```
Claude Code ──Stop hook──▶ Daemon ──WebSocket──▶ Browser SPA
                              ▲                        │
                              │                   annotate text
                              │                        │
Claude Code ◀─Prompt hook─── Daemon ◀──POST──────────┘
```

## Configuration

- `FOLDSPACE_PORT` — daemon port (default: `3377`)
- The daemon auto-starts on SessionStart if not already running

## Usage

1. Install the plugin from The No-Shop marketplace
2. Start a Claude Code session — the daemon launches automatically
3. Open `http://localhost:3377` in your browser
4. Your responses stream in. Select text to annotate. Annotations inject on your next prompt.
