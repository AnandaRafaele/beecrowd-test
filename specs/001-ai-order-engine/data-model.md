# Data Model: Intelligent Order Processing System

**Feature**: `001-ai-order-engine` | **Date**: 2026-06-24

## Prisma Schema Overview

```prisma
enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}

enum SystemLogType {
  BACKGROUND_JOB
  AI_INTERACTION
  LOCK_SKIP
  ERROR
}

model Order {
  id         String      @id @default(uuid()) @db.Uuid
  status     OrderStatus @default(PENDING)
  totalPrice Decimal     @db.Decimal(12, 2)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
  items      OrderItem[]
}

model OrderItem {
  id        String  @id @default(uuid()) @db.Uuid
  orderId   String  @db.Uuid
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId String
  quantity  Int
  unitPrice Decimal @db.Decimal(12, 2)

  @@index([orderId])
}

model SystemLog {
  id                String        @id @default(uuid()) @db.Uuid
  type              SystemLogType
  message           String
  metadata          Json?
  promptTokens      Int?
  completionTokens  Int?
  totalTokens       Int?
  latencyMs         Int?
  detectedIntent    String?
  orderId           String?       @db.Uuid
  createdAt         DateTime      @default(now())

  @@index([type, createdAt])
  @@index([orderId])
}
```

## Entity: Order

| Field | Type | Rules |
|-------|------|-------|
| `id` | UUID | Auto-generated; exposed in API responses |
| `status` | `OrderStatus` | Default `PENDING`; mutations via service layer only |
| `totalPrice` | Decimal(12,2) | Server-computed sum of line totals; never client-trusted |
| `createdAt` | DateTime | Immutable |
| `updatedAt` | DateTime | Auto-updated on change |

**Relationships**: One-to-many with `OrderItem` (cascade delete).

## Entity: OrderItem

| Field | Type | Rules |
|-------|------|-------|
| `productId` | String | Required; opaque product reference |
| `quantity` | Int | Must be > 0 |
| `unitPrice` | Decimal(12,2) | Must be >= 0 |
| Line total | computed | `quantity * unitPrice` (not stored; contributes to `Order.totalPrice`) |

## Entity: SystemLog

Captures background job events, lock skip notices, AI telemetry, and errors.

| Field | Type | Usage |
|-------|------|-------|
| `type` | enum | Categorize log entry |
| `message` | String | Human-readable summary |
| `metadata` | JSON | Batch counts, lock token, raw tool results (sanitized) |
| `promptTokens` / `completionTokens` / `totalTokens` | Int? | AI `onFinish` usage |
| `latencyMs` | Int? | Wall-clock duration of AI request |
| `detectedIntent` | String? | e.g. `status_inquiry`, `cancel_request`, `policy_question` |
| `orderId` | UUID? | Associated order when applicable |

## State Transitions

```text
                    ┌─────────────┐
         create     │   PENDING   │◄── initial state
        ──────────► │             │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │ cancel        │ batch (5 min) │ (out of scope: manual advance)
           ▼               ▼               │
    ┌─────────────┐ ┌─────────────┐        │
    │  CANCELLED  │ │ PROCESSING  │────────┘
    └─────────────┘ └──────┬──────┘
                           │ (future / out of scope for automation)
                           ▼
                    ┌─────────────┐
                    │   SHIPPED   │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │  DELIVERED  │
                    └─────────────┘
```

### Allowed Transitions (in scope)

| From | To | Trigger | Guard |
|------|-----|---------|-------|
| — | `PENDING` | Order creation | Valid items; total computed server-side |
| `PENDING` | `CANCELLED` | Manual/AI cancel API | Status must equal `PENDING` inside transaction |
| `PENDING` | `PROCESSING` | Background batch | Leader lock held; row still `PENDING` at update time |

### Forbidden Transitions

- Cancel when status ∈ {`PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`}
- Background batch must not touch non-`PENDING` orders
- AI tools must not bypass `OrderService` guards

## Validation Rules (Zod / Service)

**Create order payload**:

- `items`: array, min length 1
- Each item: `productId` non-empty string, `quantity` positive integer,
  `unitPrice` non-negative number
- Reject empty arrays and negative values at API boundary

**List orders**:

- Optional `status` query must be valid `OrderStatus` enum value

**Cancel**:

- Order must exist
- `status === PENDING` or transaction aborts with business error

## Indexes & Concurrency Notes

- Index `Order.status` for batch query: `WHERE status = 'PENDING'`
- Cancellation uses transaction:
  1. `SELECT ... FOR UPDATE` or optimistic `updateMany` with `where: { id, status: PENDING }`
  2. If count = 0, throw `OrderNotCancellableError`
- Batch update uses `updateMany({ where: { status: PENDING }, data: { status: PROCESSING } })`
  inside transaction after lock acquisition

## External Assets (not DB tables)

**knowledge_base.json** — Array of `{ context, rule }` objects loaded into AI system
prompt; not persisted in PostgreSQL.
