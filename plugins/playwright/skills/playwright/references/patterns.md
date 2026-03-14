# Common Patterns — Playwright & Stagehand Scripts

Cookbook of copy-paste-ready TypeScript script templates for web automation, scraping, and testing. Each pattern is a complete, runnable script.

---

## Pattern 1: Scrape with Stagehand

Extract structured data from a page using Stagehand's LLM-powered extraction. Supports full https URLs.

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

  await page.goto("https://TARGET_URL");

  const data = await stagehand.extract(
    "Extract DESCRIPTION_OF_DATA with full https URLs where applicable",
    z.object({
      items: z.array(z.object({
        title: z.string(),
        url: z.string().describe("Full https URL"),
        // add more fields as needed
      })),
    }),
  );

  console.log(JSON.stringify(data, null, 2));
  await stagehand.close();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
```

**When to use**: Extracting semi-structured data from unstructured HTML. Stagehand's LLM understands context and can find data even if the HTML structure is inconsistent.

---

## Pattern 2: Full-Page Screenshot

Capture a complete page as PNG, including off-screen content.

```typescript
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://TARGET_URL", { waitUntil: "networkidle" });
  await page.screenshot({ path: "./tmp/screenshot.png", fullPage: true });
  console.log(JSON.stringify({ file: "./tmp/screenshot.png" }));
  await browser.close();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
```

**When to use**: Documenting page state, visual regression testing, or archiving. Set `fullPage: false` to capture only the viewport.

---

## Pattern 3: HAR Capture

Record all network traffic (requests/responses) to a HAR file for analysis or replay.

```typescript
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordHar: { path: "./tmp/capture.har", urlFilter: "**/api/**" },
  });
  const page = await context.newPage();
  await page.goto("https://TARGET_URL", { waitUntil: "networkidle" });
  // interact if needed...
  await context.close(); // flushes HAR
  await browser.close();
  console.log(JSON.stringify({ file: "./tmp/capture.har" }));
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
```

**When to use**: Debugging API calls, recording API schemas, or analyzing page performance. The `urlFilter` restricts recording to specific paths (e.g., API endpoints).

---

## Pattern 4: Performance Audit

Measure Core Web Vitals and generate a trace for performance analysis.

```typescript
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await context.tracing.start({ screenshots: true, snapshots: true });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");

  await page.goto("https://TARGET_URL", { waitUntil: "networkidle" });

  const { metrics } = await cdp.send("Performance.getMetrics");
  await context.tracing.stop({ path: "./tmp/trace.zip" });

  const result = {
    metrics: metrics.reduce((acc: Record<string, number>, m: { name: string; value: number }) => {
      acc[m.name] = m.value;
      return acc;
    }, {}),
    trace: "./tmp/trace.zip",
  };
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
```

**When to use**: Monitoring page load time, First Paint, Largest Contentful Paint, or other performance metrics. The trace can be imported into DevTools for detailed analysis.

---

## Pattern 5: Form Fill with Stagehand

Use Stagehand's act() method to interact with forms using natural language instructions.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

async function main() {
  const stagehand = new Stagehand({
    env: "LOCAL",
    model: "anthropic/claude-haiku-4-5-20251001",
    localBrowserLaunchOptions: { headless: true },
  });
  await stagehand.init();
  const page = stagehand.context.pages()[0];

  await page.goto("https://TARGET_URL");

  await stagehand.act("Fill the email field with test@example.com");
  await stagehand.act("Fill the password field with SecurePass123");
  await stagehand.act("Click the Sign In button");

  // Wait for navigation
  await page.waitForURL("**/dashboard", { timeout: 10000 });
  console.log(JSON.stringify({ status: "logged_in", url: page.url() }));

  await stagehand.close();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
```

**When to use**: Multi-step form interactions, authentication flows, or complex user journeys. Stagehand understands intent and finds elements even with dynamic IDs.

---

## Pattern 6: Login with Cookie Persistence

Authenticate once, save cookies, and reuse them across script runs.

