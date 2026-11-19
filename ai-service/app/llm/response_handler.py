from typing import Dict, Any, List, Optional
import re
from app.core.logging import logger

INSUFFICIENT_SIGNALS = [
    "insufficient information",
    "does not mention",
    "not mentioned in the provided",
    "provided documents do not contain",
    "cannot find any reference",
    "context does not provide",
    "no information provided",
    "not covered in the context",
    "based on the provided context, there is no",
    "the text does not contain",
]

class ResponseHandler:
    """
    Cleans, inspects, and validates LLM generation responses for grounding and safety.
    """
    def clean_text(self, text: str) -> str:
        """
        Removes stray XML/HTML tags, internal delimiters, or spurious prefixes.
        """
        if not text:
            return ""

        # Remove delimiter leakages if any
        cleaned = re.sub(r'<<<[^>]+>>>', '', text)
        cleaned = re.sub(r'<think>.*?</think>', '', cleaned, flags=re.DOTALL)
        # Strip leading/trailing whitespaces and multiple newlines
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned).strip()
        return cleaned

    def detect_insufficient_context(self, response_text: str) -> bool:
        """
        Returns True if the generated answer indicates that the provided context was inadequate.
        """
        if not response_text:
            return True

        lower_text = response_text.lower()
        for signal in INSUFFICIENT_SIGNALS:
            if signal in lower_text:
                return True
        return False

    def validate_citations_in_text(self, text: str, valid_chunk_ids: List[str]) -> List[str]:
        """
        Extracts cited IDs from text and ensures none are fabricated.
        Returns the list of valid chunk IDs cited.
        """
        # Finds patterns like [ID: chunk_xxx] or [chunk_xxx]
        found_ids = re.findall(r'\[(?:ID:\s*)?([a-zA-Z0-9_\-]+)\]', text)
        valid_set = set(valid_chunk_ids)
        verified = [cid for cid in found_ids if cid in valid_set]
        return verified

    def format_insufficient_context_fallback(self, query: str) -> str:
        """
        Produces a standard honest fallback response when retrieved context is inadequate.
        """
        return (
            f"Based on the provided study documents, there is insufficient information to answer "
            f"your question about \"{query}\". Please verify that relevant course documents have been uploaded."
        )

response_handler = ResponseHandler()

