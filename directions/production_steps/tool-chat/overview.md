You’re essentially trying to build a “Consulting Intelligence Platform” — not just a chat app, but a system that combines:

LLM chat (like ChatGPT)
Knowledge management (like Notion / Confluence)
Task execution (like Asana / Trello)
Data ingestion + RAG (like Glean / Perplexity Enterprise)
Consulting workflows (like McKinsey-style problem solving systems)

Below is a clean, structured breakdown + Cursor-ready build prompt system.

1. MARKET LANDSCAPE (WHAT EXISTS TODAY)
General Chat + AI
ChatGPT → best reasoning, flexible UI
Claude → long context, doc analysis
Perplexity AI → strong retrieval + citations
Enterprise / Consulting-Oriented AI
Glean → internal doc search + RAG
Microsoft Copilot → deep ecosystem integration
Notion AI → docs + AI + lightweight PM
Knowledge + Workflow Tools
Notion
Confluence
Coda
Task / Execution Layer
Trello
Asana
2. CORE FEATURE SYNTHESIS (WHAT YOUR APP MUST DO)
A. CORE CHAT ENGINE (FOUNDATION)
Multi-thread conversations
Context-aware memory (conversation + global knowledge)
Tool calling (documents, repos, APIs)
Role modes:
Strategy Consultant
Financial Analyst
Operations Planner
Technical Architect
B. CONSULTING WORKFLOW ENGINE (THIS IS THE DIFFERENTIATOR)
Structured Thinking Modules
Problem framing (MECE breakdown)
Hypothesis trees
Issue trees
80/20 prioritization
Roadmap generation
Executive summary generation
Output Types
Slide-ready outputs
Executive memos
Strategic plans
Financial models (basic)
Action plans
C. KNOWLEDGE INGESTION (CRITICAL FOR YOUR USE CASE)
1. LOCAL REPOSITORY CONNECTION
User selects local folder
App scans:
PDFs
Word docs
Markdown
Code
Indexes + vectorizes content
2. DOCUMENT UPLOAD SYSTEM
Drag-and-drop upload
Automatic:
Chunking
Embedding
Metadata tagging
3. RAG SYSTEM
Semantic search
Context injection into chat
Source citation
D. VECTOR DATABASE LAYER
Store embeddings
Metadata filters:
Project
Client
Document type
Fast retrieval

Recommended:

Local: SQLite + embedding store
Scalable: Pinecone / Weaviate / Supabase
E. FILE & PROJECT MANAGEMENT
Workspace structure:
Clients
Projects
Workstreams
Attach documents to projects
Chat tied to project context
F. TASK + EXECUTION LAYER (TRELL0-STYLE)
Boards
Lists
Cards
AI-generated tasks from chat
Task linking to:
Documents
Conversations
G. UI / UX DESIGN
Layout
Left sidebar:
Projects
Chats
Documents
Main panel:
Chat interface
Right panel:
Context / sources / tasks
Key UX Features
Inline citations
Expandable reasoning
Drag files into chat
Switch “Consulting Modes”
3. SYSTEM ARCHITECTURE
Frontend
React (Next.js or Vite)
Tailwind CSS
Zustand or Redux
Backend
Node.js or FastAPI
API routes:
Chat
Embeddings
File ingestion
Search
AI Layer
OpenAI API
GPT-4/5 for chat
Embeddings API
Storage
Postgres (metadata)
Vector DB (embeddings)
Local file indexing system
4. CURSOR MASTER BUILD PROMPT (COPY THIS INTO .MD)
FILE: CONSULTING_CHAT_APP_SPEC.md
Writing
Consulting Intelligence Platform - Full Build Specification
Objective

Build a full-stack AI-powered consulting chat application that combines:

ChatGPT-style interaction
Enterprise knowledge retrieval (RAG)
Consulting workflows (problem structuring, strategy generation)
Task management (Trello-style)
Local repository ingestion
Core Features
1. Chat Engine
Multi-thread chat system
Streaming responses
Context memory
Tool usage (documents, tasks, search)
2. Consulting Modes

Implement selectable modes:

Strategy Consultant
Financial Analyst
Operations Planner
Technical Architect

Each mode modifies system prompt behavior.

3. Document Ingestion System
Upload
Drag-and-drop upload
Accept:
PDF
DOCX
TXT
MD
Processing Pipeline
Extract text
Chunk text (500–1000 tokens)
Generate embeddings
Store in vector database
Store metadata in Postgres
4. Local Repository Integration
Allow user to select a local folder
Recursively scan files
Index supported formats
Watch for file changes
5. RAG System
Semantic search endpoint
Retrieve top-k relevant chunks
Inject into LLM prompt
Return citations
6. Task Management System
Board → List → Card hierarchy
CRUD operations
AI can:
Generate tasks from chat
Assign tasks to projects
7. Project System
Projects contain:
Chats
Documents
Tasks
Architecture
Frontend
React (Vite)
Tailwind CSS
Zustand for state
Backend
Node.js (Express)
AI Integration
OpenAI API:
Chat completions
Embeddings
API Endpoints
Chat

POST /chat

Input: message, projectId
Output: streamed response
Upload

POST /upload

Handles file ingestion
Search

POST /search

Returns relevant document chunks
Tasks

CRUD /tasks

Database Schema
Projects
id
name
Documents
id
projectId
metadata
Embeddings
id
documentId
vector
Tasks
id
projectId
title
status
UI Layout
Left Sidebar
Projects
Chats
Documents
Main Panel
Chat interface
Right Panel
Sources
Tasks
Context
Advanced Features (Phase 2)
Slide generator (PowerPoint export)
Financial modeling assistant
Multi-user collaboration
Permissions system
Deliverables
Fully functional MVP
Modular architecture
Clean UI
Scalable backend
5. OPTIONAL SEGMENTATION (FOR CURSOR EXECUTION)

If you want cleaner execution, break into:

frontend.md
backend.md
rag_system.md
task_system.md
ui_ux.md
6. STRATEGIC INSIGHT (IMPORTANT)

What you’re building is closer to:

“Palantir + McKinsey + ChatGPT in a single interface”

The real differentiator is NOT chat.

It’s:

structured thinking
proprietary knowledge ingestion
execution (tasks + outputs)