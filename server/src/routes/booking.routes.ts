import { Router } from "express";
import { requireCustomer, requireProvider, requireAnyRole } from "../middleware/auth";
import { authenticatedRateLimit } from "../middleware/rate-limit";
import { idempotent } from "../middleware/idempotency";
import * as bookingController from "../controllers/booking.controller";
import { completeBooking } from "../controllers/booking-completion.controller";
import { recordPaymentMethod } from "../controllers/payment.controller";

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
router.patch(
  "/:id/complete",
  requireProvider,
  authenticatedRateLimit,
  idempotent("PATCH /bookings/:id/complete"),
  completeBooking
);
router.post("/:id/payment-method", requireCustomer, authenticatedRateLimit, recordPaymentMethod);

export default router;
