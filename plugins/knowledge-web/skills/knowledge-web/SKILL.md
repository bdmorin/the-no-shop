---
name: knowledge-web
description: "Build Obsidian knowledge vaults from structured research data. Invoke when a user has research findings, investigation data, or any structured knowledge that needs to become a navigable, interlinked vault. Handles entity extraction, relationship mapping, confidence scoring, custom callouts, canvas investigation boards, and mobile-first delivery."
user-invokable: true
argument-hint: "/knowledge-web <topic>, /knowledge-web from <path/to/data.json>, /knowledge-web plan <topic>"
allowed-tools: "Bash(bun *), Write, Read, Glob, Grep, Edit, Agent"
license: MIT
metadata:
  version: "1.0.0"
  author: "Brian Morin"
  homepage: "https://github.com/bdmorin/the-no-shop"
  category: productivity
---

# Knowledge Web — Research to Obsidian Vault Pipeline

Transform structured research into navigable Obsidian knowledge vaults. Touch a fact, follow its connections. Every claim sourced. Every relationship bidirectional. Every uncertainty explicit.

## When to Use This Skill

- You have research findings on any topic and need them organized as an interlinked knowledge base
- An investigation, analysis, or research project has accumulated enough entities and relationships to benefit from a graph
- The audience needs a local-first, offline-capable, mobile-friendly way to explore connected information
- You need information compartmentalization (multiple audiences, different access levels)

## The Pipeline (7 Stages)

### Stage 1: Source Collection

Gather raw research as markdown files. No structure required — capture first, structure second.

```
research/
  2026-03-06-topic-subtopic.md    # Timestamped, standalone findings
  2026-03-06-another-finding.md   # Each file is a research artifact
```

Every finding gets written down WITH ITS SOURCE. An unsourced finding is a lead, not a fact.

### Stage 2: Entity Extraction

From raw research, extract discrete entities. Six canonical types:

| Type | What It Is | Key Fields |
|------|-----------|------------|
| **person** | Any individual | `role`, `born`, `died`, `status`, `aliases[]`, `criminal_record[]`, `leads[]` |
| **place** | Physical location | `subtype`, `address`, `coordinates`, `features[]`, `timeline{}` |
| **organization** | Named group/company | `subtype`, `address`, `phone`, `status` |
| **event** | Something with a date | `date`, `type`, `people[]`, `artifacts[]`, `location` |
| **artifact** | Evidence/document | `subtype`, `date`, `text`, `significance` |
| **pattern** | Analytical assessment | `stages[]`, `elements[]`, `evidence[]`, `significance` |

**Patterns are first-class entities**, not annotations. A pattern like "supply chain vulnerability" gets its own node with its own relationships. Patterns are how raw facts become intelligence.

Each entity needs:
- **id**: Machine slug (`smith-john`, `acme-corp`). Unique across graph.
- **name**: Human-readable display name. Becomes the Obsidian filename.
- **sources[]**: Array of citations. Every entity is sourced.
- **confidence**: VERIFIED | LIKELY | UNCERTAIN | RETRACTED | ASSESSED (patterns only)

### Stage 3: Relationship Mapping

Every connection between entities is a typed, directed edge:

```json
{
  "from": "entity-id-1",
  "to": "entity-id-2",
  "type": "owned_operated",
  "years": "1968-1986",
  "evidence": "Court records"
}
```

Common relationship types (adapt to domain):
`owned_operated`, `employed_by`, `business_associate`, `parent_of`, `founded`,
`front_for`, `located_on`, `produced_by`, `distributed_by`, `investigated`,
`testified_in`, `plaintiff_in`, `defended_by`, `grew_up_at`, `resided_at`

### Stage 4: Confidence Scoring

Every entity and relationship gets scored:

| Level | Meaning | Use When |
|-------|---------|----------|
| VERIFIED | Multiple independent sources confirm | Court records + news archives + testimony agree |
| LIKELY | Strong evidence, minor gaps | Single authoritative source (court filing) |
| UNCERTAIN | Plausible but incomplete | Single uncorroborated source, circumstantial |
| RETRACTED | Previously held, now contradicted | Superseded — retain with correction for lineage |
| ASSESSED | Analytical product | Patterns, conclusions, synthesized judgments |

### Stage 5: Intelligence Discipline

