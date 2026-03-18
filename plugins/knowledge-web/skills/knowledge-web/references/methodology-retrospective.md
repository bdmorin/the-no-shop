# Retrospective: Knowledge Graph to Obsidian Vault Pipeline

**Date**: 2026-03-07
**Subject**: Methodology for transforming structured research into navigable Obsidian knowledge webs
**Provenance**: ASSESSMENT — derived from analysis of the Roselawn investigation vault build (2026-03-06), examining the artifacts, conversion script, knowledge graph schema, CSS, canvas files, and vault structure
**Confidence**: VERIFIED for the implementation patterns (code exists and runs); ASSESSED for the generalizable methodology (extrapolated from one successful execution)

---

## 1. THE PIPELINE

### Stage 1: Source Collection and Raw Research

Raw research enters as unstructured investigation output — web searches, document analysis, court record lookups, testimony transcriptions, archival database queries. This phase produces research briefs: timestamped markdown files documenting what was found, where it was found, and what it means.

**Concrete output**: Markdown files in a `research/` directory, named with ISO-8601 timestamps and topic slugs (e.g., `2026-03-06-roselawn-crime-statistics.md`). Each file is a standalone research artifact. No special structure required at this stage — the researcher writes naturally.

**What matters here**: Every finding gets written down with its source. Not formatted, not structured, just captured. The structuring comes later. Researchers who try to structure as they go either slow down or stop recording things that don't fit their current schema. Capture first. Structure second.

### Stage 2: Entity Extraction and Typing

From the raw research, extract discrete entities. Each entity gets:

- **id**: Machine-readable slug (e.g., `drost-richard`, `naked-city`, `jet-star`). Lowercase, hyphenated. Must be unique across the entire graph.
- **name**: Human-readable display name, exactly as the entity is commonly known. Preserve quotation marks, parenthetical clarifications, abbreviations. This becomes the Obsidian filename.
- **type**: One of the canonical entity types (see below).
- **description**: Plain-language summary. One paragraph. Factual, not interpretive.
- **Typed fields**: Additional structured data specific to the entity type.

**The six canonical entity types and their typed fields:**

| Type | What It Represents | Key Fields |
|------|-------------------|------------|
| **person** | Any individual — subject, witness, associate, victim, investigator, attorney, celebrity | `role`, `born`, `died`, `status`, `aliases`, `criminal_record[]`, `leads[]`, `contact`, `location`, `significance` |
| **place** | Physical location — building, property, geographic area, corridor | `subtype`, `address`, `coordinates`, `acreage`, `population`, `features[]`, `timeline{}`, `phone_numbers[]`, `significance` |
| **organization** | Named group — company, agency, front company, production outfit | `subtype`, `address`, `phone`, `status`, `description`, `context`, `directory_context{}` |
| **event** | Something that happened on a specific date or date range | `date`, `type` (legal, law_enforcement, criminal, institutional, commercial, founding), `description`, `note`, `people[]`, `artifacts[]`, `location` |
| **artifact** | Physical or documentary evidence — documents, ads, films, physical objects, court filings | `subtype`, `date`, `publication`, `text`/`text_excerpt`, `significance`, `entries[]`, `case` |
| **pattern** | An analytical assessment of recurring behavior across entities | `description`, `stages[]`, `elements[]`, `significance`, `evidence[]` |

**Critical distinction**: Patterns are first-class entities, not annotations. A pattern like "Recruitment-Transport-Exploit-Produce-Distribute Pipeline" gets its own node in the graph with its own relationships. It is an analytical product — an assessment that connects evidence across multiple entities into a coherent explanation. Patterns are how raw facts become intelligence.

**Role taxonomy for people**: Use domain-specific role labels, not generic ones. In an investigation: `primary_subject`, `victim_witness`, `associate`, `associate_of_interest`, `defense_attorney`, `prosecutor`, `law_enforcement`, `researcher_author`, `employee`, `founder`, `current_operator`, `property_owner`, `celebrity_connection`, `filmmaker`, `contestant`, `serial_killer_in_area`, `witness`. The roles should describe the person's relationship to the investigation, not their job title.

### Stage 3: Relationship Mapping

Relationships are the connective tissue. Each relationship is a directed edge:

```json
{
  "from": "entity-id-1",
  "to": "entity-id-2",
  "type": "owned_operated",
  "years": "1968-1986",
  "evidence": "Court records, nostatusquo.com",
  "role": "optional qualifier"
}
```

**Relationship type vocabulary** (observed in this build, extensible per domain):

- `owned_operated` — ownership/operational control of a place or organization
- `companion_caretaker` — personal relationship
- `business_associate` — formal or informal business connection
- `employer` / `employee` — employment relationship
- `operated` — ran an organization or front company
- `owned` — property/asset ownership
- `parent_of` — family relationship
- `front_for` — organization serving as cover for another
- `founded` — created/established
- `previous_owner` — former ownership
- `grew_up_at` — biographical connection to a place
- `located_on` — geographic adjacency or containment
- `appeared_at` — presence at an event or location
- `performed_at` — professional engagement at a location
- `participated_in` — involvement in an event
- `produced_by` — creation relationship (film, document, artifact)
- `distributed_by` — distribution channel
- `shared_address` — co-location evidence
- `plaintiff_in` — legal relationship
- `defended_by` — attorney-client

**The bidirectional indexing requirement**: When the conversion script processes relationships, it MUST build an index in both directions. If entity A has relationship R to entity B, then when rendering entity B's note, B must show the inverse of that relationship pointing back to A. The implementation uses a `relsByEntity` map that pushes each relationship into both the `from` and `to` entity's array. The note renderer then uses directional arrows (forward or backward) depending on whether the current entity is the `from` or `to` side.

