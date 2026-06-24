import { NextRequest, NextResponse } from "next/server";
import {
  createOrderSchema,
  orderStatusFilterSchema,
} from "@/lib/validation/order-schemas";
import { orderService } from "@/lib/services/order-service";
import {
  serializeOrder,
  serializeOrderSummary,
} from "@/lib/serialization/orders";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.errors.map((issue) => issue.message).join("; "),
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  const order = await orderService.create(parsed.data);
  return NextResponse.json(serializeOrder(order), { status: 201 });
}

export async function GET(request: NextRequest) {
  const statusParam = request.nextUrl.searchParams.get("status");
  const parsed = orderStatusFilterSchema.safeParse({
    status: statusParam ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid status filter", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const orders = await orderService.list(parsed.data.status);
  return NextResponse.json(orders.map(serializeOrderSummary));
}
