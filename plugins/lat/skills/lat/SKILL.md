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

## When Invoked

### /lat or /lat on

Execute these commands:

```bash
mkdir -p ~/.lat
echo "on" > ~/.lat/active
```

Then check if the daemon is running:

```bash
curl -sf http://127.0.0.1:4747/health > /dev/null 2>&1
```

If the daemon is NOT running, start it (find the plugin root — it's the directory containing this SKILL.md's parent `skills/` dir):

```bash
nohup bun run <PLUGIN_ROOT>/daemon/index.ts > /dev/null 2>&1 &
sleep 1
```

Then open the browser:

```bash
open http://127.0.0.1:4747
```

Confirm to the user: "LAT enabled. Browser opened at http://127.0.0.1:4747"

### /lat off

```bash
mkdir -p ~/.lat
echo "off" > ~/.lat/active
```

Confirm: "LAT disabled. Annotations will not inject on next prompt. Daemon stays running."

### /lat status

Check state:

```bash
STATE=$(cat ~/.lat/active 2>/dev/null || echo "off")
HEALTH=$(curl -sf http://127.0.0.1:4747/health 2>/dev/null && echo "running" || echo "not running")
```

Report: "LAT is $STATE. Daemon is $HEALTH."
