// src/lib/request-timing.ts
//
// Per-request database timing, reported to the browser as a Server-Timing
// header (visible in DevTools > Network > Timing) so latency can be measured
// in production without extra logging: db;dur=<ms>;desc="<n> queries",
// app;dur=<ms>. No query text or parameters are exposed.
import { AsyncLocalStorage } from "async_hooks";
import { Request, Response, NextFunction } from "express";

interface Timing {
  start: number;
  dbMs: number;
  dbCount: number;
}

const storage = new AsyncLocalStorage<Timing>();

export function recordDbQuery(durationMs: number): void {
  const timing = storage.getStore();
  if (!timing) return;
  timing.dbMs += durationMs;
  timing.dbCount += 1;
}

export function serverTiming(_req: Request, res: Response, next: NextFunction) {
  const timing: Timing = { start: Date.now(), dbMs: 0, dbCount: 0 };
  const writeHead = res.writeHead;
  res.writeHead = function (this: Response, ...args: unknown[]) {
    if (!res.headersSent) {
      const total = Date.now() - timing.start;
      res.setHeader(
        "Server-Timing",
        `db;dur=${Math.round(timing.dbMs)};desc="${timing.dbCount} queries", app;dur=${total}`
      );
    }
    return (writeHead as (...a: unknown[]) => Response).apply(this, args);
  } as Response["writeHead"];
  storage.run(timing, () => next());
}
