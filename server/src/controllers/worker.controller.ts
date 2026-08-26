import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { asyncHandler, AppError } from "../utils/app-error";

const availabilitySchema = z.object({ status: z.enum(["AVAILABLE", "OFF_DUTY"]) });

export const updateAvailability = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = availabilitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_FAILED", message: "status must be AVAILABLE or OFF_DUTY" } });
  }

  // Section 7.3 — resolved from the authenticated identity, never a body/path field.
  const worker = await prisma.workerProfile.findUnique({ where: { userId: req.user!.id } });
  if (!worker) {
    throw new AppError(404, "WORKER_PROFILE_NOT_FOUND", "Worker profile not found");
  }
  if (worker.suspendedAt && parsed.data.status === "AVAILABLE") {
    throw new AppError(403, "ACCOUNT_SUSPENDED", "Suspended workers cannot go available");
  }

  const updated = await prisma.workerProfile.update({
    where: { id: worker.id },
    data: { availabilityStatus: parsed.data.status }
  });
  return res.json({ status: updated.availabilityStatus, updatedAt: updated.updatedAt });
});
