import { redis } from "./redis-lock";

// Section 24.3 — Redis caches: service catalog, platform stats (TTL
// 300s), platform config (TTL 60s, wired when PHASE 11 builds
// GET/PATCH /admin/config). Failure to reach Redis degrades to a live
// compute rather than failing the request (Section 3.3 rule 1).
export async function getOrSetCache<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached !== null) return JSON.parse(cached) as T;
  } catch {
    // Redis unreachable — fall through to a live compute.
  }

  const value = await compute();

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Best-effort; a failed cache write never fails the request.
  }

  return value;
}

export async function invalidateCache(key: string): Promise<void> {
  await redis.del(key).catch(() => {});
}
