# Mentora – System Architecture

**Project:** Mentora  
**Document:** ARCHITECTURE.md  
**Version:** 1.0  
**Architecture Style:** Modular Client-Server Architecture with Separate AI Service  
**AI Architecture:** Retrieval-Augmented Generation (RAG)  
**Primary LLM:** Qwen 3.5 4B through Ollama  
**Embedding Model:** BGE-M3

---

# 1. Architecture Overview

## 1.1 Introduction

Mentora is an AI-powered study assistant built using a modular architecture that separates frontend presentation, backend application logic, and AI processing.

The system provides two primary capabilities:

1. AI Study Chatbot – Document-based question answering using RAG.
2. Graphical Study Content Generator – Transforming academic content into structured visual representations.

Both modules share a common document processing and retrieval pipeline.

The architecture is designed to:

- Maintain separation of responsibilities.
- Reuse document processing and retrieval logic.
- Support locally hosted LLM inference.
- Preserve document-level and page-level source references.
- Support future model replacement.
- Allow independent development and testing of services.

## 1.2 High-Level Architecture

```mermaid
flowchart TB
    U[Student] --> FE[React + Vite Frontend]

    FE --> API[Node.js + Express API]

    API --> AUTH[Authentication Service]
    API --> DB[(PostgreSQL)]
    API --> DOC[Document Management]
    API --> CHAT[Chat Management]
    API --> VIS[Visualization Management]

    DOC --> AI[Python + FastAPI AI Service]
    CHAT --> AI
    VIS --> AI

    subgraph AI_LAYER[AI Processing Layer]
        AI --> DP[Document Processing]
        DP --> CH[Text Chunking]
        CH --> EMB[BGE-M3 Embeddings]
        EMB --> VDB[(ChromaDB)]

        AI --> RET[Retrieval Engine]
        VDB --> RET

        RET --> LC[LangChain]
        LC --> LLM[Ollama]
        LLM --> QWEN[Qwen 3.5 4B]
    end

    QWEN --> RESP[Generated Response / Structured JSON]
    RESP --> AI
    AI --> API
    API --> FE

    FE --> RENDER[Mermaid.js / React Flow / SVG]
```

## 1.3 Architectural Layers

| Layer | Responsibility |
|---|---|
| Presentation | User interface and interactions |
| Application API | Authentication, business logic and data management |
| AI Service | Document processing, retrieval and generation |
| LLM Runtime | Local language model inference |
| Vector Storage | Embedding and semantic retrieval |
| Relational Storage | Users, documents, conversations and messages |
| Visualization | Rendering graphical learning content |

---

# 2. Technology Stack

## 2.1 Frontend

| Technology | Responsibility |
|---|---|
| React | Component-based UI |
| Vite | Development and build tooling |
| Tailwind CSS | Styling |
| shadcn/ui | UI components |
| Axios | API communication |
| React Router | Application navigation |
| Mermaid.js | Flowchart and architecture rendering |
| React Flow | Interactive node-based diagrams |

## 2.2 Backend

| Technology | Responsibility |
|---|---|
| Node.js | Backend runtime |
| Express.js | REST API framework |
| Prisma | Database ORM |
| PostgreSQL | Relational database |
| JWT | Authentication |
| Multer | File upload handling |

## 2.3 AI Service

| Technology | Responsibility |
|---|---|
| Python | AI processing |
| FastAPI | AI service API |
| LangChain | RAG orchestration |
| Ollama | Local LLM inference |
| Qwen 3.5 4B | Primary language model |
| BGE-M3 | Text embeddings |
| ChromaDB | Vector storage |
| PyMuPDF | PDF extraction |
| python-docx | DOCX processing |
| python-pptx | PPTX processing |

---

# 3. System Components

## 3.1 Frontend Application

The React application provides the interface through which students interact with Mentora.

### Main Pages

```text
Frontend/
│
├── Dashboard
│
├── Study Materials
│   ├── Document Upload
│   ├── Document List
│   └── Document Status
│
├── AI Study Chat
│   ├── Chat Interface
│   ├── Source References
│   ├── Follow-up Questions
│   └── Conversation History
│
└── Visual Learning Studio
    ├── Visualization Selection
    ├── Generation Interface
    ├── Diagram Preview
    ├── Diagram Editor
    └── Export
```