Apply six principles before the graph is complete:

1. **Provenance** — Is each claim SOURCED (cited), ASSESSMENT (analytical), or SPECULATION (hypothesis)? Label it.
2. **Lineage** — If information was corrected, the new version references the old. Revision chain is the audit trail.
3. **Confidence** — Already scored (Stage 4). Structured field, not a vague hedge word.
4. **Source Grading** — Separate the source (A=reliable → F=unknown) from the information (1=confirmed → 6=unknown). A reliable source can deliver bad info.
5. **Competing Hypotheses** — Before committing to an explanation, articulate at least one alternative. If you can't say what would prove you wrong, you haven't analyzed.
6. **Corroboration** — Single source = lead. Independent confirmation = fact. Watch for circular reporting.

### Stage 6: Knowledge Graph Assembly

Output is a single JSON file:

```json
{
  "meta": {
    "project": "Project Name",
    "created": "2026-03-07",
    "methodology": "Description of approach",
    "classification": "OPEN SOURCE | RESTRICTED | etc.",
    "tracks": {
      "full": "Complete graph for analysts",
      "filtered": "Subset for specific audience"
    }
  },
  "entities": {
    "people": [],
    "places": [],
    "organizations": [],
    "artifacts": [],
    "events": [],
    "patterns": [],
    "open_questions": [],
    "relationships": []
  },
  "search_seeds": {}
}
```

### Stage 7: Vault Generation

Run the conversion script to generate the complete Obsidian vault from the knowledge graph. The script is deterministic — same JSON in, same vault out. The JSON is the source of truth; the vault is a derived view.

## Vault Structure

```
vault/
  .obsidian/
    snippets/<topic>-theme.css     # Custom callouts + mobile CSS
    app.json                        # Reading mode, shortest-path links
    appearance.json                 # Dark theme, snippet enabled
    community-plugins.json          # Dataview, Templater
  Home.md                           # Map of Content — landing page
  People/                           # Person notes + Index.md
  Places/                           # Location notes
  Organizations/                    # Org/company notes
  Events/                           # Date-prefixed event notes + Timeline.md
  Artifacts/                        # Evidence/document notes
  Patterns/                         # Analytical pattern notes
  Research/                         # Open questions, search seeds, FOIA targets
  Sources/                          # Source index (auto-generated)
  Templates/                        # One per entity type
  Canvas/                           # Investigation boards
```

## Custom Callouts

Define domain-specific callout types in CSS. Each is one rule:

```css
.callout[data-callout="your-type"] {
  --callout-color: R, G, B;
  --callout-icon: lucide-icon-name;
}
```

Used in notes as `> [!your-type] Title`.

**Domain callout palettes**:

| Domain | Callouts |
|--------|----------|
| Investigation | evidence (green), testimony (purple), suspect (red), open-question (amber), pattern (blue), source (gray), timeline (teal), foia (orange), classified (dark red), therapeutic (pink) |
| Medical | finding (green), adverse-event (red), methodology (blue), hypothesis (amber), clinical-note (gray), contraindication (orange) |
| Competitive Intel | market-signal (green), risk (red), opportunity (blue), speculation (amber), financial (gray) |
| Genealogy | record (green), oral-tradition (purple), estimate (amber), conflict (red), migration (blue) |
| Journalism | on-record (green), background (blue), off-record (amber), disputed (red), document (gray) |

## Conversion Script Architecture

The script (Bun/TypeScript) follows this structure:

1. **Load JSON** — Parse knowledge graph
2. **Build lookup maps** — `entityMap` (id → entity), `entityFolder` (id → folder)
3. **Build bidirectional relationship index** — CRITICAL: index both `from` and `to` directions
4. **Generate notes per entity type** — YAML frontmatter + narrative body + callouts + connections + sources
5. **Generate index pages** — Home.md (MOC), People/Index.md (Dataview), Events/Timeline.md (Dataview)
6. **Generate research notes** — Open Questions, Search Seeds, FOIA Targets, Source Index
7. **Generate Canvas files** — Investigation Board (concentric rings), Timeline (horizontal)
8. **Link integrity check** — Verify every `[[wikilink]]` resolves to an existing file

### Bidirectional Relationship Index (Do Not Skip)

