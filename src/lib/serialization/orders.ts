import type { Order, OrderItem } from "@prisma/client";
import type { OrderWithItems } from "@/lib/services/order-service";

function decimalToNumber(value: Order["totalPrice"] | OrderItem["unitPrice"]): number {
  return Number(value.toString());
}

export function serializeOrderSummary(order: Order) {
  return {
    id: order.id,
    status: order.status,
    totalPrice: decimalToNumber(order.totalPrice),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function serializeOrder(order: OrderWithItems) {
  return {
    ...serializeOrderSummary(order),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: decimalToNumber(item.unitPrice),
    })),
  };
}
