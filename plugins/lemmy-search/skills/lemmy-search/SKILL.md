---
name: lemmy-search
description: "Search for communities across the Lemmyverse. Queries Lemmy instance APIs to discover communities by keyword, list trending communities, or explore specific instances. Works against any Lemmy instance's public v3 API — no API key required. Default instance: lemmy.ml (flagship). Use --instance to target others (lemmy.world, programming.dev, etc.)."
user-invokable: true
argument-hint: "lemmy-search rust programming, lemmy-search --instance lemmy.world linux, lemmy-search --list --sort Hot, lemmy-search --info technology@lemmy.ml"
allowed-tools: "Bash(curl *)"
license: MIT
metadata:
  version: "1.0.0"
  author: "Brian Morin"
  homepage: "https://github.com/bdmorin/the-no-shop"
  category: search
  requires:
    env: []
  endpoints:
    - search
    - community-list
    - community-get
---

# Lemmy Community Search

Search for communities across the Lemmyverse using any Lemmy instance's public API v3.

**No API key required** — all endpoints are public.

## Default Instance

`https://lemmy.ml` (flagship instance, federates widely)

Override with `--instance <domain>`:
- `lemmy.world` — largest instance
- `programming.dev` — tech-focused
- `lemmy.dbzer0.com` — general purpose
- `sopuli.xyz` — EU-based
- `sh.itjust.works` — general purpose

## Quick Reference

| Action | Command Pattern |
|--------|----------------|
| Search communities | `lemmy-search <query>` |
| Search on specific instance | `lemmy-search --instance lemmy.world <query>` |
| List communities | `lemmy-search --list --sort Hot` |
| Get community details | `lemmy-search --info <community_name>` |

## Search Communities

Search across posts, comments, communities, and users. Filter to communities with `type_=Communities`.

```bash
curl -s "https://lemmy.ml/api/v3/search?q=QUERY&type_=Communities&limit=20&sort=TopAll&listing_type=All" \
  -H "Accept: application/json" | jq '.communities[] | {name: .community.name, title: .community.title, instance: .community.actor_id, subscribers: .counts.subscribers, posts: .counts.posts, description: .community.description}'
```

### Search Parameters

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | **Required.** Search query |
| `type_` | string | `Communities` to filter to communities only. Also: `All`, `Posts`, `Comments`, `Users`, `Url` |
| `limit` | int | Results per page, 1–50 (default 10) |
| `page` | int | Page number for pagination (1-indexed) |
| `sort` | string | `TopAll`, `Hot`, `New`, `Old`, `Active`, `MostComments` |
| `listing_type` | string | `All` (federated), `Local` (instance-only) |

### Search Response Shape

```json
{
  "type_": "Communities",
  "communities": [
    {
      "community": {
        "id": 123,
        "name": "rust",
        "title": "The Rust Programming Language",
        "description": "...",
        "actor_id": "https://programming.dev/c/rust",
        "subscribers": 5432,
        "icon": "https://...",
        "banner": "https://...",
        "nsfw": false,
        "posting_restricted_to_mods": false
      },
      "counts": {
        "subscribers": 5432,
        "posts": 1200,
        "comments": 8500,
        "users_active_month": 300
      },
      "subscribed": "NotSubscribed"
    }
  ]
}
```

## List Communities

Browse communities on an instance without a search query.

```bash
curl -s "https://lemmy.ml/api/v3/community/list?sort=Hot&limit=20&listing_type=All" \
  -H "Accept: application/json" | jq '.communities[] | {name: .community.name, title: .community.title, subscribers: .counts.subscribers, active: .counts.users_active_month}'
```

### List Parameters

| Param | Type | Description |
|-------|------|-------------|
| `sort` | string | `Hot`, `New`, `Old`, `Active`, `TopAll`, `TopMonth`, `TopWeek`, `TopDay`, `MostComments` |
| `limit` | int | 1–50 (default 10) |
| `page` | int | Page number (1-indexed) |
| `listing_type` | string | `All`, `Local` |
| `show_nsfw` | bool | Include NSFW communities (default false) |

## Get Community Details

Fetch a specific community by name (for cross-instance lookup, use `name@instance`).

```bash
curl -s "https://lemmy.ml/api/v3/community?name=technology" \
  -H "Accept: application/json" | jq '{name: .community_view.community.name, title: .community_view.community.title, description: .community_view.community.description, subscribers: .community_view.counts.subscribers, posts: .community_view.counts.posts, active_month: .community_view.counts.users_active_month}'
```

For a community on another instance:
```bash
curl -s "https://lemmy.ml/api/v3/community?name=linux@lemmy.world" \
  -H "Accept: application/json"
```

## Multi-Instance Search

To search broadly, query multiple large instances and deduplicate by `actor_id`:

```bash
for instance in lemmy.ml lemmy.world programming.dev sh.itjust.works; do
  curl -s "https://$instance/api/v3/search?q=QUERY&type_=Communities&limit=10&listing_type=All" \
    -H "Accept: application/json"
done
```

## Formatting Results

When presenting results to the user, format as a table:

```
| Community | Instance | Subscribers | Monthly Active | Description |
|-----------|----------|-------------|----------------|-------------|
| rust | programming.dev | 5,432 | 300 | The Rust Programming Language |
```

Include the web URL: `https://<instance>/c/<community_name>`

## Error Handling

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request — check parameters |
| 404 | Community not found |
| 500 | Instance error — try another instance |
| Connection refused | Instance may be down — try another |

On connection failure, retry once after 2s, then try the next instance.

## Reference Files

- [references/instances.md](references/instances.md) — curated list of popular Lemmy instances
