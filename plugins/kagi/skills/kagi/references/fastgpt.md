# FastGPT API — Full Reference

`POST https://kagi.com/api/v0/fastgpt`

LLM-powered question answering with integrated web search and cited sources. Returns a direct answer plus the search results it drew from. Cheaper and faster than full chat completions for factual queries.

## Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | yes | The question to answer |
| `cache` | bool | no | Allow cached responses (default: `true`) |
| `web_search` | bool | no | **Currently out of service** — do not rely on this parameter |

**Cached responses are free.** Asking the same question twice — the second call costs nothing.

`web_search` is documented but out of service. All queries currently run with web search active.

## Pricing

$0.015/query ($15 per 1,000 queries) with web search.

## Request Example

```bash
curl -X POST \
  -H "Authorization: Bot $(printenv KAGI_API_KEY)" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the difference between ZTNA and VPN?"}' \
  "https://kagi.com/api/v0/fastgpt"
```

## Response Schema

```json
{
  "meta": {
    "id": "uuid",
    "node": "us-east",
    "ms": 2341,
    "api_balance": 4.59
  },
  "data": {
    "output": "Zero Trust Network Access (ZTNA) differs from VPNs in several key ways...",
    "references": [
      {
        "title": "ZTNA vs VPN: Key Differences Explained",
        "snippet": "ZTNA grants access based on identity and context rather than network location...",
        "url": "https://example.com/ztna-vs-vpn"
      },
      {
        "title": "Understanding Zero Trust Architecture",
        "snippet": "Unlike VPNs which create an encrypted tunnel to the entire network...",
        "url": "https://example.com/zero-trust"
      }
    ],
    "tokens": 843
  },
  "error": null
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `data.output` | string | The generated answer |
| `data.references` | array | Search results cited in the answer |
| `data.tokens` | int | Tokens consumed |
| `meta.api_balance` | float | Remaining credits |

### Reference Object

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Source page title |
| `snippet` | string | Relevant excerpt from the source |
| `url` | string | Full URL of the source |

## Python Example

```python
import requests
import os

KAGI_API_KEY = os.environ["KAGI_API_KEY"]

def ask(query: str, cache: bool = True) -> dict:
    resp = requests.post(
        "https://kagi.com/api/v0/fastgpt",
        headers={"Authorization": f"Bot {KAGI_API_KEY}"},
        json={"query": query, "cache": cache}
    )
    resp.raise_for_status()
    result = resp.json()
    if result.get("error"):
        raise ValueError(result["error"])
    return {
        "answer": result["data"]["output"],
        "sources": result["data"]["references"],
        "tokens": result["data"]["tokens"],
        "balance_remaining": result["meta"]["api_balance"]
    }

# Usage
result = ask("What caused the 2003 Northeast blackout?")
print(result["answer"])
for ref in result["sources"]:
    print(f"  [{ref['title']}]({ref['url']})")
```

## FastGPT vs Summarizer — When to Use Which

| Use case | Tool | Why |
|----------|------|-----|
| Answer a factual question | FastGPT | Real-time search + synthesis in one call |
| Summarize a specific document | Summarizer | Direct content extraction, no search needed |
| Translate a summary | Summarizer | `target_language` param |
| Get cited sources for a topic | FastGPT | References array |
| Process a PDF or audio file | Summarizer | File type support |
| Ask about a YouTube video | Either | FastGPT for Q&A, Summarizer for full summary |

## FastGPT vs Kagi Search — When to Use Which

| Use case | Tool |
|----------|------|
| Get a direct answer with citations | FastGPT |
| Get a list of results to browse | Search API |
| Need ranked URLs + snippets | Search API |
| Need synthesized prose answer | FastGPT |
| Build a results UI | Search API |
| Build a Q&A bot | FastGPT |
