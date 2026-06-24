---
description: "Task list for AI-Native Order Processing Engine"
---

# Tasks: AI-Native Order Processing Engine

**Input**: Design documents from `specs/001-ai-order-engine/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Per project constitution (Principle V), tests are REQUIRED for order
status transitions, transactional cancellation paths, and AI tool-calling flows.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US4)
- Include exact file paths in descriptions

## Path Conventions

Single Next.js project at repository root per `plan.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and container orchestration

- [x] T001 Create Next.js 15 App Router project scaffold with TypeScript in `package.json`, `tsconfig.json`, and `next.config.ts`
- [x] T002 [P] Add core dependencies to `package.json` (prisma, @prisma/client, zod, ioredis, ai, @ai-sdk/openai, node-cron)
- [x] T003 [P] Add dev dependencies to `package.json` (vitest, @vitejs/plugin-react, prisma CLI)
- [x] T004 [P] Create `vitest.config.ts` with node environment for service/API tests
- [x] T005 [P] Create `.env.example` with `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`
- [x] T006 Create `Dockerfile` for Next.js production/dev image with Node 20
- [x] T007 Create `docker-compose.yml` with `postgres`, `redis`, and `web` services plus `depends_on` healthchecks
- [x] T008 [P] Create `assets/knowledge_base.json` from assessment policy examples in `specs/001-ai-order-engine/contracts/chat-api.md`
- [x] T009 [P] Create minimal `src/app/layout.tsx` root layout for API and chat pages

**Checkpoint**: `docker compose config` validates; `npm install` succeeds

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database, clients, validation, and shared services — MUST complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T010 Define Prisma schema (`OrderStatus`, `SystemLogType`, `Order`, `OrderItem`, `SystemLog`) in `prisma/schema.prisma` per `data-model.md`
- [x] T011 Create initial migration via `prisma migrate dev` and document command in `README.md` setup section
- [x] T012 [P] Implement Prisma singleton client in `src/lib/prisma.ts`
- [x] T013 [P] Implement Redis client wrapper in `src/lib/redis.ts`
- [x] T014 Implement distributed lock helpers (`acquireLock`, `releaseLock`) in `src/lib/lock.ts` using `SET lock:order_processor NX PX 120000`
- [x] T015 [P] Implement Zod schemas for create-order and status filter in `src/lib/validation/order-schemas.ts`
- [x] T016 Implement `SystemLogService` (`log`, `logAiInteraction`, `logBackgroundJob`) in `src/lib/services/system-log-service.ts`
- [x] T017 Create `OrderService` skeleton with shared types and `OrderNotFoundError` / `OrderNotCancellableError` in `src/lib/services/order-service.ts`
- [x] T018 [P] Add unit tests for Zod order schemas in `tests/unit/order-schemas.test.ts`
- [x] T019 Configure `instrumentation.ts` hook registration (enabled by default in Next.js 15; no `next.config.ts` flag required)

**Checkpoint**: `npx prisma migrate deploy` works against Compose Postgres; Redis connects locally

---

## Phase 3: User Story 1 — Place and Track Orders (Priority: P1) 🎯 MVP

**Goal**: Create, list (with optional status filter), and retrieve orders with server-computed totals

**Independent Test**: POST order → GET list → GET by id; verify `PENDING`, `totalPrice`, timestamps

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T020 [P] [US1] Add unit tests for `OrderService.create`, `list`, `getById` in `tests/unit/order-service.test.ts`
- [x] T021 [P] [US1] Add integration tests for order API in `tests/integration/order-api.test.ts` (create, list, filter, detail, 404)

### Implementation for User Story 1

- [x] T022 [US1] Implement `OrderService.create` with server-side `totalPrice` computation in `src/lib/services/order-service.ts`
- [x] T023 [US1] Implement `OrderService.list` with optional status filter in `src/lib/services/order-service.ts`
- [x] T024 [US1] Implement `OrderService.getById` with items included in `src/lib/services/order-service.ts`
- [x] T025 [P] [US1] Implement `POST` and `GET` handlers in `src/app/api/orders/route.ts` (Zod validation, 400 on invalid payload)
- [x] T026 [P] [US1] Implement `GET` handler in `src/app/api/orders/[id]/route.ts` (200 detail, 404 not found)

