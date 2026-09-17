// src/lib/auth-cache.ts
//
// requireAuth used to run prisma.user.findUnique on every authenticated
// request. Against the Seoul Supabase project from the Singapore Render
// instance each query costs ~200ms, so that one lookup was a fixed ~200ms tax
// on every tap in the app. This caches the revocation-relevant fields for a
// short TTL.
//
// Security contract: every write that can revoke access (tokenVersion bump,
// accountStatus change, soft delete, demo reset) must call
// invalidateAuthUser / clearAuthUserCache right after it commits, so
// revocation still takes effect on the very next request. The TTL only
// bounds the damage if a future write path forgets to.
//
// The cache is per process. The API runs as a single Render instance; if it
// is ever scaled out, move this to Redis (or shorten the TTL) so an
// invalidation on one instance reaches the others.

export interface AuthUserState {
  id: string;
  role: string;
  tokenVersion: number;
  accountStatus: string;
  deletedAt: Date | null;
}

const TTL_MS = 15_000;
const MAX_ENTRIES = 5_000;

const entries = new Map<string, { value: AuthUserState; expiresAt: number }>();
// Bumped on every invalidation so a lookup that started before an
// invalidation can't write its now-stale result back into the cache.
let generation = 0;

export async function getAuthUser(id: string, load: () => Promise<AuthUserState | null>): Promise<AuthUserState | null> {
  const hit = entries.get(id);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const startedAt = generation;
  const value = await load();
  // Missing users are never cached, so a newly created account is seen immediately.
  if (value && startedAt === generation) {
    if (entries.size >= MAX_ENTRIES) entries.clear();
    entries.set(id, { value, expiresAt: Date.now() + TTL_MS });
  }
  return value;
}

export function invalidateAuthUser(id: string): void {
  generation++;
  entries.delete(id);
}

export function clearAuthUserCache(): void {
  generation++;
  entries.clear();
}
