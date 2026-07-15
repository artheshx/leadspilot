"""
LeadPilot AI Manager — the Brain.

One LLM-driven reasoning loop per chat turn:
  1. Load business memory + recent conversation history.
  2. Ask the LLM to decide the next step: call a tool, ask the user a
     clarifying question, or give a final response.
  3. If it calls a tool, run it (via the Tool Registry — never directly),
     append the result (or error) to the turn's scratchpad, and loop.
  4. Stop on ask_user / final_response, or after MAX_STEPS as a safety valve.

Tools never call each other. The Manager is the only orchestrator, and it is
the only thing that decides when a write action is confirmed for real.
"""
import json

from app.db import conversation_store
from app.services import llm_service
from app.tools import memory_tool, support_tool
from app.tools.base import ToolError
from app.tools.registry import get_tool, render_tool_catalog
from app.manager.prompts import build_system_prompt

MAX_STEPS = 6
HISTORY_TURNS = 12


class ManagerResponse:
    def __init__(self, message: str, awaiting_user: bool = False, trace: list = None):
        self.message = message
        self.awaiting_user = awaiting_user
        self.trace = trace or []

    def to_dict(self) -> dict:
        return {"message": self.message, "awaiting_user": self.awaiting_user, "trace": self.trace}


def run_turn(business_id: str, user_message: str, include_trace: bool = False) -> ManagerResponse:
    if not business_id:
        raise ValueError("business_id is required.")
    if not user_message or not user_message.strip():
        raise ValueError("message is required.")

    history = conversation_store.get_history(business_id, limit=HISTORY_TURNS)
    memory = memory_tool.get_business_memory(business_id)
    conversation_store.append(business_id, "user", user_message)

    system_prompt = build_system_prompt(render_tool_catalog(), memory)
    scratchpad: list[dict] = []
    trace: list[dict] = []

    for step in range(MAX_STEPS):
        transcript = _render_transcript(history, user_message, scratchpad)

        try:
            decision = llm_service.chat_json(transcript, system=system_prompt)
        except llm_service.LLMError as e:
            support_tool.escalate(business_id, "api_error", f"AI Manager reasoning failure: {e}")
            return _finalize(
                business_id,
                "I'm having trouble thinking this through right now (the AI service is unavailable). "
                "I've flagged this to support — please try again in a moment.",
                trace, include_trace,
            )

        action = decision.get("action")
        trace.append({"step": step, "decision": decision})

        if action == "final_response":
            message = (decision.get("message") or "").strip() or "Done."
            return _finalize(business_id, message, trace, include_trace)

        if action == "ask_user":
            question = (decision.get("question") or "").strip() or "Could you clarify what you'd like to do next?"
            return _finalize(business_id, question, trace, include_trace, awaiting_user=True)

        if action == "call_tool":
            tool_name = decision.get("tool")
            args = dict(decision.get("args") or {})
            tool = get_tool(tool_name)

            if tool is None:
                scratchpad.append({"tool": tool_name, "args": args, "error": f"Unknown tool '{tool_name}'."})
                continue

            args.setdefault("business_id", business_id)
            result, error = _run_tool_with_retry(tool, args)
            scratchpad.append({"tool": tool_name, "args": args, "result": result, "error": error})

            if error:
                support_tool.escalate(business_id, "api_error", f"{tool_name} failed twice: {error}")
            continue

        # Malformed / unrecognized decision shape — record and keep going.
        scratchpad.append({"tool": None, "args": {}, "error": f"Malformed manager decision: {decision}"})

    return _finalize(
        business_id,
        "I've gathered some information but need a bit more direction to finish this — "
        "could you tell me what you'd like to do next?",
        trace, include_trace, awaiting_user=True,
    )


def _run_tool_with_retry(tool, args: dict):
    """Runs a tool; on failure, retries once with the same args (transient
    errors like a flaky Ollama call), then gives up and returns the error
    string for the Manager to reason about on its next step."""
    try:
        return tool.run(**args), None
    except ToolError as e:
        try:
            return tool.run(**args), None
        except ToolError as e2:
            return None, str(e2)


def _render_transcript(history: list, user_message: str, scratchpad: list) -> str:
    parts = []
    if history:
        parts.append("Recent conversation:")
        for turn in history:
            role = "User" if turn["role"] == "user" else "LeadPilot"
            parts.append(f"{role}: {turn['content']}")

    parts.append(f"\nLatest user message: {user_message}")

    if scratchpad:
        parts.append("\nTool calls made so far this turn (most recent last):")
        for entry in scratchpad:
            if entry.get("error"):
                parts.append(f"- {entry['tool']}({entry['args']}) -> ERROR: {entry['error']}")
            else:
                parts.append(f"- {entry['tool']}({entry['args']}) -> {json.dumps(entry['result'])}")

    parts.append(
        "\nDecide your next action now. Respond with ONLY the JSON object described in the system prompt."
    )
    return "\n".join(parts)


def _finalize(business_id: str, message: str, trace: list, include_trace: bool,
              awaiting_user: bool = False) -> ManagerResponse:
    conversation_store.append(business_id, "assistant", message)
    return ManagerResponse(message=message, awaiting_user=awaiting_user, trace=trace if include_trace else [])
