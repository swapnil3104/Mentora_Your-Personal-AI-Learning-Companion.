from typing import List, Dict, Optional
import os
from pathlib import Path
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import settings
from app.core.logging import logger

class ChromaVectorStore:
    def __init__(self, persist_dir: str = None, collection_name: str = None):
        self.persist_dir = persist_dir or settings.CHROMA_PERSIST_DIRECTORY
        self.collection_name = collection_name or settings.CHROMA_COLLECTION_NAME
        
        # Ensure persistence directory exists
        Path(self.persist_dir).mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Initializing ChromaDB PersistentClient at {self.persist_dir}")
        self.client = chromadb.PersistentClient(
            path=self.persist_dir,
            settings=ChromaSettings(allow_reset=True, anonymized_telemetry=False)
        )
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"}
        )

    def store_chunks(self, chunks: List[Dict], embeddings: List[List[float]]) -> int:
        """
        Stores chunks, metadata, and embeddings into the persistent collection.
        """
        if not chunks:
            return 0

        ids = []
        documents = []
        metadatas = []

        for c in chunks:
            ids.append(c["chunk_id"])
            documents.append(c["content"])
            metadatas.append({
                "chunk_id": str(c["chunk_id"]),
                "document_id": str(c["document_id"]),
                "user_id": str(c["user_id"]),
                "filename": str(c.get("filename", "")),
                "page_number": int(c.get("page_number", 1)),
                "token_count": int(c.get("token_count", 0)),
            })

        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )

        logger.info(f"Stored {len(ids)} vectors in ChromaDB collection '{self.collection_name}'")
        return len(ids)

    def search_similar(
        self,
        query_embedding: List[float],
        user_id: str,
        document_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None,
        top_k: int = 5
    ) -> List[Dict]:
        """
        Retrieves top_k most similar chunks strictly matching user_id (and optional document_id or document_ids).
        Guarantees student isolation.
        """
        # Determine document filter
        doc_filter = None
        if document_ids and len(document_ids) > 1:
            doc_filter = {"document_id": {"$in": document_ids}}
        elif document_ids and len(document_ids) == 1:
            doc_filter = {"document_id": document_ids[0]}
        elif document_id:
            doc_filter = {"document_id": document_id}

        # Strict user isolation filter
        if doc_filter:
            where_filter = {
                "$and": [
                    {"user_id": user_id},
                    doc_filter
                ]
            }
        else:
            where_filter = {"user_id": user_id}

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where_filter,
            include=["documents", "metadatas", "distances"]
        )

        retrieved_chunks = []
        if results and results.get("ids") and results["ids"][0]:
            matched_ids = results["ids"][0]
            matched_docs = results["documents"][0]
            matched_metas = results["metadatas"][0]
            matched_dists = results["distances"][0]

            for i in range(len(matched_ids)):
                dist = matched_dists[i]
                # Cosine distance to similarity: similarity = 1 - distance
                relevance_score = max(0.0, min(1.0, 1.0 - dist))

                retrieved_chunks.append({
                    "chunk_id": matched_ids[i],
                    "content": matched_docs[i],
                    "document_id": matched_metas[i].get("document_id"),
                    "page_number": matched_metas[i].get("page_number"),
                    "filename": matched_metas[i].get("filename"),
                    "token_count": matched_metas[i].get("token_count", 0),
                    "relevance_score": round(relevance_score, 4),
                    "distance": round(dist, 4),
                })

        return retrieved_chunks

    def delete_document_vectors(self, document_id: str, user_id: str = None) -> int:
        """
        Deletes all vector embeddings associated with a given document.
        """
        if user_id:
            where_filter = {
                "$and": [
                    {"document_id": document_id},
                    {"user_id": user_id}
                ]
            }
        else:
            where_filter = {"document_id": document_id}

        try:
            # Check existing count before deletion
            existing = self.collection.get(where=where_filter)
            count = len(existing["ids"]) if existing and "ids" in existing else 0

            if count > 0:
                self.collection.delete(where=where_filter)
                logger.info(f"Deleted {count} vectors for document {document_id}")
            return count
        except Exception as e:
            logger.warning(f"Error during vector deletion for {document_id}: {e}")
            return 0

    def get_document_chunk_count(self, document_id: str) -> int:
        """
        Returns number of indexed chunks for a document.
        """
        try:
            results = self.collection.get(where={"document_id": document_id})
            return len(results["ids"]) if results and "ids" in results else 0
        except Exception:
            return 0

chroma_store = ChromaVectorStore()
