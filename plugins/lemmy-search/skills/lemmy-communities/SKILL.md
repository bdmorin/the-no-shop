---
name: lemmy-communities
description: "Search and map communities across the Lemmy fediverse. Queries the top active Lemmy instances to build a unified community directory. Supports keyword filtering and JSON output. No API key required."
user-invokable: true
argument-hint: "lemmy-communities linux, lemmy-communities --json privacy, lemmy-communities gaming --limit 100"
allowed-tools: "Bash(curl *)"
license: MIT
metadata:
  version: "1.0.0"
  author: "Brian Morin"
  homepage: "https://github.com/bdmorin/the-no-shop"
  category: search
  endpoints:
    - lemmyverse-instances
    - lemmy-community-list
---

# Lemmy Community Search

Search communities across the Lemmy fediverse by querying multiple instances and aggregating results into a unified map.

## Data Sources

### 1. Lemmyverse Instance Index (instance discovery)

The lemmyverse.net project maintains a nightly-updated JSON index of all known Lemmy instances.

```bash
curl -s "https://data.lemmyverse.net/data/instance.full.json"
```

Returns a JSON array of instance objects. Key fields per instance:

| Field | Description |
|-------|-------------|
| `baseurl` | Domain name (e.g. `lemmy.world`) |
| `name` | Instance display name |
| `version` | Lemmy version string |
| `usage.users.activeMonth` | Monthly active users |
| `usage.localPosts` | Total local posts |
| `counts.communities` | Number of local communities |
| `fed` | Whether federation is enabled |
| `open` | Whether registration is open |

### 2. Lemmy API v3 — Community List (per-instance)

Each Lemmy instance exposes a public API to list its local communities:

```bash
curl -s "https://{domain}/api/v3/community/list?type_=Local&sort=Hot&limit=50&page=1"
```

#### Parameters

| Param | Values | Default | Notes |
|-------|--------|---------|-------|
| `type_` | `Local`, `All` | `Local` | Use `Local` to get only that instance's communities |
| `sort` | `Hot`, `New`, `TopAll`, `TopMonth`, `TopWeek`, `TopDay`, `Active`, `MostComments`, `NewComments` | `Hot` | Sort order |
| `limit` | 1–50 | 10 | Results per page |
| `page` | 1+ | 1 | Pagination |
| `show_nsfw` | `true`/`false` | `false` | Include NSFW communities |

#### Response Structure

```json
{
  "communities": [
    {
      "community": {
        "id": 123,
        "name": "linux",
        "title": "Linux",
        "description": "...",
        "actor_id": "https://lemmy.ml/c/linux",
        "local": true,
        "nsfw": false,
        "visibility": "Public"
      },
      "counts": {
        "subscribers": 45000,
        "posts": 12000,
        "comments": 85000,
        "users_active_month": 3200
      }
    }
  ]
}
```

## Execution Plan

When the user invokes `/lemmy-communities`, follow this procedure:

### Step 1: Parse Arguments

- **Search term**: Any bare argument (e.g. `linux`, `privacy`, `gaming`)
- **`--json`**: Output raw JSON instead of markdown table
- **`--limit N`**: Max communities to return (default: 50)
- **`--instances N`**: Number of top instances to query (default: 25)
- **`--sort SORT`**: Sort for per-instance queries (default: `Hot`)
- **`--all-pages`**: Paginate through all communities on each instance (slower)

### Step 2: Fetch Instance Index

```bash
curl -s "https://data.lemmyverse.net/data/instance.full.json"
```

Parse the JSON array. Sort instances by `usage.users.activeMonth` descending. Take the top N instances (default 25). Filter out instances where `fed` is `false`.

### Step 3: Query Each Instance

For each instance domain, fetch communities:

```bash
curl -s --connect-timeout 5 --max-time 10 \
  "https://{domain}/api/v3/community/list?type_=Local&sort={sort}&limit=50&page=1"
```

**Important**: Use `--connect-timeout 5 --max-time 10` to avoid hanging on dead instances. Some instances may be down or slow — skip failures silently and continue.

If `--all-pages` was specified, paginate: keep incrementing `page` while the response returns a non-empty `communities` array.

### Step 4: Aggregate and Filter

Combine all community results into a single list. For each community, extract:

- `name` — community name (e.g. `linux`)
- `title` — display title
- `instance` — the domain it came from
- `subscribers` — from `counts.subscribers`
- `posts` — from `counts.posts`
- `active_monthly` — from `counts.users_active_month`
- `url` — constructed as `https://{domain}/c/{name}`
- `description` — first 100 chars of description

If a **search term** was provided, filter communities where the `name`, `title`, or `description` contains the search term (case-insensitive).

Sort the final list by `subscribers` descending.

Apply `--limit` to cap the output (default 50).

### Step 5: Output

#### Default: Markdown Table

```markdown
## Lemmy Community Map

Searched {N} instances, found {M} communities{matching "search term"}.

| Community | Instance | Subscribers | Monthly Active | Posts | Link |
|-----------|----------|-------------|----------------|-------|------|
| Linux | lemmy.ml | 45,000 | 3,200 | 12,000 | [link](https://lemmy.ml/c/linux) |
| ...       | ...      | ...         | ...            | ...   | ...  |
```

#### With `--json` flag

Output a JSON array:

```json
[
  {
    "name": "linux",
    "title": "Linux",
    "instance": "lemmy.ml",
    "subscribers": 45000,
    "active_monthly": 3200,
    "posts": 12000,
    "url": "https://lemmy.ml/c/linux",
    "description": "..."
  }
]
```

## Parallelization

To speed up queries across many instances, run curl commands in parallel batches. Use background subshells or `xargs -P` to query 5–10 instances concurrently, writing results to temp files, then merge.

Example parallel pattern:

```bash
# Write instance domains to a file, then:
cat /tmp/lemmy_instances.txt | xargs -P 10 -I {} sh -c \
  'curl -s --connect-timeout 5 --max-time 10 "https://{}/api/v3/community/list?type_=Local&sort=Hot&limit=50&page=1" > /tmp/lemmy_results_{}.json 2>/dev/null || true'
```

## Error Handling

- Instance index fetch failure: Report error and abort
- Individual instance query failure: Skip silently, note count of failed instances in output footer
- Empty results: Report "No communities found" with suggestions to broaden search
- Timeout: 5s connect, 10s total per instance — do not retry

## Rate Limiting

The Lemmy API does not require authentication for public community listings. However, be respectful:
- Default to 25 instances max (covers >95% of active communities)
- Use timeouts to avoid hammering unresponsive servers
- Do not retry failed requests

## Notes on Lemmy API Versions

- Most instances run v0.19.x with API v3
- Lemmy 1.0 (API v4) is in alpha — v3 endpoints remain compatible
- The community list endpoint is stable across versions
- The `type_` parameter uses an underscore suffix (not `type`) to avoid keyword conflicts
