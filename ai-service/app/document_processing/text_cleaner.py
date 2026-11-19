import re
import unicodedata

def clean_text(text: str) -> str:
    """
    Normalizes and cleans raw extracted text while preserving semantic structure.
    """
    if not text:
        return ""

    # Normalize unicode characters (NFKC)
    text = unicodedata.normalize("NFKC", text)

    # Rejoin hyphenated line-breaks (e.g., 'archi-\ntecture' -> 'architecture')
    text = re.sub(r"(\w+)-\n(\w+)", r"\1\2", text)

    # Replace carriage returns and vertical whitespace
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Replace multiple spaces with a single space
    text = re.sub(r"[ \t]+", " ", text)

    # Collapse 3 or more newlines into 2
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Strip leading/trailing whitespaces per line
    lines = [line.strip() for line in text.split("\n")]
    cleaned = "\n".join(lines).strip()

    return cleaned
