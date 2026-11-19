from typing import List, Optional, Dict
from pydantic import BaseModel, Field
from app.schemas.rag_schema import SourceCitation, RAGMode

class ChatGenerateRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Student's natural-language question or message")
    user_id: str = Field(..., description="User ID for student document isolation")
    conversation_id: Optional[str] = Field(None, description="Optional ID of existing conversation")
    document_id: Optional[str] = Field(None, description="Optional single document ID to scope retrieval")
    document_ids: Optional[List[str]] = Field(None, description="Optional list of document IDs to scope retrieval")
    conversation_history: Optional[List[Dict[str, str]]] = Field(
        None, description="Recent conversation turns [{'role': 'user'|'assistant', 'content': '...'}]"
    )
    mode: RAGMode = Field(RAGMode.STANDARD, description="Response mode: 'standard' or 'simple_explanation'")
    top_k: int = Field(5, ge=1, le=20, description="Max chunks to retrieve")
    min_relevance: float = Field(0.35, ge=0.0, le=1.0, description="Minimum relevance threshold")
    model: Optional[str] = Field(None, description="Override LLM model name")

class ChatGenerateResponse(BaseModel):
    query: str = Field(..., description="Normalized user query")
    answer: str = Field(..., description="AI response grounded in documents")
    sources: List[SourceCitation] = Field(default_factory=list, description="Programmatically verified source citations")
    conversation_id: Optional[str] = Field(None, description="Conversation ID")
    mode: str = Field(..., description="Mode used for generating response")
    total_chunks_retrieved: int = Field(..., description="Number of chunks retrieved")
    insufficient_context: bool = Field(False, description="Flagged true if question lacks support in documents")
    latency_ms: float = Field(..., description="End-to-end response latency in milliseconds")
    model: str = Field(..., description="LLM model used")
    suggested_follow_ups: List[str] = Field(default_factory=list, description="Dynamic relevant follow-up questions")
    thinking: Optional[str] = Field(None, description="Reasoning or thinking trace")

