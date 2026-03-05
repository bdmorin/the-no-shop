# Notion Skill Design — Pure Skill, No MCP

**Date**: 2026-03-05
**Status**: Approved
**Author**: Brian Morin (agent-assisted)

## Context

Brian signed up for a Notion business account for PKM/Second Brain use. The integration
must be skill-native — no MCP server, no daemon, no runtime. Claude learns the Notion API
and hits it directly with curl, matching the kagi/brave-search plugin pattern.

A parallel session (41773dba) designed the workspace schema: 5 relational databases
(Projects, Tasks, Notes, Research, Journal) with a Database Backbone approach and Notes
as a catch-all with Type discriminator.

## API Version

**Notion API 2025-09-03** — the latest version with breaking changes. Key change:
databases now contain "data sources" with independent schemas. All query/create operations
require `data_source_id` (not `database_id`). Discovery step required:
`GET /v1/databases/{id}` → extract `data_sources[0].id`.

## Architecture

Pure skill plugin. No binary, no npm, no build step.

```
plugins/notion/
  .claude-plugin/plugin.json
  skills/notion/
    SKILL.md                      # Core: auth, discovery, CRUD recipes, common operations
    references/
      data-sources.md             # Query, filter, sort (2025-09-03 data source API)
      pages.md                    # Create, update, retrieve, archive pages
      blocks.md                   # Read/append block content (paragraphs, headings, code, lists)
      search.md                   # Search API (pages + data sources)
      property-types.md           # Property value JSON formats for all types
      brian-pkm-schema.md         # Brian's 5 databases: real IDs, properties, relation map, recipes
```

### SKILL.md Frontmatter

```yaml
name: notion
description: "Notion API for PKM: create/query/update pages, databases, blocks, and search.
  Covers Projects, Tasks, Notes, Research, and Journal databases. API version 2025-09-03
  with data source support. Requires NOTION_API_KEY."
user-invokable: true
argument-hint: "notion add task 'Fix login bug' --project zeroclaw --priority P1,
  notion search 'webhook payload', notion add note --type Decision 'Use Bun over Node',
  notion journal 'Productive day, shipped the notion skill', notion query research --project yntk"
allowed-tools: "Bash(curl *)"
```

### Authentication

```
Authorization: Bearer $NOTION_API_KEY
Notion-Version: 2025-09-03
Content-Type: application/json
```

Token from internal integration at notion.so/profile/integrations.
Stored as `NOTION_API_KEY` env var (matches kagi/brave-search pattern).

## Database Schema (from session 41773dba)

### 5 Core Databases

| Database | Purpose | Key Properties |
|----------|---------|----------------|
| Projects | Active projects + areas | Name (title), Status (select: Active/Paused/Done/Archived), Area (select), Tags (multi-select), Start Date (date), URL (url) |
| Tasks | Action items | Name (title), Status (select: Todo/In Progress/Done/Blocked), Priority (select: P0/P1/P2/P3), Project (relation→Projects), Due Date (date), Assignee (rich_text) |
| Notes | Catch-all captures | Name (title), Type (select: Note/Meeting/Idea/Decision/Bookmark/Contact), Project (relation→Projects), Tags (multi-select), URL (url), Created (created_time) |
| Research | Agent outputs | Name (title), Source (url), Summary (rich_text), Project (relation→Projects), Agent (select), Tags (multi-select), Date (date) |
| Journal | Daily entries | Date (title), Mood (select), Energy (select), Body (rich_text), Tags (multi-select) |

### Relations

- Tasks → Projects (many-to-one)
- Notes → Projects (many-to-one)
- Research → Projects (many-to-one)

### The `brian-pkm-schema.md` Reference

Once databases are created, this file contains:
- Real database_id and data_source_id for each database
- Full property schema per database
- Pre-built curl recipes for common operations:
  - Add a task with project relation
  - Quick capture a note
  - Log research from an agent pipeline
  - Create a journal entry
  - Search across all databases
  - Query tasks by project and status

## Setup Prerequisites

1. Create internal integration at notion.so/profile/integrations (name: "claude-pkm")
2. Copy the Internal Integration Secret (starts with `ntn_`)
3. Set `NOTION_API_KEY` in shell profile or .env
4. Create the 5 databases in Notion workspace
5. Share each database with the integration (Share → Invite → claude-pkm)
6. Resolve database_id → data_source_id for each database
7. Populate `brian-pkm-schema.md` with real IDs

## Key API Patterns

### Discovery (required for every database operation)

```bash
# Get database and extract data_source_id
curl -s https://api.notion.com/v1/databases/$DB_ID \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" | jq '.data_sources[0].id'
```

### Page Creation (add a row to a database)

```bash
curl -X POST https://api.notion.com/v1/pages \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": {"data_source_id": "'$DS_ID'", "type": "data_source_id"},
    "properties": {
      "Name": {"title": [{"text": {"content": "Page title"}}]}
    }
  }'
```

### Query (filter + sort)

```bash
curl -X POST https://api.notion.com/v1/data_sources/$DS_ID/query \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {"property": "Status", "select": {"equals": "Active"}},
    "sorts": [{"property": "Name", "direction": "ascending"}]
  }'
```

## Non-Goals

- No MCP server
- No daemon process
- No TypeScript/Bun runtime
- No OAuth (internal integration only)
- No Notion app automation (only API)
- No migration tooling (manual for now)
