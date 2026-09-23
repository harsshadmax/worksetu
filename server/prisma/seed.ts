// prisma/seed.ts — Worksetu demo dataset (Section 19.3, 21.5, 15.9)
//
// The dataset itself lives in prisma/seed-data.ts: one cooperative network of
// customers, workers and bookings from which every other record here is
// derived -- invoices from the booking, payouts and feedback credits from the
// invoice, worker ratings from the reviews actually written, notifications
// from what happened on those bookings. Nothing is written per screen, so a
// dashboard total and the table under it cannot disagree. Every Booking
// lifecycle stage (Section 1.0) is represented at least once, per Section
// 19.3. Re-runnable: clears its own
// seed-owned tables in FK-safe order before re-inserting, so this same
// script backs POST /api/v1/admin/demo/reset (Section 15.9).

import { PrismaClient, VerificationStatus, ProficiencyLevel, BookingStatus, DispatchAttempt, DispatchOutcome, PaymentMethod, CreditTransactionType, CreditTransactionStatus, PayoutMethod, SettlementStatus, IncentiveStatus, NotificationAudience } from "@prisma/client";
import bcrypt from "bcrypt";
import { customers as customerSeeds, workers as workerSeeds, buildBookings } from "./seed-data";

const prisma = new PrismaClient();
const BCRYPT_COST = 12;
const COMMISSION_PERCENT = 15.0;
const FEEDBACK_CREDIT_SHARE = 0.2;

// Relative dates, so the demo always looks like it has been running for
// months no matter when it was seeded.
const SEED_RUN_AT = new Date();
function daysBefore(days: number, hour?: number, minute?: number): Date {
  const d = new Date(SEED_RUN_AT.getTime() - days * 24 * 60 * 60 * 1000);
  if (hour !== undefined) d.setHours(hour, minute ?? 0, 0, 0);
  return d;
}
function minutesAfter(from: Date, minutes: number): Date {
  return new Date(from.getTime() + minutes * 60 * 1000);
}
function formatMoney(amount: number): string {
  return "\u20b9" + Math.round(amount).toLocaleString("en-IN");
}
// Straight-line distance, matching the dispatch engine's own haversine.
function distanceKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function hash(pw: string): Promise<string> {
  return bcrypt.hash(pw, BCRYPT_COST);
}

