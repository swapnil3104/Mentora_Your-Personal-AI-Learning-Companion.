from typing import List, Dict
import os
from pptx import Presentation
from app.document_processing.text_cleaner import clean_text
from app.core.logging import logger

def extract_pptx(file_path: str) -> List[Dict]:
    """
    Extracts text slide-by-slide from PPTX presentations.
    Slide index is mapped directly to page_number.
    Returns list of dicts: [{"page_number": int, "text": str}]
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PPTX file not found at: {file_path}")

    try:
        prs = Presentation(file_path)
    except Exception as e:
        logger.error(f"Failed to open PPTX {file_path}: {e}")
        raise ValueError(f"Corrupted or invalid PPTX file: {e}")

    slides_data = []

    for slide_idx, slide in enumerate(prs.slides):
        slide_num = slide_idx + 1
        slide_texts = []

        # Extract text from shapes
        for shape in slide.shapes:
            if shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    line = paragraph.text.strip()
                    if line:
                        slide_texts.append(line)
            elif shape.has_table:
                for row in shape.table.rows:
                    row_vals = [c.text.strip() for c in row.cells if c.text.strip()]
                    if row_vals:
                        slide_texts.append(" | ".join(row_vals))

        if slide_texts:
            full_slide_text = clean_text("\n".join(slide_texts))
            if full_slide_text:
                slides_data.append({
                    "page_number": slide_num,
                    "text": full_slide_text,
                })

    return slides_data
