from typing import List
import requests
import time
from app.core.config import settings
from app.core.logging import logger

EXPECTED_DIMENSION = 1024

class EmbeddingService:
    def __init__(self, base_url: str = None, model: str = None):
        self.base_url = base_url or settings.OLLAMA_BASE_URL
        self.model = model or settings.EMBEDDING_MODEL

    def generate_single(self, text: str, retries: int = 3) -> List[float]:
        """
        Generates a 1024-dimensional embedding vector for a single text using Ollama BGE-M3.
        """
        if not text or not text.strip():
            # Return zero vector if text is empty
            return [0.0] * EXPECTED_DIMENSION

        endpoint = f"{self.base_url}/api/embeddings"
        payload = {
            "model": self.model,
            "prompt": text,
        }

        last_err = None
        for attempt in range(1, retries + 1):
            try:
                response = requests.post(endpoint, json=payload, timeout=30)
                if response.status_code == 200:
                    data = response.json()
                    embedding = data.get("embedding", [])
                    if len(embedding) == EXPECTED_DIMENSION:
                        return embedding
                    else:
                        logger.warning(
                            f"Unexpected embedding dimension {len(embedding)} (expected {EXPECTED_DIMENSION})"
                        )
                        return embedding
                else:
                    last_err = f"Ollama error {response.status_code}: {response.text}"
            except Exception as e:
                last_err = str(e)

            time.sleep(0.5 * attempt)

        logger.error(f"Embedding generation failed after {retries} attempts: {last_err}")
        raise RuntimeError(f"Failed to generate embedding with Ollama ({self.model}): {last_err}")

    def generate_batch(self, texts: List[str], batch_size: int = 8) -> List[List[float]]:
        """
        Generates embeddings for a batch of texts sequentially or in sub-batches.
        """
        results = []
        for i, text in enumerate(texts):
            emb = self.generate_single(text)
            results.append(emb)

        return results

embedding_service = EmbeddingService()
