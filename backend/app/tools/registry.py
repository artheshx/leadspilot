"""
Tool Registry.

Collects every Tool instance and exposes:
  - get_tool(name) for the AI Manager to look up and run a chosen tool
  - render_tool_catalog() to describe all tools to the Manager's LLM prompt

This is the only file that imports all ten tool modules together — keeping
that aggregation in one place is what guarantees tools never call each
other directly (each tool module only imports app.services / app.db, never
app.tools.<sibling>).
"""
from app.tools.base import Tool
from app.tools import (
    analytics_tool,
    business_tool,
    compliance_tool,
    creative_tool,
    knowledge_tool,
    landingpage_tool,
    memory_tool,
    meta_ads_tool,
    strategy_tool,
    support_tool,
)

_ALL_TOOLS: list[Tool] = [
    business_tool.TOOL,
    strategy_tool.TOOL,
    creative_tool.TOOL,
    landingpage_tool.TOOL,
    meta_ads_tool.TOOL,
    analytics_tool.TOOL,
    knowledge_tool.TOOL,
    memory_tool.TOOL,
    compliance_tool.TOOL,
    support_tool.TOOL,
]

TOOLS: dict[str, Tool] = {t.name: t for t in _ALL_TOOLS}


def get_tool(name: str) -> Tool | None:
    return TOOLS.get(name)


def render_tool_catalog() -> str:
    lines = []
    for tool in _ALL_TOOLS:
        approval_note = " [WRITE ACTIONS ARE APPROVAL-GATED]" if tool.requires_approval else ""
        args = ", ".join(f"{k}: {v}" for k, v in tool.args_schema.items())
        lines.append(f"- {tool.name}{approval_note}\n  {tool.description}\n  args: {{{args}}}")
    return "\n".join(lines)
