import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { getOrSetCache } from "../lib/cache";
import { asyncHandler, AppError, sendValidationError } from "../utils/app-error";

const availabilitySchema = z.object({ status: z.enum(["AVAILABLE", "OFF_DUTY"]) });

export const updateAvailability = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = availabilitySchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(req, res, parsed.error);

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

// Section 1.2.6 — PostGIS ST_ClusterKMeans aggregation over open REQUESTED
// bookings within the worker's service-area radius. k is resolved to a
// concrete integer (min(5, eligible count)) before being interpolated as a
// bound parameter — ST_ClusterKMeans's cluster-count argument must be a
// single fixed value for the whole partition, which a bound param already
// is; this is not string concatenation (Section 9 threat #4).
export const getDemandHeatmap = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Profile existence, service radius and current location come back in one
  // query (previously two round trips). The computed clusters are cached for
  // 60s per worker: this is a coarse demand overview polled on every
  // dashboard visit, and the clustering runs three more queries.
  const workerRows = await prisma.$queryRaw<{ id: string; serviceAreaRadiusKm: number; lng: number | null; lat: number | null }[]>`
    SELECT id, "serviceAreaRadiusKm", ST_X("currentLocation") AS lng, ST_Y("currentLocation") AS lat
    FROM worker_profiles WHERE "userId" = ${req.user!.id}
  `;
  if (workerRows.length === 0) {
    throw new AppError(404, "WORKER_PROFILE_NOT_FOUND", "Worker profile not found");
  }
  const worker = workerRows[0];
  if (worker.lng === null || worker.lat === null) {
    return res.json([]);
  }
  const { lng, lat } = worker;
  const radiusMeters = worker.serviceAreaRadiusKm * 1000;

  const cells = await getOrSetCache(`cache:demand-heatmap:${worker.id}:${lng}:${lat}:${radiusMeters}`, 60, () =>
    computeDemandCells(lng, lat, radiusMeters)
  );
  return res.json(cells);
});

async function computeDemandCells(lng: number, lat: number, radiusMeters: number) {

  const countRows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count
    FROM bookings b
    WHERE b.status = 'REQUESTED'
      AND ST_DWithin(b."customerLocation"::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})
  `;
  const openCount = Number(countRows[0].count);
  if (openCount === 0) {
    return [];
  }
  const k = Math.min(5, openCount);

  const clusters = await prisma.$queryRaw<
    { cellId: number; lng: number; lat: number; openRequests: bigint; avgUrgencyScore: number }[]
  >`
    WITH nearby AS (
      SELECT b.id, b."customerLocation",
        CASE b.urgency WHEN 'URGENT' THEN 2 ELSE 1 END AS urgency_score
      FROM bookings b
      WHERE b.status = 'REQUESTED'
        AND ST_DWithin(b."customerLocation"::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})
    ),
    clustered AS (
      SELECT *, ST_ClusterKMeans("customerLocation", ${k}::int) OVER () AS cluster_id
      FROM nearby
    )
    SELECT
      cluster_id AS "cellId",
      ST_X(ST_Centroid(ST_Collect("customerLocation"))) AS lng,
      ST_Y(ST_Centroid(ST_Collect("customerLocation"))) AS lat,
      COUNT(*) AS "openRequests",
      AVG(urgency_score) AS "avgUrgencyScore"
    FROM clustered
    GROUP BY cluster_id
  `;

  return clusters.map((c) => ({
    cellId: String(c.cellId),
    centroid: { lat: c.lat, lng: c.lng },
    openRequests: Number(c.openRequests),
    avgUrgencyScore: Number(c.avgUrgencyScore)
  }));
}

// Section 1.2.7 — read-only aggregation over the worker's own completed
// jobs; no persistent write unless a WelfareAlert threshold is crossed
// (Section 12.7's AuditLog hook is not wired here since no threshold-cross
// event exists yet without a real-time job stream — PHASE 7/8 territory).
export const getWelfare = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const [worker, completedJobs] = await Promise.all([
    prisma.workerProfile.findUnique({ where: { userId: req.user!.id }, select: { id: true } }),
    prisma.booking.findMany({
      where: {
        assignedWorker: { userId: req.user!.id },
        status: { in: ["COMPLETED", "SETTLED"] },
        startedAt: { not: null },
        completedAt: { not: null }
      },
      select: { startedAt: true, completedAt: true }
    })
  ]);
  if (!worker) {
    throw new AppError(404, "WORKER_PROFILE_NOT_FOUND", "Worker profile not found");
  }

  function hoursWorkedSince(cutoff: Date): number {
    return completedJobs
      .filter((j) => j.completedAt! >= cutoff)
      .reduce((sum, j) => sum + (j.completedAt!.getTime() - j.startedAt!.getTime()) / 3600000, 0);
  }

  const hoursWorkedToday = Math.round(hoursWorkedSince(startOfToday) * 100) / 100;
  const hoursWorkedThisWeek = Math.round(hoursWorkedSince(startOfWeek) * 100) / 100;

  const completedDays = new Set(completedJobs.map((j) => j.completedAt!.toISOString().slice(0, 10)));
  let consecutiveJobStreak = 0;
  const cursor = new Date(startOfToday);
  while (completedDays.has(cursor.toISOString().slice(0, 10))) {
    consecutiveJobStreak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // No fixed threshold is specified in the PRD for this alert; 8h/day is a
  // reasonable, documented working-hours guideline used here.
  const restRecommended = hoursWorkedToday >= 8;

  return res.json({ hoursWorkedToday, hoursWorkedThisWeek, consecutiveJobStreak, restRecommended });
});

export const getIncentives = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Nothing else in the app ever transitions a row out of PENDING once its
  // deadline passes, so a self-heal here keeps status accurate without a
  // separate cron sweep — same read-time-freshness pattern used for OTP
  // expiry and wallet balance derivation elsewhere in this codebase.
  // The profile check runs alongside the self-heal; the read must still
  // wait for the self-heal so it sees the updated statuses.
  const [worker] = await Promise.all([
    prisma.workerProfile.findUnique({ where: { userId: req.user!.id }, select: { id: true } }),
    prisma.incentiveProgress.updateMany({
      where: { workerProfile: { userId: req.user!.id }, status: "PENDING", expiry: { lt: new Date() } },
      data: { status: "EXPIRED" }
    })
  ]);
  if (!worker) {
    throw new AppError(404, "WORKER_PROFILE_NOT_FOUND", "Worker profile not found");
  }

  const incentives = await prisma.incentiveProgress.findMany({
    where: { workerProfileId: worker.id },
    orderBy: { expiry: "asc" }
  });

  return res.json(incentives);
});
