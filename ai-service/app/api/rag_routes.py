from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
import json
from app.schemas.rag_schema import (
    RAGQueryRequest,
    RAGQueryResponse,
    RAGRetrieveRequest,
    RAGRetrieveResponse,
    RetrievedChunkDetail,
    RAGMode,
)
from app.rag.rag_pipeline import rag_pipeline
from app.rag.retriever import rag_retriever
from app.llm.ollama_client import ollama_client
from app.vector_store.chroma_client import chroma_store
from app.core.logging import logger

router = APIRouter(prefix="/ai/rag", tags=["RAG Engine"])

@router.post("/query", response_model=RAGQueryResponse)
async def execute_rag_query(request: RAGQueryRequest):
    """
    Main RAG question-answering endpoint.
    Retrieves grounded context, generates answer via local Ollama LLM,
    and attaches programmatic citations with page/slide references.
    """
    try:
        response = rag_pipeline.execute(request)
        return response
    except TimeoutError as e:
        logger.error(f"RAG query timeout: {e}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Inference timed out: {str(e)}"
        )
    except ConnectionError as e:
        logger.error(f"Ollama connection error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"LLM service unavailable: {str(e)}"
        )
    except Exception as e:
        logger.error(f"RAG execution failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG pipeline error: {str(e)}"
        )

@router.post("/explain-simply", response_model=RAGQueryResponse)
async def explain_simply(request: RAGQueryRequest):
    """
    Targeted endpoint for beginner-friendly conceptual explanations with analogies.
    """
    request.mode = RAGMode.SIMPLE_EXPLANATION
    return await execute_rag_query(request)

@router.post("/retrieve", response_model=RAGRetrieveResponse)
async def semantic_retrieve(request: RAGRetrieveRequest):
    """
    Exposes raw semantic retrieval with deduplication, filtering, and student isolation.
    """
    try:
        chunks, is_insufficient = rag_retriever.retrieve(
            query=request.query,
            user_id=request.user_id,
            document_id=request.document_id,
            document_ids=request.document_ids,
            top_k=request.top_k,
            min_relevance=request.min_relevance,
        )

        detail_chunks = [
            RetrievedChunkDetail(
                chunk_id=c.get("chunk_id", ""),
                document_id=c.get("document_id", ""),
                document_name=c.get("filename", ""),
                page_number=c.get("page_number", 1),
                token_count=c.get("token_count", 0),
                content=c.get("content", ""),
                relevance_score=c.get("relevance_score", 0.0),
            )
            for c in chunks
        ]

        return RAGRetrieveResponse(
            query=request.query,
            count=len(detail_chunks),
            chunks=detail_chunks,
            insufficient_context=is_insufficient,
        )
    except Exception as e:
        logger.error(f"Retrieval error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Semantic retrieval failed: {str(e)}"
        )

@router.post("/stream")
async def stream_rag_query(request: RAGQueryRequest):
    """
    Server-Sent Events (SSE) streaming endpoint for live token streaming.
    """
    def event_generator():
        try:
            for item in rag_pipeline.execute_stream(request):
                event_name = item.get("event", "message")
                data_str = json.dumps(item.get("data", {}))
                yield f"event: {event_name}\ndata: {data_str}\n\n"
        except Exception as e:
            err_data = json.dumps({"error": str(e)})
            yield f"event: error\ndata: {err_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )

@router.get("/health")
async def rag_health_check():
    """
    Health check verifying ChromaDB vector store and Ollama LLM readiness.
    """
    ollama_info = ollama_client.check_health()
    chroma_ok = False
    total_vectors = 0
    try:
        total_vectors = chroma_store.collection.count()
        chroma_ok = True
    except Exception:
        pass

    return {
        "status": "healthy" if (ollama_info.get("status") == "healthy" and chroma_ok) else "degraded",
        "ollama": ollama_info,
        "chromadb": {
            "status": "online" if chroma_ok else "unreachable",
            "total_vectors": total_vectors,
            "collection": chroma_store.collection_name,
        }
    }

