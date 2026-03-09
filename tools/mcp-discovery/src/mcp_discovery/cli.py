"""CLI entry point for mcp-discovery."""

from __future__ import annotations

import json
import os
import sys
import time

import click
from rich.console import Console
from rich.table import Table

from .agent import analyze_with_agent
from .dedup import deduplicate
from .discover import find_mcp_files
from .output import to_summary_table, to_unified_json
from .parser import parse_all

console = Console(stderr=True)


@click.group()
@click.version_option()
def main():
    """MCP Discovery — Blazingly fast MCP config aggregator."""
    pass


@main.command()
@click.argument("root", default=".")
@click.option("--output", "-o", type=click.Path(), help="Write unified config to file")
@click.option("--smart", is_flag=True, help="Use Claude agent for intelligent analysis")
@click.option("--no-comments", is_flag=True, help="Omit provenance comments from output")
@click.option("--format", "fmt", type=click.Choice(["json", "table", "both"]), default="both", help="Output format")
def scan(root: str, output: str | None, smart: bool, no_comments: bool, fmt: str):
    """Scan a directory tree for MCP configs, deduplicate, and output unified config."""
    t0 = time.perf_counter()

    # Phase 1: Discover
    with console.status("[bold blue]Discovering MCP configs..."):
        try:
            files = find_mcp_files(root)
        except RuntimeError as e:
            console.print(f"[red]Error:[/red] {e}")
            sys.exit(1)

    console.print(f"Found [bold]{len(files)}[/bold] MCP config files")

    if not files:
        console.print("[yellow]No MCP config files found.[/yellow]")
        sys.exit(0)

    # Phase 2: Parse
    with console.status("[bold blue]Parsing configs..."):
        servers = parse_all(files, root)

    console.print(f"Parsed [bold]{len(servers)}[/bold] server entries")

    # Phase 3: Deduplicate
    with console.status("[bold blue]Deduplicating..."):
        unique = deduplicate(servers)

    console.print(
        f"Deduplicated to [bold green]{len(unique)}[/bold green] unique servers "
        f"(removed {len(servers) - len(unique)} duplicates)"
    )

    # Phase 4: Smart analysis (optional)
    analysis = None
    if smart:
        with console.status("[bold magenta]Running Claude agent analysis..."):
            try:
                analysis = analyze_with_agent(unique)
            except Exception as e:
                console.print(f"[yellow]Agent analysis failed:[/yellow] {e}")
                console.print("Continuing with local dedup results.")

    elapsed = time.perf_counter() - t0

    # Output
    if fmt in ("table", "both"):
        _print_table(unique, analysis)

    if fmt in ("json", "both"):
        unified = to_unified_json(unique, comments=not no_comments)
        if output:
            os.makedirs(os.path.dirname(os.path.abspath(output)), exist_ok=True)
            with open(output, "w") as f:
                f.write(unified)
            console.print(f"\nWritten to [bold]{output}[/bold]")
        else:
            # Print JSON to stdout (not stderr like the rest)
            click.echo(unified)

    if analysis:
        _print_analysis(analysis)

    console.print(f"\n[dim]Completed in {elapsed:.2f}s[/dim]")


@main.command()
@click.argument("root", default=".")
def list_files(root: str):
    """List all MCP config files found in the directory tree."""
    files = find_mcp_files(root)
    for f in files:
        click.echo(f)
    console.print(f"\n[dim]{len(files)} files found[/dim]")


def _print_table(servers, analysis):
    """Print a rich table of servers."""
    table = Table(title="MCP Discovery", show_lines=True)
    table.add_column("Name", style="bold cyan")
    table.add_column("Transport", style="dim")
    table.add_column("Command / URL", max_width=60)
    table.add_column("Env Vars", justify="center")
    table.add_column("Sources", justify="center")

    # Build analysis lookup
    analysis_map = {}
    if analysis and "servers" in analysis:
        for entry in analysis["servers"]:
            analysis_map[entry.get("original_name", "")] = entry

    for s in servers:
        cmd_url = s.url if s.transport == "http" else f"{s.command} {' '.join(s.args[:3])}"
        if len(s.args) > 3:
            cmd_url += "..."

        name_display = s.name
        a = analysis_map.get(s.name)
        if a and a.get("suggested_name") != s.name:
            name_display = f"{s.name} -> [green]{a['suggested_name']}[/green]"
        if a and a.get("category"):
            name_display += f"\n[dim]{a['category']}[/dim]"

        table.add_row(
            name_display,
            s.transport,
            cmd_url,
            str(len(s.env)),
            str(len(s.sources)),
        )

    console.print(table)


def _print_analysis(analysis):
    """Print agent analysis results."""
    console.print("\n[bold magenta]Agent Analysis[/bold magenta]")

    if "summary" in analysis:
        console.print(f"\n{analysis['summary']}")

    warnings = analysis.get("security_warnings", [])
    if warnings:
        console.print("\n[bold red]Security Warnings:[/bold red]")
        for w in warnings:
            console.print(f"  [red]![/red] {w}")


if __name__ == "__main__":
    main()
