"""
Knowledge Base / RAG module — ChromaDB (local, free, persisted to disk) +
Ollama embeddings. Each client's KB is isolated by business_id (collection name).
"""
import uuid
import chromadb

from app import config
from app.services import llm_service, chunking


def _get_client():
    return chromadb.PersistentClient(path=config.CHROMA_PATH)


def _collection_name(business_id: str) -> str:
    # Chroma collection names must be simple; prefix keeps multi-tenant isolation obvious.
    return f"kb_{business_id}"


def ingest_document(business_id: str, text: str, source_name: str = "document") -> int:
    """Chunk a document's text, embed each chunk via Ollama, store in the client's collection.
    Returns the number of chunks stored."""
    chunks = chunking.chunk_text(
        text, chunk_size=config.DEFAULT_CHUNK_SIZE, overlap=config.DEFAULT_CHUNK_OVERLAP
    )
    if not chunks:
        return 0

    client = _get_client()
    collection = client.get_or_create_collection(_collection_name(business_id))

    ids, embeddings, metadatas, documents = [], [], [], []
    for chunk in chunks:
        ids.append(str(uuid.uuid4()))
        embeddings.append(llm_service.embed(chunk))
        metadatas.append({"source": source_name})
        documents.append(chunk)

    collection.add(ids=ids, embeddings=embeddings, metadatas=metadatas, documents=documents)
    return len(chunks)


def retrieve(business_id: str, query: str, top_k: int = None) -> list:
    """Return the top_k most relevant chunks for a query from this business's KB.
    Returns [] if the business has no KB yet (falls back to default LLM knowledge)."""
    top_k = top_k or config.RAG_TOP_K
    client = _get_client()
    try:
        collection = client.get_collection(_collection_name(business_id))
    except Exception:
        return []

    if collection.count() == 0:
        return []

    query_embedding = llm_service.embed(query)
    results = collection.query(query_embeddings=[query_embedding], n_results=min(top_k, collection.count()))
    return results.get("documents", [[]])[0]
