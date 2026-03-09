"""Agent-powered intelligent analysis of MCP configs using Claude Agent SDK.

Uses the Agent SDK which piggybacks on Claude Max subscription —
no separate API key needed.
"""

from __future__ import annotations

import json

import anyio
from claude_agent_sdk import (
    ClaudeAgentOptions,
    ClaudeSDKClient,
    AssistantMessage,
    ResultMessage,
    TextBlock,
    tool,
    create_sdk_mcp_server,
)

from .models import McpServer

# Will be populated before agent runs
_server_data: list[dict] = []
_analysis_result: dict | None = None


@tool(
    "get_servers",
    "Retrieve the current list of deduplicated MCP servers with their configs and provenance.",
    {},
)
async def get_servers(args):
    return {"content": [{"type": "text", "text": json.dumps(_server_data, indent=2)}]}


@tool(
    "submit_analysis",
    "Submit analysis results with refined server configs, categories, and security warnings.",
    {
        "servers": list,
        "summary": str,
        "security_warnings": list,
    },
)
async def submit_analysis(args):
    global _analysis_result
    _analysis_result = args
    return {"content": [{"type": "text", "text": "Analysis accepted."}]}


SYSTEM_PROMPT = """You are an MCP (Model Context Protocol) configuration analyst.

You receive a collection of deduplicated MCP server configurations and provide
intelligent analysis: better naming, categorization, and recommendations.

Use get_servers to retrieve the server list, then submit_analysis with your results.

For submit_analysis, the servers array should contain objects with:
- original_name: current server name
- suggested_name: your recommended name (or same if fine)
- category: one of: development, monitoring, productivity, search, browser, ai, media, other
- notes: brief note about this server (optional)
- keep: true if this server seems useful, false if redundant/outdated

Rules:
- Suggest clearer names where the current name is generic
- Categorize servers by function
- Flag potential security concerns (exposed API keys, overly broad permissions)
- Identify servers that might be redundant or outdated
- Be concise and actionable
"""


async def _run_agent() -> dict | None:
    global _analysis_result
    _analysis_result = None

    server = create_sdk_mcp_server("mcp-analysis-tools", tools=[get_servers, submit_analysis])

    options = ClaudeAgentOptions(
        system_prompt=SYSTEM_PROMPT,
        mcp_servers={"analysis": server},
        max_turns=10,
    )

    async with ClaudeSDKClient(options=options) as client:
        await client.query(
            "Analyze my MCP server configurations. "
            "Use get_servers to see the list, then submit_analysis with your recommendations."
        )
        async for message in client.receive_response():
            pass  # Let the agent run to completion

    return _analysis_result


def analyze_with_agent(servers: list[McpServer]) -> dict | None:
    """Run Claude agent to analyze and refine the server list.

    Uses the Agent SDK (Claude Max subscription, no API key needed).
    Returns the analysis dict or None if the agent fails.
    """
    global _server_data

    _server_data = []
    for s in servers:
        _server_data.append({
            "name": s.name,
            "transport": s.transport,
            "command": s.command,
            "args": s.args,
            "url": s.url,
            "env_keys": list(s.env.keys()),
            "sources": s.sources,
        })

    return anyio.run(_run_agent)
