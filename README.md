# Intelligent Order Processing System

AI-native order processing backend for the beecrowd/Winter senior fullstack assessment.
Stack: Next.js 15, Prisma, PostgreSQL, Redis, Vercel AI SDK, Docker Compose.

> Implementation complete for US1–US4. See `specs/001-ai-order-engine/` for specification and plan.

## Development History

Commit history is an **evaluation criterion**. Changes are committed incrementally —
one logical slice at a time — not as a single bulk commit.

### Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) with task references:

```text
feat(orders): implement POST and GET /api/orders endpoints

Refs: T025-T026
```

| Type | Usage |
|------|-------|
| `feat` | New feature (user stories US1–US4) |
| `test` | Unit/integration tests |
| `chore` | Setup, Docker, dependencies |
| `docs` | README, SDD, GenAI report |
| `fix` | Bug fixes |
| `refactor` | Code changes without behavior change |

### Branch model

| Branch | Purpose |
|--------|---------|
| `master` | Planning (specs, constitution, tasks, rules) |
| `001-ai-order-engine` | All implementation T001–T052 |

One branch for the entire feature. Phases differ by **commits**, not by branch switches.

### Commit rhythm

On the feature branch, commits align with checkpoints in
`specs/001-ai-order-engine/tasks.md`:

1. **Setup** — project scaffold, Docker, assets
2. **Foundational** — Prisma schema, Redis lock, shared services
3. **US1–US4** — tests → service → routes (one story at a time)
4. **Polish** — swagger, README SDD, GenAI report

Full agent guidance: `.cursor/rules/git-commits.mdc`

### Useful commands

```bash
git log --oneline --graph    # review incremental history
git log --grep="Refs: T"     # trace commits to tasks
```

## Setup

Requires **Node.js 20+** (`nvm use` reads `.nvmrc`).

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

For production-like Docker run:

```bash
docker compose up --build
```

Apply migrations in containers:

```bash
npx prisma migrate deploy
```

## Quickstart

Full validation guide: [`specs/001-ai-order-engine/quickstart.md`](specs/001-ai-order-engine/quickstart.md)

```bash
# 1. Create order
curl.exe -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  --data-binary @order.json

# PowerShell alternative
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/orders \
  -ContentType "application/json" \
  -Body '{"items":[{"productId":"prod-1","quantity":2,"unitPrice":10.50}]}'

# 2. List / detail
curl.exe -s http://localhost:3000/api/orders?status=PENDING
curl.exe -s http://localhost:3000/api/orders/{ORDER_ID}

# 3. Cancel pending order
curl.exe -s -X POST http://localhost:3000/api/orders/{ORDER_ID}/cancel

# 4. Trigger background batch (dev)
curl.exe -s -X POST http://localhost:3000/api/internal/process-orders

# 5. AI chat UI
# Open http://localhost:3000/chat (requires OPENAI_API_KEY in .env)
```

API contract mirror: [`assets/swagger.json`](assets/swagger.json)

## SDD — Software Design Description

### Architecture

Single Next.js 15 App Router application with colocated REST routes, in-process
background scheduling, and a minimal chat UI. All order mutations flow through
`OrderService` — the same path for REST, cron batch, and AI tools.

```text
Client / Chat UI
    → POST /api/orders | /api/chat | /api/internal/process-orders
        → Zod validation (API boundary)
        → OrderService (business rules + Prisma transactions)
            → PostgreSQL (Order, OrderItem, SystemLog)
        → Redis lock (background job leader election)
```

### Data model

| Entity | Purpose |
|--------|---------|
| `Order` | Lifecycle state, server-computed `totalPrice`, timestamps |
| `OrderItem` | Line items (`productId`, `quantity`, `unitPrice`) |
| `SystemLog` | Background job, lock skip, AI telemetry |

**Order states**: `PENDING` → `PROCESSING` (batch) or `CANCELLED` (cancel API/chat tool).
Cancellation is allowed only when status is exactly `PENDING`.

### Concurrency

1. **Cancellation** — `prisma.$transaction` with `updateMany` guarded by
   `status = PENDING` to handle concurrent cancel attempts safely.
2. **Background batch** — `node-cron` every 5 minutes; Redis distributed lock
   (`SET lock:order_processor NX PX 120000`) ensures a single replica processes
   `PENDING` → `PROCESSING` per window. Non-leaders log `LOCK_SKIP` to `SystemLog`.
3. **Batch update** — transactional `updateMany` on all `PENDING` rows atomically.

### Docker topology

```text
docker-compose.yml
├── postgres:5432   (orders DB, healthcheck)
├── redis:6379     (distributed locks)
└── web:3000        (Next.js, depends_on healthy postgres + redis)
```

Scale test: `docker compose up --scale web=3 -d` — only one replica executes each batch.

## GenAI Development Report

### Tools used

| Tool | Role |
|------|------|
| **Cursor Agent** | Spec-driven implementation (Spec Kit), incremental commits |
| **Spec Kit** | `spec.md`, `plan.md`, `tasks.md`, constitution gates |
| **Vercel AI SDK** | `streamText`, tool calling, data stream to chat UI |
| **OpenAI GPT-4o-mini** | Support agent model (`@ai-sdk/openai`) |

### Prompts and agent design

- **System prompt** (`src/lib/ai/agent.ts`): role definition, corporate policy block
  from `assets/knowledge_base.json`, injection-resistance rules, tool-only mutations.
- **Tools**: `getOrderStatus` and `requestOrderCancellation` delegate directly to
  `OrderService` — no HTTP loopback, no client-side model access.
- **RAG**: static policy file injected per request; live order data fetched via tools.

### Failures and corrections

| Issue | Correction |
|-------|------------|
| PowerShell `curl` alias breaks JSON `-d` payloads | Document `curl.exe` or `Invoke-RestMethod`; use `--data-binary @file` |
| Missing `.env` caused Prisma P1012 | Copy `.env.example` → `.env` before migrations |
| `experimental.instrumentationHook` removed in Next.js 15 | Rely on default `instrumentation.ts` registration |
| Docker Desktop not running during early phases | Migrations/tests run locally against Compose when available |

### Observability

Each completed chat stream writes `SystemLog` (`AI_INTERACTION`) with
`promptTokens`, `completionTokens`, `latencyMs`, and heuristic `detectedIntent`.
Background jobs write `BACKGROUND_JOB` or `LOCK_SKIP` entries.

## Documentation

- **Spec**: `specs/001-ai-order-engine/spec.md`
- **Plan / SDD source**: `specs/001-ai-order-engine/plan.md`
- **Quickstart**: `specs/001-ai-order-engine/quickstart.md`
- **OpenAPI**: `specs/001-ai-order-engine/contracts/openapi.yaml` → `assets/swagger.json`
