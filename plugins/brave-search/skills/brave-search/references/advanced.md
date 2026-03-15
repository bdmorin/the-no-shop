# Advanced Features — Summarizer, LLM Context, Answers, Local POIs, Rich Results, Goggles

## Summarizer

Generates an AI-synthesized answer from web results. **Summarizer calls are free** — only the initial web search counts toward quota. Requires Search plan.

**Pre-synthesis use case**: Run web search + summarizer at query time to cache a ready-to-use answer. Since summarizer is free, you can always request `summary=1` and store the result for immediate retrieval.

### Step 1 — Web Search with summary=1

```bash
curl -s --compressed \
  "https://api.search.brave.com/res/v1/web/search?q=how+does+rust+ownership+work&summary=1" \
  -H "X-Subscription-Token: $(printenv BRAVE_SEARCH_API_KEY)" \
  -H "Accept: application/json" -H "Accept-Encoding: gzip" -H "Cache-Control: no-cache"
```

Extract `summarizer.key` from the response:

```json
{ "summarizer": { "type": "summarizer", "key": "AY2kfqxhN3yqPgW..." } }
```

If `summarizer` is absent, the query doesn't have a summarizable answer — fall back to web results.

### Step 2 — Fetch the Summary

`GET https://api.search.brave.com/res/v1/summarizer/search`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `key` | string | required | Opaque key from Step 1 |
| `entity_info` | integer | 0 | `1` for entity metadata |
| `inline_references` | boolean | false | Add inline citation markers |

### Summarizer Sub-Endpoints (all free, all require `key`)

| Sub-endpoint | Path | Returns |
|-------------|------|---------|
| Full summary | `/summarizer/search` | status, title, summary, enrichments, followups |
| Summary only | `/summarizer/summary` | Just the synthesized text |
| Streaming | `/summarizer/summary_streaming` | Chunked stream of summary tokens |
| Title only | `/summarizer/title` | Just the title string |
| Enrichments | `/summarizer/enrichments` | Images, Q&A, entities, sources separately |
| Follow-ups | `/summarizer/followups` | Suggested next queries only |
| Entity info | `/summarizer/entity_info` | Entity descriptions and metadata |

### Summarizer Response Schema

```json
{
  "type": "summarizer",
  "status": "complete",
  "title": "Rust Ownership System",
  "summary": [
    { "type": "token", "text": "Rust's ownership system...", "entities": [] }
  ],
  "enrichments": {
    "raw": "Full synthesized text as plain string — use this for LLM consumption",
    "images": [],
    "qa": [],
    "entities": [],
    "sources": [{ "title": "Source title", "url": "https://...", "index": 1 }]
  },
  "followups": ["What is borrowing in Rust?", "How does the borrow checker work?"],
  "entities_info": {}
}
```

Check `status === "complete"` before using. `enrichments.raw` = plain text. `enrichments.sources` = cite these.

---

## LLM Context

`GET https://api.search.brave.com/res/v1/llm/context`

Pre-extracted, relevance-scored web content designed for grounding LLM responses. Returns actual page content (text, tables, code) — not just snippets. Use this instead of web search when building RAG pipelines or agent tool calls.

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `q` | string | required | 1–400 chars, ≤50 words | Search query |
| `count` | integer | 20 | 1–50 | Number of results |
| `country` | string | `us` | ISO alpha-2 | Target region |
| `search_lang` | string | `en` | ISO 639-1 | Content language |
| `freshness` | string | — | `pd`, `pw`, `pm`, `py`, date range | Recency filter |
| `maximum_number_of_tokens` | integer | 8192 | 1024–32768 | Total token budget for response |
| `maximum_number_of_urls` | integer | 20 | 1–50 | Max source URLs included |
| `maximum_number_of_snippets` | integer | 50 | 1–100 | Max snippets across all sources |
| `maximum_number_of_tokens_per_url` | integer | 4096 | 512–8192 | Token cap per source URL |
| `context_threshold_mode` | string | `balanced` | `strict`, `balanced`, `lenient`, `disabled` | Relevance filtering aggressiveness |
| `enable_local` | boolean | false | — | Include location-aware results |
| `goggles` | string | — | URL or inline | Custom source re-ranking |

### Context Threshold Modes

- `strict` — only highly relevant snippets (fewer, more precise)
- `balanced` — default balance of precision and recall
- `lenient` — include loosely related content (more context, more noise)
- `disabled` — no threshold filtering

