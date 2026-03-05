# Playwright Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Claude Code plugin in the-no-shop marketplace that gives agents Stagehand + Playwright browser automation via script generation, with artifact capture.

**Architecture:** Plugin contains a SKILL.md (core instructions for agents) and reference docs (API quick-refs, script templates, deep introspection guide). No daemon, no MCP, no build step. Agent generates TypeScript scripts → executes via `bunx tsx` → captures artifacts to `ai/browser-scripts/`.

**Tech Stack:** Stagehand v3, Playwright, Zod, TypeScript, Bun

---

### Task 1: Create plugin scaffold

**Files:**
- Create: `plugins/playwright/.claude-plugin/plugin.json`
- Create: `plugins/playwright/LICENSE`
- Create: `plugins/playwright/skills/playwright/SKILL.md` (stub)

**Step 1: Create plugin.json**

```json
{
  "name": "playwright",
  "description": "Stagehand + Playwright browser automation. Script generation for scraping, screenshots, HAR recording, tracing, CDP profiling, and AI-powered extraction. No MCP needed.",
  "version": "1.0.0",
  "author": {
    "name": "Brian Morin"
  },
  "homepage": "https://github.com/bdmorin/the-no-shop",
  "repository": "https://github.com/bdmorin/the-no-shop",
  "license": "MIT",
  "keywords": [
    "playwright",
    "stagehand",
    "browser",
    "automation",
    "scraping",
    "screenshot",
    "har",
    "tracing",
    "cdp",
    "profiling"
  ]
}
```

**Step 2: Create MIT LICENSE**

Copy from `plugins/kagi/` or any existing plugin — same MIT license.

**Step 3: Create SKILL.md stub**

```markdown
---
name: playwright
description: "Placeholder — full skill content in Task 2"
---
# Playwright
WIP
```

**Step 4: Verify structure**

Run: `find plugins/playwright -type f | sort`
Expected:
```
plugins/playwright/.claude-plugin/plugin.json
plugins/playwright/LICENSE
plugins/playwright/skills/playwright/SKILL.md
```

**Step 5: Commit**

```bash
git add plugins/playwright/
git commit -m "feat(playwright): plugin scaffold"
```

---

### Task 2: Write core SKILL.md

**Files:**
- Modify: `plugins/playwright/skills/playwright/SKILL.md`

This is the main skill file — the instructions agents receive when the skill triggers.

**Step 1: Write SKILL.md**

The SKILL.md must contain:

**Frontmatter:**
- `name: playwright`
- `description:` — comprehensive trigger description covering scrape, screenshot, profile, HAR, trace, browser automation
- `user-invokable: true`
- `argument-hint:` — example invocations
- `allowed-tools: "Bash(bun *), Bash(bunx *), Bash(npx *), Bash(mkdir *), Write, Read, Glob"`
- `license: MIT`
- `metadata:` — version, author, homepage, category: browser-automation, requires env ANTHROPIC_API_KEY

**Body sections:**

1. **Setup** — One-time dependency installation: `bun add @browserbasehq/stagehand zod` (per-project) or instructions for global install. Playwright browsers: `npx playwright install chromium`.

2. **Execution Model** — Step-by-step: (a) mkdir -p ai/browser-scripts && mkdir -p tmp, (b) write script to ai/browser-scripts/<ISO-timestamp>-<slug>.ts, (c) run with `ANTHROPIC_API_KEY=$KEY bunx tsx <script>`, (d) capture stdout+stderr+exit code, (e) append manifest entry to ai/browser-scripts/manifest.jsonl, (f) if BROWSER_ARTIFACT_ENDPOINT is set, POST the manifest entry.

3. **Script Boilerplate — Stagehand** — The proven init pattern:
   ```typescript
   import { Stagehand } from "@browserbasehq/stagehand";
   import { z } from "zod";
   const stagehand = new Stagehand({ env: "LOCAL", model: "anthropic/claude-haiku-4-5-20251001", localBrowserLaunchOptions: { headless: true } });
   await stagehand.init();
   const page = stagehand.context.pages()[0];
   // task logic
   await stagehand.close();
   ```

4. **Script Boilerplate — Playwright Direct** — For screenshots, HAR, tracing, CDP:
   ```typescript
   import { chromium } from "playwright";
   const browser = await chromium.launch({ headless: true });
   // ...
   await browser.close();
   ```

5. **Decision Table** — When to use Stagehand vs Playwright direct (from design doc).

6. **Manifest Format** — JSON schema for manifest.jsonl entries.

