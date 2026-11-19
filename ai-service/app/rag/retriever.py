from typing import List, Dict, Optional, Tuple
import re
import hashlib
from app.embeddings.embedding_service import embedding_service
from app.vector_store.chroma_client import chroma_store
from app.core.config import settings
from app.core.logging import logger

class RAGRetriever:
    """
    Handles natural language query normalization, embedding generation,
    vector search with student isolation, duplicate filtering, and relevance thresholding.
    """
    def __init__(
        self,
        default_top_k: int = None,
        default_min_relevance: float = None
    ):
        self.default_top_k = default_top_k or settings.RAG_TOP_K
        self.default_min_relevance = default_min_relevance or settings.RAG_MIN_RELEVANCE

    def normalize_query(self, query: str) -> str:
        """
        Normalizes natural language questions:
        - Strips whitespace
        - Strips numbering prefixes like '1.', 'Q1:', etc. (including chained prefixes)
        - Collapses repeated whitespace
        """
        if not query:
            return ""

        # Remove numbering prefixes like '1. ', 'Q1: ', '- ', chained
        cleaned = re.sub(r'^(?:(?:[0-9]+[\.\:\)]|\bQ[0-9]*[\:\.]|\-)\s*)+', '', query.strip(), flags=re.IGNORECASE)
        # Collapse multiple spaces
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned

    def deduplicate_chunks(self, chunks: List[Dict]) -> List[Dict]:
        """
        Filters out duplicate chunks by chunk_id and text content hash.
        """
        seen_ids = set()
        seen_hashes = set()
        unique_chunks = []

        for chunk in chunks:
            cid = chunk.get("chunk_id")
            content = chunk.get("content", "").strip()

            if cid and cid in seen_ids:
                continue

            content_hash = hashlib.md5(content.encode("utf-8")).hexdigest()
            if content_hash in seen_hashes:
                continue

            if cid:
                seen_ids.add(cid)
            seen_hashes.add(content_hash)
            unique_chunks.append(chunk)

        return unique_chunks

    def retrieve(
        self,
        query: str,
        user_id: str,
        document_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None,
        top_k: Optional[int] = None,
        min_relevance: Optional[float] = None,
    ) -> Tuple[List[Dict], bool]:
        """
        Executes complete semantic retrieval for a student query:
        1. Normalizes query
        2. Generates BGE-M3 query embedding
        3. Queries ChromaDB with strict student isolation and document filters
        4. Deduplicates chunks
        5. Filters chunks below relevance threshold
        6. Flags whether results are insufficient
        
        Returns:
            Tuple of (filtered_chunks, insufficient_context_flag)
        """
        norm_query = self.normalize_query(query)
        if not norm_query:
            logger.warning("Empty query received for retrieval")
            return [], True

        k = top_k or self.default_top_k
        min_score = min_relevance if min_relevance is not None else self.default_min_relevance

        # 1. Generate query embedding using BGE-M3
        query_embedding = embedding_service.generate_single(norm_query)

        # 2. Vector search via ChromaDB (fetch extra candidates to allow filtering)
        fetch_k = max(k * 2, 8)
        raw_chunks = chroma_store.search_similar(
            query_embedding=query_embedding,
            user_id=user_id,
            document_id=document_id,
            document_ids=document_ids,
            top_k=fetch_k,
        )

        if not raw_chunks:
            logger.info(f"No chunks found for user '{user_id}' with query '{norm_query}'")
            return [], True

        # 3. Deduplicate
        deduped = self.deduplicate_chunks(raw_chunks)

        # 4. Filter by minimum relevance score threshold
        relevant_chunks = [
            c for c in deduped
            if c.get("relevance_score", 0.0) >= min_score
        ]

        # 5. Cap to top_k
        final_chunks = relevant_chunks[:k]

        insufficient = len(final_chunks) == 0
        logger.info(
            f"Retrieved {len(final_chunks)} chunks for query '{norm_query}' "
            f"(raw={len(raw_chunks)}, deduped={len(deduped)}, insufficient={insufficient})"
        )

        return final_chunks, insufficient

rag_retriever = RAGRetriever()
