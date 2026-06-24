import cron from "node-cron";
import {
  acquireLock,
  ORDER_PROCESSOR_LOCK_KEY,
  releaseLock,
} from "@/lib/lock";
import { orderService } from "@/lib/services/order-service";
import { systemLogService } from "@/lib/services/system-log-service";

export type OrderProcessorResult = {
  executed: boolean;
  updatedCount: number;
  skippedReason: string | null;
};

type OrderProcessorDeps = {
  acquireLock: typeof acquireLock;
  releaseLock: typeof releaseLock;
  processBatch: () => Promise<number>;
  logBackgroundJob: typeof systemLogService.logBackgroundJob;
  logLockSkip: typeof systemLogService.logLockSkip;
};

const defaultDeps: OrderProcessorDeps = {
  acquireLock,
  releaseLock,
  processBatch: () => orderService.processPendingBatch(),
  logBackgroundJob: (message, metadata) =>
    systemLogService.logBackgroundJob(message, metadata),
  logLockSkip: (message, metadata) =>
    systemLogService.logLockSkip(message, metadata),
};

export async function runOrderProcessorBatch(
  deps: Partial<OrderProcessorDeps> = {},
): Promise<OrderProcessorResult> {
  const resolved = { ...defaultDeps, ...deps };
  const handle = await resolved.acquireLock();

  if (!handle) {
    await resolved.logLockSkip(
      "Order processor skipped — lock held by another instance",
      { lockKey: ORDER_PROCESSOR_LOCK_KEY },
    );
    return {
      executed: false,
      updatedCount: 0,
      skippedReason: "lock_held",
    };
  }

  try {
    const updatedCount = await resolved.processBatch();
    await resolved.logBackgroundJob(
      `Processed ${updatedCount} pending order(s)`,
      { updatedCount },
    );
    return {
      executed: true,
      updatedCount,
      skippedReason: null,
    };
  } finally {
    await resolved.releaseLock(handle);
  }
}

const globalForCron = globalThis as unknown as {
  orderProcessorCronStarted?: boolean;
};

export function startOrderProcessorCron() {
  if (globalForCron.orderProcessorCronStarted) {
    return;
  }

  globalForCron.orderProcessorCronStarted = true;
  cron.schedule("*/5 * * * *", () => {
    void runOrderProcessorBatch();
  });
}
