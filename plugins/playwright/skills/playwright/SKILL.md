---
name: playwright
description: "Stagehand + Playwright browser automation — Code Mode architecture: write complete scripts, execute in isolation, return structured results. One round-trip, not N tool calls. Handles scraping, screenshots, HAR recording, tracing, CDP profiling, and AI-powered data extraction. No MCP needed. Requires ANTHROPIC_API_KEY (standard, not OAuth)."
user-invokable: true
argument-hint: "scrape https://reuters.com for headlines, screenshot https://example.com fullpage, profile https://example.com performance, har https://example.com/api capture traffic, trace https://example.com interaction trace"
allowed-tools: "Bash(bun *), Bash(bunx *), Bash(npx *), Bash(mkdir *), Write, Read, Glob"
license: MIT
metadata:
  version: "2.0.0"
  author: "Brian Morin"
  homepage: "https://github.com/bdmorin/the-no-shop"
  category: browser-automation
  requires:
    env:
      - ANTHROPIC_API_KEY
    packages:
      - "@browserbasehq/stagehand"
      - zod
---

# Playwright Skill — Code Mode

Browser automation via script generation. Write a complete TypeScript script, execute it in one shot, return structured JSON. This is the **Code Mode** pattern: one LLM round-trip, not N MCP tool calls.

## Why Code Mode Over MCP

MCP tool-calling forces N round-trips with bloated accessibility trees for what should be a single script execution. Code Mode (per Cloudflare's architecture) writes one script that chains multiple browser actions, eliminating wasted token processing between steps. The LLM is better at writing TypeScript than choosing between MCP tools — it's seen millions of real-world TypeScript projects in training.

## Setup

One-time per project:

```bash
bun add @browserbasehq/stagehand zod
npx playwright install chromium
```

## Decision Table — Pick Your Path

| What you need | Use | Why |
|---|---|---|
| **Get article/page text** | **Playwright direct** | Raw `innerText` — no AI interpretation |
| **Get page content + links** | **Playwright direct** | `evaluate()` returns actual content |
| Extract structured data (prices, specs, tables) | Stagehand `extract()` | AI maps messy HTML to clean schema |
| Click/fill on unknown forms | Stagehand `act()` | No selector knowledge needed |
| Multi-step workflow (login → navigate → extract) | **Single script with chained calls** | One round-trip, not N tool calls |
| Take screenshots | Playwright direct | No AI needed, faster |
| Record HAR / traces / CDP profiling | Playwright direct | Built-in, no AI cost |
| PDF generation | Playwright direct | Built-in capability |
| Known selector interactions | Playwright direct | Faster, deterministic |
| Site blocks headless (CF Bot Mgmt, DataDome) | Playwright direct with `headless: false` | Stealth fallback |

## Execution Model

Follow these steps in order for every automation request:

1. `mkdir -p ai/browser-scripts tmp`
2. Generate ISO timestamp slug: `YYYY-MM-DDTHH-MM-SS`
3. Write script to `ai/browser-scripts/<timestamp>-<slug>.ts`
4. Run: `cd <project-root> && ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY bun <script-path>` (Bun resolves imports from cwd, so run from the directory containing `node_modules`)
5. Capture stdout (JSON data) + stderr (logs/errors) + exit code
6. Append manifest entry to `ai/browser-scripts/manifest.jsonl`
7. If `BROWSER_ARTIFACT_ENDPOINT` is set, POST the manifest entry

**Chain everything in one script.** Don't write separate scripts for "navigate", "click", "extract". Write ONE script that does the entire workflow. This is the core Code Mode principle: eliminate intermediate LLM processing.

## Boilerplate — Stagehand (AI-powered extraction/interaction)

Use when the page structure is unknown or you need AI-powered extraction/interaction.

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

  // --- YOUR TASK LOGIC HERE ---

  // Output results as JSON to stdout
  console.log(JSON.stringify(result, null, 2));

  await stagehand.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
```

## Boilerplate — Playwright Direct (raw content & introspection)

Use for **raw content extraction** (articles, pages, text), screenshots, HAR recording, traces, CDP profiling, PDF generation, and known-selector interactions.

**IMPORTANT**: For "extract the article" or "get the page content" requests, ALWAYS use Playwright direct — NOT Stagehand. Stagehand's `extract()` interprets content through an AI middleman, which summarizes and paraphrases instead of returning the actual text. You cannot write a Zod schema for content you haven't seen yet.

```typescript
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("https://TARGET_URL", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 3000)); // let JS render

  // Raw text extraction — tries article > main > .post-content > body
  const content = await page.evaluate(() => {
    const el = document.querySelector("article")
      || document.querySelector("main")
      || document.querySelector(".post-content")
      || document.body;
    return el?.innerText || "";
  });

  // Extract all outgoing links
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href]"))
      .map((a) => ({
        text: (a as HTMLAnchorElement).innerText.trim(),
        url: (a as HTMLAnchorElement).href,
      }))
      .filter((l) => l.text && l.url.startsWith("http"));
  });

  console.log(JSON.stringify({ content, links }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
```

### Playwright Direct — Introspection (HAR/Tracing)

For HAR recording, tracing, and CDP profiling, use context-level instrumentation:

```typescript
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordHar: { path: "./tmp/capture.har" },
  });
  const page = await context.newPage();

  await context.tracing.start({ screenshots: true, snapshots: true });

  // --- YOUR TASK LOGIC HERE ---

  await context.tracing.stop({ path: "./tmp/trace.zip" });
  await context.close();
  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
