"""Parse MCP config files from all IDE formats into normalized McpServer objects."""

from __future__ import annotations

import json
import os
from pathlib import Path

from .models import McpServer


def _relative_source(filepath: str, root: str) -> str:
    """Get a human-readable relative path for provenance tracking."""
    try:
        return str(Path(filepath).relative_to(root))
    except ValueError:
        return filepath


def _parse_server_entry(
    name: str, entry: dict, source: str
) -> McpServer | None:
    """Parse a single server entry dict into an McpServer."""
    if not isinstance(entry, dict):
        return None

    transport = entry.get("type", "stdio")

    # HTTP transport (url-based)
    if transport == "http" or "url" in entry:
        return McpServer(
            name=name,
            transport="http",
            url=entry.get("url"),
            oauth=entry.get("oauth"),
            env=entry.get("env", {}),
            sources=[source],
        )

    # stdio transport (command-based)
    command = entry.get("command")
    if not command:
        return None

    return McpServer(
        name=name,
        transport="stdio",
        command=command,
        args=entry.get("args", []),
        env=entry.get("env", {}),
        sources=[source],
    )


def parse_mcp_file(filepath: str, root: str) -> list[McpServer]:
    """Parse a single MCP JSON file, handling all known schema variants.

    Returns a list of McpServer objects found in the file.
    """
    source = _relative_source(filepath, root)

    try:
        with open(filepath, "r") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []

    if not isinstance(data, dict):
        return []

    servers: list[McpServer] = []

    # Schema 1: { "mcpServers": { "name": { ... } } }
    if "mcpServers" in data:
        mcp_servers = data["mcpServers"]
        if isinstance(mcp_servers, dict):
            for name, entry in mcp_servers.items():
                server = _parse_server_entry(name, entry, source)
                if server:
                    servers.append(server)
        return servers

    # Schema 2: { "server-name": { "command": ..., ... } }
    # Bare plugin format — each top-level key is a server name
    for name, entry in data.items():
        if isinstance(entry, dict) and ("command" in entry or "url" in entry or "type" in entry):
            server = _parse_server_entry(name, entry, source)
            if server:
                servers.append(server)

    return servers


def parse_all(filepaths: list[str], root: str) -> list[McpServer]:
    """Parse all MCP files and return flat list of servers."""
    all_servers: list[McpServer] = []
    for fp in filepaths:
        all_servers.extend(parse_mcp_file(fp, root))
    return all_servers