If you skip bidirectional indexing, every note only shows relationships where it is the source — you lose half the connections. This is not a cosmetic issue. It makes the vault structurally incomplete. An entity that is only ever the target of relationships (a victim, a location) would show zero connections on its own page.

### Stage 4: Confidence Scoring

Every entity and every relationship gets a confidence level. Four levels, no ambiguity:

| Level | Meaning | When to Use |
|-------|---------|-------------|
| **VERIFIED** | Multiple independent sources confirm | Court records corroborated by news archives corroborated by witness testimony |
| **LIKELY** | Strong evidence with minor gaps | Single authoritative source (court filing) or multiple less-authoritative sources agreeing |
| **UNCERTAIN** | Plausible but incomplete evidence | Single uncorroborated source, logical inference from circumstantial evidence |
| **RETRACTED** | Previously held, now contradicted | Superseded by new evidence — retain with correction note for lineage |

**An additional level used for patterns**: **ASSESSED** — this is an analytical product, not a raw fact. The pattern itself is the analyst's conclusion drawn from evidence. It is explicitly marked as assessment rather than sourced fact.

**Where confidence lives**: In the knowledge graph JSON, confidence is a field on each entity. In the Obsidian vault, it appears in the YAML frontmatter of every note. This means Dataview queries can filter by confidence level — e.g., show me all UNCERTAIN entities, or all VERIFIED artifacts.

### Stage 5: The Intelligence Discipline Lens

Before the knowledge graph is considered complete, apply the six-principle test to every entity and every relationship:

1. **Provenance**: Is this claim sourced (cited record), assessment (analytical judgment), or speculation (hypothesis)? Label it. The knowledge graph's `sources` arrays on each entity serve this purpose. The source index aggregates all sources for the entire investigation.

2. **Lineage**: If information was corrected or updated during the investigation, the new version must reference the old. In this build, lineage manifests as notes within criminal records ("SEPARATE CASE from 1985 charge") and as the open questions being updated with status changes ("SEARCH IN PROGRESS", "ANSWERED").

3. **Confidence**: Already covered above. The key is that confidence is a structured field, not a vague hedge word in prose.

4. **Source Grading**: Evaluate the source and the information independently. A personal blog (lower source reliability) can contain verified factual claims. A court filing (high source reliability) can contain contested assertions. In this build, the source index collects all sources but does not grade them. A mature implementation would add NATO Admiralty Code grades (A-F for source, 1-6 for information) to the source index.

5. **Competing Hypotheses**: Before committing to an explanation, identify at least one alternative. In this build, the "Evidentiary Data Void" pattern explicitly addresses this: is the absence of crime data evidence of suppression, or just neglect? Both hypotheses are stated. The Epstein question was investigated specifically to test a competing hypothesis — and the answer was negative, which is itself a finding.

6. **Corroboration**: A single source is a lead, not a fact. The criminal record entries demonstrate this — each entry cites its source, and entries corroborated by multiple sources (UPI + Indianapolis Star + court records) carry VERIFIED confidence. Entries from a single source carry LIKELY.

### Stage 6: Knowledge Graph Assembly

The output of stages 2-5 is a single JSON file. The schema:

```json
{
  "meta": {
    "project": "string",
    "created": "ISO-8601 date",
    "methodology": "string",
    "classification": "string",
    "tracks": {
      "therapeutic": "description of filtered track",
      "archive": "description of full track"
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
  "search_seeds": {
    "google_newspaper_archive": [],
    "newspapers_com": [],
    "foia_targets": [],
    "contact_leads": []
  }
}
```

Note that `open_questions` and `relationships` live inside `entities` (they are entity-adjacent data), while `search_seeds` is a top-level section (it is operational guidance, not evidence).

### Stage 7: Vault Generation

The conversion script (`kg-to-obsidian.ts`) reads the knowledge graph JSON and generates the complete vault. This is a deterministic, idempotent transformation — running it twice on the same JSON produces the same vault. This matters because it means the knowledge graph is the source of truth, and the vault is a derived artifact. Update the JSON, re-run the script, get updated notes.

The script's responsibilities:

1. **Entity lookup maps**: Build `entityMap` (id to entity) and `entityFolder` (id to folder name) for O(1) access during generation.
2. **Bidirectional relationship index**: Build `relsByEntity` map indexing both directions.
3. **Note generation per entity type**: Each type gets its own generation block with type-specific fields, callouts, and sections.
4. **YAML frontmatter**: Serialized with `JSON.stringify` per value to ensure valid YAML. Contains typed metadata for Dataview queries.
5. **Wikilinks from IDs**: The `wikilink()` function resolves entity IDs to `[[Sanitized Name]]` syntax. Unknown IDs fall back to inline code formatting rather than broken links.
6. **Relationship sections**: Every entity note gets a "Connections" section with directional arrows, relationship type labels, evidence, and year ranges.
7. **Index pages**: Map of Content (Home.md), People Index (Dataview), Events Timeline (Dataview).
8. **Research notes**: Open Questions, Search Seeds, FOIA Targets, Source Index — these are derived from the knowledge graph but formatted as standalone research documents.
9. **Canvas files**: Investigation Board (concentric ring layout) and Timeline (horizontal chronological layout).
10. **Templates**: One per entity type, for manual note creation.
11. **Obsidian config**: appearance.json (dark theme, base font size, CSS snippet enabled), community-plugins.json (dataview, templater).

---

## 2. INFORMATION FIREWALLS AND COMPARTMENTALIZATION

