# Quickstart: Intelligent Order Processing System

**Feature**: `001-ai-order-engine` | **Date**: 2026-06-24

Validation guide for end-to-end feature verification. Implementation details live
in [plan.md](./plan.md); data shapes in [data-model.md](./data-model.md); API in
[contracts/openapi.yaml](./contracts/openapi.yaml).

## Prerequisites

- Docker Desktop (or Docker Engine + Compose)
- Node.js 20+ (local dev without Docker optional)
- `OPENAI_API_KEY` (or configured AI provider) in `.env`
- Copy `.env.example` → `.env` and set:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/orders
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-...
```

## Boot Stack

```bash
docker compose up --build
```

**Expected**: `postgres` and `redis` healthy before `web` accepts traffic on
`http://localhost:3000`.

**Verify health**:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/orders
# Expected: 200
```

## Scenario 1: Create and Retrieve Order (FR-001 / US1)

```bash
# Create
curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"prod-1","quantity":2,"unitPrice":10.50}]}' \
  | jq .

# Expected: id (UUID), status "PENDING", totalPrice 21.00

# List
curl -s "http://localhost:3000/api/orders?status=PENDING" | jq .

# Detail (replace ORDER_ID)
curl -s http://localhost:3000/api/orders/ORDER_ID | jq .
```

**Pass criteria**: Status `PENDING`; `totalPrice` = 21.00; items array present.

## Scenario 2: Cancel Pending Order (FR-003 / US2)

```bash
curl -s -X POST http://localhost:3000/api/orders/ORDER_ID/cancel | jq .
# Expected: status "CANCELLED"

curl -s -X POST http://localhost:3000/api/orders/ORDER_ID/cancel | jq .
# Expected: 409 error — not cancellable
```

Create a second order, wait for background job (or trigger manually — Scenario 3),
then attempt cancel on `PROCESSING` order → expect 409.

## Scenario 3: Background Batch (FR-002 / US3)

**Option A — Wait 5 minutes** after creating `PENDING` orders; recheck status →
`PROCESSING`.

**Option B — Manual trigger (dev endpoint)**:

```bash
curl -s -X POST http://localhost:3000/api/internal/process-orders | jq .
# Expected: { "executed": true, "updatedCount": N }
```

**Multi-replica test**:

```bash
docker compose up --scale web=3 -d
curl -s -X POST http://localhost:3000/api/internal/process-orders
# Only one replica should report executed:true; others skippedReason: lock_held
```

Check `SystemLog` for `LOCK_SKIP` and `BACKGROUND_JOB` entries.

## Scenario 4: AI Chat (FR-004 / US4)

Open `http://localhost:3000/chat` or:

```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_ID",
    "messages": [{"role":"user","content":"What is my order status?"}]
  }'
```

**Pass criteria**:

- Response mentions actual status from database
- `SystemLog` row with `type: AI_INTERACTION`, token counts, `latencyMs`

**Cancellation via chat** (PENDING order):

```json
{
  "orderId": "ORDER_ID",
  "messages": [{"role":"user","content":"Please cancel my order now"}]
}
```

**Pass criteria**: Tool invoked; order becomes `CANCELLED`; assistant confirms.

**Policy denial** (PROCESSING order): Model refuses; no state change; logs present.

## Scenario 5: Validation Errors

```bash
# Empty items
curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"items":[]}' 
# Expected: 400

# Invalid UUID
curl -s http://localhost:3000/api/orders/not-a-uuid
# Expected: 404
```

## Automated Tests

```bash
npm test
# or: npx vitest run
```

**Expected suites** (per constitution):

- Order status transition rules
- Cancellation rejection for non-PENDING
- AI tool calling (allowed + denied paths)
- Optional: background job with mocked Redis

## Troubleshooting

| Symptom | Check |
|---------|-------|
| `web` exits on start | `DATABASE_URL` reachable; run `npx prisma migrate deploy` |
| Batch never runs | `instrumentation.ts` enabled; cron registered; Redis up |
| Chat 503 | `OPENAI_API_KEY` set and valid |
| Duplicate batch processing | Redis lock key `lock:order_processor`; inspect `SystemLog` |

## Next Step

Run `/speckit-tasks` to generate actionable implementation tasks from this plan.
