import { describe, expect, it } from "vitest";
import {
  createOrderSchema,
  orderStatusFilterSchema,
  orderStatusSchema,
} from "@/lib/validation/order-schemas";

describe("orderStatusSchema", () => {
  it("accepts valid statuses", () => {
    expect(orderStatusSchema.parse("PENDING")).toBe("PENDING");
    expect(orderStatusSchema.parse("CANCELLED")).toBe("CANCELLED");
  });

  it("rejects invalid statuses", () => {
    expect(() => orderStatusSchema.parse("INVALID")).toThrow();
  });
});

describe("createOrderSchema", () => {
  it("accepts a valid multi-item payload", () => {
    const result = createOrderSchema.parse({
      items: [
        { productId: "prod-1", quantity: 2, unitPrice: 10.5 },
        { productId: "prod-2", quantity: 1, unitPrice: 0 },
      ],
    });

    expect(result.items).toHaveLength(2);
  });

  it("rejects empty items array", () => {
    expect(() => createOrderSchema.parse({ items: [] })).toThrow();
  });

  it("rejects non-positive quantity", () => {
    expect(() =>
      createOrderSchema.parse({
        items: [{ productId: "prod-1", quantity: 0, unitPrice: 10 }],
      }),
    ).toThrow();
  });

  it("rejects negative unit price", () => {
    expect(() =>
      createOrderSchema.parse({
        items: [{ productId: "prod-1", quantity: 1, unitPrice: -1 }],
      }),
    ).toThrow();
  });

  it("rejects blank productId", () => {
    expect(() =>
      createOrderSchema.parse({
        items: [{ productId: "  ", quantity: 1, unitPrice: 10 }],
      }),
    ).toThrow();
  });
});

describe("orderStatusFilterSchema", () => {
  it("accepts optional status filter", () => {
    expect(orderStatusFilterSchema.parse({})).toEqual({});
    expect(orderStatusFilterSchema.parse({ status: "PENDING" })).toEqual({
      status: "PENDING",
    });
  });

  it("rejects invalid status filter", () => {
    expect(() =>
      orderStatusFilterSchema.parse({ status: "UNKNOWN" }),
    ).toThrow();
  });
});
