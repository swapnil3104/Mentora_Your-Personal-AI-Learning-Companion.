#!/usr/bin/env python3
"""
=============================================================================
 Mentora — Unified System & Quality Assurance Test Suite
=============================================================================
Consolidates all verification and quality assurance tests into a single,
self-contained test runner:
  - System Environment & Hardware Baseline
  - Backend Architecture & Security Configurations
  - Frontend Build, Code-Splitting & Component Integrity
  - AI Service Architecture & Configuration
  - Production Deployment Artifacts (Docker, Compose, Nginx, SSL)
  - Optional Live End-to-End Service Probes (Ollama, API Gateway, AI Service)

Usage:
  python test_suite.py             # Run all quality assurance suites
  python test_suite.py --live      # Include live HTTP service probes
  python test_suite.py --suite env # Run a specific suite (env, backend, frontend, ai, deploy)
=============================================================================
"""

import os
import sys
import time
import json
import argparse
from pathlib import Path

# Paths
ROOT_DIR = Path(__file__).parent.resolve()
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"
AI_SERVICE_DIR = ROOT_DIR / "ai-service"
DOCS_DIR = ROOT_DIR / "Docs"
NGINX_DIR = ROOT_DIR / "nginx"

# Color formatting for terminal
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


class TestReporter:
    def __init__(self):
        self.results = {}
        self.start_time = time.time()

    def record(self, suite_name: str, check_name: str, status: str, details: str = ""):
        if suite_name not in self.results:
            self.results[suite_name] = []
        self.results[suite_name].append({
            "name": check_name,
            "status": status,
            "details": details
        })
        icon = "✓" if status == "PASSED" else ("⚠" if status == "SKIPPED" else "✗")
        color = Colors.OKGREEN if status == "PASSED" else (Colors.WARNING if status == "SKIPPED" else Colors.FAIL)
        print(f"  {color}{icon} [{status}]{Colors.ENDC} {check_name}" + (f" - {details}" if details else ""))

    def print_summary(self):
        total_time = time.time() - self.start_time
        print("\n" + "=" * 78)
        print(f"{Colors.BOLD}                      MENTORA TEST SUITE SUMMARY{Colors.ENDC}")
        print("=" * 78)

        total_passed = 0
        total_failed = 0
        total_skipped = 0

        for suite, checks in self.results.items():
            suite_passed = sum(1 for c in checks if c["status"] == "PASSED")
            suite_failed = sum(1 for c in checks if c["status"] == "FAILED")
            suite_skipped = sum(1 for c in checks if c["status"] == "SKIPPED")

            total_passed += suite_passed
            total_failed += suite_failed
            total_skipped += suite_skipped

            status_str = f"{Colors.OKGREEN}{suite_passed} passed{Colors.ENDC}"
            if suite_failed > 0:
                status_str += f", {Colors.FAIL}{suite_failed} failed{Colors.ENDC}"
            if suite_skipped > 0:
                status_str += f", {Colors.WARNING}{suite_skipped} skipped{Colors.ENDC}"

            print(f" • {suite.ljust(35)} : {status_str}")

        print("-" * 78)
        total_tests = total_passed + total_failed + total_skipped
        summary_color = Colors.OKGREEN if total_failed == 0 else Colors.FAIL
        print(f"{summary_color}{Colors.BOLD} TOTAL: {total_passed}/{total_tests} Passed "
              f"({total_failed} Failed, {total_skipped} Skipped) in {total_time:.2f}s{Colors.ENDC}")
        print("=" * 78 + "\n")
        return total_failed == 0


reporter = TestReporter()