### Frontend Responsibilities

- User authentication interface.
- Document upload and management.
- Chat interface.
- Display AI-generated responses.
- Display source references and page numbers.
- Visualization type selection.
- Render generated diagrams.
- Display loading, processing and error states.

The frontend must never communicate directly with ChromaDB or Ollama. All AI operations must go through the backend and AI service.

---

# 4. Node.js + Express Backend Architecture

## 4.1 Purpose

The Node.js backend acts as the central application API and communication layer.

It manages application-level operations and coordinates communication between the frontend, PostgreSQL and Python AI service.

## 4.2 Backend Responsibilities

- Authentication and authorization.
- User management.
- Document metadata management.
- Document upload coordination.
- Conversation management.
- Message persistence.
- Visualization metadata management.
- API validation.
- AI service communication.
- Error handling.

## 4.3 Suggested Backend Structure

```text
backend/
│
├── src/
│   │
│   ├── config/
│   │   ├── database.js
│   │   ├── environment.js
│   │   └── ai.config.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── document.controller.js
│   │   ├── chat.controller.js
│   │   └── visualization.controller.js
│   │
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── document.service.js
│   │   ├── chat.service.js
│   │   ├── visualization.service.js
│   │   └── ai.service.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── document.routes.js
│   │   ├── chat.routes.js
│   │   └── visualization.routes.js
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   ├── upload.middleware.js
│   │   └── validation.middleware.js
│   │
│   ├── utils/
│   │   ├── api-response.js
│   │   └── file-validation.js
│   │
│   ├── app.js
│   └── server.js
│
├── prisma/
│   └── schema.prisma
│
├── uploads/
├── .env
├── .env.example
└── package.json
```

## 4.4 Backend Communication

The backend communicates with:

1. React frontend through REST APIs.
2. PostgreSQL through Prisma.
3. Python AI service through HTTP APIs.
4. Local file storage for uploaded documents.

The backend is responsible for verifying the user's ownership of a document before requesting AI processing.

---

# 5. Python + FastAPI AI Service Architecture

## 5.1 Purpose

The AI service is responsible for all AI-related operations.

It handles:

- Document extraction.
- Text preprocessing.
- Chunk generation.
- Embedding generation.
- Vector database operations.
- Semantic retrieval.
- RAG prompt construction.
- LLM inference.
- Visualization data generation.
- Generated output validation.

## 5.2 AI Service Structure

```text
ai-service/
│
├── app/
│   │
│   ├── api/
│   │   ├── document_routes.py
│   │   ├── retrieval_routes.py
│   │   ├── chat_routes.py
│   │   └── visualization_routes.py
│   │
│   ├── core/
│   │   ├── config.py
│   │   ├── logging.py
│   │   └── security.py
│   │
│   ├── document_processing/
│   │   ├── extractors/
│   │   │   ├── pdf_extractor.py
│   │   │   ├── docx_extractor.py
│   │   │   ├── pptx_extractor.py
│   │   │   └── txt_extractor.py
│   │   │
│   │   ├── text_cleaner.py
│   │   ├── chunker.py
│   │   └── metadata.py
│   │
│   ├── embeddings/
│   │   └── embedding_service.py
│   │
│   ├── vector_store/
│   │   ├── chroma_client.py
│   │   ├── collection_manager.py
│   │   └── vector_operations.py
│   │
│   ├── rag/
│   │   ├── retriever.py
│   │   ├── prompt_builder.py
│   │   ├── context_builder.py
│   │   └── rag_pipeline.py
│   │
│   ├── llm/
│   │   ├── ollama_client.py
│   │   ├── model_provider.py
│   │   └── response_handler.py
│   │
│   ├── chatbot/
│   │   ├── chat_service.py
│   │   └── conversation_context.py
│   │
│   ├── visualization/
│   │   ├── visualization_service.py
│   │   ├── topic_extractor.py
│   │   ├── structured_generator.py
│   │   ├── schema_validator.py
│   │   └── prompt_templates.py
│   │
│   ├── schemas/
│   │   ├── document_schema.py
│   │   ├── chat_schema.py
│   │   └── visualization_schema.py
│   │
│   ├── main.py
│   └── dependencies.py
│
├── chroma_data/
├── tests/
├── requirements.txt
└── .env.example
```

