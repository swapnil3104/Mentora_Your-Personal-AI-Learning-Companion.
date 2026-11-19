import time
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.core.logging import logger
from app.schemas.visualization_schema import (
    VisualizationType,
    VisualizationGenerateRequest,
    VisualizationGenerateResponse,
    SourceCitation,
)
from app.rag.retriever import rag_retriever
from app.rag.context_builder import rag_context_builder
from app.rag.citation_service import citation_service
from app.llm.ollama_client import ollama_client
from app.visualization.prompt_builder import visualization_prompt_builder
from app.visualization.validator import visualization_validator

class VisualizationGenerator:
    """
    Orchestrates the generation of structured study visualizations using
    the shared RAG retrieval engine, Ollama inference, and rigorous schema validation.
    """

    def generate(self, request: VisualizationGenerateRequest) -> VisualizationGenerateResponse:
        start_time = time.time()
        normalized_query = rag_retriever.normalize_query(request.query)

        # 1. Shared RAG Retrieval
        chunks = []
        is_insufficient = False
        citations: List[SourceCitation] = []
        context_str = ""

        try:
            chunks, is_insufficient = rag_retriever.retrieve(
                query=normalized_query,
                user_id=request.user_id,
                document_id=request.document_id,
                document_ids=request.document_ids,
                top_k=request.top_k,
                min_relevance=request.min_relevance,
            )
            if chunks:
                context_str, _, included_chunks = rag_context_builder.build_context(chunks)
                citations = citation_service.build_citations(included_chunks)
        except Exception as e:
            logger.warning(f"RAG retrieval warning in visualization generator: {e}")
            is_insufficient = True

        # Merge pre-existing sources if provided (e.g., from chat message citations)
        if request.sources:
            existing_chunk_ids = {c.chunk_id for c in citations}
            for s in request.sources:
                citation_obj = None
                if isinstance(s, dict):
                    cid = s.get("chunk_id") or s.get("chunkId") or "chunk_1"
                    doc_id = s.get("document_id") or s.get("documentId") or ""
                    doc_name = s.get("document_name") or s.get("documentName") or (s.get("document", {}).get("filename") if isinstance(s.get("document"), dict) else "Document")
                    page_num = s.get("page_number") or s.get("pageNumber") or 1
                    rel_score = float(s.get("relevance_score") if s.get("relevance_score") is not None else (s.get("relevanceScore") if s.get("relevanceScore") is not None else 0.8))
                    snip = s.get("snippet") or ""
                    citation_obj = SourceCitation(
                        chunk_id=str(cid),
                        document_id=str(doc_id),
                        document_name=str(doc_name),
                        page_number=int(page_num),
                        relevance_score=rel_score,
                        snippet=str(snip),
                    )
                elif hasattr(s, "chunk_id") or hasattr(s, "chunkId"):
                    cid = getattr(s, "chunk_id", None) or getattr(s, "chunkId", "chunk_1")
                    doc_id = getattr(s, "document_id", None) or getattr(s, "documentId", "")
                    doc_name = getattr(s, "document_name", None) or getattr(s, "documentName", "Document")
                    page_num = getattr(s, "page_number", None) or getattr(s, "pageNumber", 1)
                    rel_score = float(getattr(s, "relevance_score", None) if getattr(s, "relevance_score", None) is not None else getattr(s, "relevanceScore", 0.8))
                    snip = getattr(s, "snippet", "")
                    citation_obj = SourceCitation(
                        chunk_id=str(cid),
                        document_id=str(doc_id),
                        document_name=str(doc_name),
                        page_number=int(page_num),
                        relevance_score=rel_score,
                        snippet=str(snip),
                    )

                if citation_obj and citation_obj.chunk_id not in existing_chunk_ids:
                    citations.append(citation_obj)
                    existing_chunk_ids.add(citation_obj.chunk_id)

        # Check if we have either document chunks or chat context
        has_chat_context = bool(request.chat_response_context and request.chat_response_context.strip())
        has_doc_chunks = bool(context_str.strip() and not is_insufficient)
        has_context = has_chat_context or has_doc_chunks

        if not has_context:
            logger.info(f"Insufficient document context for visualization query '{request.query}'. Returning structured fallback.")
            fallback_data = self._generate_safe_fallback(
                request.query,
                request.visualization_type,
                "",
            )
            latency_ms = round((time.time() - start_time) * 1000, 2)
            title = fallback_data.get("title") or f"{request.query.title()}"
            return VisualizationGenerateResponse(
                visualization_type=request.visualization_type.value,
                title=title,
                generated_data=fallback_data,
                sources=citations,
                insufficient_context=True,
                latency_ms=latency_ms,
                model="synthesized_concept_model",
            )

        # 2. Build Generation Prompt
        target_model = request.model or settings.LLM_MODEL
        prompt_data = visualization_prompt_builder.build_prompt(
            topic=request.query,
            context=context_str,
            visualization_type=request.visualization_type,
            chat_context=request.chat_response_context,
        )

        # 3. LLM Inference via Ollama
        raw_output = ""
        try:
            llm_result = ollama_client.generate(
                prompt=prompt_data["prompt"],
                system=prompt_data["system"],
                model=target_model,
                options={"temperature": 0.2, "num_predict": 700},
                timeout=50,
                format="json",
            )
            raw_output = llm_result.get("text", "")
        except Exception as err:
            logger.warning(f"Inference warning generating visualization: {err}. Proceeding with fallback.")
            raw_output = ""

        # 4. JSON Parsing, Validation & Repair
        parsed_json = visualization_validator.parse_and_repair_json(raw_output)
        valid = False
        errors = []
        validated_data: Dict[str, Any] = {}

        if parsed_json:
            valid, errors, validated_data = visualization_validator.validate(
                parsed_json,
                request.visualization_type,
            )

        # 5. Controlled Retry / Fallback if initial generation is malformed
        if not valid or not parsed_json:
            logger.warning(f"Initial visualization output invalid: {errors}. Retrying with strict repair prompt...")
            retry_prompt = (
                f"Your previous response was not valid JSON or violated constraints:\n"
                f"Errors: {errors}\n\n"
                f"Please regenerate ONLY the valid JSON structure for topic '{request.query}' and type '{request.visualization_type.value}'. "
                f"Do not include any explanation or backticks."
            )
            try:
                retry_result = ollama_client.generate(
                    prompt=retry_prompt,
                    system=prompt_data["system"],
                    model=target_model,
                    options={"temperature": 0.1, "num_predict": 700},
                    timeout=45,
                    format="json",
                )
                retry_output = retry_result.get("text", "")
                parsed_retry = visualization_validator.parse_and_repair_json(retry_output)
                if parsed_retry:
                    valid, errors, validated_data = visualization_validator.validate(
                        parsed_retry,
                        request.visualization_type,
                    )
            except Exception as retry_err:
                logger.error(f"Retry generation failed: {retry_err}")

        # 6. Fallback default structure if still invalid so student always gets a renderable diagram
        if not valid or not validated_data:
            logger.error(f"Visualization generation failed validation after retry. Using safe synthesized fallback.")
            validated_data = self._generate_safe_fallback(
                request.query,
                request.visualization_type,
                context_str or request.chat_response_context or "",
            )

        latency_ms = round((time.time() - start_time) * 1000, 2)
        title = validated_data.get("title") or f"{request.query.title()} ({request.visualization_type.value.replace('_', ' ').title()})"

        return VisualizationGenerateResponse(
            visualization_type=request.visualization_type.value,
            title=title,
            generated_data=validated_data,
            sources=citations,
            insufficient_context=is_insufficient and not has_chat_context,
            latency_ms=latency_ms,
            model=target_model,
        )

    def _generate_safe_fallback(
        self,
        topic: str,
        vtype: VisualizationType,
        context: str,
    ) -> Dict[str, Any]:
        """
        Creates a clean, valid default visualization structure if LLM outputs an unrepairable syntax error.
        """
        clean_title = topic.strip().title()
        if vtype == VisualizationType.INFOGRAPHIC:
            return {
                "title": clean_title,
                "subtitle": "Conceptual Overview and Core Structure",
                "summary": f"Visual summary of key academic principles concerning {clean_title}.",
                "sections": [
                    {
                        "heading": "Fundamental Concepts",
                        "description": f"Core principles and definitions relating to {clean_title}.",
                        "key_points": [
                            f"Primary theoretical foundation of {clean_title}",
                            "Systematic structure and organizational components",
                            "Operational behavior within academic literature",
                        ],
                        "category": "Foundations",
                        "stat": "Key Concept",
                    },
                    {
                        "heading": "Applications & Mechanisms",
                        "description": "Standard methodologies and implementation patterns.",
                        "key_points": [
                            "Practical execution workflows and stages",
                            "Key interactions between subcomponents",
                            "Performance and optimization factors",
                        ],
                        "category": "Mechanism",
                        "stat": "Primary Pattern",
                    },
                ],
                "takeaways": [
                    f"Understanding {clean_title} requires analyzing both components and interactions.",
                    "Review referenced course documents for in-depth mathematical or technical proofs.",
                ],
            }

        elif vtype == VisualizationType.CONCEPT_MAP:
            nodes = [
                {"id": "c1", "label": clean_title, "type": "concept", "description": "Core Subject"},
                {"id": "c2", "label": "Key Components", "type": "concept", "description": "Sub-elements"},
                {"id": "c3", "label": "Theoretical Foundations", "type": "concept", "description": "Underlying principles"},
                {"id": "c4", "label": "Operational Outcomes", "type": "concept", "description": "Results and behaviors"},
            ]
            edges = [
                {"source": "c1", "target": "c2", "label": "comprises"},
                {"source": "c1", "target": "c3", "label": "grounded in"},
                {"source": "c2", "target": "c4", "label": "produces"},
            ]
            return {"title": clean_title, "description": f"Conceptual map of {clean_title}", "nodes": nodes, "edges": edges}

        elif vtype == VisualizationType.FLOWCHART:
            nodes = [
                {"id": "start", "label": f"Start: {clean_title}", "type": "start"},
                {"id": "step1", "label": "Initialize State", "type": "process"},
                {"id": "dec1", "label": "Valid Parameters?", "type": "decision"},
                {"id": "step2", "label": "Execute Processing", "type": "process"},
                {"id": "end", "label": "Complete Flow", "type": "end"},
            ]
            edges = [
                {"source": "start", "target": "step1", "label": ""},
                {"source": "step1", "target": "dec1", "label": ""},
                {"source": "dec1", "target": "step2", "label": "Yes"},
                {"source": "dec1", "target": "start", "label": "No (Retry)"},
                {"source": "step2", "target": "end", "label": ""},
            ]
            syntax = visualization_validator.build_mermaid_syntax(nodes, edges, vtype)
            return {"title": clean_title, "description": "Logical flow representation", "nodes": nodes, "edges": edges, "mermaid_syntax": syntax}

        elif vtype == VisualizationType.MIND_MAP:
            nodes = [
                {"id": "root", "label": clean_title, "type": "root"},
                {"id": "b1", "label": "Core Principles", "type": "branch"},
                {"id": "b1_1", "label": "Definition & Scope", "type": "subtopic"},
                {"id": "b1_2", "label": "Key Assumptions", "type": "subtopic"},
                {"id": "b2", "label": "Implementation", "type": "branch"},
                {"id": "b2_1", "label": "Workflows", "type": "subtopic"},
                {"id": "b2_2", "label": "Best Practices", "type": "subtopic"},
            ]
            edges = [
                {"source": "root", "target": "b1", "label": ""},
                {"source": "b1", "target": "b1_1", "label": ""},
                {"source": "b1", "target": "b1_2", "label": ""},
                {"source": "root", "target": "b2", "label": ""},
                {"source": "b2", "target": "b2_1", "label": ""},
                {"source": "b2", "target": "b2_2", "label": ""},
            ]
            return {
                "title": clean_title,
                "description": f"Hierarchical breakdown of {clean_title}",
                "root_node": {"id": "root", "label": clean_title},
                "nodes": nodes,
                "edges": edges,
            }

        elif vtype == VisualizationType.PROCESS_DIAGRAM:
            nodes = [
                {"id": "p1", "label": "Phase 1: Input Preparation", "type": "process"},
                {"id": "p2", "label": "Phase 2: Core Execution", "type": "process"},
                {"id": "p3", "label": "Phase 3: Validation & Output", "type": "process"},
            ]
            edges = [
                {"source": "p1", "target": "p2", "label": "Prepared Data"},
                {"source": "p2", "target": "p3", "label": "Computed State"},
            ]
            syntax = visualization_validator.build_mermaid_syntax(nodes, edges, vtype)
            return {
                "title": clean_title,
                "description": f"Sequential process of {clean_title}",
                "steps": [
                    {"step_number": 1, "name": "Input Preparation", "inputs": "Raw Data", "outputs": "Prepared Data"},
                    {"step_number": 2, "name": "Core Execution", "inputs": "Prepared Data", "outputs": "Computed State"},
                    {"step_number": 3, "name": "Validation & Output", "inputs": "Computed State", "outputs": "Final Result"},
                ],
                "nodes": nodes,
                "edges": edges,
                "mermaid_syntax": syntax,
            }

        elif vtype == VisualizationType.ARCHITECTURE_DIAGRAM:
            nodes = [
                {"id": "a1", "label": "Client Interface", "type": "client", "category": "Presentation"},
                {"id": "a2", "label": "Processing Engine", "type": "service", "category": "Application"},
                {"id": "a3", "label": "Knowledge Storage", "type": "database", "category": "Persistence"},
            ]
            edges = [
                {"source": "a1", "target": "a2", "label": "Requests / Events"},
                {"source": "a2", "target": "a3", "label": "Read / Write Queries"},
            ]
            syntax = visualization_validator.build_mermaid_syntax(nodes, edges, vtype)
            return {
                "title": clean_title,
                "description": f"System architecture for {clean_title}",
                "components": [
                    {"name": "Client Interface", "layer": "Presentation", "type": "client"},
                    {"name": "Processing Engine", "layer": "Application", "type": "service"},
                    {"name": "Knowledge Storage", "layer": "Persistence", "type": "database"},
                ],
                "nodes": nodes,
                "edges": edges,
                "mermaid_syntax": syntax,
            }

        return {}

visualization_generator = VisualizationGenerator()
