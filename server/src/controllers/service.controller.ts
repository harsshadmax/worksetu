import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/app-error";

// Section 1.1.3 — Redis-cached (services:catalog:{lang}) in the full spec;
// caching is PHASE 7 work (Section 24.3). Live query for now.
export const listServices = asyncHandler(async (_req: Request, res: Response) => {
  const services = await prisma.serviceCategory.findMany({
    where: { isEnabled: true },
    orderBy: { sortOrder: "asc" }
  });
  return res.json(
    services.map((s) => ({
      id: s.id,
      translationKey: s.translationKey,
      baseRate: Number(s.baseRate),
      hourlyRate: Number(s.hourlyRate),
      icon: s.icon,
      isEnabled: s.isEnabled
    }))
  );
});