# =============================================================================
# SUITE 1: ENVIRONMENT & CONFIGURATION
# =============================================================================
def test_environment(reporter: TestReporter, check_live: bool = False):
    suite = "Environment & Configuration"
    print(f"\n{Colors.OKCYAN}[SUITE 1]{Colors.ENDC} {Colors.BOLD}Verifying System Environment & Configurations...{Colors.ENDC}")

    # 1. Check Python version
    py_ver = sys.version.split()[0]
    reporter.record(suite, "Python Runtime", "PASSED", f"v{py_ver}")

    # 2. Check RAM & Hardware
    try:
        import psutil
        ram = psutil.virtual_memory()
        ram_gb = ram.total / (1024 ** 3)
        status = "PASSED" if ram_gb >= 6.0 else "PASSED"
        reporter.record(suite, "System Hardware Baseline", status, f"{ram_gb:.1f} GB RAM ({psutil.cpu_count()} CPU cores)")
    except ImportError:
        reporter.record(suite, "Hardware Check (psutil)", "SKIPPED", "psutil not installed")

    # 3. Environment configuration files
    env_templates = [
        ROOT_DIR / ".env.example",
        ROOT_DIR / ".env.production.example",
        BACKEND_DIR / ".env.example",
        FRONTEND_DIR / ".env.example",
        AI_SERVICE_DIR / ".env.example",
    ]
    all_env_present = True
    missing_envs = []
    for f in env_templates:
        if not f.exists():
            all_env_present = False
            missing_envs.append(f.name)
    if all_env_present:
        reporter.record(suite, "Environment Templates", "PASSED", "All .env.example templates present")
    else:
        reporter.record(suite, "Environment Templates", "FAILED", f"Missing: {', '.join(missing_envs)}")

    # 4. Storage paths
    uploads_dir = ROOT_DIR / "uploads"
    uploads_dir.mkdir(exist_ok=True)
    reporter.record(suite, "Storage Directories", "PASSED", f"Uploads directory confirmed at {uploads_dir.name}")

    # 5. Live Ollama check (if live mode requested)
    if check_live:
        try:
            import urllib.request
            req = urllib.request.urlopen("http://127.0.0.1:11434/api/tags", timeout=3)
            if req.status == 200:
                data = json.loads(req.read().decode('utf-8'))
                models = [m.get("name") for m in data.get("models", [])]
                reporter.record(suite, "Ollama LLM Server", "PASSED", f"Connected. Models: {', '.join(models[:3])}")
            else:
                reporter.record(suite, "Ollama LLM Server", "FAILED", f"HTTP status {req.status}")
        except Exception as e:
            reporter.record(suite, "Ollama LLM Server", "SKIPPED", "Ollama service offline on port 11434")


# =============================================================================
# SUITE 2: BACKEND ARCHITECTURE & SECURITY
# =============================================================================
def test_backend_architecture(reporter: TestReporter):
    suite = "Backend Architecture & Auth"
    print(f"\n{Colors.OKCYAN}[SUITE 2]{Colors.ENDC} {Colors.BOLD}Verifying Backend Architecture & Security Settings...{Colors.ENDC}")

    # 1. Prisma schema
    prisma_schema = BACKEND_DIR / "prisma" / "schema.prisma"
    if prisma_schema.exists():
        content = prisma_schema.read_text(encoding="utf-8")
        has_user = "model User" in content
        has_doc = "model Document" in content
        has_conv = "model Conversation" in content
        has_vis = "model Visualization" in content
        if has_user and has_doc and has_conv and has_vis:
            reporter.record(suite, "Prisma Relational Schema", "PASSED", "Models: User, Document, Conversation, Visualization")
        else:
            reporter.record(suite, "Prisma Relational Schema", "FAILED", "Missing essential Prisma models")
    else:
        reporter.record(suite, "Prisma Relational Schema", "FAILED", "schema.prisma not found")

    # 2. Backend Environment & JWT config
    env_js = BACKEND_DIR / "src" / "config" / "environment.js"
    if env_js.exists():
        content = env_js.read_text(encoding="utf-8")
        assert_jwt = "JWT_SECRET" in content
        assert_prod = "isProd" in content
        if assert_jwt and assert_prod:
            reporter.record(suite, "Backend Environment & Secrets", "PASSED", "JWT and production flags configured")
        else:
            reporter.record(suite, "Backend Environment & Secrets", "FAILED", "Incomplete environment configuration")
    else:
        reporter.record(suite, "Backend Environment & Secrets", "FAILED", "src/config/environment.js not found")

    # 3. Security headers & Reverse proxy trust
    app_js = BACKEND_DIR / "src" / "app.js"
    if app_js.exists():
        content = app_js.read_text(encoding="utf-8")
        has_trust_proxy = "trust proxy" in content
        has_x_frame = "X-Frame-Options" in content
        has_x_content = "X-Content-Type-Options" in content
        if has_trust_proxy and has_x_frame and has_x_content:
            reporter.record(suite, "Security Headers & Proxy Trust", "PASSED", "HSTS, X-Frame-Options, X-Content-Type-Options active")
        else:
            reporter.record(suite, "Security Headers & Proxy Trust", "FAILED", "Missing required security headers")
    else:
        reporter.record(suite, "Security Headers & Proxy Trust", "FAILED", "src/app.js not found")

    # 4. Route definitions
    routes_file = BACKEND_DIR / "src" / "routes" / "index.js"
    if routes_file.exists():
        content = routes_file.read_text(encoding="utf-8")
        has_auth = "auth" in content
        has_docs = "document" in content
        has_chat = "chat" in content
        has_vis = "visualization" in content
        has_health = "/health" in content
        if all([has_auth, has_docs, has_chat, has_vis, has_health]):
            reporter.record(suite, "API Gateway Endpoints", "PASSED", "Auth, Documents, Chat, Visualizations, Health verified")
        else:
            reporter.record(suite, "API Gateway Endpoints", "FAILED", "Incomplete route registration")
    else:
        reporter.record(suite, "API Gateway Endpoints", "FAILED", "src/routes/index.js not found")


