from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from enum import Enum
from app.schemas.rag_schema import SourceCitation

class VisualizationType(str, Enum):
    INFOGRAPHIC = "infographic"
    CONCEPT_MAP = "concept_map"
    FLOWCHART = "flowchart"
    MIND_MAP = "mind_map"
    PROCESS_DIAGRAM = "process_diagram"
    ARCHITECTURE_DIAGRAM = "architecture_diagram"

# ----------------- Sub-models for Graph-based Diagrams -----------------

class DiagramNode(BaseModel):
    id: str = Field(..., description="Unique node identifier (e.g. '1', '2', 'node_1')")
    label: str = Field(..., description="Concise primary text/title of node")
    type: Optional[str] = Field("default", description="Node category: process, decision, concept, component, root, branch, subtopic")
    description: Optional[str] = Field(None, description="Detailed explanatory text or sub-label")
    category: Optional[str] = Field(None, description="Functional or conceptual grouping")

class DiagramEdge(BaseModel):
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    label: Optional[str] = Field(None, description="Relationship or transition label (e.g. 'Yes', 'No', 'depends on')")
    type: Optional[str] = Field("default", description="Edge style: default, smoothstep, straight, animated")

# ----------------- Sub-models for Infographic -----------------

class InfographicSection(BaseModel):
    heading: str = Field(..., description="Section title or key concept name")
    description: str = Field(..., description="Clear explanation of the concept")
    key_points: List[str] = Field(default_factory=list, description="List of bullet points or takeaways")
    category: Optional[str] = Field(None, description="Section category or tag")
    stat: Optional[str] = Field(None, description="Key metric, ratio, or highlighted number if applicable")

class IncomingSourceCitation(BaseModel):
    chunk_id: Optional[str] = Field(None, alias="chunkId")
    document_id: Optional[str] = Field(None, alias="documentId")
    document_name: Optional[str] = Field("Document", alias="documentName")
    page_number: Optional[int] = Field(1, alias="pageNumber")
    relevance_score: Optional[float] = Field(0.8, alias="relevanceScore")
    snippet: Optional[str] = Field("", description="Snippet of referenced content")

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

# ----------------- Requests & Responses -----------------

class VisualizationGenerateRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Topic or prompt to visualize")
    user_id: str = Field(..., description="User ID for document retrieval isolation")
    visualization_type: VisualizationType = Field(..., description="Type of visual study content to generate")
    document_id: Optional[str] = Field(None, description="Optional single document ID to scope retrieval")
    document_ids: Optional[List[str]] = Field(None, description="Optional multiple document IDs to scope retrieval")
    conversation_id: Optional[str] = Field(None, description="Optional conversation ID if generated from chat")
    chat_response_context: Optional[str] = Field(None, description="Optional chatbot answer text to visualize directly")
    sources: Optional[List[Union[SourceCitation, IncomingSourceCitation, Dict[str, Any]]]] = Field(
        default_factory=list, description="Optional source citations to preserve from chat"
    )
    top_k: int = Field(5, ge=1, le=20, description="Number of chunks to retrieve")
    min_relevance: float = Field(0.42, ge=0.0, le=1.0, description="Minimum similarity threshold")
    model: Optional[str] = Field(None, description="Override LLM model name")

class VisualizationGenerateResponse(BaseModel):
    visualization_type: str = Field(..., description="Type of visualization generated")
    title: str = Field(..., description="Title of the diagram / infographic")
    generated_data: Dict[str, Any] = Field(..., description="Validated structured diagram data")
    sources: List[SourceCitation] = Field(default_factory=list, description="Attached source references")
    insufficient_context: bool = Field(False, description="Flag indicating if context was insufficient")
    latency_ms: float = Field(..., description="Total generation time in milliseconds")
    model: str = Field(..., description="Model used for generation")

class VisualizationValidateRequest(BaseModel):
    visualization_type: VisualizationType = Field(..., description="Target diagram type")
    data: Dict[str, Any] = Field(..., description="JSON data payload to validate")

class VisualizationValidateResponse(BaseModel):
    valid: bool = Field(..., description="Whether data complies with schema and integrity rules")
    errors: List[str] = Field(default_factory=list, description="Validation error descriptions")
    repaired_data: Optional[Dict[str, Any]] = Field(None, description="Auto-repaired data if errors were fixable")
