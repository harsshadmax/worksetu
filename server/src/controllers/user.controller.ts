import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { asyncHandler, AppError, sendValidationError } from "../utils/app-error";

// Section 1.2.9 — exact editable field set; no email/role field accepted
// (role is never client-settable, Section 7.4).
const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: z.string().min(10).max(15).optional(),
  avatarUrl: z.string().url().max(500).optional()
});

export const updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(req, res, parsed.error);

  const current = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const phoneChanged = parsed.data.phone !== undefined && parsed.data.phone !== current.phone;

  if (phoneChanged) {
    const existing = await prisma.user.findUnique({ where: { phone: parsed.data.phone! } });
    if (existing) {
      throw new AppError(409, "PHONE_ALREADY_IN_USE", "This phone number is already registered");
    }
  }

  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      ...parsed.data,
      // A changed phone number invalidates its prior verification.
      phoneVerifiedAt: phoneChanged ? null : undefined
    }
  });

  return res.json({
    userId: updated.id,
    fullName: updated.fullName,
    phone: updated.phone,
    avatarUrl: updated.avatarUrl
  });
});

const updatePreferencesSchema = z.object({
  theme: z.enum(["LIGHT", "DARK"]).optional(),
  language: z.enum(["en", "hi", "ta", "bn"]).optional(),
  notificationChannels: z.array(z.enum(["IN_APP", "EMAIL", "SMS", "PUSH"])).optional()
});

export const updatePreferences = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = updatePreferencesSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(req, res, parsed.error);

  const updated = await prisma.userPreference.update({
    where: { userId: req.user!.id },
    data: parsed.data
  });

  return res.json({
    theme: updated.theme,
    language: updated.language,
    notificationChannels: updated.notificationChannels
  });
});
