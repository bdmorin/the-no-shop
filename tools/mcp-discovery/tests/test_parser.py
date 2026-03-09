"""Tests for MCP config parser."""

import json
import os
import tempfile

from mcp_discovery.parser import parse_mcp_file, parse_all


def _write_json(tmpdir: str, filename: str, data: dict) -> str:
    path = os.path.join(tmpdir, filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f)
    return path


def test_parse_standard_mcp_servers_format():
    """Standard { mcpServers: { ... } } format."""
    with tempfile.TemporaryDirectory() as tmpdir:
        path = _write_json(tmpdir, ".cursor/mcp.json", {
            "mcpServers": {
                "clickup": {
                    "command": "npx",
                    "args": ["-y", "mcp-remote", "https://mcp.clickup.com/mcp"],
                },
                "grafana": {
                    "command": "mcp-grafana",
                    "args": ["--disable-loki"],
                    "env": {"GRAFANA_URL": "https://example.com"},
                },
            }
        })

        servers = parse_mcp_file(path, tmpdir)
        assert len(servers) == 2

        by_name = {s.name: s for s in servers}
        assert "clickup" in by_name
        assert by_name["clickup"].command == "npx"
        assert by_name["clickup"].transport == "stdio"

        assert "grafana" in by_name
        assert by_name["grafana"].env["GRAFANA_URL"] == "https://example.com"


def test_parse_bare_plugin_format():
    """Bare { server-name: { command: ... } } format without mcpServers wrapper."""
    with tempfile.TemporaryDirectory() as tmpdir:
        path = _write_json(tmpdir, "playwright/.mcp.json", {
            "playwright": {
                "command": "npx",
                "args": ["@playwright/mcp@latest"],
            }
        })

        servers = parse_mcp_file(path, tmpdir)
        assert len(servers) == 1
        assert servers[0].name == "playwright"
        assert servers[0].command == "npx"


def test_parse_http_transport():
    """HTTP transport with url and oauth."""
    with tempfile.TemporaryDirectory() as tmpdir:
        path = _write_json(tmpdir, "slack/.mcp.json", {
            "slack": {
                "type": "http",
                "url": "https://mcp.slack.com/mcp",
                "oauth": {"clientId": "abc123", "callbackPort": 3118},
            }
        })

        servers = parse_mcp_file(path, tmpdir)
        assert len(servers) == 1
        assert servers[0].transport == "http"
        assert servers[0].url == "https://mcp.slack.com/mcp"
        assert servers[0].oauth["clientId"] == "abc123"


def test_parse_empty_mcp_servers():
    """Empty mcpServers dict should return no servers."""
    with tempfile.TemporaryDirectory() as tmpdir:
        path = _write_json(tmpdir, ".mcp.json", {"mcpServers": {}})
        servers = parse_mcp_file(path, tmpdir)
        assert len(servers) == 0


def test_parse_invalid_json():
    """Malformed JSON should return empty list, not crash."""
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "bad.json")
        with open(path, "w") as f:
            f.write("{this is not json")
        servers = parse_mcp_file(path, tmpdir)
        assert len(servers) == 0


def test_parse_all_aggregates():
    """parse_all should aggregate servers from multiple files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        p1 = _write_json(tmpdir, "a/.mcp.json", {
            "mcpServers": {"server-a": {"command": "cmd-a", "args": []}}
        })
        p2 = _write_json(tmpdir, "b/.mcp.json", {
            "mcpServers": {"server-b": {"command": "cmd-b", "args": []}}
        })

        servers = parse_all([p1, p2], tmpdir)
        assert len(servers) == 2
        names = {s.name for s in servers}
        assert names == {"server-a", "server-b"}


def test_provenance_tracking():
    """Sources should track which file a server came from."""
    with tempfile.TemporaryDirectory() as tmpdir:
        path = _write_json(tmpdir, "myproject/.cursor/mcp.json", {
            "mcpServers": {"test-server": {"command": "test", "args": []}}
        })

        servers = parse_mcp_file(path, tmpdir)
        assert len(servers) == 1
        assert "myproject/.cursor/mcp.json" in servers[0].sources[0]
