import { tool } from "ai";
import { z } from "zod";
import { serializeOrder } from "@/lib/serialization/orders";
import {
  OrderNotCancellableError,
  OrderNotFoundError,
  orderService,
  type OrderService,
} from "@/lib/services/order-service";

export type OrderToolsDeps = {
  orderService: Pick<OrderService, "getById" | "cancel">;
};

const defaultDeps: OrderToolsDeps = {
  orderService,
};

export async function executeGetOrderStatus(
  orderId: string,
  deps: OrderToolsDeps = defaultDeps,
) {
  try {
    const order = await deps.orderService.getById(orderId);
    return serializeOrder(order);
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      return {
        error: "ORDER_NOT_FOUND",
        message: error.message,
      };
    }
    throw error;
  }
}

export async function executeRequestOrderCancellation(
  orderId: string,
  deps: OrderToolsDeps = defaultDeps,
) {
  try {
    const order = await deps.orderService.cancel(orderId);
    return {
      success: true,
      order: serializeOrder(order),
    };
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      return {
        error: "ORDER_NOT_FOUND",
        message: error.message,
      };
    }
    if (error instanceof OrderNotCancellableError) {
      return {
        error: "ORDER_NOT_CANCELLABLE",
        message: error.message,
        status: error.status,
      };
    }
    throw error;
  }
}

export function createChatTools(
  contextOrderId?: string,
  deps: OrderToolsDeps = defaultDeps,
) {
  const orderIdHint = contextOrderId
    ? ` Prefer order ID ${contextOrderId} when the customer did not specify another valid UUID.`
    : "";

  return {
    getOrderStatus: tool({
      description:
        `Fetch live order status, total price, timestamps, and line items by order ID.${orderIdHint}`,
      parameters: z.object({
        orderId: z.string().uuid(),
      }),
      execute: async ({ orderId }) => executeGetOrderStatus(orderId, deps),
    }),
    requestOrderCancellation: tool({
      description:
        `Request cancellation for an order. Only PENDING orders can be cancelled.${orderIdHint}`,
      parameters: z.object({
        orderId: z.string().uuid(),
      }),
      execute: async ({ orderId }) =>
        executeRequestOrderCancellation(orderId, deps),
    }),
  };
}
