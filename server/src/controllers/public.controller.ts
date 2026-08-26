import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/app-error";

// Section 1.1.1 — Redis-cached (stats:platform, TTL 300s) in the full
// spec; that caching layer is explicitly PHASE 7 work (Section 24.3).
// This is the live query it will wrap.
export const getPlatformStats = asyncHandler(async (_req: Request, res: Response) => {
  const [totalWorkers, completedBookings, activeCooperatives] = await Promise.all([
    prisma.user.count({ where: { role: "WORKER", deletedAt: null } }),
    prisma.booking.count({ where: { status: "SETTLED" } }),
    prisma.cooperative.count()
  ]);
  return res.json({ totalWorkers, completedBookings, activeCooperatives });
});
