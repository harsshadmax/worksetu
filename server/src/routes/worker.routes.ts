import { Router } from "express";
import { requireProvider } from "../middleware/auth";
import { authenticatedRateLimit } from "../middleware/rate-limit";
import { idempotent } from "../middleware/idempotency";
import * as workerController from "../controllers/worker.controller";

const router = Router();

// Not one of Section 4.9's six named routes (none of those exist until
// PHASE 6/9/11), but the same idempotency middleware applies cleanly to
// any authenticated mutation — demonstrated/verified here ahead of being
// wired onto the real six routes as they're built.
router.patch(
  "/me/availability",
  requireProvider,
  authenticatedRateLimit,
  idempotent("PATCH /workers/me/availability"),
  workerController.updateAvailability
);

export default router;
