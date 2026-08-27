// src/controllers/admin-wallet-ops.controller.ts — Section 15.5 (wallet
// adjustment) and Section 15.7 (fraud reversal). Distinct from Phase 9's
// admin-payment.controller.ts (Section 14's settle/refund/reconciliation).
import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { writeAuditLog } from "../lib/audit";
import { asyncHandler, AppError, sendValidationError } from "../utils/app-error";
import { deriveRedeemableBalance } from "../utils/wallet-balance";

const adjustmentSchema = z.object({
  workerProfileId: z.string().min(1),
  amount: z.number().positive(),
  direction: z.enum(["CREDIT", "DEBIT"]),
  reason: z.string().min(1).max(500)
});

// Section 15.5 — reason mandatory, Idempotency-Key supported (mounted with
// the idempotent() middleware in admin.routes.ts, the 6th named Section 4.9
// route). CreditTransaction.amount is stored signed (positive for CREDIT,
// negative for DEBIT) so the existing balance-derivation reduce in
// wallet.controller.ts's getWallet/redeemWallet (which only special-cases
// REDEMPTION as a debit) sums this row correctly without modification —
// matching how Section 15.7's reversal is specified as "a negated amount."
export const createWalletAdjustment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = adjustmentSchema.safeParse(req.body);
  if (!parsed.success) {
    if (!(req.body as { reason?: unknown })?.reason) {
      throw new AppError(400, "REASON_REQUIRED", "A reason is required for this action");
    }
    return sendValidationError(req, res, parsed.error);
  }
  const { workerProfileId, amount, direction, reason } = parsed.data;

  const worker = await prisma.workerProfile.findUnique({ where: { id: workerProfileId } });
  if (!worker) {
    throw new AppError(404, "WORKER_NOT_FOUND", "Worker not found");
  }

  const transactionId = await prisma.$transaction(async (tx) => {
    if (direction === "DEBIT") {
      // Section 15.5 — "the same balance-never-goes-negative rule as
      // redemption; an admin cannot force a negative ledger any more than
      // a worker can."
      await tx.$queryRaw`SELECT id FROM worker_profiles WHERE id = ${worker.id} FOR UPDATE`;
      // Same fix as redeemWallet (wallet.controller.ts): must also count
      // already-PROCESSING redemptions, or an admin debit (or a
      // concurrent worker redemption) can be approved against balance
      // that's already committed to an unsettled redemption.
      const relevant = await tx.creditTransaction.findMany({
        where: {
          workerProfileId: worker.id,
          OR: [{ status: "COMPLETED" }, { status: "PROCESSING", type: "REDEMPTION" }]
        }
      });
      const balance = deriveRedeemableBalance(relevant.map((t) => ({ ...t, amount: Number(t.amount) })));
      if (amount > balance) {
        throw new AppError(409, "INSUFFICIENT_BALANCE", "Debit exceeds the worker's current balance");
      }
    }

    const created = await tx.creditTransaction.create({
      data: {
        workerProfileId: worker.id,
        type: "ADJUSTMENT",
        amount: direction === "CREDIT" ? amount : -amount,
        status: "COMPLETED",
        settledAt: new Date()
      }
    });
    await writeAuditLog(tx, {
      actorId: req.user!.id,
      action: "WALLET_ADJUSTMENT",
      entityType: "CreditTransaction",
      entityId: created.id,
      metadata: { reason, direction, amount, workerProfileId: worker.id }
    });
    return created.id;
  });

  return res.json({ transactionId, status: "COMPLETED" });
});

const reversalSchema = z.object({ reason: z.string().min(1).max(500) });

// Section 15.7 — REVERSAL row with reversesTransactionId and a negated amount.
export const reverseCreditTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = reversalSchema.safeParse(req.body);
  if (!parsed.success) {
    if (!(req.body as { reason?: unknown })?.reason) {
      throw new AppError(400, "REASON_REQUIRED", "A reason is required for this action");
    }
    return sendValidationError(req, res, parsed.error);
  }

  const original = await prisma.creditTransaction.findUnique({ where: { id: req.params.id } });
  if (!original) {
    throw new AppError(404, "CREDIT_TRANSACTION_NOT_FOUND", "Credit transaction not found");
  }
  if (original.type === "REVERSAL") {
    throw new AppError(409, "INVALID_STATE", "A reversal cannot itself be reversed");
  }

  // The stored `amount` isn't always the ledger's effective contribution —
  // REDEMPTION is the one legacy type whose balance impact (Section 13.4)
  // is the negation of its stored (always-positive) amount, special-cased
  // in wallet.controller.ts's balance derivation rather than encoded in
  // the row itself. A REVERSAL row carries no such special case, so its
  // stored amount must be the negation of the *effective contribution*,
  // not of the raw field, or reversing a REDEMPTION would silently debit
  // the worker a second time instead of crediting the money back.
  const originalContribution = original.type === "REDEMPTION" ? -Number(original.amount) : Number(original.amount);

  const reversalId = await prisma.$transaction(async (tx) => {
    const created = await tx.creditTransaction.create({
      data: {
        workerProfileId: original.workerProfileId,
        type: "REVERSAL",
        amount: -originalContribution,
        status: "COMPLETED",
        reversesTransactionId: original.id,
        settledAt: new Date()
      }
    });
    await writeAuditLog(tx, {
      actorId: req.user!.id,
      action: "CREDIT_TRANSACTION_REVERSED",
      entityType: "CreditTransaction",
      entityId: created.id,
      metadata: { reason: parsed.data.reason, reversesTransactionId: original.id }
    });
    return created.id;
  });

  return res.json({ reversalId, reversesTransactionId: original.id });
});
