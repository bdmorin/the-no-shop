"""Data models for MCP server configurations."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field


@dataclass
class McpServer:
    """Normalized MCP server entry."""

    name: str
    transport: str  # "stdio" or "http"
    command: str | None = None
    args: list[str] = field(default_factory=list)
    env: dict[str, str] = field(default_factory=dict)
    url: str | None = None
    oauth: dict | None = None
    sources: list[str] = field(default_factory=list)

    @property
    def fingerprint(self) -> str:
        """Identity fingerprint for deduplication.

        Same command+args or same URL = same server, regardless of name.
        """
        if self.transport == "http" and self.url:
            key = f"http:{self.url}"
        elif self.command:
            key = f"stdio:{self.command}:{json.dumps(sorted(self.args))}"
        else:
            key = f"name:{self.name}"
        return hashlib.sha256(key.encode()).hexdigest()[:16]

    def to_dict(self) -> dict:
        """Convert to mcpServers entry format."""
        entry: dict = {}
        if self.transport == "http":
            entry["type"] = "http"
            if self.url:
                entry["url"] = self.url
            if self.oauth:
                entry["oauth"] = self.oauth
        else:
            if self.transport != "stdio":
                entry["type"] = self.transport
            if self.command:
                entry["command"] = self.command
            if self.args:
                entry["args"] = self.args
        if self.env:
            entry["env"] = self.env
        return entry
