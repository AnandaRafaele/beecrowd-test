import { z } from "zod";

export const orderStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

export const orderItemInputSchema = z.object({
  productId: z.string().trim().min(1, "productId is required"),
  quantity: z.number().int().positive("quantity must be a positive integer"),
  unitPrice: z.number().nonnegative("unitPrice must be non-negative"),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemInputSchema).min(1, "at least one item is required"),
});

export const orderStatusFilterSchema = z.object({
  status: orderStatusSchema.optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
