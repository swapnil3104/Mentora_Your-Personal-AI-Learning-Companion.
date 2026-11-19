from typing import List, Optional
from pydantic import BaseModel, Field

class DocumentProcessRequest(BaseModel):
    document_id: str = Field(..., description="Unique document ID from PostgreSQL")
    user_id: str = Field(..., description="User ID for isolation")
    filename: str = Field(..., description="Original filename")
    file_path: str = Field(..., description="Absolute path to the uploaded file on disk")
    file_type: str = Field(..., description="File extension/type (pdf, docx, pptx, txt)")

class DocumentProcessResponse(BaseModel):
    status: str
    document_id: str
    page_count: int
    chunk_count: int
    message: str

class DocumentDeleteRequest(BaseModel):
    user_id: str

class DocumentDeleteResponse(BaseModel):
    status: str
    document_id: str
    deleted_chunks: int
    message: str

class VectorRetrievalRequest(BaseModel):
    query: str
    user_id: str
    document_id: Optional[str] = None
    top_k: int = 4

class RetrievedChunk(BaseModel):
    chunk_id: str
    document_id: str
    page_number: int
    content: str
    relevance_score: float

class VectorRetrievalResponse(BaseModel):
    query: str
    count: int
    chunks: List[RetrievedChunk]
