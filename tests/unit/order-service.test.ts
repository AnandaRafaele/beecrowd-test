import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OrderNotFoundError,
  OrderService,
} from "@/lib/services/order-service";

const mockOrderCreate = vi.fn();
const mockOrderFindMany = vi.fn();
const mockOrderFindUnique = vi.fn();

const mockDb = {
  order: {
    create: mockOrderCreate,
    findMany: mockOrderFindMany,
    findUnique: mockOrderFindUnique,
  },
} as unknown as ConstructorParameters<typeof OrderService>[0];

const sampleInput = {
  items: [
    { productId: "prod-1", quantity: 2, unitPrice: 10.5 },
    { productId: "prod-2", quantity: 1, unitPrice: 15 },
  ],
};

const sampleOrder = {
  id: "11111111-1111-1111-1111-111111111111",
  status: "PENDING" as const,
  totalPrice: new Prisma.Decimal("36.00"),
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
    {
      id: "33333333-3333-3333-3333-333333333333",
      orderId: "11111111-1111-1111-1111-111111111111",
      productId: "prod-2",
      quantity: 1,
      unitPrice: new Prisma.Decimal("15.00"),
    },
  ],
};

describe("OrderService.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderCreate.mockResolvedValue(sampleOrder);
  });

  it("computes totalPrice server-side and persists items", async () => {
    const service = new OrderService(mockDb);
    const result = await service.create(sampleInput);

    expect(mockOrderCreate).toHaveBeenCalledWith({
      data: {
        totalPrice: new Prisma.Decimal("36.00"),
        items: {
          create: [
            {
              productId: "prod-1",
              quantity: 2,
              unitPrice: new Prisma.Decimal("10.50"),
            },
            {
              productId: "prod-2",
              quantity: 1,
              unitPrice: new Prisma.Decimal("15.00"),
            },
          ],
        },
      },
      include: { items: true },
    });
    expect(result).toEqual(sampleOrder);
  });
});

describe("OrderService.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderFindMany.mockResolvedValue([sampleOrder]);
  });

  it("returns all orders when no status filter is provided", async () => {
    const service = new OrderService(mockDb);
    const result = await service.list();

    expect(mockOrderFindMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { createdAt: "desc" },
    });
    expect(result).toEqual([sampleOrder]);
  });

  it("filters orders by status when provided", async () => {
    const service = new OrderService(mockDb);
    await service.list("PENDING");

    expect(mockOrderFindMany).toHaveBeenCalledWith({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("OrderService.getById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns order with items when found", async () => {
    mockOrderFindUnique.mockResolvedValue(sampleOrder);
    const service = new OrderService(mockDb);

    const result = await service.getById(sampleOrder.id);

    expect(mockOrderFindUnique).toHaveBeenCalledWith({
      where: { id: sampleOrder.id },
      include: { items: true },
    });
    expect(result).toEqual(sampleOrder);
  });

  it("throws OrderNotFoundError when order does not exist", async () => {
    mockOrderFindUnique.mockResolvedValue(null);
    const service = new OrderService(mockDb);

    await expect(service.getById("missing-id")).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
  });
});
