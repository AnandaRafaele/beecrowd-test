# Intelligent Order Processing System

AI-native order processing backend for the beecrowd/Winter senior fullstack assessment.

**Stack (TypeScript):** Next.js 15 (App Router), Prisma ORM, PostgreSQL, Redis, Vercel AI SDK, Docker Compose, Vitest.

> Implementation on branch `001-ai-order-engine`. Specs: `specs/001-ai-order-engine/`.

## Quick start (assessment)

Operational autonomy: boot the full stack with Docker Compose and a `.env` file.

```bash
cp .env.example .env
# Edit .env — set OPENAI_API_KEY for the chat agent (optional for REST/job flows)

docker compose up --build
```

- **App:** http://localhost:3000  
- **Chat UI:** http://localhost:3000/chat  
- **Swagger contract:** [`assets/swagger.json`](assets/swagger.json)  
- **RAG policies:** [`assets/knowledge_base.json`](assets/knowledge_base.json)

The `web` container runs `prisma migrate deploy` on startup, then starts the Next.js server.

### Local development (optional)

Requires **Node.js 20+** (`nvm use` reads `.nvmrc`).

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npm run db:deploy
npm run dev
```

### Automated tests

```bash
npm test
```

42 Vitest tests cover order schemas, `OrderService`, REST API routes, background job locking, cancellation, and AI tool delegation.

## Functional requirements mapping

| ID | Requirement | Implementation |
|----|-------------|----------------|
| FR-001 | Create & list orders (filter by status) | `POST /api/orders`, `GET /api/orders?status=` |
| FR-002 | Order detail by ID | `GET /api/orders/{id}` |
| FR-003 | Background job every 5 min: `PENDING` → `PROCESSING` | `node-cron` + Redis lock; manual trigger `POST /api/internal/process-orders` |
| FR-004 | Cancel only when `PENDING` | `POST /api/orders/{id}/cancel` (409 if not cancellable) |
| FR-005 | AI chat with RAG + tool calling | `POST /api/chat`, UI `/chat`; tools call `OrderService` directly |

## API quickstart

Full guide: [`specs/001-ai-order-engine/quickstart.md`](specs/001-ai-order-engine/quickstart.md)

```powershell
# Create order (PowerShell)
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/orders `
  -ContentType "application/json" `
  -Body '{"items":[{"productId":"prod-1","quantity":2,"unitPrice":10.50}]}'

# List / detail / cancel / batch / chat
curl.exe -s "http://localhost:3000/api/orders?status=PENDING"
curl.exe -s "http://localhost:3000/api/orders/{ORDER_ID}"
curl.exe -s -X POST "http://localhost:3000/api/orders/{ORDER_ID}/cancel"
curl.exe -s -X POST http://localhost:3000/api/internal/process-orders
# http://localhost:3000/chat
```

## SDD — Software Design Description

### Architecture

Single Next.js 15 App Router application with colocated REST routes, in-process
background scheduling, and a minimal chat UI. All order mutations flow through
`OrderService` — the same path for REST, cron batch, and AI tools (deterministic
backend; AI never mutates state without tool execution guarded by service code).

```text
Client / Chat UI
    → POST /api/orders | /api/chat | /api/internal/process-orders
        → Zod validation (API boundary)
        → OrderService (business rules + Prisma transactions)
            → PostgreSQL (Order, OrderItem, SystemLog)
        → Redis lock (background job leader election)
