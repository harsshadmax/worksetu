// src/services/dispatch.service.ts
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis-lock";
import { scoreCandidateWorkers } from "./continuity-scoring.service";
import { io } from "../lib/socket";
import { dispatchNotification } from "./notification-dispatcher.service";
import { transitionBookingStatus } from "./booking-state-machine.service";
import { log } from "../lib/logger";

// Phase-13 finding: an async setTimeout/setInterval callback that throws
// (e.g. a transient DB blip — this environment's Supabase pooler is known
// to drop connections intermittently) becomes an unhandled promise
// rejection with no global handler anywhere in the app, which crashes the
// entire Node process by default. These timers fire on every single
// dispatch offer (every booking, every candidate, every 45s/120s
// timeout), so this was a live, repeatedly-triggered crash risk, not a
// theoretical one — confirmed by the integration test server going down
// mid-suite and never coming back. Every async timer callback in this
// file is wrapped so a transient failure is logged, not fatal.
function safeAsyncTimer(fn: () => Promise<void>, context: string, onError?: () => void): () => void {
  return () => {
    fn().catch((err) => {
      log({ level: "error", message: `Unhandled error in ${context}: ${err instanceof Error ? err.message : String(err)}` });
      onError?.();
    });
  };
}

const MAX_SEARCH_RADIUS_KM = 15;

// Deviation from the literal Section 4.4.3 listing, flagged: that code
// hardcoded TOP3_OFFER_TIMEOUT_SECONDS=45 / POOL_OFFER_TIMEOUT_SECONDS=120
// as module constants, even though Section 3's PlatformConfig model exists
// specifically to hold these same two values (top3TimeoutSeconds,
// poolTimeoutSeconds) so an admin can change them via PATCH /admin/config
// (Section 1.3.11/15.6). Hardcoding would make that entire admin feature a
// silent no-op. Reading live from PlatformConfig instead, with the same
// 45/120 values as the fallback default if the config row is somehow
// missing. acquireBookingLock is unaffected — that's not config-adjustable.
async function getDispatchTimeouts(): Promise<{ top3: number; pool: number }> {
  const config = await prisma.platformConfig.findUnique({ where: { id: 1 } });
  return { top3: config?.top3TimeoutSeconds ?? 45, pool: config?.poolTimeoutSeconds ?? 120 };
}

// Section 11.1/11.2 — the accept transition itself, independent of who asked
// for it. The HTTP handler calls this after its own auth and lock checks; the
// demo timer below calls it on a seeded worker's behalf. Keeping one
// implementation means demo bookings move through the real state machine and
// produce the same rows, sockets and notifications as live ones.
export async function acceptDispatchOffer(dispatchLogId: string, actorUserId: string): Promise<void> {
  const dispatchLog = await prisma.dispatchLog.findUniqueOrThrow({ where: { id: dispatchLogId } });

  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: dispatchLog.bookingId } });
    if (booking.assignedWorkerId) {
      throw new Error("ALREADY_ASSIGNED");
    }
    await tx.dispatchLog.update({
      where: { id: dispatchLog.id },
      data: { outcome: "ACCEPTED", respondedAt: new Date() }
    });
    await tx.booking.update({
      where: { id: dispatchLog.bookingId },
      data: { status: "ASSIGNED", assignedWorkerId: dispatchLog.workerId, lockExpiresAt: null }
    });
    await tx.workerProfile.update({
      where: { id: dispatchLog.workerId },
      data: { availabilityStatus: "ON_JOB", currentBookingId: dispatchLog.bookingId }
    });
    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        action: "BOOKING_ACCEPTED",
        entityType: "Booking",
        entityId: dispatchLog.bookingId
      }
    });
  });

  await redis.publish(`dispatch-response:${dispatchLog.id}`, "ACCEPTED");
  io.to(`booking:${dispatchLog.bookingId}`).emit("dispatch:update", {
    bookingId: dispatchLog.bookingId,
    phase: "ASSIGNED",
    candidateStatus: { workerId: dispatchLog.workerId, offerStatus: "ACCEPTED" }
  });

  const assignedBooking = await prisma.booking.findUnique({
    where: { id: dispatchLog.bookingId },
    include: { customer: true, assignedWorker: { include: { user: true } } }
  });
  if (assignedBooking) {
    await dispatchNotification({
      userId: assignedBooking.customer.userId,
      title: "Worker assigned",
      body: `${assignedBooking.assignedWorker?.user.fullName ?? "A cooperative worker"} has been assigned to your booking.`,
      dedupeKey: `booking:${dispatchLog.bookingId}:assigned`
    });
  }

  // Auto-confirm after 60s unless the customer cancels first (Section 11.4's
  // sweep is the durability backstop for this same transition).
  setTimeout(() => {
    transitionBookingStatus(dispatchLog.bookingId, "CONFIRMED").catch(() => {});
  }, 60000);
}

