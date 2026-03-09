"""Tests for MCP data models."""

from mcp_discovery.models import McpServer


def test_stdio_fingerprint_stable():
    """Same command+args should produce same fingerprint."""
    s1 = McpServer(name="a", transport="stdio", command="npx", args=["-y", "pkg"])
    s2 = McpServer(name="b", transport="stdio", command="npx", args=["-y", "pkg"])
    assert s1.fingerprint == s2.fingerprint


def test_different_args_different_fingerprint():
    """Different args should produce different fingerprints."""
    s1 = McpServer(name="a", transport="stdio", command="npx", args=["--v1"])
    s2 = McpServer(name="a", transport="stdio", command="npx", args=["--v2"])
    assert s1.fingerprint != s2.fingerprint


def test_http_fingerprint_by_url():
    """HTTP servers fingerprint by URL, not name."""
    s1 = McpServer(name="slack", transport="http", url="https://mcp.slack.com/mcp")
    s2 = McpServer(name="slack-remote", transport="http", url="https://mcp.slack.com/mcp")
    assert s1.fingerprint == s2.fingerprint


def test_to_dict_stdio():
    """to_dict for stdio server should include command and args."""
    s = McpServer(
        name="test", transport="stdio",
        command="npx", args=["-y", "pkg"],
        env={"KEY": "val"},
    )
    d = s.to_dict()
    assert d["command"] == "npx"
    assert d["args"] == ["-y", "pkg"]
    assert d["env"] == {"KEY": "val"}
    assert "type" not in d  # stdio is default, omitted


def test_to_dict_http():
    """to_dict for http server should include type and url."""
    s = McpServer(
        name="test", transport="http",
        url="https://example.com/mcp",
        oauth={"clientId": "abc"},
    )
    d = s.to_dict()
    assert d["type"] == "http"
    assert d["url"] == "https://example.com/mcp"
    assert d["oauth"] == {"clientId": "abc"}