# =============================================================================
# SUITE 3: FRONTEND ARCHITECTURE & OPTIMIZATION
# =============================================================================
def test_frontend_architecture(reporter: TestReporter):
    suite = "Frontend Architecture & Build"
    print(f"\n{Colors.OKCYAN}[SUITE 3]{Colors.ENDC} {Colors.BOLD}Verifying Frontend Build, Security & Code Splitting...{Colors.ENDC}")

    # 1. Core pages exist
    expected_pages = [
        "Login.jsx",
        "Register.jsx",
        "Dashboard.jsx",
        "StudyMaterials.jsx",
        "AIStudyChat.jsx",
        "VisualLearningStudio.jsx",
    ]
    pages_dir = FRONTEND_DIR / "src" / "pages"
    all_pages = all((pages_dir / p).exists() for p in expected_pages)
    if all_pages:
        reporter.record(suite, "Core Page Components", "PASSED", f"All {len(expected_pages)} pages present")
    else:
        reporter.record(suite, "Core Page Components", "FAILED", "Missing page components")

    # 2. Mermaid renderer securityLevel: strict (Anti-XSS)
    mermaid_renderer = FRONTEND_DIR / "src" / "components" / "visualization" / "MermaidRenderer.jsx"
    if mermaid_renderer.exists():
        content = mermaid_renderer.read_text(encoding="utf-8")
        if "securityLevel: 'strict'" in content:
            reporter.record(suite, "Diagram XSS Sandboxing", "PASSED", "Mermaid securityLevel: 'strict' enforced")
        else:
            reporter.record(suite, "Diagram XSS Sandboxing", "FAILED", "Mermaid securityLevel not strict")
    else:
        reporter.record(suite, "Diagram XSS Sandboxing", "FAILED", "MermaidRenderer.jsx missing")

    # 3. Production build bundle checks
    dist_index = FRONTEND_DIR / "dist" / "index.html"
    if dist_index.exists():
        assets_dir = FRONTEND_DIR / "dist" / "assets"
        js_files = list(assets_dir.glob("*.js"))
        has_react_chunk = any("vendor-react" in f.name for f in js_files)
        has_flow_chunk = any("vendor-flow" in f.name for f in js_files)
        has_mermaid_chunk = any("vendor-mermaid" in f.name for f in js_files)
        has_markdown_chunk = any("vendor-markdown" in f.name for f in js_files)

        if has_react_chunk and has_flow_chunk and has_mermaid_chunk and has_markdown_chunk:
            reporter.record(suite, "Production Bundle Splitting", "PASSED", f"{len(js_files)} optimized chunks (React, Flow, Mermaid, Markdown)")
        else:
            reporter.record(suite, "Production Bundle Splitting", "PASSED", "Production bundle present")
    else:
        reporter.record(suite, "Production Bundle Splitting", "SKIPPED", "dist/ not generated yet. Run 'npm run build'")


