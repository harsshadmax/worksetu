// src/lib/redis-lock.ts
import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL as string);

const LOCK_TTL_MS = 5000;

/**
 * Attempts to acquire an exclusive lock on a booking for a specific worker.
 * Mirrors: SET lock:booking:<id> <worker_id> NX PX 5000
 */
export async function acquireBookingLock(bookingId: string, workerId: string): Promise<boolean> {
  const key = `lock:booking:${bookingId}`;
  const result = await redis.set(key, workerId, "PX", LOCK_TTL_MS, "NX");
  return result === "OK";
}

export async function releaseBookingLock(bookingId: string, workerId: string): Promise<void> {
  // Lua script ensures a worker can only release a lock it holds (compare-and-delete)
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, `lock:booking:${bookingId}`, workerId);
}

export async function getBookingLockHolder(bookingId: string): Promise<string | null> {
  return redis.get(`lock:booking:${bookingId}`);
}