```typescript
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  // Persistent context — cookies survive across runs
  const context = await browser.newContext({
    storageState: process.env.AUTH_STATE_FILE || undefined,
  });
  const page = await context.newPage();

  await page.goto("https://TARGET_URL/login");
  await page.locator("#email").fill(process.env.LOGIN_EMAIL!);
  await page.locator("#password").fill(process.env.LOGIN_PASSWORD!);
  await page.locator("button[type=submit]").click();
  await page.waitForURL("**/dashboard");

  // Save auth state for future runs
  await context.storageState({ path: "./tmp/auth-state.json" });
  console.log(JSON.stringify({ status: "authenticated", state: "./tmp/auth-state.json" }));

  await browser.close();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
```

**When to use**: Scripts that run repeatedly and don't need to re-authenticate on every invocation. Load the saved state with `storageState: "./tmp/auth-state.json"` on subsequent runs.

---

## Pattern 7: Multi-Page Scrape

Extract data from an index page, then iterate over detail pages.

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

  // Step 1: Get links from index
  await page.goto("https://TARGET_URL");
  const { links } = await stagehand.extract(
    "Extract all article links as full https URLs",
    z.object({ links: z.array(z.string().describe("Full https URL")) }),
  );

  // Step 2: Visit each and extract
  const results = [];
  for (const url of links.slice(0, 10)) { // limit to first 10
    await page.goto(url);
    const detail = await stagehand.extract(
      "Extract the article title, author, date, and full text",
      z.object({
        title: z.string(),
        author: z.string().optional(),
        date: z.string().optional(),
        text: z.string(),
      }),
    );
    results.push({ url, ...detail });
  }

  console.log(JSON.stringify(results, null, 2));
  await stagehand.close();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
```

**When to use**: Crawling paginated results, scraping multiple article pages, or collecting data from a site with consistent detail page structure.

---

## Pattern 8: Raw Article / Content Extraction

Extract the full text of a page and all outgoing links — no AI middleman, no schema needed. This is the correct approach for "get the article" or "extract page content" requests.

```typescript
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("https://TARGET_URL", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 3000)); // let JS render

  // Raw text — tries article > main > .post-content > body
  const content = await page.evaluate(() => {
    const el = document.querySelector("article")
      || document.querySelector("main")
      || document.querySelector(".post-content")
      || document.body;
    return el?.innerText || "";
  });

  // All outgoing links with anchor text
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

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
```

**When to use**: Any request to "get the article," "extract the page," or "scrape the content." This returns the actual text, not an AI summary. Use `domcontentloaded` + delay instead of `networkidle` for ad-heavy sites.

**When NOT to use**: If you need structured data from a messy page (e.g., "extract all product prices into columns"), use Stagehand Pattern 1 instead.

---

## Pattern 9: Manifest Append Snippet

Log script execution metadata to a manifest for auditing and debugging.

```typescript
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

function appendManifest(entry: {
  intent: string;
  result: "success" | "failure";
  exit_code: number;
  output_files?: string[];
  tokens_used?: number;
  duration_ms: number;
}) {
  const dir = join(process.cwd(), "ai", "browser-scripts");
  mkdirSync(dir, { recursive: true });
  const record = {
    timestamp: new Date().toISOString(),
    script: process.argv[1],
    ...entry,
  };
  appendFileSync(join(dir, "manifest.jsonl"), JSON.stringify(record) + "\n");
}

// Usage at end of script:
const start = Date.now();
try {
  // ... script logic ...
  appendManifest({
    intent: "Scrape widget prices",
    result: "success",
    exit_code: 0,
    output_files: ["./tmp/widgets.json"],
    duration_ms: Date.now() - start,
  });
} catch (e) {
  appendManifest({
    intent: "Scrape widget prices",
    result: "failure",
    exit_code: 1,
    duration_ms: Date.now() - start,
  });
  process.exit(1);
}
```

**When to use**: Track automation runs, measure performance, and build audit logs. The manifest is append-only and structured for easy analysis with jq.

---

## Pattern 10: Scraping Cascade (cheap → expensive)

Try lightweight extraction first, fall back to full browser only when needed. Minimizes token cost and latency.

```typescript
import { chromium } from "playwright";

