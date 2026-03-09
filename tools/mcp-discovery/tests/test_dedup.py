"""Tests for MCP config deduplication."""

from mcp_discovery.dedup import deduplicate
from mcp_discovery.models import McpServer


def test_identical_servers_merge():
    """Same command+args from different projects should merge."""
    servers = [
        McpServer(
            name="clickup", transport="stdio",
            command="npx", args=["-y", "mcp-remote", "https://mcp.clickup.com/mcp"],
            sources=["project-a/.cursor/mcp.json"],
        ),
        McpServer(
            name="clickup", transport="stdio",
            command="npx", args=["-y", "mcp-remote", "https://mcp.clickup.com/mcp"],
            sources=["project-b/.roo/mcp.json"],
        ),
    ]

    result = deduplicate(servers)
    assert len(result) == 1
    assert len(result[0].sources) == 2


def test_different_servers_kept():
    """Servers with different commands should not be merged."""
    servers = [
        McpServer(
            name="grafana", transport="stdio",
            command="mcp-grafana", args=["--disable-loki"],
            sources=["a/mcp.json"],
        ),
        McpServer(
            name="clickup", transport="stdio",
            command="npx", args=["-y", "mcp-remote"],
            sources=["b/mcp.json"],
        ),
    ]

    result = deduplicate(servers)
    assert len(result) == 2


def test_name_collision_incremented():
    """Different servers with same name get incremented suffixes."""
    servers = [
        McpServer(
            name="grafana", transport="stdio",
            command="mcp-grafana", args=["--v1"],
            sources=["a/mcp.json"],
        ),
        McpServer(
            name="grafana", transport="stdio",
            command="mcp-grafana", args=["--v2"],
            sources=["b/mcp.json"],
        ),
    ]

    result = deduplicate(servers)
    assert len(result) == 2
    names = {s.name for s in result}
    assert "grafana-1" in names
    assert "grafana-2" in names


def test_http_servers_dedup_by_url():
    """HTTP servers with same URL should merge."""
    servers = [
        McpServer(
            name="slack", transport="http",
            url="https://mcp.slack.com/mcp",
            sources=["a/.mcp.json"],
        ),
        McpServer(
            name="slack-mcp", transport="http",
            url="https://mcp.slack.com/mcp",
            sources=["b/.mcp.json"],
        ),
    ]

    result = deduplicate(servers)
    assert len(result) == 1
    assert len(result[0].sources) == 2


def test_env_merge_prefers_real_values():
    """When merging, real values should win over placeholders."""
    servers = [
        McpServer(
            name="test", transport="stdio",
            command="cmd", args=[],
            env={"API_KEY": "YOUR_API_KEY"},
            sources=["a/mcp.json"],
        ),
        McpServer(
            name="test", transport="stdio",
            command="cmd", args=[],
            env={"API_KEY": "sk-real-key-123"},
            sources=["b/mcp.json"],
        ),
    ]

    result = deduplicate(servers)
    assert len(result) == 1
    assert result[0].env["API_KEY"] == "sk-real-key-123"


def test_sorted_output():
    """Output should be sorted by name."""
    servers = [
        McpServer(name="zebra", transport="stdio", command="z", args=[], sources=["a"]),
        McpServer(name="alpha", transport="stdio", command="a", args=[], sources=["b"]),
        McpServer(name="middle", transport="stdio", command="m", args=[], sources=["c"]),
    ]

    result = deduplicate(servers)
    names = [s.name for s in result]
    assert names == ["alpha", "middle", "zebra"]
