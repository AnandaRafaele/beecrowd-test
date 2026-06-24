import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OrderNotFoundError,
  orderService,
} from "@/lib/services/order-service";
import { GET as getOrderById } from "@/app/api/orders/[id]/route";
import { GET as listOrders, POST as createOrder } from "@/app/api/orders/route";

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

describe("order API integration", () => {
  beforeEach(() => {
    vi.spyOn(orderService, "create").mockResolvedValue(sampleOrder);
    vi.spyOn(orderService, "list").mockResolvedValue([sampleOrder]);
    vi.spyOn(orderService, "getById").mockResolvedValue(sampleOrder);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST /api/orders creates an order with computed totalPrice", async () => {
    const request = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      body: JSON.stringify({
        items: [{ productId: "prod-1", quantity: 2, unitPrice: 10.5 }],
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await createOrder(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      id: sampleOrder.id,
      status: "PENDING",
      totalPrice: 21,
      items: [
        {
          productId: "prod-1",
          quantity: 2,
          unitPrice: 10.5,
        },
      ],
    });
    expect(orderService.create).toHaveBeenCalledWith({
      items: [{ productId: "prod-1", quantity: 2, unitPrice: 10.5 }],
    });
  });

  it("POST /api/orders returns 400 for invalid payload", async () => {
    const request = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      body: JSON.stringify({ items: [] }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await createOrder(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(orderService.create).not.toHaveBeenCalled();
  });

  it("GET /api/orders lists orders", async () => {
    const request = new NextRequest("http://localhost:3000/api/orders");
    const response = await listOrders(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      {
        id: sampleOrder.id,
        status: "PENDING",
        totalPrice: 21,
        createdAt: sampleOrder.createdAt.toISOString(),
        updatedAt: sampleOrder.updatedAt.toISOString(),
      },
    ]);
  });

  it("GET /api/orders filters by status", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/orders?status=PENDING",
    );
    await listOrders(request);

    expect(orderService.list).toHaveBeenCalledWith("PENDING");
  });

  it("GET /api/orders returns 400 for invalid status filter", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/orders?status=INVALID",
    );
    const response = await listOrders(request);

    expect(response.status).toBe(400);
    expect(orderService.list).not.toHaveBeenCalled();
  });

  it("GET /api/orders/:id returns order detail", async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/orders/${sampleOrder.id}`,
    );
    const response = await getOrderById(request, {
      params: Promise.resolve({ id: sampleOrder.id }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.totalPrice).toBe(21);
  });

  it("GET /api/orders/:id returns 404 when order is missing", async () => {
    vi.spyOn(orderService, "getById").mockRejectedValue(
      new OrderNotFoundError("missing-id"),
    );

    const request = new NextRequest(
      "http://localhost:3000/api/orders/missing-id",
    );
    const response = await getOrderById(request, {
      params: Promise.resolve({ id: "missing-id" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("ORDER_NOT_FOUND");
  });
});
