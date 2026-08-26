import { Request, Response, NextFunction } from "express";
import { RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";
import { AppError } from "../utils/app-error";
import { AuthenticatedRequest } from "./auth";
import { redis } from "../lib/redis-lock";
import { log } from "../lib/logger";

// Section 4.10's storage backend, now Redis-backed (Section 28 PHASE 7:
// "rate-limiter store (4.10)") — same .consume() interface the in-memory
// version used through PHASE 4-6, just swapping RateLimiterMemory for
// RateLimiterRedis on the shared connection from lib/redis-lock.ts.
// Distinct keyPrefixes keep the four buckets from colliding on one
// connection (previously unnecessary — each in-memory instance was its
// own isolated store).

function makeLimiter(keyPrefix: string, points: number, durationSeconds: number): RateLimiterRedis {
  return new RateLimiterRedis({ storeClient: redis, keyPrefix, points, duration: durationSeconds });
}

const loginLimiter = makeLimiter("rl:login", 10, 15 * 60); // 10 / 15 min per IP+identifier
const registerLimiter = makeLimiter("rl:register", 5, 60 * 60); // 5 / hour per IP
const authenticatedGenericLimiter = makeLimiter("rl:auth", 300, 5 * 60); // 300 / 5 min per user
const publicGenericLimiter = makeLimiter("rl:public", 100, 5 * 60); // 100 / 5 min per IP
const locationPingLimiter = makeLimiter("rl:location-ping", 1, 5); // 1 / 5s per worker

function consumeOrReject(limiter: RateLimiterRedis, key: string, res: Response, next: NextFunction) {
  limiter
    .consume(key)
    .then(() => next())
    .catch((rej: unknown) => {
      if (rej instanceof RateLimiterRes) {
        res.setHeader("Retry-After", Math.ceil(rej.msBeforeNext / 1000).toString());
        return next(new AppError(429, "RATE_LIMITED", "Too many requests, please try again later"));
      }
      // Section 3.3 rule 1 — Redis is coordination/cache, not the source
      // of truth; a genuine Redis-connectivity error degrades to
      // fail-open (request proceeds unlimited) rather than blocking all
      // traffic, which a protective-but-optional layer must never do.
      log({ level: "error", message: `Rate limiter store error: ${rej instanceof Error ? rej.message : String(rej)}` });
      next();
    });
}

// Section 4.10: "10 attempts / 15 min per IP+identifier pair".
export function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const identifier = typeof req.body?.identifier === "string" ? req.body.identifier : "";
  consumeOrReject(loginLimiter, `${req.ip}:${identifier}`, res, next);
}

export function registerRateLimit(req: Request, res: Response, next: NextFunction) {
  consumeOrReject(registerLimiter, req.ip ?? "unknown", res, next);
}

// Mount after requireAuth so req.user is populated.
export function authenticatedRateLimit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  consumeOrReject(authenticatedGenericLimiter, req.user!.id, res, next);
}

export function publicRateLimit(req: Request, res: Response, next: NextFunction) {
  consumeOrReject(publicGenericLimiter, req.ip ?? "unknown", res, next);
}

// Section 4.10: "1 / 5s per worker (in addition to the existing 10s Redis
// debounce on the write itself)". Mount after requireProvider.
export function locationPingRateLimit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  consumeOrReject(locationPingLimiter, req.user!.id, res, next);
}
