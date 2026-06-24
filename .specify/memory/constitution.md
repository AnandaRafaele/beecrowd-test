<!--
Sync Impact Report
==================
Version change: (template) → 1.0.0
Modified principles: N/A (initial ratification)
Added sections:
  - Core Principles (5)
  - Core Technology Stack
  - Development Workflow & Quality Gates
  - Governance
Removed sections: None (placeholders replaced)
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ updated (Constitution Check gates)
  - .specify/templates/spec-template.md ✅ no change required (generic, domain-agnostic)
  - .specify/templates/tasks-template.md ✅ updated (testing mandate note)
  - .specify/templates/commands/*.md ⚠ N/A (directory does not exist)
  - README.md ⚠ pending (to be created during implementation)
Deferred TODOs: None
-->

# Intelligent Order Processing System Constitution

## Core Principles

### I. Deterministic Backend Authority (NON-NEGOTIABLE)

All order state mutations MUST be enforced by deterministic application and database
layer code. AI agents MAY recommend or request actions, but MUST NOT perform state
operations without passing through validated server-side guardrails that re-check
business rules (e.g., cancellation only when status is PENDING per FR-004).

**Rationale**: The beecrowd/Winter assessment explicitly values transactional
security over conversational fluency. LLMs are support interfaces, not sources of
truth for order lifecycle transitions.

### II. Transactional Safety & Distributed Concurrency

Order updates, cancellations, and background status transitions MUST use
`prisma.$transaction` with explicit optimistic or pessimistic concurrency control.
The PENDING → PROCESSING background job (FR-003) MUST be safe across multiple
service instances using Redis distributed locking or equivalent synchronization so
competing schedulers cannot duplicate state transitions.

**Rationale**: Horizontal scaling in Kubernetes-style deployments introduces race
conditions that deterministic single-instance code cannot assume away.

### III. Server-Mediated AI Orchestration

All AI interactions MUST flow through validated server-side API routes or Next.js
Server Actions using the Vercel AI SDK. Direct client-to-model calls are forbidden.
Tool/function calling for order cancellation MUST invoke the same deterministic
cancellation service used by REST endpoints—not a parallel code path.

**Rationale**: Prevents UI-to-model bypass, centralizes policy enforcement, and
keeps RAG context and tool schemas under server control.

### IV. Responsible AI & Prompt-Injection Resilience

The intelligent support agent (FR-005) MUST inject `knowledge_base.json` policies and
live order status before model inference. System prompts and tool schemas MUST treat
user input as untrusted. Cancellation tools MUST re-validate status server-side even
when the model requests execution. LLM transactions MUST log token usage, latency,
and detected intent metadata.

**Rationale**: Evaluation weights AI engineering and responsible AI at 30%;
prompt-injection mitigation and observability are explicit non-functional requirements.

### V. Tested Critical Paths & Containerized Operability

Automated tests (Vitest or Jest) MUST cover order status transition rules,
transactional cancellation rejection paths, and AI tool-calling flows (allowed and
denied). The full stack MUST boot with `docker compose up` using only `.env`
configuration; services MUST declare `depends_on` so PostgreSQL and Redis initialize
before the application.

**Rationale**: Testing (20%) and architecture/Dockerization (30%) are scored
deliverables; operational autonomy via Compose is a stated project expectation.

## Core Technology Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 15+ (App Router) + TypeScript | API Routes / Server Actions for backend |
| ORM / Database | Prisma ORM + PostgreSQL | Single source of truth for order state |
| Cache / Concurrency | Redis | Distributed locking and job synchronization |
| AI | Vercel AI SDK | Model inference, RAG context, tool calling |
| Containers | Docker + Docker Compose | Local multi-service parity; no cloud deploy required |
| Testing | Vitest or Jest | Unit and integration coverage for business-critical flows |

Out of scope per assessment brief: complex UI/CSS polish, commercial cloud deployment.

## Development Workflow & Quality Gates

### Specification & Planning

- Functional scope MUST trace to FR-001 through FR-005 from the assessment brief.
- Contracts MUST align with provided `swagger.json` and `knowledge_base.json` assets.
- `/speckit-plan` Constitution Check MUST pass all five principles before design
  proceeds.

### Implementation Gates

1. **Business rules**: Cancellation rejected unless status is exactly PENDING.
2. **Background job**: 5-minute PENDING → PROCESSING transition without duplicate
   processing under multi-instance simulation or design.
3. **AI agent**: Chat endpoint contextualizes policies + order state; tool calls
   route through deterministic services.
4. **Documentation**: `README.md` MUST include SDD (architecture, concurrency) and
   a GenAI report (tools used, prompts, failures, corrections).

### Commit & Review Discipline

- Commits MUST be clean and incremental; repository history is an evaluation input.
- AI-generated code MUST be audited; engineer corrections documented in the GenAI
  report section.

## Governance

This constitution supersedes ad-hoc implementation choices for the Intelligent Order
Processing System assessment. Amendments require:

1. Documented rationale tied to a principle or scored evaluation criterion.
2. Semantic version bump per rules below.
3. Propagation review of `.specify/templates/plan-template.md` and
   `.specify/templates/tasks-template.md` when gates or testing mandates change.

**Compliance**: Every `/speckit-plan`, `/speckit-tasks`, and `/speckit-implement`
cycle MUST verify alignment with Core Principles before merging feature work.

**Versioning policy**:

- **MAJOR**: Removal or incompatible redefinition of a core principle.
- **MINOR**: New principle or materially expanded mandatory gate.
- **PATCH**: Clarifications and wording that do not change obligations.

**Version**: 1.0.0 | **Ratified**: 2026-06-24 | **Last Amended**: 2026-06-24
