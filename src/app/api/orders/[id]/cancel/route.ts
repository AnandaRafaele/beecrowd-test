import { NextRequest, NextResponse } from "next/server";
import {
  OrderNotCancellableError,
  OrderNotFoundError,
  orderService,
} from "@/lib/services/order-service";
import { serializeOrder } from "@/lib/serialization/orders";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const order = await orderService.cancel(id);
    return NextResponse.json(serializeOrder(order));
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      return NextResponse.json(
        { error: error.message, code: "ORDER_NOT_FOUND" },
        { status: 404 },
      );
    }

    if (error instanceof OrderNotCancellableError) {
      return NextResponse.json(
        { error: error.message, code: "ORDER_NOT_CANCELLABLE" },
        { status: 409 },
      );
    }

    throw error;
  }
}