---

# 6. Document Processing Architecture

## 6.1 Document Ingestion Workflow

The document processing pipeline converts uploaded files into searchable knowledge.

```mermaid
flowchart TD
    A[Document Upload] --> B[File Validation]
    B --> C{Supported Format?}

    C -->|No| D[Return Validation Error]
    C -->|Yes| E[Extract Text]

    E --> F[Clean Extracted Content]
    F --> G[Preserve Page Metadata]
    G --> H[Text Chunking]
    H --> I[Generate BGE-M3 Embeddings]
    I --> J[Store in ChromaDB]
    J --> K[Update Processing Status]
    K --> L[Document Ready]
```

## 6.2 Supported Documents

| Format | Processing Library |
|---|---|
| PDF | PyMuPDF |
| DOCX | python-docx |
| PPTX | python-pptx |
| TXT | Python file handling |

## 6.3 Chunking Strategy

The initial chunking configuration:

| Parameter | Value |
|---|---|
| Chunk size | 500–700 tokens |
| Chunk overlap | 80–100 tokens |
| Embedding model | BGE-M3 |
| Storage | ChromaDB |

Chunking must preserve meaningful document sections wherever possible.

Each chunk should include:

```json
{
  "document_id": "document-123",
  "document_name": "machine-learning.pdf",
  "page_number": 12,
  "chunk_id": "chunk-001",
  "content": "Machine learning is..."
}
```

Page numbers must refer to the original document pages.

For PPTX files, page references should identify the original slide number.

For DOCX and TXT files, use section or location metadata where page numbers are unavailable.

## 6.4 Document Isolation

Each uploaded document must be associated with its owner.

ChromaDB metadata should support filtering by:

- user_id
- document_id
- chunk_id
- page_number

The AI service must not retrieve another student's documents.

---

# 7. RAG Architecture – AI Study Chatbot

## 7.1 RAG Pipeline

```mermaid
flowchart TD
    A[Student Question] --> B[Backend API]
    B --> C[AI Service]
    C --> D[Conversation Context]
    D --> E[Generate Query Embedding]
    E --> F[ChromaDB Similarity Search]
    F --> G[Retrieve Relevant Chunks]
    G --> H[Filter and Rank Results]
    H --> I[Construct Context]

    I --> J[Build RAG Prompt]
    J --> K[Ollama]
    K --> L[Qwen 3.5 4B]
    L --> M[Generate Answer]

    M --> N[Attach Source Metadata]
    N --> O[Return Response]
    O --> P[Backend Saves Message]
    P --> Q[Frontend Displays Answer]
```

## 7.2 Retrieval Process

1. Receive the student's question.
2. Retrieve the relevant conversation history.
3. Generate a query embedding using BGE-M3.
4. Search ChromaDB.
5. Retrieve the top 4–5 relevant chunks.
6. Apply document ownership and selection filters.
7. Construct the context.
8. Pass the context and question to Qwen.

## 7.3 Prompt Architecture

The system prompt should enforce:

- Answer using retrieved context.
- Explain concepts in simple language.
- Maintain conversation context.
- Avoid inventing document references.
- Clearly identify missing information.
- Include citation identifiers for supporting content.

Example:

```text
You are Mentora, an AI study assistant.

Your task is to explain academic concepts
using the provided document context.

Rules:
1. Prioritize retrieved document information.
2. Explain complex concepts simply.
3. Do not invent facts or citations.
4. Mention when the context is insufficient.
5. Provide source references.
6. Support relevant follow-up questions.

Retrieved Context:
{context}

Conversation History:
{history}

Student Question:
{question}
```

## 7.4 Citation Management

Citations should be handled by the AI service using retrieved chunk metadata.

Example response:

```json
{
  "answer": "Machine learning is a branch of AI...",
  "sources": [
    {
      "document_id": "document-123",
      "document_name": "ML-Notes.pdf",
      "page_number": 12,
      "chunk_id": "chunk-001"
    }
  ]
}
```

