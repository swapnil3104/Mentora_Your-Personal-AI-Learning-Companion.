from typing import List, Dict
import re
from app.core.config import settings
from app.core.logging import logger

def estimate_tokens(text: str) -> int:
    """
    Fast estimation of token count (~4 characters per token for English/academic text).
    """
    if not text:
        return 0
    # Words + punctuation heuristic
    words = re.findall(r"\S+", text)
    return max(len(words), int(len(text) / 4))

def split_text_into_chunks(
    text: str,
    page_number: int,
    document_id: str,
    user_id: str,
    filename: str,
    target_tokens: int = None,
    overlap_tokens: int = None,
) -> List[Dict]:
    """
    Splits text on paragraph and sentence boundaries into token-bounded chunks.
    Preserves page_number, document_id, user_id, and filename metadata.
    """
    if target_tokens is None:
        target_tokens = settings.CHUNK_SIZE_TOKENS  # ~600 tokens
    if overlap_tokens is None:
        overlap_tokens = settings.CHUNK_OVERLAP_TOKENS  # ~90 tokens

    target_chars = target_tokens * 4
    overlap_chars = overlap_tokens * 4

    if not text.strip():
        return []

    # If text is smaller than target, emit as a single chunk
    if len(text) <= target_chars:
        return [{
            "chunk_id": f"{document_id}_p{page_number}_c0",
            "document_id": document_id,
            "user_id": user_id,
            "filename": filename,
            "page_number": page_number,
            "content": text.strip(),
            "token_count": estimate_tokens(text),
        }]

    # Split into paragraphs first
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    
    # If single huge paragraph, split by sentences
    units = []
    for p in paragraphs:
        if len(p) > target_chars:
            # Split paragraph into sentences
            sentences = re.split(r"(?<=[.!?])\s+", p)
            units.extend([s.strip() for s in sentences if s.strip()])
        else:
            units.append(p)

    chunks = []
    current_chunk_units = []
    current_length = 0
    chunk_index = 0

    for unit in units:
        unit_len = len(unit)
        if current_length + unit_len > target_chars and current_chunk_units:
            chunk_content = " ".join(current_chunk_units).strip()
            chunks.append({
                "chunk_id": f"{document_id}_p{page_number}_c{chunk_index}",
                "document_id": document_id,
                "user_id": user_id,
                "filename": filename,
                "page_number": page_number,
                "content": chunk_content,
                "token_count": estimate_tokens(chunk_content),
            })
            chunk_index += 1

            # Build overlap from trailing units
            overlap_units = []
            overlap_accum = 0
            for trailing_unit in reversed(current_chunk_units):
                if overlap_accum + len(trailing_unit) <= overlap_chars:
                    overlap_units.insert(0, trailing_unit)
                    overlap_accum += len(trailing_unit)
                else:
                    break

            current_chunk_units = overlap_units
            current_length = overlap_accum

        current_chunk_units.append(unit)
        current_length += unit_len

    if current_chunk_units:
        chunk_content = " ".join(current_chunk_units).strip()
        chunks.append({
            "chunk_id": f"{document_id}_p{page_number}_c{chunk_index}",
            "document_id": document_id,
            "user_id": user_id,
            "filename": filename,
            "page_number": page_number,
            "content": chunk_content,
            "token_count": estimate_tokens(chunk_content),
        })

    return chunks

def chunk_document(
    pages: List[Dict],
    document_id: str,
    user_id: str,
    filename: str,
) -> List[Dict]:
    """
    Takes extracted pages and returns a flat list of chunk dictionaries.
    """
    all_chunks = []
    for page in pages:
        page_chunks = split_text_into_chunks(
            text=page["text"],
            page_number=page["page_number"],
            document_id=document_id,
            user_id=user_id,
            filename=filename,
        )
        all_chunks.extend(page_chunks)

    logger.info(f"Chunked document {document_id} ({len(pages)} pages) into {len(all_chunks)} chunks")
    return all_chunks
