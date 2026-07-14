import type { Prisma, SystemLogType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type LogInput = {
  type: SystemLogType;
  message: string;
  metadata?: Prisma.InputJsonValue;
  orderId?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  detectedIntent?: string;
};

export class SystemLogService {
  async log(input: LogInput) {
    return prisma.systemLog.create({
      data: {
        type: input.type,
        message: input.message,
        metadata: input.metadata,
        orderId: input.orderId,
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        totalTokens: input.totalTokens,
        latencyMs: input.latencyMs,
        detectedIntent: input.detectedIntent,
      },
    });
  }

  async logBackgroundJob(message: string, metadata?: Prisma.InputJsonValue) {
    return this.log({
      type: "BACKGROUND_JOB",
      message,
      metadata,
    });
  }

  async logLockSkip(message: string, metadata?: Prisma.InputJsonValue) {
    return this.log({
      type: "LOCK_SKIP",
      message,
      metadata,
    });
  }

  async logAiInteraction(input: Omit<LogInput, "type">) {
    return this.log({
      ...input,
      type: "AI_INTERACTION",
    });
  }
}

export const systemLogService = new SystemLogService();
