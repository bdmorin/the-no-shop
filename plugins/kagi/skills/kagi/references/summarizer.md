# Universal Summarizer API — Full Reference

`GET/POST https://kagi.com/api/v0/summarize`

Summarizes any content: web pages, PDFs, Word docs, PowerPoint, audio (mp3/wav), YouTube videos (experimental), and scanned documents (OCR). Handles content of any length.

## Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | yes* | URL of document to summarize |
| `text` | string | yes* | Raw text content to summarize |
| `engine` | string | no | `cecil` (default), `agnes`, `muriel` |
| `summary_type` | string | no | `summary` (default) or `takeaway` |
| `target_language` | string | no | Language code for output translation |
| `cache` | bool | no | Allow caching (default: `true`) |

*Either `url` or `text` required, not both. Max request size: 1MB.

## Engines

| Engine | Style | Cost | Use When |
|--------|-------|------|----------|
| `cecil` | Friendly, descriptive, fast | $0.030/1K tokens | Default; general purpose |
| `agnes` | Formal, technical, analytical | $0.030/1K tokens | Technical docs, papers, reports |
| `muriel` | Best-in-class, enterprise-grade | $1.00 flat/request | High-stakes; when quality matters most |

Cecil and Agnes: billed per token (input + output combined). Requests over 10,000 tokens billed as 10,000 tokens. Muriel: flat $1 regardless of length.

Ultimate plan: Cecil/Agnes drop to $0.025/1K tokens.

**Cached responses are always free.** Calling `summarize` on the same URL twice — the second call costs nothing.

## Summary Types

- `summary` — narrative prose summary of the content
- `takeaway` — bulleted key points, action items, or main conclusions

## Supported File Types

| Type | Notes |
|------|-------|
| Web pages | Any publicly accessible URL |
| PDF | Direct PDF URLs |
| PowerPoint (.pptx) | Slide content extracted |
| Word (.docx) | Document content extracted |
| Audio (mp3, wav) | Transcribed then summarized |
| YouTube URLs | Experimental support |
| Scanned documents | OCR processing |

## Privacy

For sensitive documents: set `cache: false` to prevent Kagi retaining the document.

```json
{"url": "https://internal.example.com/confidential.pdf", "cache": false}
```

## Request Examples

### Summarize a URL (GET)

```bash
curl -H "Authorization: Bot $(printenv KAGI_API_KEY)" \
  "https://kagi.com/api/v0/summarize?url=https://arxiv.org/abs/2301.00001&engine=agnes&summary_type=takeaway"
```

### Summarize text (POST — preferred for text to avoid URL limits)

```bash
curl -X POST \
  -H "Authorization: Bot $(printenv KAGI_API_KEY)" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Full text content here...",
    "engine": "agnes",
    "summary_type": "summary",
    "target_language": "EN"
  }' \
  "https://kagi.com/api/v0/summarize"
```

### Summarize a YouTube video

```bash
curl -H "Authorization: Bot $(printenv KAGI_API_KEY)" \
  "https://kagi.com/api/v0/summarize?url=https://www.youtube.com/watch?v=VIDEO_ID&engine=cecil"
```

### Translate summary to another language

```bash
curl -H "Authorization: Bot $(printenv KAGI_API_KEY)" \
  "https://kagi.com/api/v0/summarize?url=https://example.de/article&target_language=EN"
```

## Response Schema

```json
{
  "meta": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "node": "us-east",
    "ms": 7943,
    "api_balance": 4.61
  },
  "data": {
    "output": "This paper presents a novel approach to...",
    "tokens": 11757
  },
  "error": null
}
```

- `data.output` — the generated summary or takeaway text
- `data.tokens` — tokens consumed (for billing reference)
- `meta.api_balance` — remaining credits after this call

## Supported Languages (target_language codes)

| Code | Language | Code | Language |
|------|----------|------|----------|
| `BG` | Bulgarian | `LT` | Lithuanian |
| `CS` | Czech | `LV` | Latvian |
| `DA` | Danish | `NL` | Dutch |
| `DE` | German | `PL` | Polish |
| `EL` | Greek | `PT` | Portuguese |
| `EN` | English | `RO` | Romanian |
| `ES` | Spanish | `RU` | Russian |
| `ET` | Estonian | `SK` | Slovak |
| `FI` | Finnish | `SL` | Slovenian |
| `FR` | French | `SV` | Swedish |
| `HU` | Hungarian | `TR` | Turkish |
| `IT` | Italian | `UK` | Ukrainian |
| `JA` | Japanese | `ZH` | Chinese |

## Python Example

```python
import requests
import os

KAGI_API_KEY = os.environ["KAGI_API_KEY"]
headers = {"Authorization": f"Bot {KAGI_API_KEY}"}

def summarize_url(url: str, engine: str = "cecil", summary_type: str = "summary") -> str:
    resp = requests.get(
        "https://kagi.com/api/v0/summarize",
        headers=headers,
        params={"url": url, "engine": engine, "summary_type": summary_type}
    )
    resp.raise_for_status()
    result = resp.json()
    if result.get("error"):
        raise ValueError(result["error"])
    return result["data"]["output"]

def summarize_text(text: str, engine: str = "agnes", target_language: str = None) -> str:
    payload = {"text": text, "engine": engine, "cache": False}
    if target_language:
        payload["target_language"] = target_language
    resp = requests.post(
        "https://kagi.com/api/v0/summarize",
        headers=headers,
        json=payload
    )
    resp.raise_for_status()
    return resp.json()["data"]["output"]
```

## Cost Estimation

```python
# Cecil/Agnes: ~$0.030 per 1K tokens
# Tokens = input tokens + output tokens, capped at 10K
# A typical 5-page PDF ≈ 3,000 tokens ≈ $0.09

# Muriel: flat $1.00 per request
# Break-even vs Muriel: >33K tokens
```
