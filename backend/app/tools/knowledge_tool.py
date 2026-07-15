from app.services import rag_service
from app.tools.base import Tool


def _run(business_id: str, action: str = "search", query: str = "", **_kwargs) -> dict:
    if action == "search":
        if not query:
            raise ValueError("query is required for knowledge_tool action='search'.")
        results = rag_service.retrieve(business_id, query)
        return {"results": results}
    raise ValueError(f"Unknown knowledge_tool action '{action}'. Supported: 'search'.")


TOOL = Tool(
    name="knowledge_tool",
    description=(
        "Searches this business's uploaded knowledge base (docs, SOPs, brand notes) for relevant "
        "context. action='search' with a query. Documents are ingested separately via file upload, "
        "not through this tool."
    ),
    args_schema={
        "action": "'search' (string)",
        "query": "what to search the knowledge base for (string)",
    },
    handler=_run,
)