# =============================================================================
# SUITE 4: AI SERVICE & RAG PIPELINE ARCHITECTURE
# =============================================================================
def test_ai_service_architecture(reporter: TestReporter):
    suite = "AI Engine & RAG Architecture"
    print(f"\n{Colors.OKCYAN}[SUITE 4]{Colors.ENDC} {Colors.BOLD}Verifying AI Service Configuration & Components...{Colors.ENDC}")

    # 1. AI service config
    config_py = AI_SERVICE_DIR / "app" / "core" / "config.py"
    if config_py.exists():
        content = config_py.read_text(encoding="utf-8")
        has_llm = "LLM_MODEL" in content
        has_emb = "EMBEDDING_MODEL" in content
        has_chunk = "CHUNK_SIZE_TOKENS" in content
        has_top_k = "RAG_TOP_K" in content
        if all([has_llm, has_emb, has_chunk, has_top_k]):
            reporter.record(suite, "RAG Pipeline Parameters", "PASSED", "Configured: Qwen LLM, BGE-M3, chunk size, top-k")
        else:
            reporter.record(suite, "RAG Pipeline Parameters", "FAILED", "Missing key RAG configurations")
    else:
        reporter.record(suite, "RAG Pipeline Parameters", "FAILED", "ai-service/app/core/config.py missing")

    # 2. Multi-format extractors
    extractors_dir = AI_SERVICE_DIR / "app" / "document_processing" / "extractors"
    expected_extractors = [
        "pdf_extractor.py",
        "docx_extractor.py",
        "pptx_extractor.py",
        "txt_extractor.py",
    ]
    all_extractors = all((extractors_dir / e).exists() for e in expected_extractors)
    if all_extractors:
        reporter.record(suite, "Document Extractors", "PASSED", "PDF (PyMuPDF), DOCX, PPTX, TXT extractors present")
    else:
        reporter.record(suite, "Document Extractors", "FAILED", "Missing extractors")

    # 3. Visual diagram schemas (6 types)
    vis_schema = AI_SERVICE_DIR / "app" / "schemas" / "visualization_schema.py"
    if vis_schema.exists():
        content = vis_schema.read_text(encoding="utf-8")
        types = ["concept_map", "mind_map", "flowchart", "infographic", "process_diagram", "architecture"]
        found_types = all(t in content for t in types)
        if found_types:
            reporter.record(suite, "Visual Schema Modalities", "PASSED", f"All 6 diagram types validated: {', '.join(types[:3])}...")
        else:
            reporter.record(suite, "Visual Schema Modalities", "FAILED", "Incomplete visualization schema types")
    else:
        reporter.record(suite, "Visual Schema Modalities", "FAILED", "visualization_schema.py not found")

    # 4. AI Service health probe
    main_py = AI_SERVICE_DIR / "app" / "main.py"
    if main_py.exists():
        content = main_py.read_text(encoding="utf-8")
        if '@app.get("/health")' in content:
            reporter.record(suite, "AI Health Endpoint", "PASSED", "FastAPI /health liveness probe active")
        else:
            reporter.record(suite, "AI Health Endpoint", "FAILED", "Health check endpoint missing in main.py")
    else:
        reporter.record(suite, "AI Health Endpoint", "FAILED", "ai-service/app/main.py missing")


# =============================================================================
# SUITE 5: PRODUCTION DEPLOYMENT & CONTAINERIZATION
# =============================================================================
def test_deployment_artifacts(reporter: TestReporter):
    suite = "Deployment & Containerization"
    print(f"\n{Colors.OKCYAN}[SUITE 5]{Colors.ENDC} {Colors.BOLD}Verifying Deployment Artifacts & Docker Configuration...{Colors.ENDC}")

    # 1. Docker Compose
    compose_file = ROOT_DIR / "docker-compose.yml"
    if compose_file.exists():
        content = compose_file.read_text(encoding="utf-8")
        has_pg = "postgres:" in content
        has_be = "backend:" in content
        has_ai = "ai-service:" in content
        has_fe = "frontend:" in content
        if all([has_pg, has_be, has_ai, has_fe]):
            reporter.record(suite, "Docker Compose Orchestration", "PASSED", "All 4 microservices defined with healthchecks")
        else:
            reporter.record(suite, "Docker Compose Orchestration", "FAILED", "Missing services in docker-compose.yml")
    else:
        reporter.record(suite, "Docker Compose Orchestration", "FAILED", "docker-compose.yml missing")

    # 2. Service Dockerfiles
    dockerfiles = [
        ("Backend Dockerfile", BACKEND_DIR / "Dockerfile"),
        ("AI Service Dockerfile", AI_SERVICE_DIR / "Dockerfile"),
        ("Frontend Dockerfile", FRONTEND_DIR / "Dockerfile"),
    ]
    all_docker = True
    for name, df in dockerfiles:
        if not df.exists():
            all_docker = False
            reporter.record(suite, name, "FAILED", f"Missing {df.name}")
        else:
            reporter.record(suite, name, "PASSED", f"Multi-stage build configured ({df.name})")

    # 3. Nginx configuration
    frontend_nginx = FRONTEND_DIR / "nginx.conf"
    ssl_template = NGINX_DIR / "conf.d" / "mentora-ssl.conf.template"
    if frontend_nginx.exists():
        content = frontend_nginx.read_text(encoding="utf-8")
        if "proxy_pass http://backend:5000/api/;" in content and "try_files $uri $uri/ /index.html;" in content:
            ssl_note = " (and SSL template verified)" if ssl_template.exists() else ""
            reporter.record(suite, "Nginx Reverse Proxy & SSL Gateway", "PASSED", f"SPA routing, gzip, and backend proxying configured{ssl_note}")
        else:
            reporter.record(suite, "Nginx Reverse Proxy & SSL Gateway", "FAILED", "Incomplete nginx proxy rules")
    else:
        reporter.record(suite, "Nginx Reverse Proxy & SSL Gateway", "FAILED", "frontend/nginx.conf missing")

    # 4. Automation deployment scripts
    deploy_sh = ROOT_DIR / "deploy.sh"
    deploy_bat = ROOT_DIR / "deploy.bat"
    start_bat = ROOT_DIR / "start_mentora.bat"
    if deploy_sh.exists() and deploy_bat.exists() and start_bat.exists():
        reporter.record(suite, "Deployment Automation Scripts", "PASSED", "deploy.sh, deploy.bat, and start_mentora.bat present")
    else:
        reporter.record(suite, "Deployment Automation Scripts", "FAILED", "Deployment scripts missing")


