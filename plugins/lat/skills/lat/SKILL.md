---
name: lat
description: Toggle LLMAnnotationTerminal — browser viewer for Claude Code output with structured annotations. Use /lat or /lat on to enable, /lat off to disable.
---

# LLMAnnotationTerminal

Toggle the LAT browser sidecar for viewing and annotating Claude Code responses.

## Usage

- `/lat` or `/lat on` — Enable LAT. Starts daemon if needed, opens browser.
- `/lat off` — Disable LAT. Daemon stays running but annotations stop injecting.
- `/lat status` — Show current state.

When active, responses are rendered in a browser with:
- Native markdown rendering (code highlighting, mermaid diagrams)
- Auto-detected questions and decision points (via Haiku)
- Annotation affordances (answer, choose, highlight, comment, approve, reject)
- Annotations inject as structured XML context on your next prompt
