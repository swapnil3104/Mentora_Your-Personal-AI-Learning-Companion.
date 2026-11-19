from typing import List, Dict
import os
import pymupdf
from app.document_processing.text_cleaner import clean_text
from app.core.logging import logger

def extract_pdf(file_path: str) -> List[Dict]:
    """
    Extracts text page-by-page from a PDF document using PyMuPDF.
    Returns a list of dicts: [{"page_number": int, "text": str}]
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file not found at: {file_path}")

    pages = []
    try:
        doc = pymupdf.open(file_path)
    except Exception as e:
        logger.error(f"Failed to open PDF {file_path}: {e}")
        raise ValueError(f"Corrupted or invalid PDF file: {e}")

    try:
        total_pages = len(doc)
        logger.info(f"Extracting PDF {file_path} with {total_pages} pages")

        for page_idx in range(total_pages):
            page_num = page_idx + 1  # 1-indexed
            try:
                page = doc.load_page(page_idx)
                raw_text = page.get_text("text") or ""
                cleaned = clean_text(raw_text)
                if cleaned:
                    pages.append({
                        "page_number": page_num,
                        "text": cleaned,
                    })
            except Exception as pe:
                logger.warning(f"Error extracting page {page_num} of {file_path}: {pe}")
                continue

    finally:
        doc.close()

    if not pages:
        logger.warning(f"PDF {file_path} contained no readable text or is empty")

    return pages
