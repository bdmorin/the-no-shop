# Playwright Skill — Design Document

**Date:** 2026-03-04
**Author:** Brian Morin + Claude
**Status:** Approved
**Location:** `plugins/playwright/` in the-no-shop marketplace

## Problem

Browser automation for agents is currently painful:
- Chrome MCP: slow, token-heavy, requires a running Chrome instance
- WebFetch: can't handle JS-rendered pages
- cmux-browser: WKWebView limits (no CDP, no viewport emulation)

Need a permanent, universal browser primitive that works across all projects.

## Solution

A Claude Code plugin that teaches agents to generate and execute Stagehand + Playwright scripts. No MCP. No daemon. Pure script generation → execution → artifact capture.

## Architecture

### Plugin Structure

```
plugins/playwright/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── playwright/
│       ├── SKILL.md                    # Core skill
│       └── references/
│           ├── stagehand-api.md        # act/extract/observe quick ref
│           ├── playwright-api.md       # screenshot/pdf/locator/tracing
│           ├── deep-introspection.md   # CDP profiling, HAR, flamegraphs
│           └── patterns.md             # Common script templates
└── LICENSE
```

### Execution Model

```
Agent receives browser task
  → writes TypeScript script to <project>/ai/browser-scripts/<timestamp>-<slug>.ts
  → runs: bunx tsx <script-path> (timeout: 60s default)
  → captures stdout (JSON), stderr (errors), exit code
  → appends metadata to <project>/ai/browser-scripts/manifest.jsonl
  → reads output files (screenshots, traces, HARs) from ./tmp/
```

### Script Template (Stagehand-first)

```typescript
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

async function main() {
  const stagehand = new Stagehand({
    env: "LOCAL",
    model: "anthropic/claude-haiku-4-5-20251001",
    localBrowserLaunchOptions: { headless: true },
  });
  await stagehand.init();
  const page = stagehand.context.pages()[0];

  // --- task-specific logic here ---

  await stagehand.close();
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
```

### Script Template (Playwright-direct, for introspection)

```typescript
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordHar: { path: "./tmp/capture.har" },
  });
  const page = await context.newPage();

  await context.tracing.start({ screenshots: true, snapshots: true });
  // --- task-specific logic ---
  await context.tracing.stop({ path: "./tmp/trace.zip" });

  await context.close();
  await browser.close();
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
```

## Artifact System

Every generated script is preserved for review and self-improvement.

### File Layout

```
<project>/ai/browser-scripts/
├── 2026-03-04T14-30-00-scrape-reuters.ts
├── 2026-03-04T14-35-22-screenshot-iran-hexxa.ts
└── manifest.jsonl
```

### Manifest Entry

```json
{
  "timestamp": "2026-03-04T14:30:00Z",
  "script": "ai/browser-scripts/2026-03-04T14-30-00-scrape-reuters.ts",
  "intent": "scrape reuters headlines",
  "result": "success",
  "duration_ms": 4200,
  "exit_code": 0,
  "output_files": ["tmp/reuters-headlines.json"],
  "tokens_used": 1015
}
```

### Future POST Hook

When `BROWSER_ARTIFACT_ENDPOINT` env is set, the skill instructs agents to POST the manifest entry after execution. Zero refactoring needed — just env var activation.

## Capabilities Matrix

| Capability | API | Output Format |
|---|---|---|
| Natural language extraction | `stagehand.extract(instruction, schema)` | Typed JSON via Zod |
| Natural language interaction | `stagehand.act(instruction)` | Action result |
| Page observation | `stagehand.observe(instruction)` | Available actions list |
| Full-page screenshot | `page.screenshot({ fullPage: true })` | PNG/JPEG, no height limit |
| Element screenshot | `locator.screenshot()` | PNG of specific element |
| HAR recording | `context recordHar` option | `.har` file |
| Tracing timeline | `context.tracing.start/stop` | `.zip` (view with `npx playwright show-trace`) |
| CPU profiling | CDP `Profiler.start/stop` | `.cpuprofile` (flamegraph-ready) |
| Heap snapshot | CDP `HeapProfiler` | `.heapsnapshot` |
| Performance metrics | CDP `Performance.getMetrics` | FCP, LCP, layout count, etc. |
| Code coverage | CDP `Profiler.takePreciseCoverage` | Line-level JS coverage |
| PDF export | `page.pdf()` | PDF with margins/headers |
| Accessibility tree | `page.accessibility.snapshot()` | JSON tree |

## Dependencies

- `@browserbasehq/stagehand` (v3.1.0+) — Stagehand AI browser framework
- `zod` (v4+) — Schema definition for extract()
- `playwright` — Bundled with Stagehand, also available standalone
- `ANTHROPIC_API_KEY` — Standard API key (sk-ant-api03-...), NOT OAuth token

## Invocation

User-invokable as `/playwright`:

```
/playwright scrape https://reuters.com/world for headlines
/playwright screenshot https://iran.hexxa.dev fullpage
/playwright profile https://example.com performance metrics
/playwright har https://example.com/api record all API traffic
/playwright trace https://example.com full interaction trace
```

## Decision: When to Use Stagehand vs Raw Playwright

| Scenario | Use |
|---|---|
| Extract data from unknown page | Stagehand `extract()` |
| Click/fill on pages without known selectors | Stagehand `act()` |
| Take screenshots | Playwright direct |
| Record HAR / traces | Playwright direct |
| CDP profiling (flamegraphs, metrics) | Playwright CDP session |
| PDF generation | Playwright direct |
| Known selector interactions (testing) | Playwright direct |

## Proven (2026-03-04)

- Stagehand v3.1.0 local mode: launches headless Chromium, extract() works with Haiku 4.5
- Extract from example.com: 1.3s, 1015 tokens
- Extract structured data from HN: 2.5s, 11.5K tokens
- Raw Playwright screenshot through Stagehand page: works
- API key: must be standard Anthropic key, not OAuth token

## What This Replaces

| Tool | Limitation | Replacement |
|---|---|---|
| Chrome MCP | Slow, needs running Chrome, token-heavy | Headless scripts, minimal tokens |
| WebFetch | Can't render JS | Full Chromium rendering |
| cmux-browser | WKWebView, no CDP | Full CDP access |