**Checkpoint**: Quickstart Scenario 1 passes (`specs/001-ai-order-engine/quickstart.md`)

---

## Phase 4: User Story 2 — Cancel a Pending Order (Priority: P2)

**Goal**: Transactional cancellation only when status is exactly `PENDING`

**Independent Test**: Cancel `PENDING` order succeeds; cancel `PROCESSING`/`SHIPPED`/`DELIVERED`/`CANCELLED` returns error

### Tests for User Story 2

- [x] T027 [P] [US2] Add unit tests for `OrderService.cancel` success and rejection paths in `tests/unit/order-service.test.ts`
- [x] T028 [P] [US2] Add integration tests for cancel API in `tests/integration/cancellation.test.ts` (409 on non-PENDING, concurrent cancel safety)

### Implementation for User Story 2

- [x] T029 [US2] Implement `OrderService.cancel` using `prisma.$transaction` and `PENDING` guard in `src/lib/services/order-service.ts`
- [x] T030 [US2] Implement `POST` cancel handler in `src/app/api/orders/[id]/cancel/route.ts` (200 success, 409 not cancellable, 404 not found)

**Checkpoint**: Quickstart Scenario 2 passes

---

## Phase 5: User Story 3 — Automatic Order Progression (Priority: P3)

**Goal**: 5-minute batch transitions `PENDING` → `PROCESSING` with Redis leader election

**Independent Test**: Seed `PENDING` orders; trigger batch; verify transition; scale replicas — only one executes

### Tests for User Story 3

- [ ] T031 [P] [US3] Add unit tests for `OrderService.processPendingBatch` in `tests/unit/order-service.test.ts`
- [ ] T032 [P] [US3] Add integration tests for background job and lock skip in `tests/integration/background-job.test.ts` (mock or test Redis)

### Implementation for User Story 3

- [ ] T033 [US3] Implement `OrderService.processPendingBatch` with transactional `updateMany` in `src/lib/services/order-service.ts`
- [ ] T034 [US3] Implement batch runner with lock acquire/release in `src/jobs/schedule-order-processor.ts` (`node-cron` `*/5 * * * *`)
- [ ] T035 [US3] Register cron scheduler on server start in `src/instrumentation.ts`
- [ ] T036 [US3] Implement manual trigger route in `src/app/api/internal/process-orders/route.ts` for dev/test (returns executed/skipped)
- [ ] T037 [US3] Log `BACKGROUND_JOB` and `LOCK_SKIP` events via `SystemLogService` in `src/jobs/schedule-order-processor.ts`

**Checkpoint**: Quickstart Scenarios 3A/3B pass; `SystemLog` shows job and skip entries

---

## Phase 6: User Story 4 — Conversational Support (Priority: P4)

**Goal**: AI chat with RAG policies, tool calling, telemetry, and prompt-injection guardrails

**Independent Test**: Status inquiry returns live data; cancel via chat on `PENDING` succeeds; denied on `PROCESSING`; logs tokens/latency

### Tests for User Story 4

- [ ] T038 [P] [US4] Add unit tests for AI tools delegating to `OrderService` in `tests/integration/chat-tools.test.ts`
- [ ] T039 [P] [US4] Add tests verifying `onFinish` writes `SystemLog` AI metadata (mock streamText) in `tests/integration/chat-tools.test.ts`

### Implementation for User Story 4

