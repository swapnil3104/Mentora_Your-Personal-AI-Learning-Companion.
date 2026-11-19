from typing import List, Dict
import os
import docx
from app.document_processing.text_cleaner import clean_text
from app.core.logging import logger

def extract_docx(file_path: str) -> List[Dict]:
    """
    Extracts text from DOCX files.
    Groups text into logical page/section blocks (approx 500 words per simulated page).
    Returns list of dicts: [{"page_number": int, "text": str}]
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"DOCX file not found at: {file_path}")

    try:
        doc = docx.Document(file_path)
    except Exception as e:
        logger.error(f"Failed to open DOCX {file_path}: {e}")
        raise ValueError(f"Corrupted or invalid DOCX file: {e}")

    extracted_elements = []

    # 1. Extract paragraphs
    for p in doc.paragraphs:
        txt = p.text.strip()
        if txt:
            extracted_elements.append(txt)

    # 2. Extract tables
    for table in doc.tables:
        for row in table.rows:
            row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if row_cells:
                extracted_elements.append(" | ".join(row_cells))

    if not extracted_elements:
        return []

    # Group into simulated pages of ~2500 characters
    pages = []
    current_page_text = []
    current_length = 0
    page_num = 1

    for elem in extracted_elements:
        cleaned = clean_text(elem)
        if not cleaned:
            continue
        current_page_text.append(cleaned)
        current_length += len(cleaned)

        if current_length >= 2500:
            pages.append({
                "page_number": page_num,
                "text": "\n\n".join(current_page_text),
            })
            page_num += 1
            current_page_text = []
            current_length = 0

    if current_page_text:
        pages.append({
            "page_number": page_num,
            "text": "\n\n".join(current_page_text),
        })

    return pages