For agent use, tune `maximum_number_of_tokens` to fit your context window budget.

### LLM Context Response Schema

```json
{
  "grounding": {
    "generic": [
      {
        "url": "https://example.com/page",
        "title": "Page Title",
        "snippets": [
          "Full extracted paragraph or code block...",
          "Another relevant passage from the page..."
        ]
      }
    ],
    "poi": {},
    "map": []
  },
  "sources": {
    "https://example.com/page": {
      "title": "Page Title",
      "hostname": "example.com",
      "age": "2024-01-15"
    }
  }
}
```

`grounding.generic[].snippets` — these are ready to inject into an LLM prompt. Each snippet is actual page content, not a search excerpt.

```bash
curl -s --compressed \
  "https://api.search.brave.com/res/v1/llm/context?q=latest+rust+release&count=5&maximum_number_of_tokens=4096&context_threshold_mode=strict" \
  -H "X-Subscription-Token: $(printenv BRAVE_SEARCH_API_KEY)" \
  -H "Accept: application/json" -H "Accept-Encoding: gzip" -H "Cache-Control: no-cache"
```

---

## Answers API (Chat Completions)

`POST https://api.search.brave.com/res/v1/chat/completions`

OpenAI-SDK-compatible chat endpoint backed by live web search. Returns grounded, cited answers. Supports streaming. Rate limit: 2 req/sec (contact support for higher).

**Cost**: `(searches × $4/1000) + (input_tokens + output_tokens × $5/1,000,000)`
Example: 2 searches + 1,234 input + 300 output tokens ≈ $0.016

### Core Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | required | Set to `"brave"` |
| `messages` | array | required | OpenAI-format messages array |
| `stream` | boolean | false | Enable streaming response |
| `country` | string | `us` | Target search region (via `extra_body`) |
| `language` | string | `en` | Response language (via `extra_body`) |
| `enable_entities` | boolean | false | Include entity info (via `extra_body`) |
| `enable_citations` | boolean | false | Inline citations in response (via `extra_body`) |
| `enable_research` | boolean | false | Multi-search research mode (via `extra_body`) |

### Research Mode

Standard mode: single search, <4.5s avg. **Research mode**: iterative multi-search strategy, analyzes up to 1,000 pages, can take minutes (p99 example: 53 queries, ~300s). Use for deep factual questions, not latency-sensitive tasks.

### Python Example (streaming with citations)

```python
from openai import AsyncOpenAI
import os

client = AsyncOpenAI(
    api_key=os.environ["BRAVE_SEARCH_API_KEY"],
    base_url="https://api.search.brave.com/res/v1"
)

async def search_with_citations(query: str):
    stream = await client.chat.completions.create(
        model="brave",
        messages=[{"role": "user", "content": query}],
        stream=True,
        extra_body={
            "enable_citations": True,
            "enable_research": False,  # set True for deep research
            "country": "us",
            "language": "en"
        }
    )
    async for chunk in stream:
        print(chunk.choices[0].delta.content or "", end="")
```

### Streaming Response Format

Streaming chunks contain special XML-like tags mixed with content:

```
<citation>{"start_index": 0, "end_index": 10, "number": 1, "url": "...", "favicon": "...", "snippet": "..."}</citation>
<enum_item>{"uuid": "...", "name": "...", "href": "...", "citations": [...]}</enum_item>
<usage>{"X-Request-Requests": 1, "X-Request-Queries": 2, "X-Request-Tokens-In": 1234, "X-Request-Tokens-Out": 300}</usage>
```

Parse these tags out of the stream for structured citation data. `usage` tag appears at end — use for cost tracking.

---

## Local Search (Two-Step)

Local search finds businesses and POIs. Requires Search plan (not free tier). POI IDs expire after ~8 hours — never store them.

### Step 1 — Web Search (returns location IDs)

```bash
curl -s --compressed \
  "https://api.search.brave.com/res/v1/web/search?q=coffee+shops+near+chicago" \
  -H "X-Subscription-Token: $(printenv BRAVE_SEARCH_API_KEY)" \
  -H "Accept: application/json" -H "Accept-Encoding: gzip" -H "Cache-Control: no-cache"
```

Extract IDs from `locations.results[].id`. Collect up to 20.

