# Research: Intelligent Order Processing System

**Feature**: `001-ai-order-engine` | **Date**: 2026-06-24

## R1: Background Job Strategy in Next.js Docker Deployment

**Decision**: In-process `node-cron` registered via `instrumentation.ts` on Node
server startup, guarded by Redis distributed lock.

**Rationale**: Assessment targets long-running Docker containers (`docker compose up`),
not Vercel serverless. `instrumentation.ts` (Next.js 15) runs once per Node process,
making a 5-minute cron viable. Redis `SET NX PX` ensures only one replica executes
the batch when scaling `web` service to N containers.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|------------------|
| External cron container calling HTTP | Extra service complexity for assessment scope |
| `setInterval` without cron syntax | Harder to align with exact 5-minute wall-clock requirement |
| Bull/BullMQ job queue | Over-engineered for single batch type |
| OS crontab inside container | Not portable across Windows dev hosts |

## R2: Redis Locking Library vs Raw Commands

**Decision**: `ioredis` with atomic `SET key token NX PX 120000` + Lua unlock script
(simple token verification). Optional `redlock` only if multi-node Redis is introduced.

**Rationale**: Single Redis instance in Compose; raw NX/PX pattern is sufficient per
NFR-001 and constitution Principle II. Lock TTL (120s) exceeds expected batch duration
with margin for slow DB.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|------------------|
| PostgreSQL advisory locks | Couples job coordination to DB connection pool |
| Database `SELECT FOR UPDATE SKIP LOCKED` per order | Solves per-order races but not single-batch leader election |
| redlock (full library) | Added dependency; marginal benefit on single Redis |

## R3: AI Provider & Vercel AI SDK Pattern

**Decision**: Vercel AI SDK `streamText` with `@ai-sdk/openai` (GPT-4o-mini or
configurable via `OPENAI_API_KEY`). Tools defined with `tool()` helper; execution
calls `OrderService` directly.

**Rationale**: Matches constitution stack and assessment TypeScript track. Direct
service calls satisfy Principle III (no parallel cancellation path). `streamText`
supports `onFinish` for token telemetry (NFR-002).

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|------------------|
| LangChain agent | Heavier abstraction; constitution specifies Vercel AI SDK |
| Client-side OpenAI SDK | Violates server-mediated AI principle |
| HTTP loopback to own cancel API | Duplicates validation layer unnecessarily |

## R4: RAG / Knowledge Base Loading

**Decision**: Load `knowledge_base.json` at startup (or first request) into memory;
serialize rules into system prompt context block before each `streamText` call.

**Rationale**: Assessment asset is small JSON array; file-based RAG avoids vector DB
infrastructure. Policies stay versioned with repo. Live order status fetched via tools,
not embedded in static KB.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|------------------|
| Vector DB (pgvector) | Out of scope for fixed policy file |
| Fetch KB from S3 | No cloud requirement |
| Embed policies only in fine-tuned model | Not deterministic or auditable |

## R5: Testing Framework

**Decision**: Vitest with `vitest-environment-node` for services/API route handlers;
Prisma against test database or `prisma db push` in CI container.

**Rationale**: Fast, native ESM/TS support with Next.js ecosystem; constitution allows
Vitest or Jest — Vitest chosen for speed and modern defaults.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|------------------|
| Jest | Slower config with App Router; equally valid |
| Playwright-only E2E | Insufficient for business-rule unit coverage (20% weight) |

## R6: Validation Layer

**Decision**: Zod schemas for API request bodies and shared types inferred for
TypeScript.

**Rationale**: Runtime validation at API boundary; rejects zero-item orders and
negative quantities per spec edge cases before Prisma write.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|------------------|
| Prisma-only validation | No request-shape validation before DB |
| class-validator | Less idiomatic in Next.js App Router examples |

## R7: Prompt Injection Mitigations

**Decision**: Layered defenses — (1) hardened system prompt treating user input as
untrusted, (2) tool-only state mutations, (3) server-side re-validation in
`OrderService.cancel`, (4) no tool that sets status directly, (5) log suspicious
patterns to `SystemLog`.

**Rationale**: Aligns with NFR-002 and constitution Principle IV. Model cannot
"confirm" cancellation without successful tool result.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|------------------|
| LLM-only policy enforcement | Fails deterministic authority principle |
| Input regex blocklist only | Insufficient against creative injection |
