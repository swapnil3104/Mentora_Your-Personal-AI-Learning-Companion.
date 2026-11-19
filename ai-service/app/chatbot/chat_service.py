from typing import List, Dict, Any, Generator, Optional
import time
import re
from app.schemas.chat_schema import ChatGenerateRequest, ChatGenerateResponse
from app.schemas.rag_schema import RAGQueryRequest, RAGMode
from app.rag.rag_pipeline import rag_pipeline
from app.core.logging import logger

class ChatbotService:
    """
    Core Chatbot service orchestrating multi-turn document conversations,
    RAG groundings, streaming, and follow-up question synthesis.
    """

    def generate_follow_up_suggestions(self, query: str, answer: str, insufficient: bool) -> List[str]:
        """
        Synthesizes 2 to 3 contextual follow-up questions for the student
        to deepen their understanding without hallucinating.
        """
        if insufficient:
            return [
                "Can you check another uploaded document?",
                "Would you like to rephrase the question?",
                "What related topics are covered in the materials?"
            ]

        suggestions = []
        lower_q = query.lower()
        lower_a = answer.lower()

        if "difference" in lower_q or "compare" in lower_q or "versus" in lower_q or "vs" in lower_q:
            suggestions.append("What are the practical trade-offs between them?")
            suggestions.append("Can you give a real-world code or system example?")
        elif "explain" in lower_q or "what is" in lower_q or "define" in lower_q:
            suggestions.append("Can you explain this step-by-step with an analogy?")
            suggestions.append("What are the key advantages and limitations?")
        elif "how" in lower_q:
            suggestions.append("What failure conditions or edge cases exist here?")
            suggestions.append("How does this compare to standard alternatives?")
        else:
            suggestions.append("Can you explain this with a simple example?")
            suggestions.append("What key terms should I remember from this topic?")

        suggestions.append("How does this connect to other concepts in the document?")
        return suggestions[:3]

    def chat(self, request: ChatGenerateRequest) -> ChatGenerateResponse:
        """
        Executes a full grounded chat turn.
        """
        start_time = time.time()

        # Convert to RAGQueryRequest
        rag_request = RAGQueryRequest(
            query=request.query,
            user_id=request.user_id,
            document_id=request.document_id,
            document_ids=request.document_ids,
            top_k=request.top_k,
            min_relevance=request.min_relevance,
            mode=request.mode,
            conversation_history=request.conversation_history,
            model=request.model,
        )

        rag_response = rag_pipeline.execute(rag_request)

        follow_ups = self.generate_follow_up_suggestions(
            query=request.query,
            answer=rag_response.answer,
            insufficient=rag_response.insufficient_context,
        )

        return ChatGenerateResponse(
            query=rag_response.query,
            answer=rag_response.answer,
            sources=rag_response.sources,
            conversation_id=request.conversation_id,
            mode=rag_response.mode,
            total_chunks_retrieved=rag_response.total_chunks_retrieved,
            insufficient_context=rag_response.insufficient_context,
            latency_ms=rag_response.latency_ms,
            model=rag_response.model,
            suggested_follow_ups=follow_ups,
            thinking=rag_response.thinking,
        )

    def stream_chat(self, request: ChatGenerateRequest) -> Generator[Dict[str, Any], None, None]:
        """
        Streams grounded chat response tokens and citations via generator.
        """
        rag_request = RAGQueryRequest(
            query=request.query,
            user_id=request.user_id,
            document_id=request.document_id,
            document_ids=request.document_ids,
            top_k=request.top_k,
            min_relevance=request.min_relevance,
            mode=request.mode,
            conversation_history=request.conversation_history,
            model=request.model,
        )

        accumulated_tokens = []
        for event in rag_pipeline.execute_stream(rag_request):
            if event.get("event") == "token":
                token = event.get("data", {}).get("token", "")
                accumulated_tokens.append(token)
            elif event.get("event") == "done":
                full_text = "".join(accumulated_tokens)
                insufficient = event.get("data", {}).get("insufficient_context", False)
                follow_ups = self.generate_follow_up_suggestions(request.query, full_text, insufficient)
                event["data"]["suggested_follow_ups"] = follow_ups
                event["data"]["conversation_id"] = request.conversation_id
            yield event

chat_service = ChatbotService()

