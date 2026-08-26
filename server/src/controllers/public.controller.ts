import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/app-error";
import { getOrSetCache } from "../lib/cache";

// Section 1.1.1 — Redis-cached, key stats:platform, TTL 300s.
export const getPlatformStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await getOrSetCache("stats:platform", 300, async () => {
    const [totalWorkers, completedBookings, activeCooperatives] = await Promise.all([
      prisma.user.count({ where: { role: "WORKER", deletedAt: null } }),
      prisma.booking.count({ where: { status: "SETTLED" } }),
      prisma.cooperative.count()
    ]);
    return { totalWorkers, completedBookings, activeCooperatives };
  });
  return res.json(stats);
});
