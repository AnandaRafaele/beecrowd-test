import { Prisma, type Order, type OrderItem, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreateOrderInput, OrderStatus } from "@/lib/validation/order-schemas";

export class OrderNotFoundError extends Error {
  readonly orderId: string;

  constructor(orderId: string) {
    super(`Order not found: ${orderId}`);
    this.name = "OrderNotFoundError";
    this.orderId = orderId;
  }
}

export class OrderNotCancellableError extends Error {
  readonly orderId: string;
  readonly status: string;

  constructor(orderId: string, status: string) {
    super(
      `Order ${orderId} cannot be cancelled while status is ${status}. Only PENDING orders can be cancelled.`,
    );
    this.name = "OrderNotCancellableError";
    this.orderId = orderId;
    this.status = status;
  }
}

export type OrderWithItems = Order & { items: OrderItem[] };

function computeTotalPrice(items: CreateOrderInput["items"]): Prisma.Decimal {
  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  return new Prisma.Decimal(total.toFixed(2));
}

export class OrderService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async create(input: CreateOrderInput): Promise<OrderWithItems> {
    return this.db.order.create({
      data: {
        totalPrice: computeTotalPrice(input.items),
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
          })),
        },
      },
      include: { items: true },
    });
  }

  async list(status?: OrderStatus): Promise<Order[]> {
    return this.db.order.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(orderId: string): Promise<OrderWithItems> {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    return order;
  }

  async cancel(_orderId: string): Promise<OrderWithItems> {
    throw new Error("OrderService.cancel is not implemented yet");
  }

  async processPendingBatch(): Promise<number> {
    throw new Error("OrderService.processPendingBatch is not implemented yet");
  }
}

export const orderService = new OrderService();
