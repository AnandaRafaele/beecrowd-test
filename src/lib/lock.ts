import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import { connectRedis } from "./redis";

export const ORDER_PROCESSOR_LOCK_KEY = "lock:order_processor";
export const ORDER_PROCESSOR_LOCK_TTL_MS = 120_000;

const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export type LockHandle = {
  token: string;
  key: string;
};

export async function acquireLock(
  key: string = ORDER_PROCESSOR_LOCK_KEY,
  ttlMs: number = ORDER_PROCESSOR_LOCK_TTL_MS,
  redis?: Redis,
): Promise<LockHandle | null> {
  const client = redis ?? (await connectRedis());
  const token = randomUUID();
  const result = await client.set(key, token, "PX", ttlMs, "NX");

  if (result !== "OK") {
    return null;
  }

  return { token, key };
}

export async function releaseLock(
  handle: LockHandle,
  redis?: Redis,
): Promise<boolean> {
  const client = redis ?? (await connectRedis());
  const released = await client.eval(
    RELEASE_LOCK_SCRIPT,
    1,
    handle.key,
    handle.token,
  );

  return released === 1;
}