- [ ] T040 [P] [US4] Implement knowledge base loader in `src/lib/knowledge/load-knowledge-base.ts` reading `assets/knowledge_base.json`
- [ ] T041 [US4] Implement `getOrderStatus` and `requestOrderCancellation` tools in `src/lib/ai/tools.ts` calling `OrderService` directly
- [ ] T042 [US4] Implement `streamText` agent with hardened system prompt and KB injection in `src/lib/ai/agent.ts`
- [ ] T043 [US4] Implement `onFinish` telemetry persistence to `SystemLog` in `src/lib/ai/agent.ts`
- [ ] T044 [US4] Implement streaming `POST` handler in `src/app/api/chat/route.ts`
- [ ] T045 [US4] Implement minimal chat UI in `src/app/chat/page.tsx` (message input, optional orderId, stream display)

**Checkpoint**: Quickstart Scenario 4 passes; `SystemLog` contains `AI_INTERACTION` rows

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, assessment deliverables, and final validation

- [ ] T046 [P] Mirror OpenAPI contract to `assets/swagger.json` from `specs/001-ai-order-engine/contracts/openapi.yaml`
- [ ] T047 Write SDD architecture section in `README.md` (data model, concurrency, Docker topology)
- [ ] T048 Write GenAI report section in `README.md` (tools used, prompts, failures, corrections)
- [ ] T049 Add `README.md` quickstart commands referencing `specs/001-ai-order-engine/quickstart.md`
- [ ] T050 Run full Vitest suite (`npm test`) and fix failures across `tests/`
- [ ] T051 Validate `docker compose up --build` end-to-end per `specs/001-ai-order-engine/quickstart.md`
- [ ] T052 [P] Update `.gitignore` for `.env`, `node_modules`, `.next`, and generated Prisma artifacts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Foundational — MVP deliverable
- **US2 (Phase 4)**: Depends on US1 (`OrderService` + persisted orders)
- **US3 (Phase 5)**: Depends on US1 (batch updates `PENDING` orders); independent of US2/US4
- **US4 (Phase 6)**: Depends on US1 + US2 (tools use `getById` and `cancel`)
- **Polish (Phase 7)**: Depends on desired user stories complete (all four for full assessment)

### User Story Dependencies

```text
Foundational → US1 → US2 ─┐
              ↓            ├→ US4
              → US3 ───────┘
```

- **US1**: No story dependencies after Foundational
- **US2**: Requires US1 order persistence
- **US3**: Requires US1; parallel with US2 after US1 complete
- **US4**: Requires US1 + US2 (cancellation tool path)

### Within Each User Story

- Tests written first (must fail), then service methods, then API routes/UI
- `OrderService` is the single write path for REST, batch, and AI tools

### Parallel Opportunities

- Phase 1: T002, T003, T004, T005, T008, T009 in parallel after T001
- Phase 2: T012, T013, T015, T018 in parallel after T010
- US1: T020, T021 parallel; T025, T026 parallel after service methods
- US2: T027, T028 parallel
- US3: T031, T032 parallel
- US4: T038, T039 parallel; T040 parallel with T041 prep
- After US1: **US2 and US3 can proceed in parallel** by different developers

---

## Parallel Example: After US1 Complete

```bash
# Developer A — User Story 2 (Cancellation)
T027 → T028 → T029 → T030

# Developer B — User Story 3 (Background Job)
T031 → T032 → T033 → T034 → T035 → T036 → T037
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (T020–T026)
4. **STOP and VALIDATE**: Quickstart Scenario 1
5. Demo order CRUD via curl or API client

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. US1 → test independently → **MVP**
3. US2 → cancellation rules proven
4. US3 → automated lifecycle + distributed lock
5. US4 → AI-native support layer
6. Polish → README, swagger, full Compose validation

### Suggested MVP Scope

**User Story 1 only** (Phases 1–3, tasks T001–T026) delivers order ingestion and retrieval — minimum viable backend for the assessment.

Full assessment submission requires **all user stories** (Phases 1–7, tasks T001–T052).

---

## Notes

- All state mutations MUST go through `src/lib/services/order-service.ts` (constitution G1)
- AI tools MUST NOT call HTTP loopback — direct service calls only (constitution G3)
- Commit incrementally after each checkpoint; clean history is an evaluation criterion
