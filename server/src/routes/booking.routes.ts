import { Router } from "express";
import { requireCustomer, requireProvider, requireAnyRole } from "../middleware/auth";
import { authenticatedRateLimit } from "../middleware/rate-limit";
import { idempotent } from "../middleware/idempotency";
import * as bookingController from "../controllers/booking.controller";

const router = Router();

router.post(
  "/request",
  requireCustomer,
  authenticatedRateLimit,
  idempotent("POST /bookings/request"),
  bookingController.requestBooking
);
router.get("/:id", requireAnyRole, authenticatedRateLimit, bookingController.getBooking);
router.post("/:id/cancel", requireAnyRole, authenticatedRateLimit, bookingController.cancelBooking);
router.patch("/:id/start", requireProvider, authenticatedRateLimit, bookingController.startBooking);

export default router;
