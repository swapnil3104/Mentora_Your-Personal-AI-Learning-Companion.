from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import logger
from app.api.document_routes import router as document_router
from app.api.rag_routes import router as rag_router
from app.api.chat_routes import router as chat_router
from app.api.visualization_routes import router as visualization_router
from app.vector_store.chroma_client import chroma_store
import requests
import uvicorn

import time
from datetime import datetime, timezone
import requests
import uvicorn
try:
    import psutil
except ImportError:
    psutil = None

start_time = time.time()

app = FastAPI(
    title="Mentora AI Service",
    description="Python + FastAPI AI Service for Mentora: RAG, Embeddings, Document Processing, and Graphical Generation",
    version="1.0.0",
)

# CORS configuration
cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()] if settings.CORS_ORIGINS else ["*"]
if "*" in cors_origins:
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health Check Endpoints
@app.get("/health")
@app.get("/ai/health")
async def health_check():
    """
    Health check endpoint verifying AI service, ChromaDB, and Ollama connectivity.
    """
    # Test Ollama connectivity
    ollama_ok = False
    try:
        r = requests.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=3)
        ollama_ok = r.status_code == 200
    except Exception:
        ollama_ok = False

    # Test ChromaDB connectivity
    chroma_ok = False
    try:
        count = chroma_store.collection.count()
        chroma_ok = True
    except Exception:
        chroma_ok = False

    # System metrics
    memory_mb = None
    if psutil:
        try:
            memory_mb = round(psutil.Process().memory_info().rss / 1024 / 1024, 2)
        except Exception:
            pass

    return {
        "status": "online" if (ollama_ok and chroma_ok) else "degraded",
        "service": "mentora-ai-service",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(time.time() - start_time, 2),
        "memory_mb": memory_mb,
        "dependencies": {
            "ollama": "online" if ollama_ok else "unreachable",
            "chromadb": "online" if chroma_ok else "error",
            "embedding_model": settings.EMBEDDING_MODEL,
            "llm_model": settings.LLM_MODEL,
        },
        "chroma_total_vectors": chroma_store.collection.count() if chroma_ok else 0,
    }

# Mount document, RAG, Chatbot, and Visualization routes
app.include_router(document_router)
app.include_router(rag_router)
app.include_router(chat_router)
app.include_router(visualization_router)

@app.on_event("startup")
async def startup_event():
    logger.info("Mentora AI Service started successfully.")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