### The Tracks Concept

The same knowledge graph supports multiple audiences with different needs. In this build, two tracks:

- **Archive track**: Full evidence graph. Every entity, every relationship, every source, every criminal record detail. This is the investigative record. It is comprehensive and unflinching.
- **Therapeutic track**: Filtered subset. Context without re-traumatization. Same facts, but presented with care — guidance on how to search, what to expect, emotional off-ramps ("you don't have to keep going right then").

The tracks are implemented at the project level, not the vault level. The `therapeutic/` directory contains separately authored content (the "Getting Started Guide") that references the same investigation but with a different framing. The vault itself is the archive track. A therapeutic-track vault would be a separate generation pass with filtering logic — exclude entities tagged as high-trauma, soften callout language, add therapeutic callouts.

**This is a design pattern, not an implementation**: The current build did not implement automated track filtering in the conversion script. It would work as follows:

1. Add a `track` field to entities: `["archive"]` or `["archive", "therapeutic"]`.
2. Add a track filter parameter to the conversion script.
3. Generate two vaults from the same knowledge graph — one full, one filtered.
4. The therapeutic vault would include additional callout types (the `[!therapeutic]` callout already exists in CSS) and omit entities with detailed criminal evidence.

### Why Obsidian as the Medium

The choice of Obsidian is not arbitrary. It serves specific requirements:

1. **Local-first**: The vault is a folder of markdown files. No cloud service. No account. No server. Copy the folder to a USB drive, open it on any device. This matters when the audience includes people who may not be technically sophisticated and should not need to create accounts or trust third-party services with sensitive material.

2. **Offline on iOS**: Obsidian's iOS app works fully offline with local vaults. For an end user who is processing this material on their phone — in a waiting room, on a commute, in a therapist's office — internet dependency is a blocker.

3. **Wikilinks as information architecture**: Touch a name, see everything about that name. Touch a connection, jump to the connected entity. This is how investigations work — you pull a thread and follow it. The vault makes that physical.

4. **No vendor lock-in on the data**: Every note is a markdown file. If Obsidian disappears tomorrow, the files are readable in any text editor. The wikilinks degrade to plaintext `[[brackets]]` that are still human-parseable.

5. **Privacy**: No telemetry, no sync unless you configure it, no sharing unless you explicitly export. This is mandatory for sensitive research material.

### Wikilinks as Information Firewalls

The vault can be subset by folder. Give someone the `People/` and `Places/` folders without `Patterns/` or `Research/`, and they get entity profiles without analytical assessments. The wikilinks to patterns will show as unresolved links (purple in Obsidian), which is a natural signal that more exists without exposing what it is.

This is implicit compartmentalization through file distribution. More sophisticated approaches:

- **Vault-per-track**: Generate separate vaults for each audience. The therapeutic vault is self-contained — no broken links, no references to material the audience should not see.
- **Tag-based filtering with Dataview**: In a shared vault, use Dataview queries filtered by tags to create views that only show entities appropriate for the current user's access level.
- **Folder-based access**: Use Obsidian Sync's selective sync to share only specific folders with specific people.

### Vault-per-Investigation vs Single Vault

For a single investigation: one vault. The investigation IS the vault's scope.

For an analyst running multiple investigations: separate vaults. Cross-investigation links would use full file paths or an intermediary index, but mixing investigations in a single vault creates noise. Obsidian's vault switcher makes this low-friction.

For a team collaborating on a single investigation: one vault, shared via Obsidian Sync or git. Conflict resolution on markdown files is straightforward.

---

## 3. THE KNOWLEDGE WEB ARCHITECTURE

### Entity-Relationship to Wikilinks: The Natural Mapping

The knowledge graph is a directed graph: entities are nodes, relationships are edges. Obsidian's wikilinks implement a graph: notes are nodes, `[[links]]` are edges. The mapping is direct.

But the power is in the rendering. A knowledge graph in JSON is queryable but not navigable. You can write a query to find all entities connected to entity X, but you cannot *explore*. An Obsidian vault is navigable — you tap a name, you see that person's note, you see their connections as tappable links, you follow those. The investigative act of "pulling a thread" becomes literal.

### The Levenshtein Distance Metaphor

Brian described the design intention using a distance metaphor: proximity in the graph should correspond to investigative proximity. Entities one hop away are directly connected (co-conspirators, locations of events, artifacts produced by subjects). Entities two hops away are circumstantially connected (a celebrity who performed at a location operated by the subject). Three hops: contextual (a county where an unrelated serial killer operated, suggesting a pattern of institutional failure).

This is implemented through the concentric ring layout in the Canvas files. The primary subject sits at the center. Inner ring: entities with direct operational relationships (co-conspirators, primary locations, key artifacts, front companies). Middle ring: entities with documented but less direct connections (associates, legal entities, secondary evidence). Outer ring: contextual entities (community members, celebrities, unrelated crimes in the same jurisdiction, transportation corridors).

The number of hops between two entities in the vault's link graph is a rough proxy for how closely connected they are in reality. This is not a coincidence — it is a designed property.

### Canvas Files as Investigation Boards

Obsidian Canvas files are JSON structures with `nodes` (positioned cards referencing vault files) and `edges` (labeled connections between cards). Two canvas types serve different analytical purposes:

