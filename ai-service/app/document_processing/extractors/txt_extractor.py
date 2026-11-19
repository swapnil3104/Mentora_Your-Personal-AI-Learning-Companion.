from typing import List, Dict
import os
from app.document_processing.text_cleaner import clean_text
from app.core.logging import logger

def extract_txt(file_path: str) -> List[Dict]:
    """
    Extracts text from plain text files with encoding fallbacks.
    Returns list of dicts: [{"page_number": int, "text": str}]
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"TXT file not found at: {file_path}")

    raw_content = None
    encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]

    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                raw_content = f.read()
            break
        except (UnicodeDecodeError, Exception):
            continue

    if raw_content is None:
        raise ValueError(f"Unable to decode text file with supported encodings: {file_path}")

    cleaned = clean_text(raw_content)
    if not cleaned:
        return []

    # If document is short (<= 3000 chars), treat as single page
    if len(cleaned) <= 3000:
        return [{"page_number": 1, "text": cleaned}]

    # Otherwise divide into logical ~2500 char page blocks
    pages = []
    paragraphs = cleaned.split("\n\n")
    current_page = []
    current_len = 0
    page_num = 1

    for p in paragraphs:
        current_page.append(p)
        current_len += len(p)
        if current_len >= 2500:
            pages.append({
                "page_number": page_num,
                "text": "\n\n".join(current_page),
            })
            page_num += 1
            current_page = []
            current_len = 0

    if current_page:
        pages.append({
            "page_number": page_num,
            "text": "\n\n".join(current_page),
        })

    return pages