Do not rely only on the LLM to generate citation metadata. Attach citations programmatically from the actual retrieved chunks.

---

# 8. Graphical Study Content Generator Architecture

## 8.1 Overview

The graphical generator uses the same document knowledge base and retrieval engine as the chatbot.

It transforms retrieved academic information into structured diagram data.

It must not generate unrelated visuals without using the selected study context.

## 8.2 Generation Workflow

```mermaid
flowchart TD
    A[Student Selects Document or Chat Response] --> B[Select Topic]
    B --> C[Select Visualization Type]
    C --> D[Retrieve Relevant Context]
    D --> E[Construct Visualization Prompt]
    E --> F[Ollama - Qwen 3.5 4B]
    F --> G[Generate Structured JSON]
    G --> H[Validate JSON Schema]
    H --> I{Valid Output?}

    I -->|No| J[Retry or Repair Generation]
    J --> H

    I -->|Yes| K[Send to Frontend]
    K --> L{Visualization Type}

    L --> M[Mermaid.js]
    L --> N[React Flow]
    L --> O[SVG / HTML Renderer]

    M --> P[Display Visualization]
    N --> P
    O --> P
```

## 8.3 Supported Visualization Types

| Visualization | Rendering Technology |
|---|---|
| Infographics | SVG / HTML |
| Concept Maps | React Flow |
| Flowcharts | Mermaid.js |
| Mind Maps | React Flow |
| Process Diagrams | Mermaid.js |
| Architecture Diagrams | Mermaid.js / React Flow |

## 8.4 Structured Generation

The LLM should produce validated structured data.

Example:

```json
{
  "title": "Machine Learning Workflow",
  "type": "flowchart",
  "nodes": [
    {
      "id": "1",
      "label": "Data Collection",
      "type": "process"
    },
    {
      "id": "2",
      "label": "Data Preprocessing",
      "type": "process"
    },
    {
      "id": "3",
      "label": "Model Training",
      "type": "process"
    },
    {
      "id": "4",
      "label": "Model Evaluation",
      "type": "process"
    }
  ],
  "edges": [
    {
      "source": "1",
      "target": "2"
    },
    {
      "source": "2",
      "target": "3"
    },
    {
      "source": "3",
      "target": "4"
    }
  ]
}
```

The backend must validate:

- Required fields.
- Node identifiers.
- Edge references.
- Allowed node types.
- Maximum diagram complexity.
- Valid visualization type.

The frontend must render structured data through predefined components.

Never execute arbitrary LLM-generated JavaScript or HTML.

## 8.5 Source Grounding

Every generated visualization must retain its supporting document references.

The generation process should use:

- Selected document or chatbot response.
- Retrieved content.
- Original page metadata.
- Selected visualization type.

The system should avoid introducing unsupported relationships between concepts.

---

# 9. Database Architecture

Mentora uses PostgreSQL for relational data and ChromaDB for vector storage.

## 9.1 PostgreSQL

PostgreSQL stores:

- User accounts.
- Document metadata.
- Conversations.
- Chat messages.
- Source references.
- Visualization records.

## 9.2 Suggested Database Relationships

```mermaid
erDiagram
    USER ||--o{ DOCUMENT : uploads
    USER ||--o{ CONVERSATION : creates
    USER ||--o{ VISUALIZATION : creates

    DOCUMENT ||--o{ MESSAGE_SOURCE : supports
    CONVERSATION ||--o{ MESSAGE : contains
    MESSAGE ||--o{ MESSAGE_SOURCE : references
    DOCUMENT ||--o{ VISUALIZATION : provides_context
    CONVERSATION ||--o{ VISUALIZATION : generates_from
```

## 9.3 Core Entities

### User

- id
- name
- email
- password_hash
- created_at

### Document

- id
- user_id
- filename
- file_type
- storage_path
- processing_status
- page_count
- created_at

### Conversation

- id
- user_id
- title
- created_at
- updated_at

### Message

- id
- conversation_id
- role
- content
- created_at

### MessageSource

- id
- message_id
- document_id
- page_number
- chunk_id
- relevance_score

### Visualization

