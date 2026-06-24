import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleAgentFinish } from "@/lib/ai/agent";
import {
  executeGetOrderStatus,
  executeRequestOrderCancellation,
} from "@/lib/ai/tools";
import {
  OrderNotCancellableError,
  OrderNotFoundError,
} from "@/lib/services/order-service";

const mockGetById = vi.fn();
const mockCancel = vi.fn();
const mockLogAiInteraction = vi.fn();

const sampleOrder = {
  id: "11111111-1111-1111-1111-111111111111",
  status: "PENDING" as const,
  totalPrice: new Prisma.Decimal("21.00"),
  createdAt: new Date("2026-06-24T12:00:00.000Z"),
  updatedAt: new Date("2026-06-24T12:00:00.000Z"),
  items: [
    {
      id: "22222222-2222-2222-2222-222222222222",
      orderId: "11111111-1111-1111-1111-111111111111",
      productId: "prod-1",
      quantity: 2,
      unitPrice: new Prisma.Decimal("10.50"),
    },
  ],
};

const deps = {
  orderService: {
    getById: mockGetById,
    cancel: mockCancel,
  },
};

describe("AI tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getOrderStatus delegates to OrderService.getById", async () => {
    mockGetById.mockResolvedValue(sampleOrder);

    const result = await executeGetOrderStatus(sampleOrder.id, deps);

    expect(mockGetById).toHaveBeenCalledWith(sampleOrder.id);
    expect(result).toMatchObject({
      id: sampleOrder.id,
      status: "PENDING",
      totalPrice: 21,
    });
  });

  it("getOrderStatus returns structured error when order is missing", async () => {
    mockGetById.mockRejectedValue(new OrderNotFoundError("missing-id"));

    const result = await executeGetOrderStatus("missing-id", deps);

    expect(result).toEqual({
      error: "ORDER_NOT_FOUND",
      message: "Order not found: missing-id",
    });
  });

  it("requestOrderCancellation delegates to OrderService.cancel", async () => {
    mockCancel.mockResolvedValue({ ...sampleOrder, status: "CANCELLED" });

    const result = await executeRequestOrderCancellation(sampleOrder.id, deps);

    expect(mockCancel).toHaveBeenCalledWith(sampleOrder.id);
    expect(result).toMatchObject({
      success: true,
      order: { status: "CANCELLED" },
    });
  });

  it("requestOrderCancellation returns not cancellable error from service", async () => {
    mockCancel.mockRejectedValue(
      new OrderNotCancellableError(sampleOrder.id, "PROCESSING"),
    );

    const result = await executeRequestOrderCancellation(sampleOrder.id, deps);

    expect(result).toEqual({
      error: "ORDER_NOT_CANCELLABLE",
      message: expect.stringContaining("PROCESSING"),
      status: "PROCESSING",
    });
  });
});

describe("handleAgentFinish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAiInteraction.mockResolvedValue({});
  });

  it("persists AI telemetry to SystemLog on finish", async () => {
    await handleAgentFinish({
      usage: {
        promptTokens: 120,
        completionTokens: 45,
        totalTokens: 165,
      },
      toolCalls: [{ toolName: "getOrderStatus" }],
      messages: [{ role: "user", content: "What is my order status?" }],
      startTime: Date.now() - 250,
      orderId: sampleOrder.id,
      logAiInteraction: mockLogAiInteraction,
    });

    expect(mockLogAiInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "AI support chat interaction completed",
        orderId: sampleOrder.id,
        promptTokens: 120,
        completionTokens: 45,
        totalTokens: 165,
        detectedIntent: "status_inquiry",
        latencyMs: expect.any(Number),
        metadata: { toolCalls: ["getOrderStatus"] },
      }),
    );
  });

  it("detects cancel intent from tool calls", async () => {
    await handleAgentFinish({
      toolCalls: [{ toolName: "requestOrderCancellation" }],
      messages: [{ role: "user", content: "Please cancel my order" }],
      startTime: Date.now(),
      logAiInteraction: mockLogAiInteraction,
    });

    expect(mockLogAiInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        detectedIntent: "cancel_request",
      }),
    );
  });
});