1. **Investigation Board**: Concentric ring layout. Shows the full entity-relationship map as a visual board. Color-coded by entity type (Obsidian's built-in color palette: 1=red for people, 4=green for places, 6=purple for organizations, 3=yellow for artifacts, 5=cyan for events, 2=orange for patterns). Each card is a file reference — double-click opens the full note. Edges are labeled with relationship types.

2. **Timeline Canvas**: Horizontal chronological layout. Events sorted by date, connected by edges in sequence. This is a visual timeline where each node is a tappable event note. Spacing is uniform (450px intervals), which works for sparse timelines but would need adjustment for dense ones.

**Canvas positioning algorithm**: Use trigonometric placement for concentric rings.

```typescript
function placeRing(ids: string[], radius: number, centerX: number, centerY: number) {
  const count = ids.length;
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    nodePositions.set(ids[i], { x, y });
  }
}
```

The `-Math.PI / 2` offset places the first entity at the 12 o'clock position. Radius values (600, 1200, 2000) are calibrated for node sizes of 300x120 — smaller nodes could use tighter radii.

### Dataview Queries as Auto-Updating Indexes

Dataview queries in index pages provide structured views that update automatically as notes are added or modified:

```dataview
TABLE role, status, died
FROM "People"
WHERE type = "person"
SORT role ASC
```

This works because every entity note has YAML frontmatter with the `type` field. Dataview reads frontmatter as queryable metadata. The queries are simple by design — complex Dataview queries are fragile and hard to debug. Stick to TABLE + FROM + WHERE + SORT.

**Graceful degradation**: Without the Dataview plugin installed, these queries render as code blocks. The vault is still fully navigable via wikilinks and the Home.md map of content. Dataview adds convenience, not structure.

### Patterns as First-Class Entities

The decision to make patterns their own entity type (with their own folder, their own notes, their own connections) rather than inline analysis within other notes is a structural choice that pays off in three ways:

1. **Patterns are linkable**: Other notes can reference `[[Recruitment-Transport-Exploit-Produce-Distribute Pipeline]]` as a wikilink. This means evidence scattered across many entity notes is connected through the pattern note that explains what it means collectively.

2. **Patterns appear in the graph**: In Obsidian's graph view, patterns show as nodes connected to the entities they reference. This makes analytical structure visible — you can see which entities are part of which patterns.

3. **Patterns are assessable**: Because patterns have their own confidence level (`ASSESSED`), they are explicitly marked as analytical products. This satisfies the intelligence discipline requirement that assessments never masquerade as sourced facts.

---

## 4. DECISION POINTS AND TRADE-OFFS

### JSON Knowledge Graph vs Direct-to-Obsidian

The intermediate JSON format adds a step but provides critical benefits:

- **Separation of concerns**: Research populates the JSON. The conversion script renders the vault. They evolve independently. You can improve the rendering (better callouts, new sections, different CSS) without touching research. You can add new entities without changing the script.
- **Idempotent regeneration**: `bun run scripts/kg-to-obsidian.ts` produces a complete vault from scratch. You never hand-edit generated vault files. If you want to change something, change the JSON and regenerate. This eliminates drift between the source of truth and the rendered output.
- **Machine-readable source of truth**: The JSON can feed other systems — a web visualization, a database import, an API, a different rendering format. The vault is one view of the data, not the data itself.
- **Version control**: JSON diffs are clean. You can see exactly what changed between versions of the knowledge graph. Vault file diffs are noisy (regenerated timestamps, reformatted sections).

**Trade-off**: You lose the ability to hand-edit vault notes with the expectation that changes persist. Every regeneration overwrites. If you need human-authored content that coexists with generated content, either: (a) add it to the knowledge graph JSON (preferred), or (b) put it in separate non-generated notes that wikilink to generated ones (acceptable).

### Obsidian vs Alternatives

| Tool | Why Not |
|------|---------|
| **Notion** | Cloud-dependent, no offline, vendor lock-in, slow on mobile, no local file access |
| **Roam Research** | Cloud-dependent, proprietary format, expensive, no offline |
| **LogSeq** | Good local-first alternative, but less mature mobile app, smaller plugin ecosystem |
| **Google Docs** | No linking between documents, no graph view, cloud-dependent, no structured metadata |
| **DEVONthink** | macOS-only, expensive, overkill for this use case |
| **Plain markdown** | Works, but no graph view, no wikilink resolution, no Canvas, no Dataview |

Obsidian won because: local-first + offline iOS + wikilinks + graph view + Canvas + Dataview + CSS customization + zero cost + no vendor lock-in. For an investigative vault delivered to non-technical users who will primarily consume it on a phone, nothing else checks all boxes.

### File Naming: Human-Readable Names vs IDs

Entity IDs are machine slugs (`drost-richard`). Filenames use human-readable names (`Richard 'Dick' Drost.md`). Wikilinks use the display name (`[[Richard 'Dick' Drost]]`).

This works because Obsidian resolves wikilinks by shortest unique path — you don't need to specify the folder. `[[Richard 'Dick' Drost]]` resolves to `People/Richard 'Dick' Drost.md` regardless of which folder the linking note is in. This means entity names must be unique across the entire vault, which they naturally are (entity IDs enforce uniqueness, and display names are derived from IDs).

**Event filenames** are an exception: they use `{date} {description-truncated-to-60-chars}.md` because event descriptions alone are not unique, but date + description is. The Home.md uses piped wikilinks to show clean display text: `[[1980-08-12 Indiana State Police raid...|1980-08-12: Indiana State Police raid...]]`.

**The sanitization function**: Filenames cannot contain `/\:*?"<>|`. The `sanitizeFilename()` function replaces these with hyphens. This is essential — entity names often contain characters that are valid in JSON but illegal in filenames (colons in dates, slashes in "Air Check / Videochex", pipes in alternative names).

### Frontmatter Schema: YAML vs Note Body

**In frontmatter (YAML)**: Typed, structured fields that Dataview can query. Entity type, role, status, born/died dates, aliases, confidence, tags. Values must be JSON-serializable — no raw wikilinks in frontmatter arrays. The script serializes each value with `JSON.stringify()` to ensure valid YAML.

**In note body**: Narrative description, callouts (evidence, suspect, open-question, pattern, source, timeline, foia, classified, therapeutic), relationship sections, source citations. These are human-readable content, not queryable metadata.

**Rule of thumb**: If you would query it with Dataview (filter, sort, group), it goes in frontmatter. If you would read it as prose, it goes in the body.

**YAML gotcha**: Wikilinks (`[[Name]]`) in YAML arrays are treated as literal strings by Obsidian — they don't resolve as links. Don't put wikilinks in frontmatter. Put them in the note body instead. The script puts `peopleLinks` and `locationLink` in event frontmatter for Dataview queryability, but these are display strings, not functional links. The actual clickable links are in the body.

### Callouts vs Tags vs Folders

All three are used, for different purposes:

- **Folders** (`People/`, `Places/`, `Events/`, etc.): Primary structural organization. One folder per entity type. This is the physical filing system.
- **Tags** (`person`, `primary_subject`, `event`, `legal`, etc.): Cross-cutting classification. A note in `People/` has tags `[person, primary_subject]`. Tags enable Dataview filtering independent of folder structure.
- **Callouts** (`[!evidence]`, `[!suspect]`, `[!open-question]`, etc.): Visual presentation within notes. They highlight specific types of content within a note — a criminal record block, a source citation, an unresolved question. They are styled with custom CSS.

This is a layered system: folders for navigation, tags for querying, callouts for reading. Each layer serves a different mode of interaction with the vault.

---

## 5. GOTCHAS AND LESSONS LEARNED

### Wikilinks with Special Characters

Entity names frequently contain characters that interfere with wikilink syntax:

- **Slashes**: "Air Check / Videochex" becomes `Air Check - Videochex` in the filename. The sanitizer replaces `/` with `-`.
- **Colons**: Not allowed in filenames on macOS/Windows. Replaced with `-`.
- **Parentheses**: Work fine in wikilinks and filenames. `[[Naked City (Club Zoro - Sun Aura Resort)]]` resolves correctly.
- **Single quotes**: Work in filenames and wikilinks. `[[Richard 'Dick' Drost]]` is valid.
- **Pipes**: `|` in entity names would conflict with piped wikilink syntax (`[[file|display]]`). Replaced with `-` by the sanitizer.
- **Em dashes (unicode)**: Present in description text (e.g., "100+ films — $75K equipment"). These work in note body text but should be avoided in entity names/filenames due to potential encoding issues on different filesystems.

### Canvas Node Positioning

Concentric rings work. Random positioning does not.

With random placement, canvas nodes overlap and the spatial relationships between entities convey no information. The concentric ring layout communicates investigative proximity — central subject, inner associates, outer context. The rings must be manually curated: which entities go in which ring is an analytical decision, not a mechanical one.

**Node size calibration**: 300x120 works for entity names up to about 40 characters. Longer names get truncated in the canvas card view. The canvas card shows the note's filename by default — if filenames are too long (event filenames, especially), the card becomes unreadable. The 60-character truncation on event filenames is a compromise between readability in the canvas and uniqueness.

**Ring radii**: Inner ring at 600px, middle at 1200px, outer at 2000px. These values assume 300x120 node cards. At 7 nodes in the inner ring (600px radius), adjacent cards are about 500px apart — enough clearance with some overlap of edge labels. At 24 nodes in the outer ring (2000px radius), adjacent cards are about 520px apart. If you add more nodes per ring, increase the radius proportionally or accept overlap.

### The JSON.txt Extension

The knowledge graph file is `knowledge-graph.json.txt`. This is a valid JSON file with a `.txt` extension appended. This is a common artifact of LLM output being saved — some interfaces append `.txt` to avoid content-type confusion. The conversion script reads it by path regardless of extension. `JSON.parse(readFileSync(path, "utf-8"))` does not care about file extensions.

**Defensive practice**: Always parse by content, not by extension. If you're building a pipeline that accepts knowledge graphs from multiple sources, try parsing the file as JSON first, regardless of extension. Reject only on parse failure, not on extension mismatch.

### Bidirectional Relationship Indexing

This is the single most important technical decision in the conversion script. The relationships array in the knowledge graph stores each relationship once, with `from` and `to` fields. But every entity needs to show ALL its relationships — both those where it is the source and those where it is the target.

```typescript
const relsByEntity = new Map<string, Rel[]>();
for (const rel of relationships as Rel[]) {
  if (!relsByEntity.has(rel.from)) relsByEntity.set(rel.from, []);
  if (!relsByEntity.has(rel.to)) relsByEntity.set(rel.to, []);
  relsByEntity.get(rel.from)!.push(rel);
  relsByEntity.get(rel.to)!.push(rel);
}
```

When rendering, the direction arrow depends on which side the current entity is:

```typescript
const isFrom = rel.from === entityId;
const direction = isFrom ? "\u2192" : "\u2190";
```

Skip this and half your connections are invisible. On a 25-person, 25-relationship graph, that means dozens of missing links. On a larger graph, it is catastrophic.

### Dataview Plugin Dependency

Dataview queries only work after the plugin is installed. The vault's index pages (`People/Index.md`, `Events/Timeline.md`) contain dataview code blocks. Without the plugin, these render as raw code.

**Mitigation**: The Home.md serves as a non-Dataview fallback. It lists every entity as a wikilink, grouped and sorted. It works with zero plugins installed. The Dataview indexes are convenience, not the only navigation path.

The vault ships with `.obsidian/community-plugins.json` listing `["dataview", "templater-obsidian"]`. On first vault open, Obsidian will prompt the user to enable community plugins and install these. This is a manual step — there is no way to auto-install plugins. The Home.md includes installation instructions.

### YAML Frontmatter Serialization

Values in YAML frontmatter must be valid YAML. The script uses `JSON.stringify()` for each value, which produces valid YAML for strings, numbers, booleans, and arrays. Edge cases:

- `null` → `null` (valid YAML)
- Empty string `""` → `""` (valid YAML)
- Arrays `["tag1", "tag2"]` → `["tag1","tag2"]` (valid JSON, valid YAML flow style)
- Strings with colons → `"Newton County, IN"` (quoted, valid)

**What breaks**: If you use YAML block style (`key:\n  - value1\n  - value2`) mixed with JSON-style arrays, Obsidian's YAML parser can be inconsistent. Stick to one style — the JSON.stringify approach guarantees inline/flow style throughout, which Obsidian handles reliably.

### Mobile-First CSS

The vault's CSS snippet is designed for iOS consumption. Key decisions:

- **No hover states**: Mobile has no hover. Every interaction is `:active` (tap), not `:hover`. The CSS uses `.internal-link:active` for tap feedback.
- **Large tap targets**: Wikilinks get padding and a minimum height of 44px on mobile (Apple's HIG minimum). Without this, tapping a link in a dense paragraph of text is frustrating.
- **Vertical flow only**: No multi-column layouts, no side-by-side panels. Everything stacks vertically. Mobile screens are narrow; horizontal layouts break.
- **Larger font on mobile**: `--font-text-size: 18px` on screens under 768px (up from 17px default). This seems small but the increased line-height (1.7 vs 1.65) makes a bigger readability difference than font size alone.
- **Full-width callouts on mobile**: Negative margins (`margin-left: -8px; margin-right: -8px`) and zero border-radius make callouts span the full screen width, which looks intentional rather than cramped.

### The "One Broken Link" Problem

If a wikilink references an entity name that does not have a corresponding file in the vault, Obsidian shows it as an unresolved link (different color, no hover preview). In an investigation vault, a dead link is a dead end — the user taps a name expecting to see information and gets nothing.

**Mitigation in the script**: The `wikilink()` function checks `entityMap.get(id)` before generating a wikilink. If the ID is not found, it falls back to inline code formatting (backtick-wrapped) instead of a broken wikilink. This makes unknown references visually distinct ("this ID exists in the data but has no entity definition") without creating dead links.

**Remaining risk**: Relationship references can point to entity IDs that were not included in the current knowledge graph version. If entity A's relationship references entity B, but entity B was removed or renamed, the wikilink will be broken. The solution is a link integrity check as a post-generation step: scan all generated files for `[[...]]` patterns and verify each resolves to an existing file.

---

## 6. REUSABLE PATTERNS FOR ANY TOPIC

### Research Topic to Knowledge Graph Schema

The six entity types (person, place, organization, event, artifact, pattern) are universal enough for most investigative or research domains. Domain-specific adaptation happens in the typed fields and role taxonomies:

| Domain | Person Roles | Artifact Types | Pattern Examples |
|--------|-------------|----------------|-----------------|
| **Criminal investigation** | subject, witness, victim, prosecutor, defender, investigator | court filings, evidence photos, testimony transcripts, arrest records | operational pipelines, institutional failures, evidentiary gaps |
| **Medical research** | patient, researcher, clinician, reviewer | papers, trial data, imaging, lab reports | drug interactions, diagnostic pathways, publication biases |
| **Competitive intelligence** | executive, founder, advisor, investor | SEC filings, patents, press releases, job postings | market entry patterns, acquisition strategies, talent flows |
| **Genealogy** | ancestor, descendant, spouse, sibling | birth/death certificates, census records, immigration papers | migration patterns, naming conventions, occupational lineages |
| **Journalism** | source, subject, editor, official | documents, recordings, emails, financial records | corruption patterns, influence networks, timeline discrepancies |

### Knowledge Graph to Obsidian Vault: The Conversion Pipeline

The conversion script is structured as sequential blocks, one per entity type, followed by index pages, research notes, and canvas files. To adapt for a different domain:

1. **Define your entity types**: What are the node types in your domain? People and places are almost always present. Organizations, events, and artifacts are common. Patterns are always applicable (they are analytical, not domain-specific).

2. **Define your relationship types**: What connects entities in your domain? Start with the relationships observed in your data, not a theoretical taxonomy. You can normalize later.

3. **Define your callout types**: What categories of information appear within notes? These become custom CSS callouts. The Roselawn build uses: evidence, testimony, suspect, open-question, pattern, source, timeline, foia, classified, therapeutic. A medical research vault might use: finding, methodology, contraindication, hypothesis, citation, clinical-note.

4. **Write the conversion script**: Start from the `kg-to-obsidian.ts` template. Replace entity-type-specific blocks with your domain's types. Keep the infrastructure (lookup maps, bidirectional indexing, sanitization, wikilink function, canvas generation) unchanged — it is domain-independent.

5. **Generate and verify**: Run the script. Open the vault. Check every entity note for correct rendering. Check the canvas for correct positioning. Check the Home.md for complete coverage. Fix and re-run.

### Custom Callouts for Different Domains

Obsidian callout types are defined entirely in CSS. Adding a new callout type is one CSS rule:

```css
.callout[data-callout="your-type"] {
  --callout-color: R, G, B;
  --callout-icon: lucide-icon-name;
}
```

Used in markdown as:

```markdown
> [!your-type] Title
> Content of the callout
```

**Domain callout palettes**:

- **Legal investigation**: evidence (green), testimony (purple), suspect (red), open-question (amber), classified (dark red), exculpatory (blue)
- **Medical**: finding (green), adverse-event (red), methodology (blue), hypothesis (amber), clinical-note (gray), contraindication (orange)
- **Competitive intel**: market-signal (green), risk (red), opportunity (blue), speculation (amber), financial (gray)
- **Genealogy**: record (green), oral-tradition (purple), estimate (amber), conflict (red), location (blue)

### The "Map of Content" Pattern

Home.md is a Map of Content (MOC) — a manually curated index note that links to every major section of the vault. It is the landing page, the table of contents, the starting point.

Structure:
1. Classification/scope statement (callout)
2. Entity sections grouped by type, with role subgroups for people
3. Research section (open questions, search seeds, source index)
4. Investigation boards (canvas links)
5. Setup instructions (graph view settings, required plugins)
6. Audience-specific note (therapeutic callout for family members)

The MOC should be generated by the conversion script (to stay in sync with the knowledge graph) but can also be hand-edited for additional curation.

### Template-Driven Note Creation

Templates in `vault/Templates/` provide scaffolding for manually adding new entities without running the conversion script. Each template mirrors the generated note structure:

- YAML frontmatter with all expected fields (empty/placeholder values)
- Section headings matching the generated layout
- Placeholder callouts
- Placeholder connections section

Templates are used with the Templater plugin: create a new note, apply a template, fill in the fields. This enables human collaborators to add entities directly to the vault without touching the knowledge graph JSON.

**Trade-off**: Manually added notes will not survive a regeneration (the script overwrites the vault). If manual additions are expected, either: (a) add the entity to the JSON and regenerate, or (b) put manual notes in a separate folder (e.g., `Manual/`) that the script does not touch.

### Source Index as First-Class Artifact

The source index collects every source cited by every entity in the knowledge graph into a single alphabetized list. This serves two purposes:

1. **Audit trail**: Any reviewer can see every source used in the investigation in one place. No hiding behind inline citations scattered across 80 notes.
2. **Deduplication detection**: Similar but not identical source references (e.g., "Indianapolis Star" vs "Indianapolis Star, March 24, 1982" vs "Indianapolis Star (newspapers.com/106180754)") become visible. A mature source index would normalize these into canonical source records with multiple access references.

The source index is generated, not hand-maintained. It scans all entities for `sources` arrays and deduplicates with a Set. To add a source, add it to an entity's sources array in the knowledge graph.

---

## 7. THE INTELLIGENCE ANALYST'S LENS

### Provenance Tagging Transforms Guesses Into Analysis

Without provenance labels, every statement in the vault has the same apparent authority. "Drost was convicted in 1975" and "Drost may have been connected to Epstein" look the same in a bulleted list. With provenance:

- "Drost was convicted in 1975" → SOURCED (court records, UPI archives)
- "Drost may have been connected to Epstein" → SPECULATION (hypothesis, subsequently investigated and disproven)

The vault implements this through three mechanisms:
1. **Confidence levels in frontmatter**: Every note is tagged VERIFIED, LIKELY, UNCERTAIN, or ASSESSED.
2. **Source callouts**: `[!source]` blocks list every citation for that entity.
3. **Inline source attribution**: Criminal records include per-entry source fields.

A reader can evaluate the strength of any claim by checking its provenance. "Who says so?" is always answerable.

### Confidence Scoring Makes Uncertainty Explicit

The worst outcome of an investigation vault is false certainty — presenting uncertain information with the same visual weight as verified facts. Confidence scoring prevents this by making uncertainty a visible, queryable property.

Practical applications:
- A Dataview query for `WHERE confidence = "UNCERTAIN"` surfaces every entity that needs more evidence.
- Notes tagged ASSESSED are clearly analytical products, not raw evidence.
- The absence of a confidence level is itself a flag — something was missed in the structuring phase.

### Source Grading Separates Messenger from Message

The source index in this build lists sources but does not grade them. A mature implementation would add two-axis grading:

- **Source reliability**: A (completely reliable — court records) through F (cannot judge — anonymous blog comment)
- **Information quality**: 1 (confirmed by independent sources) through 6 (cannot judge)

A blog post by an eyewitness (source: C, information: 3) carries different weight than a court filing (source: A, information: 2). The current build implicitly handles this through confidence levels, but explicit source grading would add rigor.

### Competing Hypotheses Prevent Confirmation Bias

The investigation explicitly tested and rejected the Epstein hypothesis. This is a model: before committing to an explanation, articulate what else could explain the same evidence, then investigate the alternatives.

In the vault, this manifests as:
- Open questions that pose alternative explanations
- The "Evidentiary Data Void" pattern, which explicitly states two competing explanations (suppression vs neglect)
- The Epstein search, documented as a negative finding — the absence of evidence IS a finding when the search was thorough

### The "Data Void" as Evidence

The "Evidentiary Data Void" pattern is one of the most methodologically important outputs of the investigation. Newton County has essentially no searchable historical crime data for a 50-year period. This county hosted:
- An 18-year trafficking operation
- A serial killer's dumping ground
- Organized crime burials

Yet the data void exists. The pattern note treats this absence as evidence — of institutional failure, of minimal law enforcement, of operational cover provided by rural isolation.

For any investigation, the question "what data should exist but doesn't?" is as important as "what data did we find?" The knowledge graph should include data voids as pattern entities with their own analysis and connections.

### Open Questions as First-Class Entities

Open questions are not afterthoughts or TODO lists. They are active investigation leads with structure:

```json
{
  "question": "Why were federal charges never filed?",
  "priority": "HIGH",
  "status": null,
  "leads": [
    "FOIA request to FBI",
    "DOJ records",
    "US Attorney records"
  ]
}
```

Priority levels (CRITICAL, HIGH, MEDIUM, LOW) enable triage. Leads provide actionable next steps. Status tracking (null = open, "SEARCH IN PROGRESS", "ANSWERED") provides investigation state.

In the vault, open questions get their own note (`Research/Open Questions.md`) with custom callouts (`[!open-question]`). This makes them visible and navigable — they are not buried in entity notes where they might be forgotten.

The transition from open question to answered question to new entity or relationship is the investigation's heartbeat. When a question is answered, the answer becomes a new entity or updates an existing one, and the question's status changes to ANSWERED with a note about what was found.

---

## 8. WHAT THIS RETROSPECTIVE DOES NOT COVER

The following are identified gaps — areas where the methodology could be extended but was not exercised in this build:

1. **Automated track filtering**: The therapeutic/archive track split is a design pattern but not implemented in the conversion script. A production skill would include a `--track=therapeutic` flag that filters entities by sensitivity.

2. **Source grading**: The source index lists but does not grade sources. Adding NATO Admiralty Code grades would strengthen the intelligence product.

3. **Link integrity checking**: No post-generation verification that all wikilinks resolve to existing files. A `verify-links.ts` script would catch orphaned references.

4. **Incremental updates**: The current pipeline is full regeneration — it overwrites the entire vault on each run. An incremental mode (only update changed entities) would be necessary for large, actively maintained vaults.

5. **Multi-vault generation**: Generating multiple vaults from the same knowledge graph (one per track) is architecturally clean but not implemented.

6. **Graph visualization tuning**: Obsidian's graph view settings (node colors by tag, force strength, link distance) are documented in Home.md but not auto-configured. The `.obsidian/graph.json` file could be pre-populated.

7. **Search within the vault**: Obsidian's built-in search is adequate for small vaults. For larger investigations (hundreds of entities), a dedicated search index or Dataview-based search page would help.

---

## APPENDIX A: FILE MANIFEST

For reference, the complete vault structure generated by the conversion script:

```
vault/
  .obsidian/
    app.json                           # Obsidian app settings
    appearance.json                    # Dark theme, base font, CSS snippet enabled
    community-plugins.json             # [dataview, templater-obsidian]
    snippets/
      roselawn-investigation.css       # Custom callouts, mobile-first styling
  Home.md                              # Map of Content (MOC)
  People/
    Index.md                           # Dataview auto-index
    {Person Name}.md                   # One per person entity
  Places/
    {Place Name}.md                    # One per place entity
  Organizations/
    {Org Name}.md                      # One per organization entity
  Events/
    Timeline.md                        # Dataview auto-index
    {Date Description}.md              # One per event entity (date-prefixed)
  Artifacts/
    {Artifact Name}.md                 # One per artifact entity
  Patterns/
    {Pattern Name}.md                  # One per pattern entity
  Research/
    Open Questions.md                  # Prioritized investigation questions
    Search Seeds.md                    # Structured queries for investigators
    FOIA Targets.md                    # Freedom of Information request targets
    NotebookLM Source.md               # Full narrative document (if exists)
  Sources/
    Source Index.md                    # All cited sources, alphabetized
  Templates/
    Person.md                          # Template for manual person creation
    Place.md                           # Template for manual place creation
    Organization.md                    # Template for manual org creation
    Event.md                           # Template for manual event creation
    Artifact.md                        # Template for manual artifact creation
    Pattern.md                         # Template for manual pattern creation
  Canvas/
    Investigation Board.canvas         # Concentric ring entity-relationship map
    Timeline.canvas                    # Horizontal chronological event layout
```

## APPENDIX B: CONVERSION SCRIPT ARCHITECTURE

The `kg-to-obsidian.ts` script follows this execution order:

1. Load knowledge graph JSON
2. Build entity lookup maps (entityMap, entityFolder)
3. Build bidirectional relationship index (relsByEntity)
4. Generate People notes (with criminal records, leads, connections)
5. Generate Places notes (with timelines, phone numbers, features)
6. Generate Organizations notes (with directory context)
7. Generate Artifacts notes (with original text, key facts)
8. Generate Events notes (with people links, artifact links, location)
9. Generate Patterns notes (with pipeline stages, evidence links)
10. Generate Open Questions research note
11. Generate Search Seeds research note
12. Generate FOIA Targets research note
13. Generate Source Index
14. Copy NotebookLM source (if exists)
15. Generate Home.md (Map of Content)
16. Generate Dataview index pages (People Index, Events Timeline)
17. Generate Canvas files (Investigation Board, Timeline)
18. Print summary statistics

Runtime: under 100ms for a 1200-line knowledge graph producing 80+ files. The script is I/O-bound (many small file writes), not compute-bound.

## APPENDIX C: KNOWLEDGE GRAPH STATISTICS (ROSELAWN BUILD)

| Metric | Count |
|--------|-------|
| People | 26 |
| Places | 6 |
| Organizations | 4 |
| Artifacts | 6 |
| Events | 14 |
| Patterns | 4 |
| Open Questions | 10 |
| Relationships | 25+ |
| Canvas files | 2 |
| Index pages | 2 |
| Research notes | 4 |
| Total vault files | ~80 |
| Knowledge graph size | ~1200 lines / ~58 KB |