7. **Key Gotchas:**
   - ANTHROPIC_API_KEY must be standard (sk-ant-api03-...), not OAuth token
   - Stagehand extract() schema: be explicit about URL format ("full https URL, not element reference")
   - Each script is self-contained: launches browser, does work, closes browser
   - Output data via stdout (JSON), output files to ./tmp/
   - Default timeout 60s, override in script if needed

8. **Reference links** — Point to reference files for detailed API docs.

**Step 2: Verify SKILL.md loads**

Run: `head -20 plugins/playwright/skills/playwright/SKILL.md`
Confirm frontmatter is valid YAML.

**Step 3: Commit**

```bash
git add plugins/playwright/skills/playwright/SKILL.md
git commit -m "feat(playwright): core SKILL.md with execution model and boilerplate"
```

---

### Task 3: Write Stagehand API reference

**Files:**
- Create: `plugins/playwright/skills/playwright/references/stagehand-api.md`

**Step 1: Write reference**

Cover the three core Stagehand v3 methods:

- **`stagehand.extract(instruction, schema)`** — Natural language data extraction. Include: instruction best practices ("be specific: full https URL not element ref"), Zod schema patterns (strings, arrays, optional fields, .describe() for hints), return type, token cost notes (Haiku 4.5: ~1K tokens for simple, ~11K for complex pages).

- **`stagehand.act(instruction)`** — Natural language interaction. Include: click, fill, select examples. Note: one action per call for reliability. Chain multiple act() calls for multi-step flows.

- **`stagehand.observe(instruction)`** — Query available actions. Returns list of possible interactions. Use before act() when page structure is unknown.

- **`stagehand.agent({ mode, model })`** — Multi-step autonomous agent. Include the CUA mode pattern from docs. Note: this uses more tokens, prefer act() for single actions.

- **Page access** — `stagehand.context.pages()[0]` gives the raw Playwright Page object.

- **Model options** — List supported Anthropic models: `anthropic/claude-haiku-4-5-20251001` (cheapest, good enough for extraction), `anthropic/claude-sonnet-4-6` (more capable), `anthropic/claude-opus-4-6` (overkill for most tasks).

**Step 2: Commit**

```bash
git add plugins/playwright/skills/playwright/references/stagehand-api.md
git commit -m "feat(playwright): stagehand API reference"
```

---

### Task 4: Write Playwright API reference

**Files:**
- Create: `plugins/playwright/skills/playwright/references/playwright-api.md`

**Step 1: Write reference**

Cover the Playwright APIs agents use most:

- **Screenshots** — `page.screenshot()` options: fullPage, clip, mask, format, quality, scale. Element screenshots via `locator.screenshot()`. Note: fullPage has no height limit.

- **PDF** — `page.pdf()` options: format, printBackground, margin, headerTemplate, footerTemplate. Chromium only.

- **Navigation** — `page.goto(url, { waitUntil })`. waitUntil options: 'load', 'domcontentloaded', 'networkidle'.

- **Selectors** — getByRole, getByLabel, getByText, getByTestId, locator(). Priority order for reliability.

- **Interaction** — click(), fill(), selectOption(), check(), press(). Include waitForSelector patterns.

- **Content** — page.content() for full HTML, page.textContent() for text, page.evaluate() for arbitrary JS.

- **Network** — page.route() for interception, page.requests() for recent requests, page.on('request') / page.on('response') for monitoring.

**Step 2: Commit**

```bash
git add plugins/playwright/skills/playwright/references/playwright-api.md
git commit -m "feat(playwright): playwright API reference"
```

---

### Task 5: Write deep introspection reference

**Files:**
- Create: `plugins/playwright/skills/playwright/references/deep-introspection.md`

**Step 1: Write reference**

This is the power-user doc — the stuff that makes this better than Chrome MCP.

- **HAR Recording** — Two methods: (a) `browser.newContext({ recordHar: { path, urlFilter } })` for automatic capture, (b) `page.routeFromHAR(path, { update: true })` for selective recording. Include both CLI (`npx playwright open --save-har`) and programmatic. Note: close context to flush HAR.

- **Tracing** — `context.tracing.start({ screenshots, snapshots, sources, title })` / `.stop({ path })`. Output is a .zip viewable with `npx playwright show-trace trace.zip`. Include chunk API for multi-phase traces.

- **CDP Profiling** — Full patterns:
  - CPU profiling: `Profiler.enable` → `Profiler.start` → actions → `Profiler.stop` → save .cpuprofile → view in Chrome DevTools or speedscope.app
  - Performance metrics: `Performance.enable` → `Performance.getMetrics` → returns FCP, LCP, layout count, task duration, etc.
  - Heap snapshot: `HeapProfiler.takeHeapSnapshot` → save .heapsnapshot
  - Code coverage: `Profiler.startPreciseCoverage` → actions → `Profiler.takePreciseCoverage` → line-level JS coverage data

