# Media Search — Images, Videos, News, Suggest, Spellcheck

## Image Search

`GET https://api.search.brave.com/res/v1/images/search`

| Parameter | Type | Default | Allowed | Description |
|-----------|------|---------|---------|-------------|
| `q` | string | required | any | Search query |
| `country` | string | — | ISO alpha-2 or `ALL` | `ALL` for worldwide results |
| `search_lang` | string | — | ISO 639-1 | Content language |
| `count` | integer | 50 | 1–200 | Results per request (much higher than web) |
| `safesearch` | string | `strict` | `off`, `strict` | Note: default is strict, not moderate |
| `spellcheck` | boolean | true | `true`, `false` | Auto-correct query |

### Image Response Schema

```json
{
  "type": "images",
  "query": { "original": "..." },
  "results": [
    {
      "type": "image_result",
      "title": "Image title",
      "url": "https://source-page.com",
      "source": "example.com",
      "page_fetched": "2024-01-15",
      "thumbnail": {
        "src": "https://imgs.search.brave.com/...",
        "width": 500,
        "height": 333
      },
      "properties": {
        "url": "https://original-image.com/photo.jpg",
        "placeholder": "https://imgs.search.brave.com/...small...",
        "width": 1920,
        "height": 1280
      }
    }
  ]
}
```

Key: `properties.url` is the direct image URL. `thumbnail.src` is Brave's privacy-proxied 500px-wide version. Thumbnails originate from Brave's servers — source servers never see end-user IPs.

---

## Video Search

`GET https://api.search.brave.com/res/v1/videos/search`

| Parameter | Type | Default | Allowed | Description |
|-----------|------|---------|---------|-------------|
| `q` | string | required | any | Search query |
| `count` | integer | 20 | 1–50 | Results per request |
| `country` | string | — | ISO alpha-2 | Target country |
| `search_lang` | string | — | ISO 639-1 | Content language |
| `ui_lang` | string | — | BCP 47 | UI language |
| `freshness` | string | — | `pd`, `pw`, `pm`, `py`, date range | Recency filter |
| `safesearch` | string | `moderate` | `off`, `moderate`, `strict` | Content filter |
| `spellcheck` | integer | 1 | `0`, `1` | Auto-correct |
| `offset` | integer | 0 | 0–9 | Pagination offset |

### Video Response Schema

```json
{
  "type": "videos",
  "query": { "original": "..." },
  "results": [
    {
      "type": "video_result",
      "url": "https://youtube.com/watch?v=...",
      "title": "Video title",
      "description": "Video description",
      "age": "2024-01-10",
      "page_age": "1 week ago",
      "video": {
        "duration": "12:34",
        "views": 150000,
        "creator": "Channel Name",
        "publisher": "YouTube",
        "thumbnail": {
          "src": "https://...",
          "original": "https://i.ytimg.com/..."
        }
      },
      "meta_url": {
        "scheme": "https",
        "netloc": "youtube.com",
        "hostname": "youtube.com",
        "favicon": "https://...",
        "path": "watch?v=..."
      },
      "thumbnail": {
        "src": "https://imgs.search.brave.com/...",
        "original": "https://..."
      }
    }
  ]
}
```

---

## News Search

`GET https://api.search.brave.com/res/v1/news/search`

| Parameter | Type | Default | Allowed | Description |
|-----------|------|---------|---------|-------------|
| `q` | string | required | any | Search query |
| `count` | integer | 20 | 1–50 | Results per request |
| `country` | string | — | ISO alpha-2 | Target country |
| `search_lang` | string | — | ISO 639-1 | Content language |
| `ui_lang` | string | — | BCP 47 | UI language |
| `freshness` | string | — | `pd`, `pw`, `pm`, `py`, date range | Critical for news — always set this |
| `safesearch` | string | `moderate` | `off`, `moderate`, `strict` | Content filter |
| `extra_snippets` | boolean | false | `true`, `false` | Up to 5 excerpts per article |
| `spellcheck` | integer | 1 | `0`, `1` | Auto-correct |
| `offset` | integer | 0 | 0–9 | Pagination offset |
| `goggles_id` | string | — | URL or ID | Custom re-ranking filter |

### News Response Schema

```json
{
  "type": "news",
  "query": { "original": "..." },
  "results": [
    {
      "type": "news_result",
      "url": "https://example.com/article",
      "title": "Article headline",
      "description": "Article excerpt or lede",
      "age": "2024-01-15T14:30:00",
      "page_age": "2 hours ago",
      "breaking": false,
      "thumbnail": {
        "src": "https://imgs.search.brave.com/..."
      },
      "meta_url": {
        "scheme": "https",
        "netloc": "example.com",
        "hostname": "example.com",
        "favicon": "https://...",
        "path": "/article"
      },
      "extra_snippets": ["paragraph 1...", "paragraph 2..."]
    }
  ]
}
```

For breaking news monitoring, combine `freshness=pd` (past 24h) with `extra_snippets=true`.

---

## Suggest (Autocomplete)

`GET https://api.search.brave.com/res/v1/suggest/search`

Returns query suggestions as the user types — useful for building autocomplete UIs or expanding queries.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | required | Partial query |
| `count` | integer | 5 | Number of suggestions |
| `country` | string | — | ISO alpha-2 |
| `search_lang` | string | — | ISO 639-1 |
| `rich` | boolean | false | Include rich suggestion metadata |

### Suggest Response

```json
{
  "type": "suggest",
  "query": "open sou",
  "results": [
    { "type": "suggest_result", "query": "open source projects", "is_entity": false },
    { "type": "suggest_result", "query": "open source software", "is_entity": false },
    { "type": "suggest_result", "query": "open source licenses", "is_entity": false }
  ]
}
```

---

## Spellcheck

`GET https://api.search.brave.com/res/v1/spellcheck/search`

Returns corrected query. Useful for validating/correcting user input before searching.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | required | Query to check |
| `country` | string | — | ISO alpha-2 |
| `search_lang` | string | — | ISO 639-1 |

### Spellcheck Response

```json
{
  "type": "spellcheck",
  "results": [
    {
      "type": "spellcheck_result",
      "query": "open source",
      "altered": "open source",
      "changed": false
    }
  ]
}
```

If `changed` is `true`, use `altered` as the corrected query for subsequent searches.
