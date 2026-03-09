"""Discover MCP config files using fd."""

from __future__ import annotations

import subprocess


def find_mcp_files(root: str) -> list[str]:
    """Find all MCP JSON config files under root using fd.

    Uses fd with -uuu (unrestricted: hidden + ignored + no-ignore) for
    complete coverage, matching any file with 'mcp' in the name ending in .json.
    """
    result = subprocess.run(
        ["fd", "-uuu", "-tf", "-i", ".*mcp.*\\.json", root],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"fd failed: {result.stderr}")

    paths = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    return sorted(paths)