- **Accessibility** — `page.accessibility.snapshot()` returns full a11y tree. Useful for understanding page structure without visual rendering.

- **Console & Errors** — `page.on('console', msg => ...)` and `page.on('pageerror', err => ...)` for capturing browser-side output.

**Step 2: Commit**

```bash
git add plugins/playwright/skills/playwright/references/deep-introspection.md
git commit -m "feat(playwright): deep introspection reference (HAR, tracing, CDP, profiling)"
```

---

### Task 6: Write common patterns reference

**Files:**
- Create: `plugins/playwright/skills/playwright/references/patterns.md`

**Step 1: Write reference**

Complete, copy-paste-ready script templates for common tasks:

- **Scrape with Stagehand** — Navigate to URL, extract structured data, output JSON to stdout. Include the Zod schema pattern and explicit URL instruction.

- **Full-page screenshot** — Navigate, wait for networkidle, screenshot to tmp/. Both Stagehand (if already have a stagehand script) and Playwright-direct versions.

- **HAR capture** — Record all traffic for a page load, filter to API calls only, save to tmp/.

- **Performance audit** — Launch with tracing + CDP metrics, navigate, capture FCP/LCP/layout metrics, output as JSON.

- **Form fill and submit** — Stagehand act() for unknown forms, Playwright selectors for known forms.

- **Login flow** — Navigate to login, fill credentials (from env vars — never hardcode), wait for redirect, verify logged-in state. Include cookie persistence via userDataDir.

- **Multi-page scrape** — Navigate to index, extract links, visit each, extract data. Include pagination pattern.

- **Manifest append snippet** — The TypeScript snippet agents should include at the end of every script to append to manifest.jsonl.

**Step 2: Commit**

```bash
git add plugins/playwright/skills/playwright/references/patterns.md
git commit -m "feat(playwright): common patterns reference with copy-paste templates"
```

---

### Task 7: End-to-end validation

**Files:**
- No new files — test the plugin works

**Step 1: Verify plugin structure is complete**

Run: `find plugins/playwright -type f | sort`
Expected:
```
plugins/playwright/.claude-plugin/plugin.json
plugins/playwright/LICENSE
plugins/playwright/skills/playwright/SKILL.md
plugins/playwright/skills/playwright/references/deep-introspection.md
plugins/playwright/skills/playwright/references/patterns.md
plugins/playwright/skills/playwright/references/playwright-api.md
plugins/playwright/skills/playwright/references/stagehand-api.md
```

**Step 2: Validate plugin.json is valid JSON**

Run: `cat plugins/playwright/.claude-plugin/plugin.json | python3 -m json.tool > /dev/null && echo "VALID" || echo "INVALID"`
Expected: `VALID`

**Step 3: Validate SKILL.md frontmatter**

Run: `head -1 plugins/playwright/skills/playwright/SKILL.md`
Expected: `---`

**Step 4: Run a real extraction test using the patterns from the skill**

Create a test script following the exact boilerplate from SKILL.md. Run it against example.com. Verify:
- Extract returns structured data
- Screenshot file is created
- Script exits cleanly

Run: `mkdir -p /tmp/pw-validate && cd /tmp/pw-validate && bun init -y && bun add @browserbasehq/stagehand zod`

Write and run a minimal test:
```typescript
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
async function main() {
  const stagehand = new Stagehand({ env: "LOCAL", model: "anthropic/claude-haiku-4-5-20251001", localBrowserLaunchOptions: { headless: true } });
  await stagehand.init();
  const page = stagehand.context.pages()[0];
  await page.goto("https://example.com");
  const data = await stagehand.extract("Extract the heading", z.object({ heading: z.string() }));
  console.log(JSON.stringify(data));
  await page.screenshot({ path: "test.png", fullPage: true });
  await stagehand.close();
}
main().catch(e => { console.error(e); process.exit(1); });
```

Expected: JSON output with heading "Example Domain", test.png file exists.

**Step 5: Commit and push**

```bash
git add -A
git commit -m "feat(playwright): complete plugin with skill, references, and validation"
git push
```

---

### Task 8: Register in marketplace README

**Files:**
- Modify: `plugins/` listing or `README.md` if the-no-shop has a plugin index

**Step 1: Check if README lists plugins**

Run: `head -50 README.md`

**Step 2: Add playwright entry if there's a plugin list**

Add to the plugin table/list:
```
| playwright | Stagehand + Playwright browser automation — scraping, screenshots, HAR, tracing, CDP profiling |
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add playwright plugin to marketplace index"
```
