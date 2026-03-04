# Web Search — Full Reference

Endpoint: `GET https://api.search.brave.com/res/v1/web/search`

## All Query Parameters

| Parameter | Type | Default | Allowed | Description |
|-----------|------|---------|---------|-------------|
| `q` | string | required | any | Search query. Supports operators (site:, filetype:, quotes, minus). |
| `count` | integer | 20 | 1–20 | Max results per page. Actual may be less. |
| `offset` | integer | 0 | 0–9 | 0-based page offset. Page 2 = offset 1. |
| `country` | string | — | ISO 3166-1 alpha-2 | Target country (e.g., `us`, `de`, `gb`). |
| `search_lang` | string | `en` | ISO 639-1 | Content language filter. |
| `ui_lang` | string | — | BCP 47 (e.g., `en-US`) | Language for response metadata. |
| `safesearch` | string | `moderate` | `off`, `moderate`, `strict` | Adult content filtering. |
| `freshness` | string | — | `pd`, `pw`, `pm`, `py`, or date range | Recency filter. |
| `extra_snippets` | boolean | false | `true`, `false` | Up to 5 additional excerpts per result. |
| `enable_rich_callback` | integer | 0 | `0`, `1` | Enable rich data (weather, stocks, etc.). |
| `summary` | integer | — | `1` | Request AI summarizer key (free endpoint). |
| `spellcheck` | integer | 1 | `0`, `1` | Auto-correct query spelling. |
| `result_filter` | string | — | comma-list | Limit result types (e.g., `web,news`). |
| `goggles_id` | string | — | URL or ID | Apply a Goggle re-ranking filter. |
| `units` | string | — | `metric`, `imperial` | Unit system for local/rich results. |

## Response Schema

### Top-level fields

```json
{
  "type": "search",
  "query": { ... },
  "web": { ... },
  "locations": { ... },
  "news": { ... },
  "videos": { ... },
  "rich": { ... },
  "summarizer": { ... }
}
```

### query object

```json
{
  "original": "open source projects",
  "show_strict_warning": false,
  "is_navigational": false,
  "is_news_breaking": false,
  "spellcheck_off": false,
  "country": "us",
  "bad_results": false,
  "should_fallback": false,
  "postal_code": "",
  "city": "",
  "header_country": "",
  "more_results_available": true,
  "state": ""
}
```

`more_results_available` — check this before fetching the next page.

### web.results[] item

```json
{
  "type": "search_result",
  "index": 0,
  "title": "Page title",
  "url": "https://example.com",
  "is_source_local": false,
  "is_source_both": false,
  "description": "Main snippet text extracted from the page.",
  "page_age": "2024-01-15",
  "page_fetched": "2024-01-20T10:00:00",
  "profile": {
    "name": "Example Site",
    "long_name": "example.com",
    "url": "https://example.com",
    "img": "https://imgs.search.brave.com/..."
  },
  "language": "en",
  "family_friendly": true,
  "extra_snippets": [
    "Additional excerpt 1",
    "Additional excerpt 2"
  ]
}
```

`extra_snippets` — only populated when `extra_snippets=true` is set. Up to 5 items.

### locations.results[] item (when query has local intent)

```json
{
  "type": "location_result",
  "id": "a3b4c5d6e7f8...",
  "provider_url": "https://...",
  "coordinates": [37.7749, -122.4194],
  "zoom_level": 15,
  "thumbnail": { ... },
  "postal_address": { ... },
  "opening_hours": { ... },
  "contact": { ... },
  "ratings": { ... },
  "categories": ["Restaurant"]
}
```

**id field expires in ~8 hours — do not persist for later use.**

### summarizer object (when summary=1 was requested)

```json
{
  "type": "summarizer",
  "key": "opaque-key-string-use-for-summarizer-endpoint"
}
```

Pass this `key` to `/res/v1/summarizer/search?key=<key>` to get the AI summary.

### rich object (when enable_rich_callback=1)

```json
{
  "type": "rich",
  "results": {
    "hint": {
      "vertical": "weather",
      "callback_key": "opaque-callback-key"
    }
  }
}
```

Verticals: `weather`, `stocks`, `sports`, `cryptocurrency`, `currency_conversion`, `calculator`, `definitions`, `time`.
Pass `callback_key` to `/res/v1/web/rich?key=<callback_key>` for the full data.

## Pagination Example

```bash
# Page 1
curl -s --compressed \
  "https://api.search.brave.com/res/v1/web/search?q=rust+async&count=20&offset=0" \
  -H "X-Subscription-Token: $BRAVE_SEARCH_API_KEY" \
  -H "Accept: application/json" -H "Accept-Encoding: gzip" -H "Cache-Control: no-cache"

# Page 2 (only if more_results_available=true)
curl -s --compressed \
  "https://api.search.brave.com/res/v1/web/search?q=rust+async&count=20&offset=1" \
  -H "X-Subscription-Token: $BRAVE_SEARCH_API_KEY" \
  -H "Accept: application/json" -H "Accept-Encoding: gzip" -H "Cache-Control: no-cache"
```

## Localized Search Example

```bash
curl -s --compressed \
  "https://api.search.brave.com/res/v1/web/search?q=nachhaltige+energie&country=de&search_lang=de&ui_lang=de-DE" \
  -H "X-Subscription-Token: $BRAVE_SEARCH_API_KEY" \
  -H "Accept: application/json" -H "Accept-Encoding: gzip" -H "Cache-Control: no-cache"
```
