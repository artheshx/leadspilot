"""
Tool base class for the LeadPilot AI Manager architecture.

A Tool is a self-contained capability (Business Analysis, Strategy, Creative,
Landing Page, Meta Ads, Analytics, Knowledge, Memory, Compliance, Support).
Tools:
  - are independent — a tool's handler must NEVER import or call another
    tool. If work needs two capabilities, that composition happens in the
    AI Manager's reasoning loop, one tool call at a time.
  - expose one `handler(**kwargs) -> dict` entrypoint. Internal branching on
    an `action` kwarg is fine (e.g. meta_ads_tool has many actions); what's
    not fine is a tool file importing from app.tools.<other_tool>.
  - raise ToolError (or let Tool.run wrap any other exception into one) so
    the Manager always sees a uniform error shape it can retry/fallback on.
"""
from dataclasses import dataclass
from typing import Callable


class ToolError(Exception):
    """Uniform error shape surfaced to the AI Manager for any tool failure."""
    pass


@dataclass
class Tool:
    name: str
    description: str
    args_schema: dict            # {arg_name: "human description (type)"} — rendered into the Manager's prompt
    handler: Callable[..., dict]  # kwargs in, JSON-serializable dict out
    requires_approval: bool = False  # hint surfaced in the prompt; real enforcement lives in the handler

    def run(self, **kwargs) -> dict:
        try:
            result = self.handler(**kwargs)
        except ToolError:
            raise
        except (ValueError, LookupError, PermissionError) as e:
            # Expected, user-facing failures (bad/missing args, not-found, not-yet-approved).
            raise ToolError(str(e)) from e
        except Exception as e:
            raise ToolError(f"{self.name} failed unexpectedly: {e}") from e

        if not isinstance(result, dict):
            raise ToolError(f"{self.name} returned a non-dict result — this is a bug in the tool.")
        return result