async function setPoint(table: "customer_profiles" | "worker_profiles", column: string, id: string, lng: number, lat: number) {
  await prisma.$executeRawUnsafe(
    `UPDATE ${table} SET "${column}" = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
    lng,
    lat,
    id
  );
}

async function setWorkerLocations(workerProfileId: string, lng: number, lat: number) {
  await prisma.$executeRaw`
    UPDATE worker_profiles
    SET "homeLocation" = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
        "currentLocation" = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
        "lastLocationAt" = now()
    WHERE id = ${workerProfileId}
  `;
}

interface InsertBookingParams {
  customerId: string;
  serviceCategoryId: string;
  description: string;
  address: string;
  lng: number;
  lat: number;
  scheduledAt: Date | null;
  urgency: "NORMAL" | "URGENT";
  baseCharge: number;
  hourlyRate: number;
  estimatedTotal: number;
  status: BookingStatus;
  assignedWorkerId?: string | null;
  confirmedAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  settledAt?: Date | null;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
  createdAt: Date;
}

async function insertBooking(p: InsertBookingParams): Promise<string> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO bookings (
      id, "customerId", "serviceCategoryId", type, description, address,
      "customerLocation", "scheduledAt", urgency, "baseCharge", "hourlyRate",
      "estimatedTotal", status, "assignedWorkerId", "confirmedAt", "startedAt",
      "completedAt", "settledAt", "cancelledAt", "cancelReason", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), ${p.customerId}, ${p.serviceCategoryId},
      ${p.scheduledAt ? "SCHEDULED" : "ON_DEMAND"}::"BookingType", ${p.description}, ${p.address},
      ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326),
      ${p.scheduledAt}, ${p.urgency}::"UrgencyLevel", ${p.baseCharge}, ${p.hourlyRate},
      ${p.estimatedTotal}, ${p.status}::"BookingStatus", ${p.assignedWorkerId ?? null},
      ${p.confirmedAt ?? null}, ${p.startedAt ?? null}, ${p.completedAt ?? null},
      ${p.settledAt ?? null}, ${p.cancelledAt ?? null}, ${p.cancelReason ?? null},
      ${p.createdAt}, now()
    )
    RETURNING id
  `;
  return rows[0].id;
}

async function clearSeedOwnedData() {
  // Reverse dependency order — safe to re-run (Section 15.9 demo reset).
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.settlementRecord.deleteMany();
  await prisma.creditTransaction.deleteMany();
  await prisma.feedbackCredit.deleteMany();
  await prisma.incentiveProgress.deleteMany();
  await prisma.review.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.dispatchLog.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.certification.deleteMany();
  await prisma.document.deleteMany();
  await prisma.workerSkill.deleteMany();
  await prisma.workerProfile.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.adminProfile.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.otpVerification.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.user.deleteMany();
  await prisma.serviceCategory.deleteMany();
  await prisma.skillCategory.deleteMany();
  await prisma.cooperative.deleteMany();
}

async function main() {
  console.log("Clearing prior seed data...");
  await clearSeedOwnedData();

  console.log("Platform config...");
  await prisma.platformConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, commissionPercent: COMMISSION_PERCENT, top3TimeoutSeconds: 45, poolTimeoutSeconds: 120 }
  });

  console.log("Cooperatives...");
  const cooperativeData = [
    { id: "coop-1", name: "Chennai Skilled Workers Cooperative", location: "Chennai", registrationNumber: "TN/COOP/2018/0114", members: 340, founded: 2018, dividendSharePercent: 12 },
    { id: "coop-2", name: "Delhi Household & Labor Union", location: "Delhi", registrationNumber: "DL/COOP/2015/0089", members: 520, founded: 2015, dividendSharePercent: 10 },
    { id: "coop-3", name: "Mumbai Community & Caregivers Society", location: "Mumbai", registrationNumber: "MH/COOP/2020/0231", members: 280, founded: 2020, dividendSharePercent: 15 },
    { id: "coop-4", name: "Bangalore Technicians Cooperative Board", location: "Bangalore", registrationNumber: "KA/COOP/2017/0176", members: 410, founded: 2017, dividendSharePercent: 8 }
  ];
  for (const c of cooperativeData) {
    await prisma.cooperative.create({ data: c });
  }

  console.log("Service categories + matching skill categories...");
  const serviceData = [
    { id: "plumbing", translationKey: "plumbing", baseRate: 250, hourlyRate: 150, icon: "wrench" },
    { id: "electrical", translationKey: "electrical", baseRate: 300, hourlyRate: 200, icon: "zap" },
    { id: "carpentry", translationKey: "carpentry", baseRate: 280, hourlyRate: 180, icon: "hammer" },
    { id: "painting", translationKey: "painting", baseRate: 350, hourlyRate: 220, icon: "paint-brush" },
    { id: "caregiving", translationKey: "caregiving", baseRate: 400, hourlyRate: 250, icon: "heart" },
    // "flower"/"sparkles" were never valid Font Awesome 6 Free icon names
    // (confirmed live: content: none on both), so these two cards rendered
    // with no glyph at all despite the icon markup being wired correctly.
    // seedling/broom are real icons in the same fa-solid set already used
    // by every other service card.
    { id: "gardening", translationKey: "gardening", baseRate: 200, hourlyRate: 120, icon: "seedling" },
    { id: "cleaning", translationKey: "cleaning", baseRate: 180, hourlyRate: 100, icon: "broom" },
    { id: "domesticHelp", translationKey: "domesticHelp", baseRate: 220, hourlyRate: 130, icon: "utensils" }
  ];
  for (let i = 0; i < serviceData.length; i++) {
    const s = serviceData[i];
    await prisma.serviceCategory.create({ data: { ...s, sortOrder: i, isEnabled: true } });
    await prisma.skillCategory.create({ data: { id: s.id, translationKey: s.translationKey } });
  }

  console.log("Admin (super)...");
  const adminUser = await prisma.user.create({
    data: {
      role: "ADMIN",
      fullName: "Federation Registrar",
      email: "registrar@worksetu.coop",
      phone: "9000000001",
      passwordHash: await hash("AdminPass@123"),
      accountStatus: "ACTIVE",
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      acceptedTermsAt: new Date(),
      adminProfile: { create: { title: "Federation Registrar", isSuper: true } },
      preference: { create: {} }
    }
  });

  console.log(`Customers (${customerSeeds.length})...`);
  const customerProfileIdByMockId = new Map<string, string>();
  const customerUserIdByMockId = new Map<string, string>();
  for (const c of customerSeeds) {
    const joinedAt = daysBefore(c.joinedDaysAgo);
    const user = await prisma.user.create({
      data: {
        role: "CUSTOMER",
        fullName: c.name,
        email: c.email,
        phone: c.phone,
        passwordHash: await hash("Customer@123"),
        accountStatus: "ACTIVE",
        emailVerifiedAt: joinedAt,
        phoneVerifiedAt: joinedAt,
        acceptedTermsAt: joinedAt,
        createdAt: joinedAt,
        customerProfile: { create: { defaultAddress: c.address } },
        preference: { create: {} }
      },
      include: { customerProfile: true }
    });
    await setPoint("customer_profiles", "defaultLocation", user.customerProfile!.id, c.lng, c.lat);
    customerProfileIdByMockId.set(c.id, user.customerProfile!.id);
    customerUserIdByMockId.set(c.id, user.id);
  }

  console.log(`Workers (${workerSeeds.length})...`);
  const workerProfileIdByMockId = new Map<string, string>();
  const workerUserIdByMockId = new Map<string, string>();
  for (const w of workerSeeds) {
    const proficiency: ProficiencyLevel = w.experience >= 8 ? "ADVANCED" : w.experience >= 5 ? "INTERMEDIATE" : "BASIC";
    const joinedAt = daysBefore(w.joinedDaysAgo);
    const approved = w.verification === "APPROVED";
    const user = await prisma.user.create({
      data: {
        role: "WORKER",
        fullName: w.name,
        email: w.email,
        phone: w.phone,
        passwordHash: await hash("Worker@123"),
        accountStatus: "ACTIVE",
        emailVerifiedAt: joinedAt,
        phoneVerifiedAt: joinedAt,
        acceptedTermsAt: joinedAt,
        createdAt: joinedAt,
        preference: { create: {} },
        workerProfile: {
          create: {
            cooperativeId: w.cooperativeId,
            experienceYears: w.experience,
            serviceAreaRadiusKm: w.serviceRadiusKm,
            verificationStatus: w.verification as VerificationStatus,
            approvedAt: approved ? joinedAt : null,
            approvedByAdminId: approved ? adminUser.id : null,
            // An applicant still in review is not taking jobs yet.
            availabilityStatus: approved ? w.availabilityStatus : "OFF_DUTY",
            ratingAverage: 0,
            ratingCount: 0,
            createdAt: joinedAt,
            skills: {
              create: [w.skill, ...(w.extraSkills ?? [])].map((skillId, idx) => ({
                skillCategoryId: skillId,
                proficiencyLevel: proficiency,
                verificationStatus: (approved ? "APPROVED" : "PENDING") as VerificationStatus,
                isPrimary: idx === 0
              }))
            }
          }
        }
      },
      include: { workerProfile: true }
    });
    await setWorkerLocations(user.workerProfile!.id, w.lng, w.lat);
    workerProfileIdByMockId.set(w.mockId, user.workerProfile!.id);
    workerUserIdByMockId.set(w.mockId, user.id);

    if (approved) {
      await prisma.auditLog.create({
        data: {
          actorId: adminUser.id,
          action: "WORKER_VERIFIED",
          entityType: "WorkerProfile",
          entityId: user.workerProfile!.id,
          metadata: { decision: "APPROVED", cooperativeId: w.cooperativeId },
          createdAt: joinedAt
        }
      });
    }
  }

  // ---------------------------------------------------------------------
  // Bookings. One generated plan drives every stage of the lifecycle, so the
  // ledger, reviews, ratings and dashboard totals are all derived from the
  // same rows instead of being written independently per screen.
  // ---------------------------------------------------------------------
  const bookingPlans = buildBookings();
  console.log(`Bookings (${bookingPlans.length}) with invoices, payments, reviews and payouts...`);

  const ratingsByWorker = new Map<string, number[]>();
  const now = new Date();
  const recentEvents: { userId: string; title: string; body: string; at: Date; isRead: boolean }[] = [];
  const areaOf = (address: string) => address.split(",").slice(-2)[0].trim();

  for (const plan of bookingPlans) {
    const cust = customerSeeds.find((c) => c.id === plan.customerMockId)!;
    const customerProfileId = customerProfileIdByMockId.get(plan.customerMockId)!;
    const service = serviceData.find((s) => s.id === plan.serviceId)!;
    const workerProfileId = plan.workerMockId ? workerProfileIdByMockId.get(plan.workerMockId)! : null;
    const workerSeed = plan.workerMockId ? workerSeeds.find((w) => w.mockId === plan.workerMockId)! : null;

    const createdAt = daysBefore(plan.daysAgo, plan.hour, plan.minute);
    const total = service.baseRate + service.hourlyRate * plan.hoursBilled;
    const platformFee = Math.round(total * (COMMISSION_PERCENT / 100) * 100) / 100;
    const confirmedAt = minutesAfter(createdAt, 6);
    const startedAt = minutesAfter(createdAt, 35);
    const completedAt = minutesAfter(startedAt, plan.hoursBilled * 60);
    const settledAt = minutesAfter(completedAt, 12);
    const settled = plan.status === "SETTLED";
    const live = plan.status === "ASSIGNED" || plan.status === "CONFIRMED" || plan.status === "IN_PROGRESS";
    const hasWorker = settled || live || plan.status === "COMPLETED";

    const bookingId = await insertBooking({
      customerId: customerProfileId,
      serviceCategoryId: plan.serviceId,
      description: plan.description,
      address: cust.address,
      lng: cust.lng,
      lat: cust.lat,
      scheduledAt: null,
      urgency: plan.urgency,
      baseCharge: service.baseRate,
      hourlyRate: service.hourlyRate,
      estimatedTotal: total,
      status: plan.status as BookingStatus,
      assignedWorkerId: hasWorker ? workerProfileId : null,
      confirmedAt: settled || plan.status === "CONFIRMED" || plan.status === "IN_PROGRESS" || plan.status === "COMPLETED" ? confirmedAt : null,
      startedAt: settled || plan.status === "IN_PROGRESS" || plan.status === "COMPLETED" ? startedAt : null,
      completedAt: settled || plan.status === "COMPLETED" ? completedAt : null,
      settledAt: settled ? settledAt : null,
      cancelledAt: plan.status === "CANCELLED" ? minutesAfter(createdAt, 18) : null,
      cancelReason: plan.cancelReason ?? null,
      createdAt
    });

    // Offers that timed out, then whoever currently holds the open offer.
    const declined = plan.declinedByMockIds ?? [];
    for (let idx = 0; idx < declined.length; idx++) {
      await prisma.dispatchLog.create({
        data: {
          bookingId,
          workerId: workerProfileIdByMockId.get(declined[idx])!,
          attemptNumber: (idx === 0 ? "ATTEMPT_1" : "ATTEMPT_2") as DispatchAttempt,
          distanceKm: 0.9 + idx * 1.4,
          continuityScore: 90 - idx * 20,
          offeredAt: createdAt,
          respondedAt: minutesAfter(createdAt, 1),
          outcome: "TIMEOUT" as DispatchOutcome
        }
      });
    }
    for (const mockId of plan.offeredToMockIds ?? []) {
      await prisma.dispatchLog.create({
        data: {
          bookingId,
          workerId: workerProfileIdByMockId.get(mockId)!,
          attemptNumber: (plan.status === "DISPATCHING_POOL" ? "POOL" : "ATTEMPT_1") as DispatchAttempt,
          distanceKm: 2.3,
          continuityScore: 64,
          offeredAt: createdAt,
          outcome: "OFFERED" as DispatchOutcome
        }
      });
    }

    if (workerProfileId && hasWorker) {
      await prisma.dispatchLog.create({
        data: {
          bookingId,
          workerId: workerProfileId,
          attemptNumber: "ATTEMPT_1" as DispatchAttempt,
          distanceKm: Math.round(distanceKm(cust.lng, cust.lat, workerSeed!.lng, workerSeed!.lat) * 10) / 10,
          continuityScore: 60 + ((plan.hoursBilled * 7) % 35),
          offeredAt: createdAt,
          respondedAt: minutesAfter(createdAt, 2),
          outcome: "ACCEPTED" as DispatchOutcome
        }
      });
    }

    if (live && workerProfileId) {
      await prisma.workerProfile.update({
        where: { id: workerProfileId },
        data: { availabilityStatus: "ON_JOB", currentBookingId: bookingId }
      });
    }

    // An invoice exists from completion onward; payment, review and payout
    // only once the customer has reviewed, which is what settles a booking.
    if (settled || plan.status === "COMPLETED") {
      const invoice = await prisma.invoice.create({
        data: {
          bookingId,
          baseCharge: service.baseRate,
          hoursBilled: plan.hoursBilled,
          hourlyCharge: service.hourlyRate,
          platformFee,
          totalAmount: total,
          createdAt: completedAt
        }
      });

      if (settled) {
        await prisma.paymentTransaction.create({
          data: {
            invoiceId: invoice.id,
            paymentMethod: (plan.hoursBilled > 2 ? "DIRECT_PAY" : "CASH") as PaymentMethod,
            paymentStatus: "PAID",
            amount: total,
            processedAt: settledAt
          }
        });
      }
    }

    if (settled && workerProfileId && plan.rating !== null) {
      await prisma.review.create({
        data: {
          bookingId,
          customerId: customerProfileId,
          workerId: workerProfileId,
          punctuality: plan.rating,
          quality: plan.rating,
          professionalism: plan.rating,
          communication: plan.rating,
          overallScore: plan.rating,
          writtenFeedback: plan.review,
          createdAt: settledAt
        }
      });
      const list = ratingsByWorker.get(plan.workerMockId!) ?? [];
      list.push(plan.rating);
      ratingsByWorker.set(plan.workerMockId!, list);

      const jobPayout = Math.round((total - platformFee) * 100) / 100;
      await prisma.creditTransaction.create({
        data: {
          workerProfileId,
          type: "JOB_PAYOUT" as CreditTransactionType,
          amount: jobPayout,
          status: "COMPLETED" as CreditTransactionStatus,
          referenceBookingId: bookingId,
          createdAt: settledAt,
          settledAt
        }
      });

      if (plan.rating >= 4.5) {
        const creditAmount = Math.round(platformFee * FEEDBACK_CREDIT_SHARE * 100) / 100;
        await prisma.feedbackCredit.upsert({
          where: { workerProfileId },
          create: { workerProfileId, commissionPoolTotal: creditAmount, distributedTotal: creditAmount },
          update: { commissionPoolTotal: { increment: creditAmount }, distributedTotal: { increment: creditAmount } }
        });
        await prisma.creditTransaction.create({
          data: {
            workerProfileId,
            type: "FEEDBACK_CREDIT" as CreditTransactionType,
            amount: creditAmount,
            status: "COMPLETED" as CreditTransactionStatus,
            referenceBookingId: bookingId,
            createdAt: settledAt,
            settledAt
          }
        });
      }
    }

    // Notifications describe what actually happened on these bookings.
    if (plan.daysAgo <= 2) {
      const customerUserId = customerUserIdByMockId.get(plan.customerMockId)!;
      const serviceName = service.id === "domesticHelp" ? "domestic help" : service.id;
      if (plan.status === "ASSIGNED" || plan.status === "CONFIRMED") {
        recentEvents.push({ userId: customerUserId, title: "Worker assigned", body: `${workerSeed!.name} accepted your ${serviceName} booking and will reach ${areaOf(cust.address)} shortly.`, at: confirmedAt, isRead: false });
        recentEvents.push({ userId: workerUserIdByMockId.get(plan.workerMockId!)!, title: "Job accepted", body: `You accepted a ${serviceName} job for ${cust.name} in ${areaOf(cust.address)}. Estimated ${formatMoney(total)}.`, at: confirmedAt, isRead: true });
      }
      if (plan.status === "IN_PROGRESS") {
        recentEvents.push({ userId: customerUserId, title: "Work in progress", body: `${workerSeed!.name} has started the ${serviceName} job at your address.`, at: startedAt, isRead: false });
      }
      if (plan.status === "COMPLETED") {
        recentEvents.push({ userId: customerUserId, title: "Service completed", body: `Your ${serviceName} booking is complete. Rate ${workerSeed!.name} to close the invoice of ${formatMoney(total)}.`, at: completedAt, isRead: false });
        recentEvents.push({ userId: workerUserIdByMockId.get(plan.workerMockId!)!, title: "Awaiting customer review", body: `You marked the ${serviceName} job complete. The payout releases once ${cust.name} submits a review.`, at: completedAt, isRead: true });
      }
      if (plan.status === "DISPATCHING_TOP3" || plan.status === "DISPATCHING_POOL") {
        recentEvents.push({ userId: customerUserId, title: "Finding a worker", body: `We are offering your ${serviceName} request to cooperative workers near ${areaOf(cust.address)}.`, at: createdAt, isRead: false });
        for (const mockId of plan.offeredToMockIds ?? []) {
          recentEvents.push({ userId: workerUserIdByMockId.get(mockId)!, title: "New job offer", body: `${serviceName} job near ${areaOf(cust.address)} — ${formatMoney(total)} estimated.`, at: createdAt, isRead: false });
        }
      }
      if (settled && plan.rating !== null) {
        recentEvents.push({ userId: workerUserIdByMockId.get(plan.workerMockId!)!, title: `New ${plan.rating}-star review`, body: `${cust.name} rated your ${serviceName} job ${plan.rating} out of 5.`, at: settledAt, isRead: plan.daysAgo > 1 });
      }
    }
  }

  // Ratings are recomputed from the reviews that were actually written.
  console.log("Recomputing worker ratings from seeded reviews...");
  for (const [mockId, ratings] of ratingsByWorker.entries()) {
    const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    await prisma.workerProfile.update({
      where: { id: workerProfileIdByMockId.get(mockId)! },
      data: { ratingAverage: Math.round(avg * 100) / 100, ratingCount: ratings.length }
    });
  }

  console.log("Cooperative dividends...");
  for (const w of workerSeeds) {
    const workerProfileId = workerProfileIdByMockId.get(w.mockId)!;
    const earnings = await prisma.creditTransaction.aggregate({
      where: { workerProfileId, type: "JOB_PAYOUT" as CreditTransactionType, status: "COMPLETED" as CreditTransactionStatus },
      _sum: { amount: true }
    });
    const totalEarnings = Number(earnings._sum.amount ?? 0);
    if (totalEarnings <= 0) continue;
    const sharePercent = cooperativeData.find((c) => c.id === w.cooperativeId)!.dividendSharePercent;
    const dividendAmount = Math.round(totalEarnings * (sharePercent / 100) * 100) / 100;
    if (dividendAmount <= 0) continue;
    await prisma.creditTransaction.create({
      data: {
        workerProfileId,
        type: "DIVIDEND_PAYOUT" as CreditTransactionType,
        amount: dividendAmount,
        status: "COMPLETED" as CreditTransactionStatus,
        settledAt: now
      }
    });
  }

  console.log("Redemptions and settlement records...");
  const raviId = workerProfileIdByMockId.get("worker-1")!;
  const settledRedemption = await prisma.creditTransaction.create({
    data: { workerProfileId: raviId, type: "REDEMPTION" as CreditTransactionType, amount: 500, status: "COMPLETED" as CreditTransactionStatus, payoutMethod: "BANK_TRANSFER_MOCK" as PayoutMethod, settledAt: now }
  });
  await prisma.settlementRecord.create({
    data: {
      creditTransactionId: settledRedemption.id,
      payoutMethod: "BANK_TRANSFER_MOCK" as PayoutMethod,
      externalReferenceNote: "Mock UTR WSU2026082600123",
      status: "RECONCILED" as SettlementStatus,
      recordedByAdminId: adminUser.id,
      recordedAt: now,
      reconciledByAdminId: adminUser.id,
      reconciledAt: now
    }
  });
  await prisma.creditTransaction.create({
    data: { workerProfileId: raviId, type: "REDEMPTION" as CreditTransactionType, amount: 300, status: "PROCESSING" as CreditTransactionStatus, payoutMethod: "CASH_PICKUP" as PayoutMethod }
  });

  // ---------------------------------------------------------------------
  // Incentive programs (Section 1.2.5) — one per state.
  // ---------------------------------------------------------------------
  console.log("Incentive programs...");
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  await prisma.incentiveProgress.createMany({
    data: [
      { workerProfileId: raviId, title: "Complete 5 jobs this week", reward: 200, reason: "Weekly job-volume bonus", progress: 3, target: 5, expiry: new Date(now.getTime() + oneWeek), status: "PENDING" as IncentiveStatus },
      { workerProfileId: workerProfileIdByMockId.get("worker-2")!, title: "5-star streak bonus", reward: 150, reason: "Three consecutive 5-star reviews", progress: 3, target: 3, expiry: new Date(now.getTime() + oneWeek), status: "COMPLETED" as IncentiveStatus },
      { workerProfileId: workerProfileIdByMockId.get("worker-7")!, title: "Ten electrical jobs this month", reward: 400, reason: "Monthly category volume bonus", progress: 7, target: 10, expiry: new Date(now.getTime() + 2 * oneWeek), status: "PENDING" as IncentiveStatus },
      { workerProfileId: workerProfileIdByMockId.get("worker-10")!, title: "Weekend availability bonus", reward: 100, reason: "Available both weekend days", progress: 1, target: 2, expiry: new Date(now.getTime() - oneWeek), status: "EXPIRED" as IncentiveStatus },
      { workerProfileId: workerProfileIdByMockId.get("worker-15")!, title: "Refer a cooperative member", reward: 250, reason: "Membership growth drive", progress: 1, target: 1, expiry: new Date(now.getTime() + oneWeek), status: "COMPLETED" as IncentiveStatus }
    ]
  });

  // ---------------------------------------------------------------------
  // Notifications (Section 18). Each one was collected while its booking was
  // created, so every line refers to a booking that exists.
  // ---------------------------------------------------------------------
  const pendingWorkers = workerSeeds.filter((w) => w.verification === "PENDING");
  recentEvents.push({
    userId: workerUserIdByMockId.get("worker-1")!,
    title: "Redemption settled",
    body: "Your redemption of " + formatMoney(500) + " via bank transfer has been settled.",
    at: minutesAfter(now, -180),
    isRead: true
  });
  for (const w of pendingWorkers) {
    const coopName = cooperativeData.find((c) => c.id === w.cooperativeId)!.name;
    recentEvents.push({
      userId: adminUser.id,
      title: "Worker verification pending",
      body: `${w.name} (${w.location}) applied to ${coopName} and is awaiting document review.`,
      at: daysBefore(w.joinedDaysAgo),
      isRead: false
    });
    recentEvents.push({
      userId: workerUserIdByMockId.get(w.mockId)!,
      title: "Application received",
      body: "Your cooperative membership application is under review. You will be notified once the registrar approves it.",
      at: daysBefore(w.joinedDaysAgo),
      isRead: true
    });
  }

  console.log(`Notifications (${recentEvents.length})...`);
  await prisma.notification.createMany({
    data: recentEvents
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .map((e) => ({
        userId: e.userId,
        audience: "USER" as NotificationAudience,
        title: e.title,
        body: e.body,
        isRead: e.isRead,
        createdAt: e.at
      }))
  });

  console.log("\nSeed complete.\n");
  console.log("Demo credentials:");
  console.log("  Admin (super):", "registrar@worksetu.coop", "/", "AdminPass@123");
  console.log("  Customer:     ", "deepika@example.com", "/", "Customer@123");
  console.log("  Worker:       ", "ravi.kumar@example.com", "/", "Worker@123");
}

// Retry resilience, added after repeatedly observing transient Supabase
// pooler disconnects (P1001/P1017/P2024) during this build's long-running
// seed sessions. main() always starts with clearSeedOwnedData(), so a full
// retry from the top is safe/idempotent — this also backs POST
// /api/v1/admin/demo/reset (Section 15.9), where a flaky connection
// mid-demo should not require an operator to notice and re-run manually.
const RETRYABLE_PRISMA_CODES = new Set(["P1001", "P1017", "P2024"]);
const MAX_ATTEMPTS = 3;

function isRetryablePrismaError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && RETRYABLE_PRISMA_CODES.has((err as { code: string }).code);
}

async function runWithRetry(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await main();
      return;
    } catch (err) {
      if (isRetryablePrismaError(err) && attempt < MAX_ATTEMPTS) {
        console.warn(`Seed attempt ${attempt} failed with a transient connection error, retrying...`, err);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }
      throw err;
    }
  }
}

runWithRetry()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
