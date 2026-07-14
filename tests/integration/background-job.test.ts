import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  runOrderProcessorBatch,
  type OrderProcessorResult,
} from "@/jobs/schedule-order-processor";

const mockRunOrderProcessorBatch = vi.fn<
  () => Promise<OrderProcessorResult>
>();

vi.mock("@/jobs/schedule-order-processor", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/jobs/schedule-order-processor")>();
  return {
    ...actual,
    runOrderProcessorBatch: (...args: Parameters<typeof runOrderProcessorBatch>) =>
      args.length > 0
        ? actual.runOrderProcessorBatch(...args)
        : mockRunOrderProcessorBatch(),
  };
});

import { POST as triggerProcessOrders } from "@/app/api/internal/process-orders/route";

const mockAcquireLock = vi.fn();
const mockReleaseLock = vi.fn();
const mockProcessBatch = vi.fn();
const mockLogBackgroundJob = vi.fn();
const mockLogLockSkip = vi.fn();

const lockHandle = { token: "lock-token", key: "lock:order_processor" };

function testDeps() {
  return {
    acquireLock: mockAcquireLock,
    releaseLock: mockReleaseLock,
    processBatch: mockProcessBatch,
    logBackgroundJob: mockLogBackgroundJob,
    logLockSkip: mockLogLockSkip,
  };
}

describe("runOrderProcessorBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAcquireLock.mockResolvedValue(lockHandle);
    mockReleaseLock.mockResolvedValue(true);
    mockProcessBatch.mockResolvedValue(2);
    mockLogBackgroundJob.mockResolvedValue({});
    mockLogLockSkip.mockResolvedValue({});
  });

  it("processes pending orders when lock is acquired", async () => {
    const result = await runOrderProcessorBatch(testDeps());

    expect(result).toEqual({
      executed: true,
      updatedCount: 2,
      skippedReason: null,
    });
    expect(mockProcessBatch).toHaveBeenCalledOnce();
    expect(mockLogBackgroundJob).toHaveBeenCalledWith(
      "Processed 2 pending order(s)",
      { updatedCount: 2 },
    );
    expect(mockReleaseLock).toHaveBeenCalledWith(lockHandle);
  });

  it("skips processing when lock is held elsewhere", async () => {
    mockAcquireLock.mockResolvedValue(null);

    const result = await runOrderProcessorBatch(testDeps());

    expect(result).toEqual({
      executed: false,
      updatedCount: 0,
      skippedReason: "lock_held",
    });
    expect(mockProcessBatch).not.toHaveBeenCalled();
    expect(mockLogLockSkip).toHaveBeenCalledWith(
      "Order processor skipped — lock held by another instance",
      { lockKey: "lock:order_processor" },
    );
    expect(mockReleaseLock).not.toHaveBeenCalled();
  });

  it("releases lock even when batch processing fails", async () => {
    mockProcessBatch.mockRejectedValue(new Error("database unavailable"));

    await expect(runOrderProcessorBatch(testDeps())).rejects.toThrow(
      "database unavailable",
    );
    expect(mockReleaseLock).toHaveBeenCalledWith(lockHandle);
  });
});

describe("process orders API integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST /api/internal/process-orders returns batch result", async () => {
    mockRunOrderProcessorBatch.mockResolvedValue({
      executed: true,
      updatedCount: 4,
      skippedReason: null,
    });

    const response = await triggerProcessOrders();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      executed: true,
      updatedCount: 4,
      skippedReason: null,
    });
    expect(mockRunOrderProcessorBatch).toHaveBeenCalledOnce();
  });

  it("POST /api/internal/process-orders returns skipped result when lock held", async () => {
    mockRunOrderProcessorBatch.mockResolvedValue({
      executed: false,
      updatedCount: 0,
      skippedReason: "lock_held",
    });

    const response = await triggerProcessOrders();
    const body = await response.json();

    expect(body).toEqual({
      executed: false,
      updatedCount: 0,
      skippedReason: "lock_held",
    });
  });
});