```

### Database design choices

| Decision | Rationale |
|----------|-----------|
| **PostgreSQL 16** (container) | Relational order lifecycle, ACID transactions for cancel/batch races |
| **Prisma ORM** | Type-safe schema, migrations, `$transaction` for guards |
| **`Order` + `OrderItem` (1:N, cascade delete)** | Multi-item orders; line totals contribute to server-computed `totalPrice` |
| **`SystemLog` (append-only telemetry)** | Background job, lock skip, and AI interaction audit trail |
| **Indexes** | `Order.status`; `SystemLog(type, createdAt)` for operational queries |
| **`Decimal(12,2)` for money** | Avoid floating-point drift on prices and totals |

**Lifecycle states:** `PENDING` → `PROCESSING` (batch) or `CANCELLED` (cancel API/chat tool).
`SHIPPED` / `DELIVERED` exist in the enum for policy rules; only `PENDING` cancellation and
`PENDING` → `PROCESSING` automation are implemented in scope.

### Distributed concurrency

1. **Cancellation** — `prisma.$transaction` with `updateMany` where `status = PENDING`;
   concurrent cancel attempts: exactly one succeeds.
2. **Background batch** — `node-cron` `*/5 * * * *`; Redis lock
   `SET lock:order_processor NX PX 120000` so only one replica runs each window;
   others log `LOCK_SKIP` to `SystemLog`.
3. **Batch update** — transactional `updateMany` on all `PENDING` rows atomically.

Simulate multi-instance: `docker compose up --scale web=3 -d`.

### Prompt injection mitigation

- Hardened system prompt treats user input as untrusted.
- State changes only via tools (`getOrderStatus`, `requestOrderCancellation`) that
  delegate to `OrderService` — same guards as REST.
- Corporate policy injected from `knowledge_base.json` (RAG context block).

### Docker topology

```text
docker-compose.yml
├── postgres:5432   (orders DB, healthcheck)
├── redis:6379     (distributed locks)
└── web:3000        (Next.js; migrate deploy on startup; depends_on healthy DB/cache)
```

## GenAI Development Report

Per assessment deliverable: tools used, prompts, failures/hallucinations, and engineer corrections.

### Tools used in development

| Tool | Role |
|------|------|
| **Cursor Agent** | Spec-driven implementation (Spec Kit), incremental commits |
| **Spec Kit** | `spec.md`, `plan.md`, `tasks.md`, constitution gates |
| **Vercel AI SDK** | `streamText`, tool calling, data stream to chat UI |
| **OpenAI GPT-4o-mini** | Runtime support agent model (`@ai-sdk/openai`) |

### Prompts generated

**Runtime agent** (`src/lib/ai/agent.ts`):

- Role: customer support for order status and governed cancellations.
- Injected block: serialized rules from `assets/knowledge_base.json`.
- Constraints: tool-only mutations; reject injection; never claim success without tool output.

**Development workflow (Spec Kit / Cursor):**

- Feature spec and task breakdown from natural-language assessment description.
- Per-phase prompts: “implement T020–T026 order API with TDD”, “add Redis lock batch job”, etc.
- Constitution gates enforced deterministic `OrderService` as single write path.

### Failures, hallucinations, and corrections

| Issue | Type | Engineer correction |
|-------|------|---------------------|
| Suggested `experimental.instrumentationHook` in Next.js 15 | Hallucination / stale docs | Removed flag; `instrumentation.ts` enabled by default |
| PowerShell `curl` breaks JSON `-d` payloads | Environment | Document `curl.exe` / `Invoke-RestMethod` |
| Missing `.env` → Prisma P1012 | Setup | Document `cp .env.example .env` |
| Docker build without `prisma generate` | Omission | `build` script runs `prisma generate && next build` |
| Chat stream showed generic “An error occurred.” on OpenAI 429 | Poor UX | Added `getChatErrorMessage` for quota/key errors |
| Cron ran before migrations applied | Race on first boot | Docker entrypoint runs `migrate deploy` before server |

### Observability (LLM)

Each completed chat stream persists `SystemLog` (`AI_INTERACTION`) with
`promptTokens`, `completionTokens`, `totalTokens`, `latencyMs`, and heuristic
`detectedIntent`. Background jobs write `BACKGROUND_JOB` or `LOCK_SKIP`.

## Development history

Commit history is an **evaluation criterion**. Changes are committed incrementally on
branch `001-ai-order-engine` (Conventional Commits + `Refs: T0XX`).

```bash
git log --oneline --graph
git log --grep="Refs: T"
```

## Documentation

- **Spec:** `specs/001-ai-order-engine/spec.md`
- **Plan:** `specs/001-ai-order-engine/plan.md`
- **Quickstart:** `specs/001-ai-order-engine/quickstart.md`
- **OpenAPI source:** `specs/001-ai-order-engine/contracts/openapi.yaml` → `assets/swagger.json`