- id
- user_id
- document_id
- conversation_id
- visualization_type
- title
- generated_data
- created_at

## 9.4 ChromaDB

ChromaDB stores vector embeddings and chunk metadata.

Suggested metadata:

```json
{
  "user_id": "user-123",
  "document_id": "document-123",
  "chunk_id": "chunk-001",
  "page_number": 12,
  "document_name": "ML-Notes.pdf"
}
```

PostgreSQL is the source of truth for application records. ChromaDB is the searchable vector index.

---

# 10. API Communication Architecture

## 10.1 Service Communication

```mermaid
flowchart LR
    FE[React Frontend]
    BE[Express Backend]
    AI[FastAPI AI Service]
    DB[(PostgreSQL)]
    VDB[(ChromaDB)]
    LLM[Ollama]

    FE <-->|REST API| BE
    BE <-->|Prisma| DB
    BE <-->|Internal HTTP| AI
    AI <-->|Vector Operations| VDB
    AI <-->|Inference| LLM
```

## 10.2 Express API Routes

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
```

### Documents

```text
POST   /api/documents/upload
GET    /api/documents
GET    /api/documents/:id
GET    /api/documents/:id/status
DELETE /api/documents/:id
```

### Chat

```text
POST   /api/conversations
GET    /api/conversations
GET    /api/conversations/:id
DELETE /api/conversations/:id

POST   /api/chat/message
GET    /api/chat/:conversationId/history
```

### Visualizations

```text
POST   /api/visualizations/generate
GET    /api/visualizations
GET    /api/visualizations/:id
DELETE /api/visualizations/:id
```

## 10.3 FastAPI AI Routes

### Document Processing

```text
POST /ai/documents/process
GET  /ai/documents/{document_id}/status
DELETE /ai/documents/{document_id}
```

### Retrieval

```text
POST /ai/retrieval/search
```

### Chat

```text
POST /ai/chat/generate
```

### Visualization

```text
POST /ai/visualization/generate
POST /ai/visualization/validate
```

The Express backend must authenticate users and enforce ownership. The FastAPI service should only accept authenticated internal requests or requests protected by a service credential.

---

# 11. Model Architecture

## 11.1 Primary LLM

**Model:** Qwen 3.5 4B through Ollama.

Responsibilities:

- Contextual question answering.
- Simple academic explanations.
- Follow-up question handling.
- Structured JSON generation.
- Diagram content generation.

## 11.2 Embedding Model

**Model:** BGE-M3.

Responsibilities:

- Generate document chunk embeddings.
- Generate question embeddings.
- Support semantic retrieval.
- Support multilingual study materials.

## 11.3 Model Configuration

Initial development settings:

| Parameter | Value |
|---|---|
| Primary model | Qwen 3.5 4B |
| Quantization | Q4 |
| Context window | 4096 tokens |
| Temperature | 0.2 |
| Maximum output | 768 tokens |
| Embeddings | BGE-M3 |
| Retrieval top-k | 4–5 |

These settings must be evaluated on the available development hardware.

## 11.4 Hardware Considerations

Initial development environment:

- CPU: AMD Ryzen 7 6800H.
- RAM: 16 GB.
- GPU: NVIDIA RTX 3050 Laptop GPU.
- Dedicated VRAM: 4 GB.
- OS: Windows 11.

Optimization requirements:

- Run one LLM request at a time initially.
- Avoid loading multiple LLMs simultaneously.
- Monitor GPU and RAM utilization.
- Use quantized models.
- Avoid unnecessarily large context windows.
- Keep embedding and LLM workloads memory-aware.

The application must not assume that the entire model will fit into dedicated GPU memory. Ollama may distribute computation between GPU and CPU.

---

# 12. Security Architecture

## 12.1 Authentication

- JWT-based authentication.
- Secure password hashing.
- Protected application routes.
- Token validation middleware.

## 12.2 Document Security

- Validate file extensions and MIME types.
- Enforce upload size limits.
- Store uploaded documents securely.
- Verify document ownership.
- Prevent cross-user retrieval.
- Remove associated vectors when documents are deleted.

## 12.3 AI Security

- Treat uploaded document text as untrusted input.
- Do not execute instructions found inside uploaded documents.
- Validate LLM-generated structured data.
- Never execute generated code.
- Restrict internal AI service access.
- Keep secrets in environment variables.

---

# 13. Error Handling and Reliability

The application must handle:

| Failure | Expected Behaviour |
|---|---|
| Invalid document | Return validation error |
| Corrupted PDF | Report extraction failure |
| Embedding failure | Mark processing as failed |
| ChromaDB unavailable | Return service error |
| Ollama unavailable | Display AI service unavailable |
| LLM timeout | Return controlled error |
| Invalid JSON | Retry or repair generation |
| Missing source context | Explain insufficient information |
| Unauthorized document | Reject access |
| Diagram rendering failure | Display fallback error |

Document processing should be asynchronous so that large files do not block normal API requests.

---

# 14. Deployment Architecture

## 14.1 Local Development

```mermaid
flowchart TB
    subgraph WINDOWS[Windows 11 Development Machine]
        FE[React + Vite<br/>Port 5173]
        BE[Express<br/>Port 5000]
        AI[FastAPI<br/>Port 8000]
        PG[(PostgreSQL<br/>Port 5432)]
        CH[(ChromaDB)]
        OL[Ollama<br/>Port 11434]

        FE --> BE
        BE --> PG
        BE --> AI
        AI --> CH
        AI --> OL
    end
