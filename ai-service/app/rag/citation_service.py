from typing import List, Dict
from app.schemas.rag_schema import SourceCitation
from app.core.logging import logger

class CitationService:
    """
    Programmatic citation generator that attaches verified document and page references
    directly from retrieved vector chunks, preventing LLM fabrication or hallucinations.
    """
    def build_citations(self, used_chunks: List[Dict]) -> List[SourceCitation]:
        """
        Transforms verified retrieved chunks into structured SourceCitation objects.
        """
        citations: List[SourceCitation] = []
        seen_chunk_ids = set()

        for chunk in used_chunks:
            chunk_id = str(chunk.get("chunk_id", ""))
            if not chunk_id or chunk_id in seen_chunk_ids:
                continue

            doc_id = str(chunk.get("document_id", "unknown"))
            doc_name = str(chunk.get("filename", "Document"))
            page_no = int(chunk.get("page_number", 1))
            score = float(chunk.get("relevance_score", 0.0))
            content = str(chunk.get("content", "")).strip()

            # Clean snippet for UI display (first 180 chars)
            snippet = content[:180].replace("\n", " ") + ("..." if len(content) > 180 else "")

            citation = SourceCitation(
                chunk_id=chunk_id,
                document_id=doc_id,
                document_name=doc_name,
                page_number=page_no,
                relevance_score=round(score, 4),
                snippet=snippet,
            )
            citations.append(citation)
            seen_chunk_ids.add(chunk_id)

        # Sort citations by relevance score descending
        citations.sort(key=lambda c: c.relevance_score, reverse=True)
        return citations

citation_service = CitationService()