// Demo mode only. Seeded workers have no one tapping "accept", so a dispatch
// would always run its offers down to a timeout and cancel. With
// DEMO_AUTO_ACCEPT_SECONDS set, the first offered candidate accepts after that
// delay -- through acceptDispatchOffer above, so the booking, dispatch log,
// worker status, notification and sockets are all the real ones. Unset in
// production, this does nothing.
const DEMO_AUTO_ACCEPT_SECONDS = Number(process.env.DEMO_AUTO_ACCEPT_SECONDS ?? 0);

function scheduleDemoAutoAccept(dispatchLogId: string, workerProfileId: string): void {
  if (!DEMO_AUTO_ACCEPT_SECONDS || DEMO_AUTO_ACCEPT_SECONDS <= 0) return;
  setTimeout(async () => {
    try {
      const log = await prisma.dispatchLog.findUnique({ where: { id: dispatchLogId } });
      if (!log || log.outcome !== "OFFERED") return; // a real response won the race
      const worker = await prisma.workerProfile.findUnique({ where: { id: workerProfileId } });
      if (!worker) return;
      await acceptDispatchOffer(dispatchLogId, worker.userId);
    } catch {
      // A demo convenience must never take the dispatch engine down with it.
    }
  }, DEMO_AUTO_ACCEPT_SECONDS * 1000);
}

// Demo mode only. Candidate selection requires a location ping inside the
// last 120 seconds (continuity-scoring.service.ts), which is right for live
// use but means seeded workers fall out of every search two minutes after the
// seed runs, so "finding a worker" could never succeed in a demo. This keeps
// approved, available seeded workers marked as present. Unset in production,
// nothing runs and presence stays earned by real pings.
export function startDemoPresenceHeartbeat(): void {
  if (!DEMO_AUTO_ACCEPT_SECONDS || DEMO_AUTO_ACCEPT_SECONDS <= 0) return;
  const refresh = async () => {
    await prisma.$executeRaw`
      UPDATE worker_profiles
      SET "lastLocationAt" = now()
      WHERE "verificationStatus" = 'APPROVED'
        AND "availabilityStatus" = 'AVAILABLE'
        AND "currentLocation" IS NOT NULL
    `.catch(() => undefined);
  };
  refresh();
  setInterval(refresh, 60_000);
}

export async function enqueueDispatch(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { customer: true }
  });

  const [lng, lat] = await getBookingCoordinates(bookingId);
  const { top3: TOP3_OFFER_TIMEOUT_SECONDS, pool: POOL_OFFER_TIMEOUT_SECONDS } = await getDispatchTimeouts();

  const candidates = await scoreCandidateWorkers({
    serviceCategoryId: booking.serviceCategoryId,
    customerId: booking.customerId,
    lng,
    lat,
    maxRadiusKm: MAX_SEARCH_RADIUS_KM
  });

  await transitionBookingStatus(bookingId, "DISPATCHING_TOP3");

  const top3 = candidates.slice(0, 3);
  const pool = candidates.slice(3);

  await runSequentialOfferQueue(bookingId, top3, "TOP3", TOP3_OFFER_TIMEOUT_SECONDS);

  const stillOpen = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (stillOpen && stillOpen.status === "DISPATCHING_TOP3") {
    await transitionBookingStatus(bookingId, "DISPATCHING_POOL");
    await runBroadcastOfferPool(bookingId, pool, POOL_OFFER_TIMEOUT_SECONDS);
  }
}

async function runSequentialOfferQueue(
  bookingId: string,
  candidates: { workerId: string; distanceKm: number; continuityScore: number }[],
  phaseLabel: "TOP3",
  timeoutSeconds: number
): Promise<void> {
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const attemptNumber = (["ATTEMPT_1", "ATTEMPT_2", "ATTEMPT_3"] as const)[i];

    const dispatchLog = await prisma.dispatchLog.create({
      data: {
        bookingId,
        workerId: candidate.workerId,
        attemptNumber,
        distanceKm: candidate.distanceKm,
        continuityScore: candidate.continuityScore,
        outcome: "OFFERED"
      }
    });

    // Section 12.3 — a worker's currently-connected sockets join the
    // booking room the moment they're offered it (not just at their own
    // connect-time snapshot, since this offer may be created well after
    // they connected).
    await io.in(`worker:${candidate.workerId}`).socketsJoin(`booking:${bookingId}`);

    io.to(`worker:${candidate.workerId}`).emit("dispatch:offer", {
      dispatchLogId: dispatchLog.id,
      bookingId,
      phase: phaseLabel,
      offerExpiresInSeconds: timeoutSeconds
    });
    scheduleDemoAutoAccept(dispatchLog.id, candidate.workerId);
    io.to(`booking:${bookingId}`).emit("dispatch:update", {
      bookingId,
      phase: phaseLabel,
      candidateStatus: { workerId: candidate.workerId, offerStatus: "WAITING" }
    });

    const outcome = await waitForResponseOrTimeout(dispatchLog.id, timeoutSeconds);

    if (outcome === "ACCEPTED") {
      return; // acceptBooking() already transitioned status inside the respond handler
    }
    // DECLINED or TIMEOUT: continue to the next candidate in the sequence
  }
}

