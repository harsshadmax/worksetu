import { Request, Response, NextFunction } from "express";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";
import { AppError } from "../utils/app-error";
import { AuthenticatedRequest } from "./auth";

// Section 4.10 — in-memory store for now. The storage BACKEND (Redis) is
// explicitly PHASE 7 work ("rate-limiter store (4.10)" in Section 28);
// rate-limiter-flexible's RateLimiterMemory and RateLimiterRedis share the
// same .consume() interface, so PHASE 7 swaps the backend without touching
// any call site below.

function makeLimiter(points: number, durationSeconds: number): RateLimiterMemory {
  return new RateLimiterMemory({ points, duration: durationSeconds });
}

const loginLimiter = makeLimiter(10, 15 * 60); // 10 / 15 min per IP+identifier
const registerLimiter = makeLimiter(5, 60 * 60); // 5 / hour per IP
const authenticatedGenericLimiter = makeLimiter(300, 5 * 60); // 300 / 5 min per user
const publicGenericLimiter = makeLimiter(100, 5 * 60); // 100 / 5 min per IP

function consumeOrReject(limiter: RateLimiterMemory, key: string, res: Response, next: NextFunction) {
  limiter
    .consume(key)
    .then(() => next())
    .catch((rejRes: RateLimiterRes) => {
      res.setHeader("Retry-After", Math.ceil(rejRes.msBeforeNext / 1000).toString());
      next(new AppError(429, "RATE_LIMITED", "Too many requests, please try again later"));
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
