# Search API, Enrichment APIs, and Small Web RSS

## Search API

`GET https://kagi.com/api/v0/search`

**Status**: Closed beta — contact support@kagi.com for access.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | yes | Search query |
| `limit` | int | no | Max number of results to return |

### Request Example

```bash
curl -H "Authorization: Bot $KAGI_API_KEY" \
  "https://kagi.com/api/v0/search?q=federated+identity+protocols&limit=10"
```

### Response Schema

`data` is an array of search objects. Each has a `t` field indicating type.

#### t: 0 — Search Result

```json
{
  "t": 0,
  "url": "https://example.com/article",
  "title": "Article title",
  "snippet": "Excerpt from the page describing the content.",
  "published": "2024-01-15T10:00:00Z",
  "thumbnail": {
    "url": "/proxy/img.jpg?c=HASH",
    "height": 200,
    "width": 300
  }
}
```

- `snippet` — optional; not all results have excerpts
- `published` — optional ISO 8601 timestamp
- `thumbnail` — optional; prepend `https://kagi.com` to construct full URL

#### t: 1 — Related Searches

```json
{
  "t": 1,
  "list": ["related query one", "related query two", "related query three"]
}
```

### Personalization

The Search API respects your account's:
- Website blocking/promotion lists (personal search preferences)
- Snippet length preference (from Search settings)

Results are meaningfully different from commodity search APIs because Kagi's index is built without SEO gaming as the primary ranking signal.

### Pricing

$25 per 1,000 queries ($0.025/search). No charge for errors.

---

## Web Enrichment API

`GET https://kagi.com/api/v0/enrich/web`

Returns results from Kagi's **Teclis** index — non-commercial websites, personal sites, indie content. Use alongside standard search to surface results that mainstream indexes bury.

**Not a general search engine.** Optimized for non-commercial queries. Use it to complement, not replace, the Search API.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | yes | Search query |

### Request Example

```bash
curl -H "Authorization: Bot $KAGI_API_KEY" \
  "https://kagi.com/api/v0/enrich/web?q=personal+knowledge+management"
```

### Response Schema

`data` is an array of Search Objects (same structure as Search API — `t: 0` results only).

```json
{
  "meta": { "id": "...", "node": "us-east", "ms": 88, "api_balance": 4.72 },
  "data": [
    {
      "t": 0,
      "url": "https://personalsite.example.com/notes",
      "title": "My PKM System",
      "snippet": "How I organize my notes using plain text files..."
    }
  ],
  "error": null
}
```

### Pricing

$2 per 1,000 searches ($0.002/search). **Only charged when non-zero results are returned.** Volume discounts available via support@kagi.com.

---

## News Enrichment API

`GET https://kagi.com/api/v0/enrich/news`

Returns results from Kagi's **TinyGem** index — non-commercial news sources, independent journalism, community discussions. Surfaces news that ad-driven indexes deprioritize.

**Not a general news search.** Best combined with mainstream news results.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | yes | Search query |

### Request Example

```bash
curl -H "Authorization: Bot $KAGI_API_KEY" \
  "https://kagi.com/api/v0/enrich/news?q=open+source+AI+tools"
```

### Response Schema

Same structure as Web Enrichment — array of `t: 0` Search Objects.

### Pricing

Same as Web Enrichment: $0.002/search, billed only on non-zero results.

---

## Small Web RSS Feed

`GET https://kagi.com/api/v1/smallweb/feed/`

**Free — no API key required.**

Returns an RSS feed of recent content from the non-commercial web: personal blogs, indie sites, hobbyist pages. The "small web" is content created for expression and knowledge-sharing, not monetization.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | no | Limit number of feed entries returned |

### Request Examples

```bash
# All recent small web entries
curl "https://kagi.com/api/v1/smallweb/feed/"

# Limit to 20 entries
curl "https://kagi.com/api/v1/smallweb/feed/?limit=20"
```

### Response Format

Standard RSS/Atom XML feed. Parse with any RSS library.

### Use Cases

- Discover non-commercial content for agent context
- Monitor indie web publishing trends
- Feed into summarization pipeline for daily digests
- Augment RAG corpora with non-mainstream sources

---

## Combining Enrichment with Search

Pattern for comprehensive coverage:

```python
import requests

headers = {"Authorization": f"Bot {KAGI_API_KEY}"}
query = "federated learning privacy"

# Run all three in parallel
import concurrent.futures

def fetch(endpoint):
    return requests.get(
        f"https://kagi.com/api/v0/{endpoint}?q={query}",
        headers=headers
    ).json()

with concurrent.futures.ThreadPoolExecutor() as ex:
    futures = {
        "search": ex.submit(fetch, "search"),
        "web": ex.submit(fetch, "enrich/web"),
        "news": ex.submit(fetch, "enrich/news"),
    }
    results = {k: v.result() for k, v in futures.items()}

# Merge and deduplicate by URL
seen = set()
combined = []
for source in results.values():
    for item in (source.get("data") or []):
        if item.get("t") == 0 and item["url"] not in seen:
            seen.add(item["url"])
            combined.append(item)
```
