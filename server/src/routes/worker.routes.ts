import { Router } from "express";
import { requireProvider } from "../middleware/auth";
import { authenticatedRateLimit } from "../middleware/rate-limit";
import { idempotent } from "../middleware/idempotency";
import * as workerController from "../controllers/worker.controller";
import { getIncomingOffers, getMyWorkerBookings } from "../controllers/booking.controller";

const router = Router();

// Not one of Section 4.9's six named routes, but the same idempotency
// middleware applies cleanly to any authenticated mutation — first
// demonstrated here in PHASE 4, ahead of PHASE 6 wiring it onto two of
// the real six routes below (POST /bookings/request, POST /dispatch/respond).
router.patch(
  "/me/availability",
  requireProvider,
  authenticatedRateLimit,
  idempotent("PATCH /workers/me/availability"),
  workerController.updateAvailability
);

router.get("/me/demand-heatmap", requireProvider, authenticatedRateLimit, workerController.getDemandHeatmap);
router.get("/me/welfare", requireProvider, authenticatedRateLimit, workerController.getWelfare);
router.get("/me/incoming", requireProvider, authenticatedRateLimit, getIncomingOffers);
router.get("/me/bookings", requireProvider, authenticatedRateLimit, getMyWorkerBookings);

export default router;
