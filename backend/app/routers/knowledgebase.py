from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pypdf import PdfReader
import io

from app.services import rag_service
from app.services.llm_service import LLMError
from app.auth import get_current_user, assert_business_access, CurrentUser

router = APIRouter(prefix="/knowledgebase", tags=["knowledgebase"], dependencies=[Depends(get_current_user)])


@router.post("/upload")
async def upload_document(business_id: str = Form(...), file: UploadFile = File(...),
                           user: CurrentUser = Depends(get_current_user)):
    assert_business_access(business_id, user)
    raw = await file.read()

    if file.filename.lower().endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(raw))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            raise HTTPException(400, f"Could not read PDF: {e}")
    else:
        try:
            text = raw.decode("utf-8", errors="ignore")
        except Exception as e:
            raise HTTPException(400, f"Could not read file as text: {e}")

    if not text.strip():
        raise HTTPException(400, "No extractable text found in the uploaded file.")

    try:
        chunk_count = rag_service.ingest_document(business_id, text, source_name=file.filename)
    except LLMError as e:
        raise HTTPException(503, str(e))

    return {"business_id": business_id, "source": file.filename, "chunks_stored": chunk_count}
