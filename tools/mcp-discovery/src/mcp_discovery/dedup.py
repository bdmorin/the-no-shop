"""Deduplicate MCP server configs by fingerprint."""

from __future__ import annotations

from collections import defaultdict

from .models import McpServer


def _merge_env_with_provenance(servers: list[McpServer]) -> dict[str, str]:
    """Merge env vars from multiple instances of the same server.

    When env var values differ across sources, pick the first non-placeholder
    value and add a comment noting provenance.
    """
    env: dict[str, str] = {}
    env_sources: dict[str, list[str]] = defaultdict(list)

    placeholder_patterns = {
        "ANTHROPIC_API_KEY_HERE",
        "YOUR_API_KEY",
        "your-api-key",
        "",
    }

    for server in servers:
        for key, val in server.env.items():
            env_sources[key].extend(server.sources)
            if key not in env or env[key] in placeholder_patterns:
                if val not in placeholder_patterns:
                    env[key] = val

    return env


def _pick_best_name(servers: list[McpServer]) -> str:
    """Pick the most descriptive name from a group of duplicate servers."""
    # Prefer names without generic prefixes, longer = more descriptive
    names = sorted(
        {s.name for s in servers},
        key=lambda n: (-len(n), n),
    )
    return names[0] if names else servers[0].name


def deduplicate(servers: list[McpServer]) -> list[McpServer]:
    """Deduplicate servers by fingerprint.

    Servers with the same fingerprint (same command+args or same URL) are
    merged: sources are aggregated, env vars are merged with provenance,
    and the most descriptive name is kept.

    If truly distinct servers share the same name, they get incremented
    suffixes (clickup-1, clickup-2, etc).
    """
    # Group by fingerprint
    groups: dict[str, list[McpServer]] = defaultdict(list)
    for server in servers:
        groups[server.fingerprint].append(server)

    # Merge each group into a single canonical server
    merged: list[McpServer] = []
    for fingerprint, group in groups.items():
        canonical = McpServer(
            name=_pick_best_name(group),
            transport=group[0].transport,
            command=group[0].command,
            args=group[0].args,
            url=group[0].url,
            oauth=group[0].oauth,
            env=_merge_env_with_provenance(group),
            sources=sorted(
                {src for s in group for src in s.sources}
            ),
        )
        merged.append(canonical)

    # Handle name collisions among distinct servers
    name_counts: dict[str, list[McpServer]] = defaultdict(list)
    for server in merged:
        name_counts[server.name].append(server)

    result: list[McpServer] = []
    for name, group in name_counts.items():
        if len(group) == 1:
            result.append(group[0])
        else:
            for i, server in enumerate(group, 1):
                server.name = f"{name}-{i}"
                result.append(server)

    return sorted(result, key=lambda s: s.name)
