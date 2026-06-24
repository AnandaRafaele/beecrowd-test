import type { Order, OrderItem, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

export class OrderService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async create(): Promise<OrderWithItems> {
    throw new Error("OrderService.create is not implemented yet");
  }

  async list(): Promise<OrderWithItems[]> {
    throw new Error("OrderService.list is not implemented yet");
  }

  async getById(_orderId: string): Promise<OrderWithItems> {
    throw new Error("OrderService.getById is not implemented yet");
  }

  async cancel(_orderId: string): Promise<OrderWithItems> {
    throw new Error("OrderService.cancel is not implemented yet");
  }

  async processPendingBatch(): Promise<number> {
    throw new Error("OrderService.processPendingBatch is not implemented yet");
  }
}

export const orderService = new OrderService();
