"""Output formatters for unified MCP config."""

from __future__ import annotations

import json

from .models import McpServer


def to_unified_json(servers: list[McpServer], comments: bool = True) -> str:
    """Generate a unified mcpServers JSON config.

    When comments=True, env var entries include provenance comments
    as _comment fields showing which projects the server was found in.
    """
    mcp_servers: dict = {}

    for server in servers:
        entry = server.to_dict()

        if comments and server.sources:
            entry["_sources"] = server.sources

        mcp_servers[server.name] = entry

    output = {"mcpServers": mcp_servers}
    return json.dumps(output, indent=2)


def to_summary_table(servers: list[McpServer]) -> list[dict]:
    """Generate a summary table of servers for display."""
    rows = []
    for s in servers:
        rows.append({
            "name": s.name,
            "transport": s.transport,
            "command/url": s.url if s.transport == "http" else f"{s.command} {' '.join(s.args[:2])}{'...' if len(s.args) > 2 else ''}",
            "env_vars": len(s.env),
            "found_in": len(s.sources),
            "sources": s.sources,
        })
    return rows