You can optionally add location hint headers to the web search:
```
x-loc-lat: 41.8781
x-loc-long: -87.6298
```

### Step 2a — Fetch POI Details

`GET https://api.search.brave.com/res/v1/local/pois`

| Parameter | Type | Description |
|-----------|------|-------------|
| `ids` | array | Location IDs from Step 1 (max 20). Repeat param: `?ids=id1&ids=id2` |
| `search_lang` | string | ISO 639-1 |
| `ui_lang` | string | BCP 47 |
| `units` | string | `metric` or `imperial` |

```bash
curl -s --compressed \
  "https://api.search.brave.com/res/v1/local/pois?ids=ID1&ids=ID2&units=imperial" \
  -H "X-Subscription-Token: $(printenv BRAVE_SEARCH_API_KEY)" \
  -H "Accept: application/json" -H "Accept-Encoding: gzip" -H "Cache-Control: no-cache"
```

POI response includes: name, address, phone, hours, ratings, coordinates, categories, website.

### Step 2b — Fetch AI Descriptions (optional)

`GET https://api.search.brave.com/res/v1/local/descriptions`

| Parameter | Type | Description |
|-----------|------|-------------|
| `ids` | array | Same location IDs (max 20) |

Returns AI-generated descriptions for each location. Combine with POI details for richer output.

---

## Rich Results

Rich results provide real-time structured data for weather, stocks, sports, etc. Opt-in only.

### Step 1 — Web Search with enable_rich_callback=1

```bash
curl -s --compressed \
  "https://api.search.brave.com/res/v1/web/search?q=AAPL+stock+price&enable_rich_callback=1" \
  -H "X-Subscription-Token: $(printenv BRAVE_SEARCH_API_KEY)" \
  -H "Accept: application/json" -H "Accept-Encoding: gzip" -H "Cache-Control: no-cache"
```

Extract from response:
```json
{
  "rich": {
    "results": {
      "hint": {
        "vertical": "stocks",
        "callback_key": "opaque-key..."
      }
    }
  }
}
```

If `rich` is absent, the query doesn't match a rich vertical.

### Step 2 — Fetch Rich Data

`GET https://api.search.brave.com/res/v1/web/rich?key=<callback_key>`

```bash
curl -s --compressed \
  "https://api.search.brave.com/res/v1/web/rich?key=opaque-key..." \
  -H "X-Subscription-Token: $(printenv BRAVE_SEARCH_API_KEY)" \
  -H "Accept: application/json" -H "Accept-Encoding: gzip" -H "Cache-Control: no-cache"
```

Response structure varies by vertical:
- `weather` — temperature, conditions, forecast
- `stocks` — price, change, market cap, P/E
- `sports` — scores, standings, schedules
- `cryptocurrency` — price, 24h change, market cap
- `currency_conversion` — exchange rate
- `calculator` — computed result
- `definitions` — word definitions, etymology
- `time` — current time in timezone

---

## Goggles (Custom Re-Ranking)

Goggles let you boost, demote, or filter results by domain. Apply to web and news search.

```bash
# Use a public Goggle (by URL)
curl -s --compressed \
  "https://api.search.brave.com/res/v1/web/search?q=javascript+frameworks&goggles_id=https://raw.githubusercontent.com/nicohvi/techmeme-goggles/main/tech-news.goggle" \
  -H "X-Subscription-Token: $(printenv BRAVE_SEARCH_API_KEY)" \
  -H "Accept: application/json" -H "Accept-Encoding: gzip" -H "Cache-Control: no-cache"
```

Goggles are plain text files with boost/discard rules. Create and host your own, then reference by URL.

Goggle syntax basics:
```
$boost,site=github.com
$discard,site=pinterest.com
$boost=3,inurl=docs
```

---

## Plans and Pricing

| Feature | Free | Search ($5/1K) | Answers ($4/1K + tokens) |
|---------|------|---------------|--------------------------|
| Web search | $5 credit/mo | Yes | — |
| News/Images/Videos | $5 credit/mo | Yes | — |
| Suggest/Spellcheck | $5 credit/mo | Yes | — |
| Local POIs | No | Yes | — |
| Rich results | No | Yes | — |
| LLM Context | No | Yes | — |
| Chat completions | No | — | Yes |
| Summarizer | Free with web | Free | Free |

Rate limits: Search plan = 50 req/sec. Answers plan = 2 req/sec.
