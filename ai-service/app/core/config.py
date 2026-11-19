import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Root directory of ai-service
BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = ""
    CORS_ORIGINS: str = "*"

    # Ollama Service
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    EMBEDDING_MODEL: str = "bge-m3"
    LLM_MODEL: str = "qwen2.5:3b"

    # ChromaDB Configuration
    CHROMA_PERSIST_DIRECTORY: str = str(BASE_DIR / "chroma_data")
    CHROMA_COLLECTION_NAME: str = "mentora_study_materials"

    # Chunking Configuration
    CHUNK_SIZE_TOKENS: int = 600
    CHUNK_OVERLAP_TOKENS: int = 90

    # RAG Configuration
    RAG_TOP_K: int = 5
    RAG_MIN_RELEVANCE: float = 0.35
    RAG_MAX_CONTEXT_TOKENS: int = 3000

    # LLM Inference Configuration
    LLM_TEMPERATURE: float = 0.2
    LLM_NUM_CTX: int = 4096
    LLM_NUM_PREDICT: int = 1500
    LLM_TIMEOUT_SECONDS: int = 180

    class Config:
        env_file = str(BASE_DIR / ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
