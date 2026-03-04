---
name: brave-search
description: "Brave Search REST API covering web, news, images, videos, suggest, spellcheck, local POIs, rich results, AI summarizer, LLM context (RAG-optimized grounding with token budget controls), and Answers (OpenAI-compatible chat completions with streaming and citations). Triggers on any request for live web data, current events, recent news, image search, video search, or building search-augmented agent workflows. Requires BRAVE_SEARCH_API_KEY."
user-invokable: true
argument-hint: "brave-search latest Iran news, brave-search --images mars surface, brave-search --answers what caused the 2025 spain outage, brave-search --local coffee shops chicago"
allowed-tools: "Bash(curl *)"
license: MIT
metadata:
  version: "1.0.0"
  author: "Brian Morin"
  homepage: "https://github.com/bdmorin/the-no-shop"
  category: search
  requires:
    env:
      - BRAVE_SEARCH_API_KEY
  endpoints:
    - web-search
    - llm-context
    - answers
    - images
    - videos
    - news
    - suggest
    - spellcheck
    - local-pois
    - rich-results
    - summarizer
---

# Brave Search API

Base URL: `https://api.search.brave.com/res/v1`

## Authentication

Every request requires these headers:

```
X-Subscription-Token: <BRAVE_SEARCH_API_KEY>
Accept: application/json
Accept-Encoding: gzip
Cache-Control: no-cache
```

Missing `Cache-Control: no-cache` returns 422. Missing token returns 401.

Read the key from environment: `$BRAVE_SEARCH_API_KEY`

## Endpoints — Quick Reference

| Endpoint | Path | Key params |
|----------|------|-----------|
| Web Search | `GET /web/search` | `q`, `count`, `offset`, `freshness`, `country`, `extra_snippets` |
| LLM Context | `GET /llm/context` | `q`, `count`, `maximum_number_of_tokens`, `context_threshold_mode` |
| Answers | `POST /chat/completions` | OpenAI-format, `model="brave"`, `enable_citations`, `enable_research` |
| Image Search | `GET /images/search` | `q`, `count` (max 200), `safesearch` |
| Video Search | `GET /videos/search` | `q`, `count`, `freshness` |
| News Search | `GET /news/search` | `q`, `count` (max 50), `freshness` |
| Suggest | `GET /suggest/search` | `q`, `count` |
| Spellcheck | `GET /spellcheck/search` | `q` |
| Local POIs | `GET /local/pois` | `ids[]` (from web search, max 20) |
| Local Descriptions | `GET /local/descriptions` | `ids[]` (from web search, max 20) |
| Rich Results | `GET /web/rich` | `key` (callback_key from web response) |
| Summarizer | `GET /summarizer/search` | `key` (from web search with `summary=1`) |

## Basic Web Search

```bash
curl -s --compressed \
  "https://api.search.brave.com/res/v1/web/search?q=YOUR+QUERY&count=10" \
  -H "X-Subscription-Token: $BRAVE_SEARCH_API_KEY" \
  -H "Accept: application/json" \
  -H "Accept-Encoding: gzip" \
  -H "Cache-Control: no-cache"
```

Response fields you'll use most:
- `web.results[]` — array of results: `.title`, `.url`, `.description`, `.extra_snippets[]`
- `query.more_results_available` — boolean, check before fetching next page
- `locations.results[]` — local business POIs (if query is location-sensitive)
- `rich` — rich result hint (weather, stocks, etc. if `enable_rich_callback=1`)

## Pagination

Web search: max `count=20`, `offset` 0–9 (so max 200 results total).
News search: max `count=50`, `offset` 0–9.
Only paginate if `query.more_results_available` is `true`.

## Freshness Filter

| Value | Meaning |
|-------|---------|
| `pd` | Past 24 hours |
| `pw` | Past 7 days |
| `pm` | Past 31 days |
| `py` | Past year |
| `2024-01-01to2024-06-30` | Custom date range |

## Rate Limits and Error Handling

| Code | Meaning |
|------|---------|
| 200 | Success (only successful requests are billed) |
| 401 | Invalid or missing API key |
| 422 | Validation error — usually missing `Cache-Control: no-cache` header |
| 429 | Rate limit exceeded |

On 429, read `X-RateLimit-Reset` from response headers and apply exponential backoff (1s → 2s → 4s).

Key rate limit headers on every response:
- `X-RateLimit-Limit` — requests allowed per window
- `X-RateLimit-Remaining` — requests left this window
- `X-RateLimit-Reset` — seconds until window resets

## Two-Step Workflows

Some endpoints require fetching an ID from web search first:

**Summarizer** — See [references/advanced.md](references/advanced.md) § Summarizer
**Local POIs + Descriptions** — See [references/advanced.md](references/advanced.md) § Local Search
**Rich Results** — See [references/advanced.md](references/advanced.md) § Rich Results

## Reference Files

- [references/web-search.md](references/web-search.md) — full web search params and response schema
- [references/media-search.md](references/media-search.md) — images, videos, news, suggest, spellcheck
- [references/advanced.md](references/advanced.md) — summarizer, local POIs, rich results, Goggles

## Search Operators (embed in `q`)

| Operator | Example | Effect |
|----------|---------|--------|
| Quotes | `"exact phrase"` | Exact match |
| Minus | `python -snake` | Exclude term |
| site: | `site:github.com` | Limit to domain |
| filetype: | `filetype:pdf` | Specific file type |
| intitle: | `intitle:security` | Term in page title |

## Key Gotchas

- POI IDs from `/local/pois` expire after ~8 hours — never store them
- Summarizer calls are **free** — only web search counts toward quota
- Local search requires the "Search plan" (not free tier)
- Image search default safesearch is `strict` (not `moderate` like web)
- Image search allows up to 200 results per request (vs 20 for web)
- `enable_rich_callback=1` must be explicitly set — rich results are opt-in
