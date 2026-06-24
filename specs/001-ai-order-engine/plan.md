# Implementation Plan: Intelligent Order Processing System

**Branch**: `001-ai-order-engine` | **Date**: 2026-06-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-ai-order-engine/spec.md`

## Summary

Build an AI-native order processing backend on Next.js 15 (App Router) with
PostgreSQL (Prisma), Redis distributed locking for a 5-minute background batch,
deterministic REST APIs for order lifecycle management, and a Vercel AI SDK chat
agent with RAG (`knowledge_base.json`) and secure tool calling. The full stack
runs locally via Docker Compose with Vitest coverage for business-critical paths.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS

**Primary Dependencies**: Next.js 15+ (App Router), Prisma ORM, Zod, `ioredis`,
Vercel AI SDK (`ai` + `@ai-sdk/openai` or provider of choice), Vitest,
`node-cron` (in-process scheduler with Redis mutex)

**Storage**: PostgreSQL 16 (`postgres:latest` container) for orders/items/logs;
Redis 7 (`redis:alpine`) for distributed locks

**Testing**: Vitest + `@testing-library/react` (minimal chat UI); integration
tests against Prisma test DB or Dockerized services

**Target Platform**: Docker Compose on Windows/macOS/Linux; multi-replica web
containers simulating Kubernetes horizontal scaling

**Performance Goals**: Order CRUD < 3s p95 locally (SC-001); background batch
completes within lock TTL (120s); chat first token < 5s with configured model

**Constraints**: No direct client-to-LLM calls; cancellation only when
`PENDING`; single batch executor per 5-minute window across replicas; prompt
injection mitigations on chat path

**Scale/Scope**: Assessment/demo scope — single-tenant, no auth, functional chat
UI, four API domains (orders, cancel, cron/worker, chat)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Reference: `.specify/memory/constitution.md` (Intelligent Order Processing System)

| Gate | Requirement | Design Compliance | Post-Design |
|------|-------------|-------------------|-------------|
| G1 Deterministic Authority | No AI-only state mutations | `OrderService` centralizes all writes; AI tools delegate to same service | ✅ PASS |
| G2 Transactional Concurrency | Safe multi-instance jobs | `prisma.$transaction` + Redis `SET NX PX` lock `lock:order_processor` | ✅ PASS |
| G3 Server-Mediated AI | No client-to-model bypass | `POST /api/chat` uses `streamText` server-side only | ✅ PASS |
| G4 Responsible AI | Injection resilience + logs | System prompt hardening + `knowledge_base.json` RAG + `SystemLog` via `onFinish` | ✅ PASS |
| G5 Tested & Containerized | Tests + Compose | `docker-compose.yml` with `depends_on`; Vitest suites per constitution | ✅ PASS |

All gates pass; no Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-order-engine/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   └── chat-api.md
└── tasks.md              # Created by /speckit-tasks
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma

src/
├── app/
│   ├── api/
│   │   ├── orders/
│   │   │   ├── route.ts                 # POST, GET (list + filter)
│   │   │   └── [id]/
│   │   │       ├── route.ts             # GET detail
│   │   │       └── cancel/
│   │   │           └── route.ts         # POST cancel
│   │   ├── chat/
│   │   │   └── route.ts                 # POST streamText agent
│   │   └── internal/
│   │       └── process-orders/
│   │           └── route.ts             # Manual/triggered batch (tests)
│   ├── chat/
│   │   └── page.tsx                     # Minimal chat UI
│   └── layout.tsx
├── lib/
│   ├── prisma.ts
│   ├── redis.ts
│   ├── lock.ts                          # Distributed mutex helpers
│   ├── validation/
│   │   └── order-schemas.ts             # Zod schemas
│   ├── services/
│   │   ├── order-service.ts             # CRUD, cancel, batch transition
│   │   └── system-log-service.ts
│   ├── knowledge/
│   │   └── load-knowledge-base.ts
│   └── ai/
│       ├── agent.ts                     # streamText + system prompt
│       └── tools.ts                     # getOrderStatus, requestOrderCancellation
├── jobs/
│   └── schedule-order-processor.ts      # node-cron every 5 min + lock
└── instrumentation.ts                   # Register cron on Node server start

tests/
├── unit/
│   ├── order-service.test.ts
│   └── order-schemas.test.ts
└── integration/
    ├── order-api.test.ts
    ├── cancellation.test.ts
    ├── background-job.test.ts
    └── chat-tools.test.ts

assets/
├── knowledge_base.json
└── swagger.json                         # Assessment input (mirror contracts/)

docker-compose.yml
Dockerfile
.env.example
package.json
vitest.config.ts
```

**Structure Decision**: Single Next.js application (App Router) with colocated API
routes and a minimal chat page. Background scheduling runs in-process via
`instrumentation.ts` + `node-cron` guarded by Redis lock — appropriate for
long-running Docker containers (not serverless). Shared `OrderService` is the
single write path for REST, cron batch, and AI tools.

## Implementation Phases

### Phase 1: Data Layer & Environment Orchestration

1. **Prisma schema** — `OrderStatus` enum; `Order`, `OrderItem`, `SystemLog` models
   (see [data-model.md](./data-model.md)).
2. **Docker Compose** — `postgres`, `redis`, `web` (Next.js) with healthchecks and
   `depends_on` ordering; `DATABASE_URL` and `REDIS_URL` via `.env`.

### Phase 2: Core API Routes & Deterministic Validation

1. **Order API** — Zod-validated `POST /api/orders` (server-side total computation);
   `GET /api/orders` with optional `?status=`; `GET /api/orders/[id]`.
2. **Cancellation engine** — `POST /api/orders/[id]/cancel` inside
   `prisma.$transaction` with status guard; throws on non-`PENDING` to rollback.

### Phase 3: Redis Distributed Locking

1. **Distributed mutex** — `ioredis` with `SET lock:order_processor <token> NX PX 120000`
   (or `redlock` if multi-master Redis later).
2. **Background runner** — `node-cron` `*/5 * * * *` invokes batch; lock holder
   processes `PENDING` → `PROCESSING`; others log skip to `SystemLog`.

### Phase 4: Vercel AI SDK Integration & Security Layer

1. **Chat route** — `POST /api/chat` with `streamText`, messages + optional `orderId`.
2. **Prompt hardening** — Strict system instructions; `knowledge_base.json` injected
   as context block.
3. **Tools** — `getOrderStatus`, `requestOrderCancellation` calling `OrderService`
   (not HTTP loopback).
4. **Telemetry** — `onFinish` logs `promptTokens`, `completionTokens`, duration,
   detected intent to `SystemLog`.

## Complexity Tracking

> No violations — table intentionally empty.
