import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OrderNotCancellableError,
  OrderNotFoundError,
  orderService,
} from "@/lib/services/order-service";
import { POST as cancelOrder } from "@/app/api/orders/[id]/cancel/route";

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

describe("cancel order API integration", () => {
  beforeEach(() => {
    vi.spyOn(orderService, "cancel").mockResolvedValue({
      ...sampleOrder,
      status: "CANCELLED",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST /api/orders/:id/cancel returns cancelled order", async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/orders/${sampleOrder.id}/cancel`,
      { method: "POST" },
    );
    const response = await cancelOrder(request, {
      params: Promise.resolve({ id: sampleOrder.id }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("CANCELLED");
    expect(orderService.cancel).toHaveBeenCalledWith(sampleOrder.id);
  });

  it("POST /api/orders/:id/cancel returns 409 when order is not PENDING", async () => {
    vi.spyOn(orderService, "cancel").mockRejectedValue(
      new OrderNotCancellableError(sampleOrder.id, "PROCESSING"),
    );

    const request = new NextRequest(
      `http://localhost:3000/api/orders/${sampleOrder.id}/cancel`,
      { method: "POST" },
    );
    const response = await cancelOrder(request, {
      params: Promise.resolve({ id: sampleOrder.id }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("ORDER_NOT_CANCELLABLE");
  });

  it("POST /api/orders/:id/cancel returns 404 when order is missing", async () => {
    vi.spyOn(orderService, "cancel").mockRejectedValue(
      new OrderNotFoundError("missing-id"),
    );

    const request = new NextRequest(
      "http://localhost:3000/api/orders/missing-id/cancel",
      { method: "POST" },
    );
    const response = await cancelOrder(request, {
      params: Promise.resolve({ id: "missing-id" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("ORDER_NOT_FOUND");
  });

  it("handles concurrent cancel attempts safely via service guard", async () => {
    const cancelSpy = vi.spyOn(orderService, "cancel");
    cancelSpy
      .mockResolvedValueOnce({ ...sampleOrder, status: "CANCELLED" })
      .mockRejectedValueOnce(
        new OrderNotCancellableError(sampleOrder.id, "CANCELLED"),
      );

    const request = new NextRequest(
      `http://localhost:3000/api/orders/${sampleOrder.id}/cancel`,
      { method: "POST" },
    );
    const context = { params: Promise.resolve({ id: sampleOrder.id }) };

    const first = await cancelOrder(request, context);
    const second = await cancelOrder(request, context);

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(cancelSpy).toHaveBeenCalledTimes(2);
  });
});
