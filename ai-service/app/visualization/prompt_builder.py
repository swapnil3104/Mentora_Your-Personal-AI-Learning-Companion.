from typing import Dict, Any, Optional
from app.schemas.visualization_schema import VisualizationType

class VisualizationPromptBuilder:
    """
    Constructs type-specific prompts requiring pure, validated JSON output
    for all 6 academic study visualization formats.
    """

    SYSTEM_BASE = (
        "You are Mentora Visual Engine, an expert academic visualization generator.\n"
        "Your task is to transform academic study materials and retrieved concepts into "
        "structured, readable, and factually grounded diagrams and infographics.\n\n"
        "CRITICAL RULES:\n"
        "1. Output ONLY a single valid JSON object. Do not include markdown code block backticks (e.g. ```json), no preambles, and no conversational text.\n"
        "2. All nodes, steps, and points must be strictly grounded in the provided context.\n"
        "3. Every edge must connect existing nodes: edge 'source' and 'target' MUST match a node 'id'.\n"
        "4. Keep labels concise, clear, and academic (maximum 4-8 words per label).\n"
        "5. Node IDs must be simple alphanumeric identifiers (e.g. '1', '2', 'node_1')."
    )

    def build_prompt(
        self,
        topic: str,
        context: str,
        visualization_type: VisualizationType,
        chat_context: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Builds system and user prompt for the given visualization type.
        """
        combined_context = ""
        if chat_context:
            combined_context += f"--- CHATBOT ANSWER CONTEXT ---\n{chat_context}\n\n"
        if context:
            combined_context += f"--- RETRIEVED ACADEMIC DOCUMENT CONTENT ---\n{context}\n\n"
        if not combined_context.strip():
            combined_context = f"Topic: {topic}\n(Use authoritative academic principles for this concept)."

        schema_spec = self._get_schema_instructions(visualization_type)

        user_prompt = (
            f"TARGET TOPIC: {topic}\n\n"
            f"RELEVANT STUDY CONTEXT:\n{combined_context}\n\n"
            f"REQUIRED OUTPUT SCHEMA ({visualization_type.value}):\n{schema_spec}\n\n"
            f"Generate the complete JSON structure for this {visualization_type.value} now:"
        )

        return {
            "system": self.SYSTEM_BASE,
            "prompt": user_prompt,
        }

    def _get_schema_instructions(self, vtype: VisualizationType) -> str:
        if vtype == VisualizationType.INFOGRAPHIC:
            return """
JSON Format:
{
  "title": "Clear Concept Title",
  "subtitle": "Short explanatory subtitle",
  "summary": "1-2 sentence core concept definition",
  "sections": [
    {
      "heading": "Section / Concept Name",
      "description": "Clear explanation of this aspect",
      "key_points": ["Key bullet point 1", "Key bullet point 2", "Key bullet point 3"],
      "category": "Classification / Tag",
      "stat": "Optional key metric, formula or highlight (e.g. 'O(n log n)', '5 Stages')"
    }
  ],
  "takeaways": ["High-level summary takeaway 1", "High-level summary takeaway 2"]
}
Requirements: Include 3 to 5 comprehensive sections.
"""
        elif vtype == VisualizationType.CONCEPT_MAP:
            return """
JSON Format:
{
  "title": "Concept Map Title",
  "description": "Short explanation of domain relationships",
  "nodes": [
    {"id": "1", "label": "Primary Concept", "type": "concept", "description": "Core idea"},
    {"id": "2", "label": "Related Concept", "type": "concept", "description": "Supporting idea"}
  ],
  "edges": [
    {"source": "1", "target": "2", "label": "relationship verb (e.g. 'comprises', 'regulates', 'derives from')", "type": "default"}
  ]
}
Requirements: Provide 5 to 10 interconnected concept nodes and meaningful relational verbs on edges. Every edge source and target MUST exist in nodes.
"""
        elif vtype == VisualizationType.FLOWCHART:
            return """
JSON Format:
{
  "title": "Flowchart Title",
  "description": "Overview of the algorithm or logical flow",
  "nodes": [
    {"id": "start", "label": "Start", "type": "start"},
    {"id": "step1", "label": "Execute Step 1", "type": "process"},
    {"id": "dec1", "label": "Condition Check?", "type": "decision"},
    {"id": "step2", "label": "Action on True", "type": "process"},
    {"id": "end", "label": "End", "type": "end"}
  ],
  "edges": [
    {"source": "start", "target": "step1", "label": ""},
    {"source": "step1", "target": "dec1", "label": ""},
    {"source": "dec1", "target": "step2", "label": "Yes"},
    {"source": "dec1", "target": "end", "label": "No"},
    {"source": "step2", "target": "end", "label": ""}
  ],
  "mermaid_syntax": "flowchart TD\\n  start([Start]) --> step1[Execute Step 1]\\n  step1 --> dec1{Condition Check?}\\n  dec1 -->|Yes| step2[Action on True]\\n  dec1 -->|No| end1([End])\\n  step2 --> end1"
}
Requirements: Logical branching flow with at least 1 decision node and correct Mermaid syntax using flowchart TD.
"""
        elif vtype == VisualizationType.MIND_MAP:
            return """
JSON Format:
{
  "title": "Mind Map Title",
  "description": "Hierarchical breakdown of central theme",
  "root_node": {"id": "root", "label": "Central Subject"},
  "nodes": [
    {"id": "root", "label": "Central Subject", "type": "root"},
    {"id": "b1", "label": "Main Branch 1", "type": "branch", "description": "Branch overview"},
    {"id": "b1_1", "label": "Subtopic 1.1", "type": "subtopic", "description": "Detail"},
    {"id": "b1_2", "label": "Subtopic 1.2", "type": "subtopic", "description": "Detail"},
    {"id": "b2", "label": "Main Branch 2", "type": "branch", "description": "Branch overview"},
    {"id": "b2_1", "label": "Subtopic 2.1", "type": "subtopic", "description": "Detail"}
  ],
  "edges": [
    {"source": "root", "target": "b1", "label": ""},
    {"source": "b1", "target": "b1_1", "label": ""},
    {"source": "b1", "target": "b1_2", "label": ""},
    {"source": "root", "target": "b2", "label": ""},
    {"source": "b2", "target": "b2_1", "label": ""}
  ]
}
Requirements: Clear tree hierarchy expanding from 1 central root to 2-4 main branches and 2-4 subtopics per branch.
"""
        elif vtype == VisualizationType.PROCESS_DIAGRAM:
            return """
JSON Format:
{
  "title": "Process Diagram Title",
  "description": "Chronological execution workflow",
  "nodes": [
    {"id": "s1", "label": "Stage 1: Input Acquisition", "type": "process", "description": "Fetches raw data"},
    {"id": "s2", "label": "Stage 2: Core Processing", "type": "process", "description": "Applies transformations"},
    {"id": "s3", "label": "Stage 3: Output Delivery", "type": "process", "description": "Stores final artifacts"}
  ],
  "edges": [
    {"source": "s1", "target": "s2", "label": "Raw Tokens"},
    {"source": "s2", "target": "s3", "label": "Computed State"}
  ]
}
Requirements: Sequential activity stages with inputs, outputs, and transitions.
"""
        elif vtype == VisualizationType.ARCHITECTURE_DIAGRAM:
            return """
JSON Format:
{
  "title": "System Architecture Title",
  "description": "Component structure and communication channels",
  "nodes": [
    {"id": "c1", "label": "Client Layer", "type": "client", "category": "Presentation"},
    {"id": "c2", "label": "API Service", "type": "service", "category": "Application"},
    {"id": "c3", "label": "Database Engine", "type": "database", "category": "Data"}
  ],
  "edges": [
    {"source": "c1", "target": "c2", "label": "REST / JSON"},
    {"source": "c2", "target": "c3", "label": "SQL Queries"}
  ]
}
Requirements: System components grouped into architectural tiers with communication protocols on edges.
"""
        return "{}"

visualization_prompt_builder = VisualizationPromptBuilder()