async function main() {
  const url = "https://TARGET_URL";

  // Step 1: Try fetch + regex (cheapest — no browser)
  try {
    const resp = await fetch(url);
    const html = await resp.text();
    // Check for poison pills: paywalls, CAPTCHAs, bot blocks
    if (
      html.includes("Just a moment") ||          // Cloudflare
      html.includes("captcha") ||                 // Generic CAPTCHA
      html.includes("Please verify") ||           // Bot check
      html.includes("paywall") ||                 // Paywall
      html.length < 500                           // Empty/blocked response
    ) {
      throw new Error("Poison pill detected — need full browser");
    }
    // Extract from static HTML if sufficient
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    const bodyMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
    if (bodyMatch) {
      console.log(JSON.stringify({
        method: "fetch",
        title: titleMatch?.[1] || "",
        content: bodyMatch[1].replace(/<[^>]+>/g, " ").trim(),
      }));
      return;
    }
  } catch (e) {
    // Fall through to browser
  }

  // Step 2: Full browser (expensive — JS rendering, dynamic content)
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 3000));

  const content = await page.evaluate(() => {
    const el = document.querySelector("article")
      || document.querySelector("main")
      || document.body;
    return el?.innerText || "";
  });

  console.log(JSON.stringify({ method: "browser", content }));
  await browser.close();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
```

**When to use**: High-volume scraping where most pages are static HTML. The fetch path costs zero Playwright overhead. Only pages that need JS rendering or are bot-protected escalate to the browser.

---

## Pattern 11: Anti-Bot Fallback (headless → headed)

When headless is blocked, automatically retry with a headed browser. Detects common anti-bot signals.

```typescript
import { chromium, type Browser, type Page } from "playwright";

async function withFallback(url: string): Promise<{ browser: Browser; page: Page }> {
  // Try headless first
  let browser = await chromium.launch({ headless: true });
  let page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2000));

  const text = await page.evaluate(() => document.body.innerText);
  const blocked =
    text.length < 100 ||
    text.includes("Just a moment") ||
    text.includes("Verify you are human") ||
    text.includes("Access denied") ||
    text.includes("Enable JavaScript");

  if (blocked) {
    await browser.close();
    // Retry headed — harder to detect
    browser = await chromium.launch({ headless: false });
    page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 3000));
  }

  return { browser, page };
}

async function main() {
  const { browser, page } = await withFallback("https://TARGET_URL");
  const content = await page.evaluate(() => {
    const el = document.querySelector("article") || document.body;
    return el?.innerText || "";
  });
  console.log(JSON.stringify({ content }));
  await browser.close();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
```

**When to use**: Scraping sites with anti-bot protection. The headed fallback works against basic detection (navigator.webdriver checks, UA sniffing) but won't bypass enterprise solutions like DataDome or PerimeterX without additional stealth plugins.

---

## Tips & Tricks

### Error Handling
Always wrap main() in try/catch and exit with a non-zero code on failure:
```typescript
main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
```

### Wait for Navigation
After clicking a button that navigates, use `waitForURL()` or `waitForNavigation()`:
```typescript
await page.click("a[href='/next-page']");
await page.waitForURL("**/next-page");
```

### Extract Without Stagehand
For simple, well-structured HTML, use Playwright's locators:
```typescript
const titles = await page.locator("h2.article-title").allTextContents();
const urls = await page.locator("a.article-link").evaluateAll(els =>
  els.map(el => el.getAttribute("href"))
);
```

### Rate Limiting
Respect server load — add delays between requests:
```typescript
for (const url of urls) {
  await page.goto(url);
  await page.waitForTimeout(1000); // 1 second between requests
  // ... extract data ...
}
```

### Environment Variables
Use env vars for secrets — never hardcode credentials:
```typescript
const apiKey = process.env.API_KEY || "";
if (!apiKey) throw new Error("API_KEY not set");
```

### Output Format
Always output valid JSON for downstream processing:
```typescript
console.log(JSON.stringify({ status: "ok", data: results }, null, 2));
```
