from fastapi import APIRouter, HTTPException, status
from app.schemas.document_schema import (
    DocumentProcessRequest,
    DocumentProcessResponse,
    DocumentDeleteRequest,
    DocumentDeleteResponse,
    VectorRetrievalRequest,
    VectorRetrievalResponse,
    RetrievedChunk,
)
from app.document_processing.extractors.pdf_extractor import extract_pdf
from app.document_processing.extractors.docx_extractor import extract_docx
from app.document_processing.extractors.pptx_extractor import extract_pptx
from app.document_processing.extractors.txt_extractor import extract_txt
from app.document_processing.chunker import chunk_document
from app.embeddings.embedding_service import embedding_service
from app.vector_store.chroma_client import chroma_store
from app.core.logging import logger
import os

router = APIRouter(prefix="/ai/documents", tags=["Documents"])

@router.post("/process", response_model=DocumentProcessResponse)
async def process_document(request: DocumentProcessRequest):
    """
    Ingests and indexes an uploaded document:
    1. Validates file existence
    2. Extracts text preserving page/slide numbers
    3. Chunks text into 500-700 token blocks
    4. Generates BGE-M3 embeddings
    5. Stores in persistent ChromaDB with user isolation
    """
    file_path = request.file_path
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Uploaded file does not exist at {file_path}"
        )

    file_type = request.file_type.lower().strip()
    logger.info(f"Processing document {request.document_id} ({request.filename}) of type {file_type}")

    # 1. Text extraction
    try:
        if file_type == "pdf":
            pages = extract_pdf(file_path)
        elif file_type == "docx" or file_type == "doc":
            pages = extract_docx(file_path)
        elif file_type == "pptx" or file_type == "ppt":
            pages = extract_pptx(file_path)
        elif file_type == "txt":
            pages = extract_txt(file_path)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported document type: {file_type}"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Extraction failed for {request.document_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Extraction error: {str(e)}"
        )

    if not pages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document appears to be empty or contains no extractable text."
        )

    page_count = len(pages)

    # 2. Chunking
    try:
        chunks = chunk_document(
            pages=pages,
            document_id=request.document_id,
            user_id=request.user_id,
            filename=request.filename,
        )
    except Exception as e:
        logger.error(f"Chunking failed for {request.document_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chunking error: {str(e)}"
        )

    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to generate chunks from extracted document text."
        )

    # 3. Clean up prior vectors to prevent duplicate indexing
    chroma_store.delete_document_vectors(request.document_id, request.user_id)

    # 4. Generate BGE-M3 Embeddings
    try:
        chunk_texts = [c["content"] for c in chunks]
        embeddings = embedding_service.generate_batch(chunk_texts)
    except Exception as e:
        logger.error(f"Embedding generation failed for {request.document_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Embedding error: {str(e)}"
        )

    # 5. ChromaDB Vector Store
    try:
        stored_count = chroma_store.store_chunks(chunks=chunks, embeddings=embeddings)
    except Exception as e:
        logger.error(f"Vector storage failed for {request.document_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vector storage error: {str(e)}"
        )

    return DocumentProcessResponse(
        status="COMPLETED",
        document_id=request.document_id,
        page_count=page_count,
        chunk_count=stored_count,
        message=f"Successfully indexed {stored_count} chunks from {page_count} pages."
    )

@router.get("/{document_id}/status")
async def get_document_indexing_status(document_id: str):
    """
    Returns the vector index count for a document.
    """
    chunk_count = chroma_store.get_document_chunk_count(document_id)
    return {
        "document_id": document_id,
        "indexed": chunk_count > 0,
        "chunk_count": chunk_count,
    }

@router.delete("/{document_id}", response_model=DocumentDeleteResponse)
async def delete_document_vectors(document_id: str, request: DocumentDeleteRequest = None):
    """
    Deletes all vector embeddings for a given document.
    """
    user_id = request.user_id if request else None
    deleted = chroma_store.delete_document_vectors(document_id, user_id)
    return DocumentDeleteResponse(
        status="SUCCESS",
        document_id=document_id,
        deleted_chunks=deleted,
        message=f"Deleted {deleted} vectors for document {document_id}."
    )

@router.post("/retrieve", response_model=VectorRetrievalResponse)
async def retrieve_relevant_chunks(request: VectorRetrievalRequest):
    """
    Retrieves relevant document chunks using BGE-M3 semantic similarity.
    Strictly isolated by user_id.
    """
    try:
        query_embedding = embedding_service.generate_single(request.query)
        results = chroma_store.search_similar(
            query_embedding=query_embedding,
            user_id=request.user_id,
            document_id=request.document_id,
            top_k=request.top_k,
        )

        chunks = [
            RetrievedChunk(
                chunk_id=r["chunk_id"],
                document_id=r["document_id"],
                page_number=r["page_number"],
                content=r["content"],
                relevance_score=r["relevance_score"],
            )
            for r in results
        ]

        return VectorRetrievalResponse(
            query=request.query,
            count=len(chunks),
            chunks=chunks,
        )
    except Exception as e:
        logger.error(f"Retrieval error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Semantic retrieval failed: {str(e)}"
        )
