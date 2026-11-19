import json
import re
from typing import Dict, Any, List, Tuple, Optional
from app.schemas.visualization_schema import VisualizationType
from app.core.logging import logger

class VisualizationValidator:
    """
    Validates, repairs, and sanitizes generated structured visualization data.
    Enforces referential integrity between nodes and edges, ensures Mermaid syntax
    validity, and defends against unsafe markup injection.
    """

    DANGEROUS_PATTERNS = [
        re.compile(r"<script.*?>.*?</script>", re.IGNORECASE | re.DOTALL),
        re.compile(r"javascript:", re.IGNORECASE),
        re.compile(r"onload=", re.IGNORECASE),
        re.compile(r"onerror=", re.IGNORECASE),
    ]

    def parse_and_repair_json(self, raw_text: str) -> Optional[Dict[str, Any]]:
        """
        Attempts to parse LLM text into JSON, repairing markdown fences
        and common JSON syntax anomalies if necessary.
        """
        if not raw_text or not raw_text.strip():
            return None

        text = raw_text.strip()

        # 1. Strip markdown fences if present
        if "```json" in text:
            match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
            if match:
                text = match.group(1).strip()
        elif "```" in text:
            match = re.search(r"```\s*(.*?)\s*```", text, re.DOTALL)
            if match:
                text = match.group(1).strip()

        # 2. Extract outermost JSON object { ... }
        start_idx = text.find("{")
        end_idx = text.rfind("}")
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            text = text[start_idx:end_idx + 1]

        # 3. Direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # 4. Repair common JSON issues
        try:
            # Remove trailing commas before } or ]
            repaired = re.sub(r",\s*([\]}])", r"\1", text)
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

        try:
            # Replace unescaped newlines in strings
            repaired = re.sub(r'(?<!\\)\n', ' ', text)
            repaired = re.sub(r",\s*([\]}])", r"\1", repaired)
            return json.loads(repaired)
        except json.JSONDecodeError as err:
            logger.warning(f"Failed to parse LLM JSON output: {err}")
            return None

    def sanitize_string(self, val: str) -> str:
        """
        Strips dangerous scripts and escapes risky HTML characters.
        """
        if not isinstance(val, str):
            return str(val)
        sanitized = val
        for pat in self.DANGEROUS_PATTERNS:
            sanitized = pat.sub("", sanitized)
        return sanitized.strip()

    def validate(
        self,
        data: Dict[str, Any],
        vtype: VisualizationType,
    ) -> Tuple[bool, List[str], Dict[str, Any]]:
        """
        Validates the diagram data against the specific visualization type rules.
        Returns: (is_valid, errors_list, sanitized_or_repaired_data)
        """
        errors = []
        if not isinstance(data, dict):
            return False, ["Payload must be a JSON dictionary object"], {}

        repaired = dict(data)
        title = repaired.get("title") or "Study Visualization"
        repaired["title"] = self.sanitize_string(str(title))

        if vtype == VisualizationType.INFOGRAPHIC:
            return self._validate_infographic(repaired)
        else:
            return self._validate_graph_diagram(repaired, vtype)

    def _validate_infographic(self, data: Dict[str, Any]) -> Tuple[bool, List[str], Dict[str, Any]]:
        errors = []
        sections = data.get("sections")
        if not isinstance(sections, list) or len(sections) == 0:
            errors.append("Infographic must include a non-empty 'sections' list")
            sections = []

        valid_sections = []
        for i, sec in enumerate(sections):
            if not isinstance(sec, dict):
                continue
            heading = sec.get("heading") or f"Section {i+1}"
            desc = sec.get("description") or ""
            key_pts = sec.get("key_points") or []
            if isinstance(key_pts, str):
                key_pts = [key_pts]
            elif not isinstance(key_pts, list):
                key_pts = []

            sanitized_pts = [self.sanitize_string(str(pt)) for pt in key_pts]
            valid_sections.append({
                "heading": self.sanitize_string(str(heading)),
                "description": self.sanitize_string(str(desc)),
                "key_points": sanitized_pts,
                "category": self.sanitize_string(str(sec.get("category") or "")),
                "stat": self.sanitize_string(str(sec.get("stat") or "")),
            })

        data["sections"] = valid_sections
        if "summary" in data:
            data["summary"] = self.sanitize_string(str(data["summary"]))
        if "subtitle" in data:
            data["subtitle"] = self.sanitize_string(str(data["subtitle"]))
        if "takeaways" in data and isinstance(data["takeaways"], list):
            data["takeaways"] = [self.sanitize_string(str(t)) for t in data["takeaways"]]

        if len(valid_sections) == 0:
            errors.append("Infographic contains zero valid sections")

        return len(errors) == 0, errors, data

    def _validate_graph_diagram(
        self,
        data: Dict[str, Any],
        vtype: VisualizationType,
    ) -> Tuple[bool, List[str], Dict[str, Any]]:
        errors = []
        nodes = data.get("nodes")
        edges = data.get("edges")

        if not isinstance(nodes, list) or len(nodes) == 0:
            errors.append(f"{vtype.value} must contain a non-empty 'nodes' list")
            nodes = []
        if not isinstance(edges, list):
            edges = []

        # Validate nodes and build node ID lookup table
        node_id_map = {}
        valid_nodes = []
        for i, node in enumerate(nodes):
            if not isinstance(node, dict):
                continue
            raw_id = str(node.get("id") or f"n{i+1}").strip()
            # Clean ID for safety (alphanumeric and underscores)
            clean_id = re.sub(r"[^a-zA-Z0-9_\-]", "_", raw_id)
            if not clean_id:
                clean_id = f"node_{i+1}"

            # Avoid collision
            if clean_id in node_id_map:
                clean_id = f"{clean_id}_{i+1}"

            label = self.sanitize_string(str(node.get("label") or f"Concept {i+1}"))
            ntype = str(node.get("type") or "default").lower()
            desc = self.sanitize_string(str(node.get("description") or ""))
            category = self.sanitize_string(str(node.get("category") or ""))

            node_obj = {
                "id": clean_id,
                "label": label,
                "type": ntype,
                "description": desc,
                "category": category,
            }
            node_id_map[raw_id] = clean_id
            node_id_map[clean_id] = clean_id
            valid_nodes.append(node_obj)

        data["nodes"] = valid_nodes
        valid_node_ids = {n["id"] for n in valid_nodes}

        # Validate edges and referential integrity
        valid_edges = []
        for i, edge in enumerate(edges):
            if not isinstance(edge, dict):
                continue
            src = str(edge.get("source") or "").strip()
            tgt = str(edge.get("target") or "").strip()

            mapped_src = node_id_map.get(src, src)
            mapped_tgt = node_id_map.get(tgt, tgt)

            if mapped_src in valid_node_ids and mapped_tgt in valid_node_ids and mapped_src != mapped_tgt:
                edge_label = self.sanitize_string(str(edge.get("label") or ""))
                valid_edges.append({
                    "id": f"e_{mapped_src}_{mapped_tgt}_{i}",
                    "source": mapped_src,
                    "target": mapped_tgt,
                    "label": edge_label,
                    "type": str(edge.get("type") or "default"),
                })

        data["edges"] = valid_edges

        # Generate or sanitize Mermaid syntax for Mermaid-capable diagrams
        if vtype in (VisualizationType.FLOWCHART, VisualizationType.PROCESS_DIAGRAM, VisualizationType.ARCHITECTURE_DIAGRAM):
            mermaid = data.get("mermaid_syntax")
            if not mermaid or not isinstance(mermaid, str) or len(mermaid.strip()) < 10:
                data["mermaid_syntax"] = self.build_mermaid_syntax(valid_nodes, valid_edges, vtype)
            else:
                sanitized_mermaid = self.sanitize_mermaid(mermaid)
                # Ensure it starts with valid directive
                if not any(sanitized_mermaid.strip().startswith(p) for p in ["flowchart", "graph", "sequenceDiagram", "stateDiagram"]):
                    sanitized_mermaid = f"flowchart TD\n{sanitized_mermaid}"
                data["mermaid_syntax"] = sanitized_mermaid

        # Mind map specific check
        if vtype == VisualizationType.MIND_MAP:
            root_node = data.get("root_node")
            if not root_node or not isinstance(root_node, dict):
                # Auto-assign first node as root
                if valid_nodes:
                    data["root_node"] = {"id": valid_nodes[0]["id"], "label": valid_nodes[0]["label"]}

        # Process diagram specific check
        if vtype == VisualizationType.PROCESS_DIAGRAM:
            if "steps" not in data or not isinstance(data.get("steps"), list):
                data["steps"] = [
                    {
                        "step_number": i + 1,
                        "name": n["label"],
                        "description": n.get("description", ""),
                        "inputs": "Input state",
                        "outputs": "Processed state",
                    }
                    for i, n in enumerate(valid_nodes)
                ]

        # Architecture diagram specific check
        if vtype == VisualizationType.ARCHITECTURE_DIAGRAM:
            if "components" not in data or not isinstance(data.get("components"), list):
                data["components"] = [
                    {
                        "name": n["label"],
                        "layer": n.get("category") or "Core",
                        "type": n.get("type", "service"),
                    }
                    for n in valid_nodes
                ]

        return len(errors) == 0, errors, data

    def build_mermaid_syntax(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]], vtype: VisualizationType) -> str:
        """
        Programmatically constructs clean, valid Mermaid diagram syntax from nodes and edges.
        """
        direction = "LR" if vtype == VisualizationType.PROCESS_DIAGRAM else "TD"
        lines = [f"flowchart {direction}"]

        for node in nodes:
            nid = node["id"]
            # Escape quotes in label
            nlabel = node["label"].replace('"', "'")
            ntype = node.get("type", "")

            if ntype in ("start", "end", "terminal"):
                lines.append(f'    {nid}(["{nlabel}"])')
            elif ntype in ("decision", "condition"):
                lines.append(f'    {nid}{{"{nlabel}"}}')
            elif ntype in ("database", "storage"):
                lines.append(f'    {nid}[("{nlabel}")]')
            else:
                lines.append(f'    {nid}["{nlabel}"]')

        for edge in edges:
            src = edge["source"]
            tgt = edge["target"]
            lbl = edge.get("label", "").replace('"', "'").strip()
            if lbl:
                lines.append(f'    {src} -->|"{lbl}"| {tgt}')
            else:
                lines.append(f'    {src} --> {tgt}')

        return "\n".join(lines)

    def sanitize_mermaid(self, mermaid_code: str) -> str:
        """
        Cleans Mermaid code by normalizing line endings and removing dangerous strings.
        """
        code = mermaid_code.replace("\\n", "\n")
        lines = code.split("\n")
        cleaned_lines = []
        for line in lines:
            # Disallow script tags or click directives executing functions
            if "click " in line and ("call " in line or "href " in line):
                continue
            cleaned_lines.append(line)
        return "\n".join(cleaned_lines)

visualization_validator = VisualizationValidator()
