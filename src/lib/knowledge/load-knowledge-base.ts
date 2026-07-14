import { readFileSync } from "node:fs";
import { join } from "node:path";

export type KnowledgeRule = {
  context: string;
  rule: string;
};

export function loadKnowledgeBase(): KnowledgeRule[] {
  const filePath = join(process.cwd(), "assets", "knowledge_base.json");
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as KnowledgeRule[];
}

export function formatKnowledgeBase(rules: KnowledgeRule[]): string {
  return rules
    .map((entry) => `- ${entry.context}: ${entry.rule}`)
    .join("\n");
}
