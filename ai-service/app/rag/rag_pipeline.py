from typing import Dict, Any, List, Optional, Generator
import time
from app.rag.retriever import rag_retriever
from app.rag.context_builder import rag_context_builder
from app.rag.prompt_builder import rag_prompt_builder
from app.rag.citation_service import citation_service
from app.llm.ollama_client import ollama_client
from app.llm.response_handler import response_handler
from app.schemas.rag_schema import (
    RAGQueryRequest,
    RAGQueryResponse,
    SourceCitation,
    RAGMode,
)
from app.core.config import settings
from app.core.logging import logger

class RAGPipeline:
    """
    Central RAG pipeline orchestrating query processing, semantic retrieval,
    token-bounded context construction, prompt engineering, LLM inference,
    grounding verification, and programmatic citation management.
    """
    def execute(self, request: RAGQueryRequest) -> RAGQueryResponse:
        """
        Executes complete synchronous RAG pipeline for a student query.
        """
        start_time = time.time()
        normalized_query = rag_retriever.normalize_query(request.query)

        # 1. Semantic Retrieval
        chunks, is_insufficient = rag_retriever.retrieve(
            query=normalized_query,
            user_id=request.user_id,
            document_id=request.document_id,
            document_ids=request.document_ids,
            top_k=request.top_k,
            min_relevance=request.min_relevance,
        )

        # 2. Case: Completely insufficient retrieval results
        if is_insufficient or not chunks:
            fallback_text = response_handler.format_insufficient_context_fallback(normalized_query)
            latency_ms = round((time.time() - start_time) * 1000, 2)
            return RAGQueryResponse(
                query=normalized_query,
                answer=fallback_text,
                sources=[],
                mode=request.mode.value if isinstance(request.mode, RAGMode) else str(request.mode),
                total_chunks_retrieved=0,
                insufficient_context=True,
                latency_ms=latency_ms,
                model=request.model or settings.LLM_MODEL,
                thinking=None,
            )

        # 3. Context Construction with token ceiling
        context_str, context_tokens, included_chunks = rag_context_builder.build_context(chunks)

        # 4. Prompt Construction
        prompt_data = rag_prompt_builder.build_rag_prompt(
            question=normalized_query,
            context=context_str,
            history=request.conversation_history,
            mode=request.mode.value if isinstance(request.mode, RAGMode) else str(request.mode),
        )

        # 5. LLM Inference via Ollama
        target_model = request.model or settings.LLM_MODEL
        try:
            llm_result = ollama_client.generate(
                prompt=prompt_data["prompt"],
                system=prompt_data["system"],
                model=target_model,
            )
            raw_answer = llm_result.get("text", "")
            thinking_trace = llm_result.get("thinking")
        except Exception as e:
            logger.error(f"Inference error in RAG pipeline: {e}")
            raise

        # 6. Response Cleaning and Grounding Verification
        cleaned_answer = response_handler.clean_text(raw_answer)
        detected_insufficient = response_handler.detect_insufficient_context(cleaned_answer)

        # 7. Programmatic Citations
        citations = citation_service.build_citations(included_chunks)

        latency_ms = round((time.time() - start_time) * 1000, 2)
        mode_str = request.mode.value if isinstance(request.mode, RAGMode) else str(request.mode)

        return RAGQueryResponse(
            query=normalized_query,
            answer=cleaned_answer,
            sources=citations,
            mode=mode_str,
            total_chunks_retrieved=len(included_chunks),
            insufficient_context=detected_insufficient,
            latency_ms=latency_ms,
            model=target_model,
            thinking=thinking_trace,
        )

    def execute_stream(
        self, request: RAGQueryRequest
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Executes streaming RAG pipeline, yielding intermediate status, tokens,
        and finally the verified citations.
        """
        start_time = time.time()
        normalized_query = rag_retriever.normalize_query(request.query)

        # 1. Retrieval
        chunks, is_insufficient = rag_retriever.retrieve(
            query=normalized_query,
            user_id=request.user_id,
            document_id=request.document_id,
            document_ids=request.document_ids,
            top_k=request.top_k,
            min_relevance=request.min_relevance,
        )

        if is_insufficient or not chunks:
            fallback = response_handler.format_insufficient_context_fallback(normalized_query)
            yield {
                "event": "token",
                "data": {"token": fallback}
            }
            yield {
                "event": "done",
                "data": {
                    "sources": [],
                    "insufficient_context": True,
                    "latency_ms": round((time.time() - start_time) * 1000, 2),
                }
            }
            return

        # 2. Context & Prompt
        context_str, _, included_chunks = rag_context_builder.build_context(chunks)
        prompt_data = rag_prompt_builder.build_rag_prompt(
            question=normalized_query,
            context=context_str,
            history=request.conversation_history,
            mode=request.mode.value if isinstance(request.mode, RAGMode) else str(request.mode),
        )

        citations = citation_service.build_citations(included_chunks)
        yield {
            "event": "sources",
            "data": {"sources": [c.dict() for c in citations]}
        }

        # 3. Stream tokens from Ollama
        for token in ollama_client.generate_stream(
            prompt=prompt_data["prompt"],
            system=prompt_data["system"],
            model=request.model or settings.LLM_MODEL,
        ):
            yield {
                "event": "token",
                "data": {"token": token}
            }

        yield {
            "event": "done",
            "data": {
                "latency_ms": round((time.time() - start_time) * 1000, 2),
                "insufficient_context": False,
            }
        }

rag_pipeline = RAGPipeline()

