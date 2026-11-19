from typing import List, Dict, Tuple
from app.core.config import settings
from app.core.logging import logger

class RAGContextBuilder:
    """
    Constructs clean, structured, and token-bounded context blocks from retrieved document chunks.
    Ensures exact preservation of page numbers, slide references, and source document metadata.
    """
    def __init__(self, max_context_tokens: int = None):
        self.max_context_tokens = max_context_tokens or settings.RAG_MAX_CONTEXT_TOKENS

    def estimate_tokens(self, text: str) -> int:
        """
        Fast token estimation based on character and word ratios (~1 token per 3.8 chars or 0.75 words).
        """
        if not text:
            return 0
        return max(len(text) // 4, int(len(text.split()) * 1.3))

    def build_context(self, chunks: List[Dict]) -> Tuple[str, int, List[Dict]]:
        """
        Assembles formatted context string from retrieved chunks while staying within token limits.

        Returns:
            Tuple of:
            - context_string: Formatted text containing all included chunks
            - total_estimated_tokens: Estimated token count of the context block
            - included_chunks: The subset of chunks that fitted within the token window
        """
        if not chunks:
            return "No document context available.", 0, []

        formatted_blocks = []
        total_tokens = 0
        included_chunks = []

        for chunk in chunks:
            doc_id = chunk.get("document_id", "unknown_doc")
            filename = chunk.get("filename", "Document")
            page_num = chunk.get("page_number", 1)
            chunk_id = chunk.get("chunk_id", "unknown_chunk")
            content = chunk.get("content", "").strip()

            header = f"--- [Document: {filename} (ID: {doc_id}), Page: {page_num}, Chunk: {chunk_id}] ---"
            block = f"{header}\n{content}\n"
            block_tokens = self.estimate_tokens(block)

            # Check if adding this chunk exceeds maximum context window
            if total_tokens + block_tokens > self.max_context_tokens:
                logger.warning(
                    f"Context token limit reached ({total_tokens}/{self.max_context_tokens}). "
                    f"Skipping chunk {chunk_id}."
                )
                break

            formatted_blocks.append(block)
            total_tokens += block_tokens
            included_chunks.append(chunk)

        context_string = "\n".join(formatted_blocks)
        return context_string, total_tokens, included_chunks

rag_context_builder = RAGContextBuilder()

