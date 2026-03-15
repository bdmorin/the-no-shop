---
name: retro
description: "Session retrospective — analyzes the current Claude Code session and produces a structured retrospective with lessons learned, insights, blockers, resolutions, and session origin story. Use when you say 'retro', 'session retro', 'what did we learn', 'wrap up', or at session end."
user-invokable: true
argument-hint: "retro, retro --dry-run, retro --focus architecture"
license: MIT
metadata:
  version: "1.0.0"
  author: "Brian Morin"
  homepage: "https://github.com/bdmorin/the-no-shop"
  category: productivity
  inspired-by:
    - name: "jwynia/agent-skills — context-retrospective"
      url: "https://github.com/jwynia/agent-skills"
      contribution: "6-dimension analysis framework, anti-pattern library (The Completeness Illusion, The Guidance Overdose), 3-phase retrospective process"
    - name: "onekeyhq/app-monorepo — 1k-retrospective"
      url: "https://github.com/onekeyhq/app-monorepo"
      contribution: "Case-log-to-rule-improvement feedback loop, pattern threshold gates, concrete rule change proposals from observed failures"
---

# Retro — Session Retrospective

<!-- Credits:
  Analysis framework adapted from jwynia/agent-skills context-retrospective
  (https://github.com/jwynia/agent-skills) — 6-dimension transcript analysis,
  anti-pattern detection, prioritized gap analysis.

  Feedback loop pattern adapted from onekeyhq/app-monorepo 1k-retrospective
  (https://github.com/onekeyhq/app-monorepo) — case logging, pattern threshold
  gates (3+ occurrences), concrete rule edits from observed failures.

  Both MIT licensed. This skill is a hybrid that combines jwynia's analytical
  depth with onekeyhq's operational feedback loop, redesigned to run inside
  a live Claude Code session rather than post-hoc transcript analysis.
-->

Analyzes the current conversation to produce a structured retrospective. This runs INSIDE the session — you already have full context. No transcript extraction needed.

## Trigger

Invoke when:
- User says "retro", "session retro", "what did we learn", "wrap up"
- A significant block of work completes within a session
- Session is winding down after substantial work

## Input Parsing

- `--dry-run`: Print the retro to stdout only, don't persist anywhere
- `--focus TOPIC`: Narrow analysis to a specific area (architecture, debugging, tooling, etc.)
- No args = full session retro, printed to stdout

## Analysis Framework

You have the full conversation context. Analyze it through these six dimensions:

### Dimension 1: Session Origin Story
- What prompted this session? What was the user's opening intent?
- Did the scope shift? When and why?
- How did the final outcome relate to the original intent?

### Dimension 2: Key Decisions
- What non-obvious decisions were made? (architecture choices, tool selection, approach pivots)
- What alternatives were considered and rejected? Why?
- Which decisions were the user's vs. the agent's?

### Dimension 3: Lessons Learned
- What worked that should be repeated?
- What failed or was harder than expected?
- What would you do differently if starting over?
- Any recurring patterns that suggest a rule or convention?

### Dimension 4: Blockers and Resolutions
- What blocked progress? (tool failures, missing context, ambiguity, external dependencies)
- How was each blocker resolved? (workaround, root fix, human help, abandoned)
- Unresolved blockers that carry forward

### Dimension 5: Insights
- Non-obvious findings about the codebase, tools, or domain
- Things the user said that should be remembered (preferences, corrections, context)
- Connections to other projects or prior work

### Dimension 6: Artifacts and Unfinished Work
- Files created, modified, or deleted
- Commits made
- Work that was started but not completed
- Explicit TODOs or follow-ups mentioned

## Output Format

Produce a structured retro document. Write it to `{cwd}/tmp/` using the project's tmp convention if a `./tmp/` directory exists, otherwise print inline.

```markdown
# Session Retro: {BRIEF_TITLE}

**Date**: {YYYY-MM-DD}
**Project**: {project slug from CWD}
**Branch**: {git branch}
**Duration**: {approximate from conversation flow}

## Origin Story
{1-3 sentences: what started this session, how scope evolved}

## Key Decisions
{Numbered list. Each: what was decided, why, what was rejected}

## Lessons Learned
{Bulleted. Each: observation + recommendation}

## Blockers & Resolutions
{Table or list: blocker | resolution | status (resolved/workaround/open)}

## Insights
{Bulleted. Non-obvious findings worth remembering across sessions}

## Artifacts
- **Created**: {files}
- **Modified**: {files}
- **Commits**: {hashes + messages}
- **Unfinished**: {items}

## Proposed Rule Changes
{ONLY if the session revealed patterns that should become rules or conventions}
- **Rule**: {the rule}
- **Evidence**: {what happened in this session that motivates it}
- **Where**: {which config file or convention doc}
```

## Quality Gates

Before producing the retro, verify:

1. **Session had substance.** If the conversation was < 5 exchanges, say so and produce a one-liner summary instead of a full retro. Don't pad.
2. **Don't invent.** Only report what actually happened in the conversation. If you're uncertain whether something happened, say "uncertain" — do not fabricate exchanges or decisions.
3. **No sycophancy in the retro.** If the session went poorly, say so. If a decision was questionable, flag it. The retro is for learning, not validation.

## What This Skill Does NOT Do

- Modify any code or files (except writing the retro output)
- Propose work for next session (that's the user's call)
- Auto-update config files (proposes rules, user decides)
