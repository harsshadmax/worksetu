// src/controllers/booking.controller.ts
import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { enqueueDispatch } from "../services/dispatch.service";
import { transitionBookingStatus } from "../services/booking-state-machine.service";
import { io } from "../lib/socket";
import { dispatchNotification } from "../services/notification-dispatcher.service";
import { asyncHandler, AppError, sendValidationError } from "../utils/app-error";
import { paginationQuerySchema, paginate } from "../utils/pagination";
import { haversineKm } from "./location.controller";

export const requestBookingSchema = z.object({
  serviceCategoryId: z.string().min(1),
  location: z.object({
    address: z.string().min(5).max(200),
    lat: z.number().min(6.0).max(37.5),
    lng: z.number().min(68.0).max(97.5)
  }),
  description: z.string().min(10).max(500),
  scheduledAt: z.string().datetime().nullable(),
  urgency: z.enum(["NORMAL", "URGENT"])
});

export const requestBooking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = requestBookingSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(req, res, parsed.error);
  const { serviceCategoryId, location, description, scheduledAt, urgency } = parsed.data;

  const service = await prisma.serviceCategory.findUnique({ where: { id: serviceCategoryId } });
  if (!service || !service.isEnabled) {
    throw new AppError(404, "SERVICE_NOT_FOUND", "Service not found");
  }

  const customerProfile = await prisma.customerProfile.findUnique({ where: { userId: req.user!.id } });
  if (!customerProfile) {
    throw new AppError(404, "CUSTOMER_PROFILE_NOT_FOUND", "Customer profile not found");
  }

  const estimatedTotal = Number(service.baseRate) + Number(service.hourlyRate);

  const bookingId = await prisma.$transaction(async (tx) => {
    const created = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO bookings (
        id, "customerId", "serviceCategoryId", type, description, address,
        "customerLocation", "scheduledAt", urgency, "baseCharge", "hourlyRate",
        "estimatedTotal", status, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), ${customerProfile.id}, ${serviceCategoryId},
        ${scheduledAt ? "SCHEDULED" : "ON_DEMAND"}::"BookingType", ${description}, ${location.address},
        ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326),
        ${scheduledAt}, ${urgency}::"UrgencyLevel", ${service.baseRate}, ${service.hourlyRate},
        ${estimatedTotal}, 'REQUESTED'::"BookingStatus", now(), now()
      )
      RETURNING id
    `;
    const id = created[0].id;

    await tx.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "BOOKING_CREATED",
        entityType: "Booking",
        entityId: id,
        metadata: { serviceCategoryId, urgency }
      }
    });

    return id;
  });

  // Section 12.3 — the customer's currently-connected sockets join this
  // booking's room immediately, so a client already connected when they
  // submit the request (not just one that connects afterward) still
  // receives live dispatch:update events without polling.
  await io.in(`user:${req.user!.id}`).socketsJoin(`booking:${bookingId}`);

  // Fix, not a literal transcription: Section 4.3's illustrative code
  // awaits enqueueDispatch(booking) inline, but enqueueDispatch runs the
  // full top-3 (up to 3x45s) plus pool (120s) sequence internally — an
  // inline await would hang this request for minutes, directly
  // contradicting Section 24.1's <500ms target for this route and Section
  // 1.1.5's "Finding workers" screen, which expects an immediate REQUESTED
  // response followed by live Socket.io phase updates. Fire-and-forget.
  enqueueDispatch(bookingId).catch((err) => console.error("enqueueDispatch failed", err));

  return res.status(201).json({ bookingId, status: "REQUESTED", estimatedTotal });
});

export const getBooking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: {
      customer: true,
      assignedWorker: { include: { user: true, cooperative: true } }
    }
  });

  // Section 7.3 — 404, not 403, for a booking that exists but isn't
  // visible to this requester.
  const isOwnerCustomer = booking?.customer.userId === req.user!.id;
  const isAssignedWorker = booking?.assignedWorker?.user.id === req.user!.id;
  if (!booking || (!isOwnerCustomer && !isAssignedWorker && req.user!.role !== "ADMIN")) {
    throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
  }

  const acceptedDispatch = await prisma.dispatchLog.findFirst({
    where: { bookingId: booking.id, outcome: "ACCEPTED" },
    select: { respondedAt: true }
  });

  // Tracking needs where both ends of the job are. Geometry columns are
  // Unsupported in the Prisma schema, so they come out through the same raw
  // ST_X/ST_Y read the live-operations map already uses -- no second source
  // of worker position.
  const [places] = await prisma.$queryRaw<
    {
      customerLng: number | null;
      customerLat: number | null;
      workerLng: number | null;
      workerLat: number | null;
      lastLocationAt: Date | null;
    }[]
  >`
    SELECT
      ST_X(b."customerLocation") AS "customerLng",
      ST_Y(b."customerLocation") AS "customerLat",
      ST_X(COALESCE(wp."currentLocation", wp."homeLocation")) AS "workerLng",
      ST_Y(COALESCE(wp."currentLocation", wp."homeLocation")) AS "workerLat",
      wp."lastLocationAt" AS "lastLocationAt"
    FROM bookings b
    LEFT JOIN worker_profiles wp ON wp.id = b."assignedWorkerId"
    WHERE b.id = ${booking.id}
  `;

  const hasWorkerPoint =
    places?.workerLat !== null && places?.workerLat !== undefined && places?.workerLng !== null && places?.workerLng !== undefined;
  const hasCustomerPoint =
    places?.customerLat !== null && places?.customerLat !== undefined && places?.customerLng !== null && places?.customerLng !== undefined;
  const distanceKm =
    hasWorkerPoint && hasCustomerPoint
      ? Math.round(haversineKm(places!.workerLat!, places!.workerLng!, places!.customerLat!, places!.customerLng!) * 10) / 10
      : null;

  const timeline = [
    { stage: "REQUESTED", at: booking.createdAt },
    { stage: "ASSIGNED", at: acceptedDispatch?.respondedAt ?? null },
    { stage: "CONFIRMED", at: booking.confirmedAt },
    { stage: "IN_PROGRESS", at: booking.startedAt },
    { stage: "COMPLETED", at: booking.completedAt },
    { stage: "SETTLED", at: booking.settledAt },
    { stage: "CANCELLED", at: booking.cancelledAt }
  ].filter((t) => t.at !== null);

  return res.json({
    id: booking.id,
    status: booking.status,
    // Whether this deployment exposes the demo controls, so the client does
    // not offer a button that 404s in production.
    demoMode: Boolean(Number(process.env.DEMO_AUTO_ACCEPT_SECONDS ?? 0)),
    estimatedTotal: Number(booking.estimatedTotal),
    // What the customer needs to recognise the job on the tracking screen.
    serviceCategoryId: booking.serviceCategoryId,
    description: booking.description,
    address: booking.address,
    urgency: booking.urgency,
    createdAt: booking.createdAt,
    scheduledAt: booking.scheduledAt,
    customerLocation: hasCustomerPoint ? { lat: places!.customerLat, lng: places!.customerLng } : null,
    worker: booking.assignedWorker
      ? {
          id: booking.assignedWorker.id,
          name: booking.assignedWorker.user.fullName,
          phone: booking.assignedWorker.user.phone,
          avatarUrl: booking.assignedWorker.user.avatarUrl,
          cooperative: booking.assignedWorker.cooperative?.name ?? null,
          rating: Number(booking.assignedWorker.ratingAverage),
          ratingCount: booking.assignedWorker.ratingCount,
          availabilityStatus: booking.assignedWorker.availabilityStatus,
          // Null while the worker has never pinged: the client says
          // "location unavailable" rather than inventing a position.
          location: hasWorkerPoint ? { lat: places!.workerLat, lng: places!.workerLng } : null,
          lastLocationAt: places?.lastLocationAt ?? null,
          distanceKm
        }
      : null,
    timeline
  });
});

// Demo mode only (DEMO_AUTO_ACCEPT_SECONDS). The customer-facing "simulate
// next update" control needs the booking to move forward, but the transitions
// after assignment belong to the worker, and the signed-in customer must not
// be able to call worker endpoints. This walks the booking one step along the
// same state machine, for the customer's own booking, and 404s when demo mode
// is off so production exposes nothing.
// Follows the same legal transitions as the state machine: a booking goes
// ASSIGNED -> CONFIRMED (worker on the way) -> IN_PROGRESS -> COMPLETED.
const DEMO_STEP: Partial<Record<string, "CONFIRMED" | "IN_PROGRESS" | "COMPLETED">> = {
  ASSIGNED: "CONFIRMED",
  CONFIRMED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED"
};

export const demoAdvanceBooking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!Number(process.env.DEMO_AUTO_ACCEPT_SECONDS ?? 0)) {
    throw new AppError(404, "ROUTE_NOT_FOUND", "The requested route does not exist");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { customer: true }
  });
  if (!booking || booking.customer.userId !== req.user!.id) {
    throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
  }

  const next = DEMO_STEP[booking.status];
  if (!next) {
    return res.json({ status: booking.status, advanced: false });
  }

  await transitionBookingStatus(booking.id, next);
  const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
  io.to(`booking:${booking.id}`).emit("dispatch:update", { bookingId: booking.id, phase: updated.status });
  return res.json({ status: updated.status, advanced: true });
});

export const listMyBookings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = paginationQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendValidationError(req, res, parsed.error);
  const { page, pageSize } = parsed.data;

  // Filtering through the relation (customer.userId) lets the profile check
  // run alongside the list queries instead of costing its own round trip
  // first; the 404 for a missing profile is unchanged.
  const where = { customer: { userId: req.user!.id } };
  const [customerProfile, items, totalCount] = await Promise.all([
    prisma.customerProfile.findUnique({ where: { userId: req.user!.id }, select: { id: true } }),
    prisma.booking.findMany({
      where,
      include: { assignedWorker: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.booking.count({ where })
  ]);
  if (!customerProfile) {
    throw new AppError(404, "CUSTOMER_PROFILE_NOT_FOUND", "Customer profile not found");
  }

  return res.json(
    paginate(
      items.map((b) => ({
        id: b.id,
        status: b.status,
        serviceCategoryId: b.serviceCategoryId,
        description: b.description,
        estimatedTotal: Number(b.estimatedTotal),
        workerName: b.assignedWorker?.user.fullName ?? null,
        createdAt: b.createdAt
      })),
      page,
      pageSize,
      totalCount
    )
  );
});

const cancelSchema = z.object({ reason: z.string().max(500).optional() });
const CANCELLABLE_STATUSES = ["REQUESTED", "DISPATCHING_TOP3", "DISPATCHING_POOL", "ASSIGNED", "CONFIRMED"] as const;

export const cancelBooking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = cancelSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(req, res, parsed.error);

  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { customer: true, assignedWorker: { include: { user: true } } }
  });

  const isOwnerCustomer = booking?.customer.userId === req.user!.id;
  const isAssignedWorker = booking?.assignedWorker?.user.id === req.user!.id;
  if (!booking || (!isOwnerCustomer && !isAssignedWorker)) {
    throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
  }
  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(booking.status)) {
    throw new AppError(409, "INVALID_STATE", "This booking can no longer be cancelled");
  }

  await prisma.$transaction(async (tx) => {
    await transitionBookingStatus(booking.id, "CANCELLED", tx);
    if (parsed.data.reason) {
      await tx.booking.update({ where: { id: booking.id }, data: { cancelReason: parsed.data.reason } });
    }
    if (booking.assignedWorkerId) {
      await tx.workerProfile.update({
        where: { id: booking.assignedWorkerId },
        data: { availabilityStatus: "AVAILABLE", currentBookingId: null }
      });
    }
  });

  // Section 11.1 — "the other party notified". Whichever side did not
  // initiate the cancellation hears about it; a worker on a booking still
  // in REQUESTED/DISPATCHING_* (not yet assigned) has nothing to notify.
  if (isOwnerCustomer && booking.assignedWorker) {
    await dispatchNotification({
      userId: booking.assignedWorker.user.id,
      title: "Booking cancelled",
      body: "The customer has cancelled this booking.",
      dedupeKey: `booking:${booking.id}:cancelled`
    });
  } else if (isAssignedWorker) {
    await dispatchNotification({
      userId: booking.customer.userId,
      title: "Booking cancelled",
      body: "The assigned worker has cancelled this booking.",
      dedupeKey: `booking:${booking.id}:cancelled`
    });
  }

  return res.json({ bookingId: booking.id, status: "CANCELLED" });
});

export const startBooking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { assignedWorker: { include: { user: true } } }
  });
  if (!booking || booking.assignedWorker?.user.id !== req.user!.id) {
    throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
  }
  if (booking.status !== "CONFIRMED") {
    throw new AppError(409, "INVALID_STATE", "Booking is not ready to start");
  }
  await transitionBookingStatus(booking.id, "IN_PROGRESS");
  return res.json({ bookingId: booking.id, status: "IN_PROGRESS" });
});

export const getIncomingOffers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const [worker, offers, config] = await Promise.all([
    prisma.workerProfile.findUnique({ where: { userId: req.user!.id }, select: { id: true } }),
    prisma.dispatchLog.findMany({
      where: { worker: { userId: req.user!.id }, outcome: "OFFERED" },
      include: { booking: true },
      orderBy: { offeredAt: "desc" }
    }),
    prisma.platformConfig.findUnique({ where: { id: 1 } })
  ]);
  if (!worker) {
    throw new AppError(404, "WORKER_PROFILE_NOT_FOUND", "Worker profile not found");
  }
  const top3Timeout = config?.top3TimeoutSeconds ?? 45;
  const poolTimeout = config?.poolTimeoutSeconds ?? 120;

  return res.json(
    offers.map((o) => ({
      dispatchLogId: o.id,
      bookingId: o.bookingId,
      serviceCategory: o.booking.serviceCategoryId,
      customerAreaLabel: o.booking.address,
      distanceKm: o.distanceKm,
      estimatedTotal: Number(o.booking.estimatedTotal),
      offerExpiresAt: new Date(o.offeredAt.getTime() + (o.attemptNumber === "POOL" ? poolTimeout : top3Timeout) * 1000)
    }))
  );
});

// Naive travel-time estimate for the active-job dashboard card — this app
// has no routing/traffic API (out of scope, see CLAUDE.md), so this is
// straight-line haversine distance at an assumed flat urban average speed,
// not a real ETA. Clearly a rough estimate, not fabricated: it's a
// disclosed, documented approximation derived from real coordinates,
// consistently recomputed from the same two GPS points routing/dispatch
// already uses elsewhere in this file.
const ASSUMED_AVG_SPEED_KMH = 20;

export const getMyWorkerBookings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = paginationQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendValidationError(req, res, parsed.error);
  const { page, pageSize } = parsed.data;

  const where = { assignedWorker: { userId: req.user!.id } };
  const [worker, items, totalCount] = await Promise.all([
    prisma.workerProfile.findUnique({ where: { userId: req.user!.id }, select: { id: true } }),
    prisma.booking.findMany({
      where,
      include: { customer: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.booking.count({ where })
  ]);
  if (!worker) {
    throw new AppError(404, "WORKER_PROFILE_NOT_FOUND", "Worker profile not found");
  }

  // Distance/navigation/contact info is only meaningful (and only shown by
  // the frontend) for a currently-active assignment, so it's computed just
  // for those rows rather than the whole paginated history.
  const activeIds = items.filter((b) => ["ASSIGNED", "CONFIRMED", "IN_PROGRESS"].includes(b.status)).map((b) => b.id);
  const activeLocations =
    activeIds.length > 0
      ? await prisma.$queryRaw<{ id: string; lng: number; lat: number; workerLng: number | null; workerLat: number | null }[]>`
          SELECT b.id, ST_X(b."customerLocation") AS lng, ST_Y(b."customerLocation") AS lat,
                 ST_X(wp."currentLocation") AS "workerLng", ST_Y(wp."currentLocation") AS "workerLat"
          FROM bookings b
          JOIN worker_profiles wp ON wp.id = ${worker.id}
          WHERE b.id = ANY(${activeIds})
        `
      : [];
  const locationById = new Map(activeLocations.map((r) => [r.id, r]));

  return res.json(
    paginate(
      items.map((b) => {
        const loc = locationById.get(b.id);
        const hasBothPoints = loc && loc.workerLat !== null && loc.workerLng !== null;
        const distanceKm = hasBothPoints ? haversineKm(loc!.workerLat!, loc!.workerLng!, loc!.lat, loc!.lng) : null;
        return {
          id: b.id,
          status: b.status,
          serviceCategoryId: b.serviceCategoryId,
          description: b.description,
          estimatedTotal: Number(b.estimatedTotal),
          customerName: b.customer.user.fullName,
          customerPhone: b.customer.user.phone,
          createdAt: b.createdAt,
          location: loc ? { lat: loc.lat, lng: loc.lng } : null,
          distanceKm: distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null,
          estTravelMinutes: distanceKm !== null ? Math.max(1, Math.round((distanceKm / ASSUMED_AVG_SPEED_KMH) * 60)) : null
        };
      }),
      page,
      pageSize,
      totalCount
    )
  );
});