async function runBroadcastOfferPool(
  bookingId: string,
  pool: { workerId: string; distanceKm: number; continuityScore: number }[],
  timeoutSeconds: number
): Promise<void> {
  const dispatchLogs = await prisma.$transaction(
    pool.map((candidate) =>
      prisma.dispatchLog.create({
        data: {
          bookingId,
          workerId: candidate.workerId,
          attemptNumber: "POOL",
          distanceKm: candidate.distanceKm,
          continuityScore: candidate.continuityScore,
          outcome: "OFFERED"
        }
      })
    )
  );

  for (const candidate of pool) {
    await io.in(`worker:${candidate.workerId}`).socketsJoin(`booking:${bookingId}`);
    io.to(`worker:${candidate.workerId}`).emit("dispatch:offer", {
      bookingId,
      phase: "POOL",
      offerExpiresInSeconds: timeoutSeconds
    });
  }
  io.to(`booking:${bookingId}`).emit("dispatch:update", {
    bookingId,
    phase: "POOL",
    candidates: pool.map((c) => ({ workerId: c.workerId, offerStatus: "WAITING" }))
  });

  // Demo mode: the nearest pool candidate takes the job, same as the
  // sequential path above.
  if (dispatchLogs.length > 0) {
    scheduleDemoAutoAccept(dispatchLogs[0].id, dispatchLogs[0].workerId);
  }

  await new Promise<void>((resolve) => {
    const pollInterval = setInterval(
      safeAsyncTimer(async () => {
        const current = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!current || current.status !== "DISPATCHING_POOL") {
          clearInterval(pollInterval);
          resolve();
        }
      }, "runBroadcastOfferPool poll"),
      2000
    );
    setTimeout(
      safeAsyncTimer(
        async () => {
          clearInterval(pollInterval);
          const current = await prisma.booking.findUnique({ where: { id: bookingId } });
          if (current && current.status === "DISPATCHING_POOL") {
            await prisma.dispatchLog.updateMany({
              where: { id: { in: dispatchLogs.map((d) => d.id) }, outcome: "OFFERED" },
              data: { outcome: "TIMEOUT", respondedAt: new Date() }
            });
            await transitionBookingStatus(bookingId, "CANCELLED");
            io.to(`booking:${bookingId}`).emit("dispatch:exhausted", { bookingId });
          }
          resolve();
        },
        "runBroadcastOfferPool timeout",
        // This is the terminal fallback for the whole wait — if it
        // itself throws (e.g. a transient DB blip mid-write), the
        // awaiting caller must still be unblocked rather than hang
        // forever waiting on a promise nothing will ever resolve.
        resolve
      ),
      timeoutSeconds * 1000
    );
  });
}

function waitForResponseOrTimeout(dispatchLogId: string, timeoutSeconds: number): Promise<"ACCEPTED" | "DECLINED" | "TIMEOUT"> {
  return new Promise((resolve) => {
    const channel = `dispatch-response:${dispatchLogId}`;
    const subscriber = redis.duplicate();
    let settled = false;

    // Self-protecting: every caller below fires this without awaiting it
    // (a pub/sub message handler, a timer callback), so it must never
    // throw — resolve() is this whole promise's only way out, and a
    // transient Redis error unsubscribing/disconnecting must not prevent
    // it from firing.
    const finish = async (outcome: "ACCEPTED" | "DECLINED" | "TIMEOUT") => {
      if (settled) return;
      settled = true;
      try {
        await subscriber.unsubscribe(channel);
        subscriber.disconnect();
      } catch (err) {
        log({ level: "error", message: `dispatch subscriber cleanup failed: ${err instanceof Error ? err.message : String(err)}` });
      }
      resolve(outcome);
    };

    subscriber.subscribe(channel, () => {
      subscriber.on("message", (_chan, message) => {
        finish(message as "ACCEPTED" | "DECLINED");
      });
    });

    setTimeout(
      safeAsyncTimer(
        async () => {
          await prisma.dispatchLog.updateMany({
            where: { id: dispatchLogId, outcome: "OFFERED" },
            data: { outcome: "TIMEOUT", respondedAt: new Date() }
          });
          finish("TIMEOUT");
        },
        "waitForResponseOrTimeout",
        () => finish("TIMEOUT")
      ),
      timeoutSeconds * 1000
    );
  });
}

async function getBookingCoordinates(bookingId: string): Promise<[number, number]> {
  const rows = await prisma.$queryRaw<{ lng: number; lat: number }[]>`
    SELECT ST_X("customerLocation") AS lng, ST_Y("customerLocation") AS lat
    FROM bookings WHERE id = ${bookingId}
  `;
  return [rows[0].lng, rows[0].lat];
}
