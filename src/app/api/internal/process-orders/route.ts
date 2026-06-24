import { NextResponse } from "next/server";
import { runOrderProcessorBatch } from "@/jobs/schedule-order-processor";

export async function POST() {
  const result = await runOrderProcessorBatch();
  return NextResponse.json(result);
}