```typescript
const relsByEntity = new Map<string, Rel[]>();
for (const rel of relationships) {
  if (!relsByEntity.has(rel.from)) relsByEntity.set(rel.from, []);
  if (!relsByEntity.has(rel.to)) relsByEntity.set(rel.to, []);
  relsByEntity.get(rel.from)!.push(rel);
  relsByEntity.get(rel.to)!.push(rel);
}
```

Skip this and entities that are only targets of relationships show ZERO connections. Half your web is invisible.

### Canvas Concentric Ring Layout

```typescript
function placeRing(ids: string[], radius: number, cx: number, cy: number) {
  for (let i = 0; i < ids.length; i++) {
    const angle = (2 * Math.PI * i) / ids.length - Math.PI / 2;
    positions.set(ids[i], {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    });
  }
}
// Center: primary subject. Inner ring (r=600): direct associates.
// Middle ring (r=1200): secondary connections. Outer ring (r=2000): context.
```

Ring assignment is an ANALYTICAL decision — which entities go where reflects investigative proximity.

### Wikilink Resolution

```typescript
function wikilink(id: string): string {
  const entity = entityMap.get(id);
  if (!entity) return `\`${id}\``;  // Fallback: code format, not broken link
  return `[[${sanitizeFilename(entity.name)}]]`;
}
```

Unknown IDs render as inline code, not broken links. Dead links are dead ends.

## Gotchas

1. **Filename sanitization**: Entity names with `/\:*?"<>|` must be cleaned. Slashes → hyphens, colons → hyphens, pipes → hyphens. Parentheses and single quotes are fine.

2. **YAML frontmatter**: Use `JSON.stringify()` per value. No raw wikilinks in frontmatter arrays — Obsidian treats them as strings, not links. Put clickable links in the note body.

3. **Dataview dependency**: Queries only work after plugin install. Home.md must serve as a non-Dataview fallback with full wikilink navigation.

4. **Mobile CSS**: No `:hover` states. Min tap target 44px. Full-width callouts. Vertical flow only. Test on actual iOS device or at 375px viewport.

5. **Canvas node sizing**: 300x120 per card. Inner ring 7 nodes max at r=600. Scale radius with node count.

6. **Event filenames**: Use `{date} {description-truncated-60}.md` for sortability + uniqueness. Pipe wikilinks for clean display: `[[filename|Display Text]]`.

7. **JSON.txt quirk**: Knowledge graph files sometimes arrive with wrong extensions. Parse by content, not extension.

8. **Link integrity**: After generation, verify ALL wikilinks resolve. One broken link = one investigation dead end.

## Information Firewalls

The vault supports compartmentalization:

- **Vault-per-track**: Generate separate vaults for different audiences from the same JSON. Add a `track` field to entities, filter during generation.
- **Folder-based access**: Share only specific folders (People + Places but not Patterns).
- **Selective sync**: Use Obsidian Sync to share subsets per user.
- **Unresolved links as signals**: If someone receives a subset, wikilinks to excluded notes show as unresolved — visible signal that more exists, without exposing what.

## Verification Checklist

After vault generation:

- [ ] Open vault in Obsidian — all notes load, no parse errors
- [ ] Enable CSS snippet — custom callouts render with correct colors/icons
- [ ] Graph view populates — entity clusters and relationship web visible
- [ ] Mobile test — callouts readable, links tappable, text legible at 375px
- [ ] Dataview queries populate after plugin install
- [ ] Bidirectional links work — click entity A, see link to B, click B, see backlink to A
- [ ] Canvas files open — Investigation Board shows positioned nodes, Timeline shows chronological layout
- [ ] Link integrity — zero broken wikilinks (run: `grep -roh '\[\[[^]|]*' vault/ | sort -u` vs `find vault/ -name '*.md' | sed 's|.*/||;s|\.md$||' | sort -u`)
- [ ] Source index is complete — every source from every entity appears
- [ ] Home.md links to every entity section

## Reference Implementation

A complete working example exists at `/Users/bdmorin/cowork/roselawn/`:
- `data/knowledge-graph.json.txt` — 97-entity knowledge graph
- `scripts/kg-to-obsidian.ts` — Bun/TypeScript conversion script
- `vault/` — Generated 80-file Obsidian vault
- `docs/retrospective.md` — Full methodology retrospective

The script is domain-agnostic: replace entity data, adjust callout types and role taxonomies, regenerate.
