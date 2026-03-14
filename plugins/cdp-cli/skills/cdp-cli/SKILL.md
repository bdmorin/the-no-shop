---
name: cdp-cli
description: "Ride a running Chromium browser via Chrome DevTools Protocol. Access authenticated sessions (Gmail, Slack, etc.) without re-logging in. Works with Brave, Chrome, Edge, Arc — any Chromium browser. CLI interface, no MCP needed."
user-invokable: true
argument-hint: "tabs, content Gmail, screenshot Slack, eval github document.title, ensure"
allowed-tools: "Bash(bun *), Bash(cdp-cli *)"
license: MIT
metadata:
  version: "1.0.0"
  author: "Brian Morin"
  homepage: "https://github.com/bdmorin/the-no-shop"
  category: browser-automation
  requires:
    packages:
      - puppeteer-core
---

# cdp-cli — Session Rider for Chromium Browsers

Connect to a running Chromium browser (Brave, Chrome, Edge, Arc) via Chrome DevTools Protocol. Access all authenticated sessions — Gmail, Slack, Hostinger, whatever the user is logged into — without credentials or re-authentication.

No MCP. No Playwright. No extension. Pure CDP over WebSocket.

## Setup

The browser must be running with `--remote-debugging-port=9222`. Use `cdp-cli ensure` to auto-detect and relaunch on macOS:

```bash
cdp-cli ensure
```

Or launch manually:

```bash
open -a "Brave Browser Beta" --args --remote-debugging-port=9222
```

One-time dependency install:

```bash
bun add puppeteer-core
```

## Commands

```bash
cdp-cli tabs                       # List all open tabs (title + URL)
cdp-cli content <match>            # Extract text from matching tab
cdp-cli links <match>              # Extract all links from matching tab
cdp-cli screenshot <match> [path]  # Screenshot matching tab
cdp-cli eval <match> <js>          # Run JavaScript in matching tab
cdp-cli navigate <match> <url>     # Navigate matching tab to a URL
cdp-cli ensure                     # Ensure browser has CDP enabled (macOS)
```

The `<match>` argument finds a tab by case-insensitive substring on title or URL. Use `"first"` for the first tab, or a number for tab index.

## When to Use This vs Playwright Skill

| Need | Use |
|------|-----|
| Access a site the user is logged into | **cdp-cli** — rides existing session |
| Scrape a public URL | Playwright skill — headless, no session needed |
| Screenshot a deploy for verification | Either works — cdp-cli if already open |
| Fill forms on unknown sites | Playwright skill with Stagehand |
| Read content from user's open tabs | **cdp-cli** — already loaded, sub-second |

## Examples

```bash
# What tabs are open?
cdp-cli tabs

# Get the inbox count from Gmail
cdp-cli eval "gmail" "document.title"

# Extract article text from a tab
cdp-cli content "medium.com"

# Screenshot the Hostinger dashboard
cdp-cli screenshot "hostinger" ./tmp/hostinger.png

# Get all links from a GitHub PR
cdp-cli links "github.com/pull"
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `CDP_PORT` | `9222` | Chrome debugging port |

## How It Works

1. `cdp-cli ensure` checks if CDP is available on `localhost:9222`
2. If not, it finds a running Chromium browser (Brave > Chrome > Edge), quits it gracefully via osascript, and relaunches with `--remote-debugging-port=9222`
3. Commands connect via Puppeteer's `connect({ browserURL })`, find the matching tab, execute the operation, and disconnect
4. The browser keeps running — `cdp-cli` never closes or kills it

## Key Gotchas

- Browser MUST be launched with `--remote-debugging-port`. Without it, no CDP endpoint exists.
- `cdp-cli ensure` restarts the browser — user may lose unsaved form data in tabs. It warns on stderr.
- Only one CDP client can control a tab at a time. Don't run two cdp-cli commands targeting the same tab simultaneously.
- `cdp-cli` uses Puppeteer (not Playwright) because Playwright's `connectOverCDP` has a known hang bug with Chrome 146+.
- The `eval` command runs in the page context — same-origin policy applies. You can't eval cross-origin iframes.