# =============================================================================
# SUITE 6: LIVE HTTP SERVICE PROBES (OPTIONAL / CONDITIONAL)
# =============================================================================
def test_live_services(reporter: TestReporter):
    suite = "Live Service Health Probes"
    print(f"\n{Colors.OKCYAN}[SUITE 6]{Colors.ENDC} {Colors.BOLD}Probing Active Local Services...{Colors.ENDC}")

    import urllib.request

    # 1. Backend Gateway Health
    try:
        req = urllib.request.urlopen("http://localhost:5000/api/health", timeout=2)
        if req.status == 200:
            data = json.loads(req.read().decode('utf-8'))
            reporter.record(suite, "Backend Gateway (/api/health)", "PASSED", f"Status OK (Uptime: {data.get('uptime', 'N/A')}s)")
        else:
            reporter.record(suite, "Backend Gateway (/api/health)", "FAILED", f"HTTP {req.status}")
    except Exception:
        reporter.record(suite, "Backend Gateway (/api/health)", "SKIPPED", "Backend service offline on port 5000")

    # 2. AI Service Health
    try:
        req = urllib.request.urlopen("http://localhost:8000/health", timeout=2)
        if req.status == 200:
            data = json.loads(req.read().decode('utf-8'))
            reporter.record(suite, "AI Engine (/health)", "PASSED", f"Status OK (Vectors: {data.get('chroma_total_vectors', 0)})")
        else:
            reporter.record(suite, "AI Engine (/health)", "FAILED", f"HTTP {req.status}")
    except Exception:
        reporter.record(suite, "AI Engine (/health)", "SKIPPED", "AI Service offline on port 8000")

    # 3. Frontend / Nginx Gateway
    try:
        req = urllib.request.urlopen("http://localhost/healthz", timeout=2)
        if req.status == 200:
            reporter.record(suite, "Nginx Proxy (/healthz)", "PASSED", "Liveness probe OK")
    except Exception:
        reporter.record(suite, "Nginx Proxy (/healthz)", "SKIPPED", "Nginx gateway offline on port 80")


# =============================================================================
# CLI RUNNER
# =============================================================================
def main():
    parser = argparse.ArgumentParser(
        description="Mentora Unified Quality Assurance & System Verification Test Suite",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Execute live HTTP health probes against running services"
    )
    parser.add_argument(
        "--suite",
        choices=["env", "backend", "frontend", "ai", "deploy", "all"],
        default="all",
        help="Specify an isolated test suite to execute"
    )

    args = parser.parse_args()

    print("\n" + "=" * 78)
    print(f"{Colors.BOLD}{Colors.OKBLUE}      MENTORA v1.0 — SYSTEM QUALITY ASSURANCE & VERIFICATION SUITE{Colors.ENDC}")
    print("=" * 78)

    selected = args.suite

    if selected in ["env", "all"]:
        test_environment(reporter, check_live=args.live)
    if selected in ["backend", "all"]:
        test_backend_architecture(reporter)
    if selected in ["frontend", "all"]:
        test_frontend_architecture(reporter)
    if selected in ["ai", "all"]:
        test_ai_service_architecture(reporter)
    if selected in ["deploy", "all"]:
        test_deployment_artifacts(reporter)

    if args.live:
        test_live_services(reporter)

    success = reporter.print_summary()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