```

Ports are initial development defaults and can be adjusted.

## 14.2 Environment Variables

### Backend

```env
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/mentora
JWT_SECRET=your_secure_secret
AI_SERVICE_URL=http://localhost:8000
UPLOAD_DIR=./uploads
```

### AI Service

```env
APP_ENV=development

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3.5:4b-q4_K_M

EMBEDDING_MODEL=bge-m3

CHROMA_PERSIST_DIRECTORY=./chroma_data
CHROMA_COLLECTION=mentora_documents

CHUNK_SIZE=600
CHUNK_OVERLAP=100
RETRIEVAL_TOP_K=5
```

Use secure local secrets and never commit actual credentials to GitHub.

---

# 15. Data Lifecycle Management

## Document Upload

1. User uploads a document.
2. Express validates the request and stores the file.
3. Document metadata is created in PostgreSQL.
4. Express requests document processing from FastAPI.
5. FastAPI extracts and chunks the content.
6. Embeddings are generated.
7. ChromaDB stores vectors and metadata.
8. PostgreSQL document status is updated.

## Document Deletion

1. User requests document deletion.
2. Express verifies ownership.
3. The document is marked for deletion.
4. AI service removes associated vectors.
5. Original file is deleted.
6. PostgreSQL records are cleaned up.
7. Deletion status is finalized.

Deletion operations should be idempotent and handle partial failures safely.

## Chat Lifecycle

1. User creates a conversation.
2. User sends a question.
3. Express stores or coordinates message persistence.
4. AI service retrieves relevant content.
5. Ollama generates an answer.
6. Source references are attached.
7. Response and references are saved.
8. Frontend displays the answer.

## Visualization Lifecycle

1. User selects a topic or chatbot response.
2. Relevant document context is retrieved.
3. LLM generates structured visual data.
4. Backend validates the result.
5. Frontend renders the diagram.
6. Visualization data and metadata are saved.

---

# 16. Architecture Principles

All implementation work must follow these principles:

1. Maintain clear separation between frontend, application backend and AI service.
2. Reuse the same RAG pipeline for both core modules.
3. Keep LLM inference independent from business logic.
4. Preserve source document and page metadata throughout processing.
5. Use structured outputs for diagram generation.
6. Validate every generated visualization before rendering.
7. Protect document ownership at every service boundary.
8. Keep model providers interchangeable.
9. Avoid unnecessary dependencies and duplicate services.
10. Optimize inference for the available hardware.

---

# 17. Future Architecture Improvements

These are not part of the initial implementation.

- Background task queue for large document processing.
- Advanced hybrid retrieval.
- Reranking models.
- PostgreSQL pgvector migration if justified.
- Cloud-based inference providers.
- Distributed document storage.
- Multi-user collaborative learning.
- OCR for scanned PDFs.
- Advanced observability and performance monitoring.

---

# 18. Final Architecture Definition

Mentora uses a modular client-server architecture with a dedicated Python AI service.

React provides the student interface. Node.js and Express manage application operations, authentication and persistence. Python and FastAPI orchestrate document processing, retrieval and generation.

LangChain connects the RAG workflow with BGE-M3 embeddings, ChromaDB and the locally hosted Qwen model through Ollama.

Both the AI Study Chatbot and Graphical Study Content Generator share the same document knowledge base and retrieval engine.

This architecture prioritizes modularity, source-grounded answers, visual learning, local AI inference and future extensibility.

---

# 19. Production Deployment Architecture (Phase 8 Release)

## 19.1 Containerized Deployment Topology

Mentora v1.0 is fully containerized using Docker and orchestrated via Docker Compose.

```mermaid
flowchart TD
    Internet([External Clients / Web Browsers])
    
    subgraph Host["Production Host / Container Network (mentora-network)"]
        subgraph Gateway["Edge Gateway"]
            NGINX["Nginx Alpine (Port 80/443)\n- SSL Termination (TLSv1.3)\n- Static React SPA Hosting\n- Gzip & Caching\n- /api Reverse Proxy"]
        end

        subgraph CoreServices["Microservices"]
            BACKEND["Node.js Express Backend (Port 5000)\n- Non-root user: node\n- Prisma ORM\n- Multi-tenant auth & file validation"]
            AI["FastAPI AI Engine (Port 8000)\n- Python 3.11 slim\n- Multi-worker Uvicorn\n- Document parsers & RAG"]
        end

        subgraph Storage["Persistent Storage Volumes"]
            PG_VOL[("postgres_data\nPostgreSQL 16 Engine")]
            CHROMA_VOL[("chroma_data\nSQLite & Vector Embeddings")]
            UPLOADS_VOL[("uploads_data\nStudent Documents Store")]
            LOGS_VOL[("ai_logs\nRotating Audit Logs")]
        end

        subgraph Inference["Local Inference Engine"]
            OLLAMA["Ollama Host Server (Port 11434)\n- host.docker.internal\n- Qwen 2.5 3B (LLM)\n- BGE-M3 (Embeddings)"]
        end
    end

    Internet <-->|HTTPS / SSL| NGINX
    NGINX <-->|Static Files| NGINX
    NGINX <-->|Proxy Pass /api| BACKEND
    BACKEND <-->|Prisma SQL| PG_VOL
    BACKEND <-->|File Storage| UPLOADS_VOL
    BACKEND <-->|Internal HTTP JSON/SSE| AI
    AI <-->|Vector IO| CHROMA_VOL
    AI <-->|Log Files| LOGS_VOL
    AI <-->|Local Inference| OLLAMA
