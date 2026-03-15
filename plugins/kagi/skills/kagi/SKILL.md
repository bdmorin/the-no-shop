---
name: kagi
description: "Kagi API covering privacy-first web search, Universal Summarizer (URL/text/PDF/audio/YouTube, 3 engines, 26 languages), FastGPT (LLM Q&A with cited sources), Web and News Enrichment (non-commercial Teclis/TinyGem indexes), and Small Web RSS feed (free). Triggers on any request for web search, document summarization, AI-answered questions, small-web content, or enrichment of search results. Requires KAGI_API_KEY."
user-invokable: true
argument-hint: "kagi search rust async, kagi summarize https://example.com/paper.pdf, kagi ask what is ZTNA, kagi enrich web privacy tools, kagi smallweb"
allowed-tools: "Bash(curl *)"
license: MIT
metadata:
  version: "1.0.0"
  author: "Brian Morin"
  homepage: "https://github.com/bdmorin/the-no-shop"
  category: search
  api_status: "v0 beta"
  requires:
    env:
      - KAGI_API_KEY
  endpoints:
    - search
    - summarizer
    - fastgpt
    - enrich-web
    - enrich-news
    - smallweb-rss
---

# Kagi API

Base URL: `https://kagi.com/api/v0`
Small Web RSS base: `https://kagi.com/api/v1`

API is in **v0 beta** — breaking changes possible. All responses are JSON.

## Authentication

Every request requires:

```
Authorization: Bot <KAGI_API_KEY>
```

Token is shown once on generation. Generating a new token invalidates the previous one. Optional IP allowlist configurable in Search API settings.

Get key: `https://kagi.com/settings/api`
Add credits: `https://kagi.com/settings/billing_api`

## Endpoints — Quick Reference

| Endpoint | Method | Path | Cost |
|----------|--------|------|------|
| Search | GET | `/search` | $0.025/query |
| Summarizer | GET/POST | `/summarize` | $0.030/1K tokens (Cecil/Agnes), $1 flat (Muriel) |
| FastGPT | POST | `/fastgpt` | $0.015/query |
| Enrich Web | GET | `/enrich/web` | $0.002/search (only if results returned) |
| Enrich News | GET | `/enrich/news` | $0.002/search (only if results returned) |
| Small Web RSS | GET | `/v1/smallweb/feed/` | Free |

## Universal Response Envelope

Every response follows this structure:

```json
{
  "meta": {
    "id": "uuid",
    "node": "us-east",
    "ms": 143,
    "api_balance": 4.82
  },
  "data": { ... },
  "error": null
}
```

`meta.api_balance` — remaining dollars. Track this. `error` is null on success, an array of error objects on failure.

## Error Codes

| Code | Meaning |
|------|---------|
| 0 | Internal error |
| 1 | Malformed request |
| 2 | Unauthorized |
| 100 | No billing information |
| 101 | Insufficient credit |
| 200 | Summarize failed |

## Basic Search

```bash
curl -H "Authorization: Bot $(printenv KAGI_API_KEY)" \
  "https://kagi.com/api/v0/search?q=your+query&limit=10"
```

Response `data` is an array of search objects identified by `t` field:
- `t: 0` — search result (`url`, `title`, `snippet`, `published`, `thumbnail`)
- `t: 1` — related searches (`list` array of strings)

## Basic Summarize

```bash
# Summarize a URL
curl -H "Authorization: Bot $(printenv KAGI_API_KEY)" \
  "https://kagi.com/api/v0/summarize?url=https://example.com/paper.pdf"

# Summarize text (use POST to avoid URL length limits)
curl -X POST -H "Authorization: Bot $(printenv KAGI_API_KEY)" \
  -H "Content-Type: application/json" \
  -d '{"text": "Your long text here...", "engine": "agnes"}' \
  "https://kagi.com/api/v0/summarize"
```

## Basic FastGPT

```bash
curl -X POST -H "Authorization: Bot $(printenv KAGI_API_KEY)" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is ZTNA?"}' \
  "https://kagi.com/api/v0/fastgpt"
```

## Image Proxy URLs

API results may return bare image paths — prepend `https://kagi.com`:

```
/proxy/filename.jpg?c=HASH  →  https://kagi.com/proxy/filename.jpg?c=HASH
```

The `c=` parameter is a cryptographic hash that validates the proxy request.

## Key Gotchas

- **Search API is invite-only** — email support@kagi.com for access
- **Cached responses are always free** — both Summarizer and FastGPT
- **Enrichment only billed when results returned** — zero-result queries cost nothing
- **Summarizer text POST** — use POST for text input to avoid URL length limits; max 1MB
- **Muriel engine** — $1 flat regardless of token count; use for high-stakes summaries
- **`web_search` in FastGPT is currently out of service** — `web_search: false` is the only functioning mode
- **Token shown once** — store it immediately; can't retrieve it again
- **Ultimate plan discount** — Summarizer drops to $0.025/1K tokens on Ultimate plan

## Reference Files

- [references/search-and-enrich.md](references/search-and-enrich.md) — Search API params/response, Enrich web/news, Small Web RSS
- [references/summarizer.md](references/summarizer.md) — Summarizer engines, languages, file types, full params
- [references/fastgpt.md](references/fastgpt.md) — FastGPT params, response schema, reference object
