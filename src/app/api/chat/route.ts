import { NextResponse } from "next/server";
import { runSupportAgent } from "@/lib/ai/agent";
import { getChatErrorMessage } from "@/lib/ai/errors";
import { chatRequestSchema } from "@/lib/validation/chat-schemas";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "AI provider unavailable", code: "AI_UNAVAILABLE" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.errors.map((issue) => issue.message).join("; "),
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  const result = runSupportAgent(parsed.data);
  return result.toDataStreamResponse({
    getErrorMessage: getChatErrorMessage,
  });
}
