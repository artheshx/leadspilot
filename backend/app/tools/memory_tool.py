from app.db import memory_store
from app.tools.base import Tool


def get_business_memory(business_id: str) -> dict:
    """Direct helper (not the Tool.run path) used by the AI Manager to load
    context at the start of every turn."""
    return memory_store.get_memory(business_id)


def _run(business_id: str, action: str = "recall", **kwargs) -> dict:
    if action == "recall":
        return {"memory": get_business_memory(business_id)}

    if action == "remember":
        data = kwargs.get("data")
        if not data:
            raise ValueError("data (object) is required for memory_tool action='remember'.")
        memory_store.update_memory(business_id, data)
        return {"saved": True, "memory": get_business_memory(business_id)}

    if action == "save_winning_creative":
        creative = kwargs.get("creative")
        if not creative:
            raise ValueError("creative (object) is required for memory_tool action='save_winning_creative'.")
        note = kwargs.get("note", "")
        creative_id = memory_store.add_winning_creative(business_id, creative, note)
        return {"saved": True, "id": creative_id}

    if action == "list_winning_creatives":
        return {"winning_creatives": memory_store.list_winning_creatives(business_id)}

    raise ValueError(
        f"Unknown memory_tool action '{action}'. Supported: recall, remember, "
        f"save_winning_creative, list_winning_creatives."
    )


TOOL = Tool(
    name="memory_tool",
    description=(
        "Stores and recalls durable facts about this business: profile, brand, preferences, past "
        "campaigns, winning creatives. actions: 'recall' (no args), 'remember' (data: object to "
        "merge into memory), 'save_winning_creative' (creative: object, note: string), "
        "'list_winning_creatives'. The business profile is already loaded into every turn "
        "automatically — only call this when you need something beyond what's already shown to you, "
        "or to explicitly save a new fact/preference the user just told you."
    ),
    args_schema={
        "action": "recall|remember|save_winning_creative|list_winning_creatives (string)",
    },
    handler=_run,
)