```

## 19.2 Storage Persistence Guarantees

1. **Relational Data (`postgres_data`)**: Stores user credentials, document metadata, conversations, messages, source citations, and visualization configurations. Survives container restarts and updates.
2. **Vector Store (`chroma_data`)**: Preserves all 1024-dimensional BGE-M3 dense embeddings and chunk metadata across service redeployments, eliminating expensive re-embedding cycles.
3. **Physical Documents (`uploads_data`)**: Persists original academic documents (`.pdf`, `.docx`, `.pptx`, `.txt`) mapped by unique hashes to prevent filename collisions.
4. **Audit Logs (`ai_logs`)**: Retains rotating log files (`10MB` limit, 5 backup generations) for diagnostic tracking and performance profiling.

## 19.3 Production Health & Resiliency

Mentora incorporates comprehensive multi-tiered health monitoring:
- **Nginx Liveness (`/healthz`)**: Fast HTTP 200 ping for external load balancers and orchestrators.
- **Backend Readiness (`/api/health`)**: Actively validates PostgreSQL roundtrip latency, memory usage (`rssMb`, `heapUsedMb`), uptime, and AI service readiness. Returns HTTP 503 if critical storage is unreachable.
- **AI Engine Health (`/health`)**: Actively probes Ollama connectivity (`/api/tags`), ChromaDB collection vector count, memory usage, and model readiness.

**End of ARCHITECTURE.md**