```

## Anti-Bot Fallback

Headless Chromium is detected by commercial anti-bot services (Cloudflare Bot Mgmt, DataDome, PerimeterX). Detection surface: `navigator.webdriver=true`, `HeadlessChrome/` UA string, missing plugins, CDP side effects.

When a script gets blocked (HTTP 403, CAPTCHA page, empty content on a page you know has content):

```typescript
// Try headless first, fall back to headed if blocked
let browser = await chromium.launch({ headless: true });
let page = await browser.newPage();
await page.goto(url, { waitUntil: "domcontentloaded" });

const content = await page.evaluate(() => document.body.innerText);
if (content.length < 100 || content.includes("Just a moment")) {
  // Likely blocked — retry headed
  await browser.close();
  browser = await chromium.launch({ headless: false });
  page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
}
```

For serious anti-bot bypass, use `playwright-extra` with stealth plugin:

```typescript
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
chromium.use(stealth());
```

## Manifest Format

Each execution appends one line to `ai/browser-scripts/manifest.jsonl`:

```json
{"timestamp":"2026-03-04T14:30:00Z","script":"ai/browser-scripts/2026-03-04T14-30-00-scrape-reuters.ts","intent":"scrape reuters headlines","result":"success","duration_ms":4200,"exit_code":0,"output_files":["tmp/reuters.json"],"tokens_used":1015}
```

## Key Gotchas

- **Stagehand extract() is NOT for raw content** — it interprets through AI. For "get the article," use Playwright direct with `page.evaluate(() => article.innerText)`
- **Chain everything in one script** — don't write separate scripts for each browser action. One script = one round-trip.
- ANTHROPIC_API_KEY must be standard `sk-ant-api03-...`, NOT an OAuth token (`sk-ant-oat01-...`)
- Stagehand `extract()` schemas: be explicit about URL format in the instruction — say "full https URL" or Stagehand returns element refs
- Each script is self-contained: launches browser, does work, closes browser
- Output data via `console.log(JSON.stringify(...))` to stdout
- Output files (screenshots, HAR, traces) to `./tmp/`
- Default timeout 60s — override with `setTimeout` if needed
- Stagehand v3 page access: `stagehand.context.pages()[0]`, NOT `stagehand.page`
- **Module resolution**: scripts import from `node_modules` relative to the script location. Ensure `@browserbasehq/stagehand`, `zod`, and `playwright` are installed in the project root (run `bun add` there)
- **`networkidle` timeout**: Ad-heavy sites never reach networkidle. Use `waitUntil: "domcontentloaded"` + manual `setTimeout` delay instead
- **Cloudflare Turnstile**: Headless Chromium is blocked by CF's bot detection. Use anti-bot fallback pattern above, or WebFetch for CF-protected sites

## Reference Links

- [references/stagehand-api.md](references/stagehand-api.md) — extract, act, observe, agent, model options
- [references/playwright-api.md](references/playwright-api.md) — screenshots, PDF, navigation, selectors
- [references/deep-introspection.md](references/deep-introspection.md) — HAR, tracing, CDP profiling, flamegraphs
- [references/patterns.md](references/patterns.md) — Copy-paste script templates for common tasks
