import { test, expect } from "@playwright/test";
import { pointFrontendAtBackend, apiGet, registerAndApproveWorker, uniqueId, uniquePhone, pollUntil, clearRateLimitState, BACKEND_URL } from "./helpers";

test.beforeEach(clearRateLimitState);

// Section 20.2 CUSTOMER flow: register -> login -> request booking ->
// dispatch -> ASSIGNED -> tracking -> COMPLETED (worker-side, driven via
// API here since this spec exercises the customer's own UI) -> review.
const TAMBARAM = { lat: 12.9249, lng: 80.1 };

test("customer: register, request a booking, track to completion, and leave a review", async ({ page, request }) => {
  test.setTimeout(240000);
  await pointFrontendAtBackend(page);
  await page.goto("/");
  // The very first test in the run has shown the app's own initial
  // data fetches (cooperatives/services/stats) still in flight when the
  // next click fires, well after the backend's own health check passed —
  // confirmed live: a role-nav click appeared to do nothing on a cold
  // start. Let the page settle before interacting with it.
  await page.waitForLoadState("networkidle").catch(() => {});

  await page.getByRole("button", { name: "Customer" }).first().click();
  await page.getByText("Register here").click();

  const id = uniqueId();
  const email = `e2e.customer.${id}@example.com`;
  // Registration form field order (index.html): fullName (text) -> email
  // -> phone (tel) -> address (text) -> password.
  await page.locator('input[type="text"]').nth(0).fill("E2E Customer");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="tel"]').fill(uniquePhone("9"));
  await page.locator('input[type="text"]').nth(1).fill("Tambaram, Chennai");
  await page.locator('input[type="password"]').fill("TestPass@123");
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Register" }).click();

  // Registration logs the customer straight in (Section 6 — token
  // returned from POST /auth/customer/register).
  await expect(page.getByText("Plumbing").first()).toBeVisible({ timeout: 60000 });

  // Play the worker side via API — this spec is verifying the customer's
  // own UI, not re-testing dispatch acceptance (covered by
  // tests/integration/booking-lifecycle.test.ts and the WORKER E2E spec).
  // Confirmed live: dispatch.service.ts's enqueueDispatch scores eligible
  // candidates exactly ONCE, at the moment the booking is created
  // (scoreCandidateWorkers, called synchronously before either offer
  // phase runs) — it is never re-queried later. Registering this worker
  // AFTER submitting the booking (the original order here) meant the
  // worker didn't exist yet at scoring time and could never receive an
  // offer, regardless of how long TOP3/POOL kept running. This worker
  // must exist and be durably eligible before the booking is created.
  const worker = await registerAndApproveWorker(request, TAMBARAM, `customer-flow-${id}`);

  await page.getByText("Plumbing").first().click();
  await page.locator('input[type="text"]').first().fill("Tambaram, Chennai");
  const future = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
  await page.locator('input[type="datetime-local"]').fill(future);
  await page.locator("textarea").fill("E2E Playwright test: leaking kitchen tap");
  await page.getByRole("button", { name: /Find Cooperative Workers/i }).click();

  // Lands on the matching/dispatch screen (Section 11.1 DISPATCHING_TOP3).
  await expect(page.getByText(/Top 3 Suitable Cooperative Workers Contacted|Wider Cooperative Pool Activated/).first()).toBeVisible({
    timeout: 60000
  });

  // Find the booking this customer just created via the worker's incoming
  // offers (the sole eligible candidate at this isolated test location).
  let dispatchLogId: string | undefined;
  let bookingId: string | undefined;
  await pollUntil(
    async () => {
      const incoming = await apiGet<any[]>(request, "/workers/me/incoming", worker.token);
      if (Array.isArray(incoming) && incoming.length > 0) {
        dispatchLogId = incoming[0].dispatchLogId;
        bookingId = incoming[0].bookingId;
        return true;
      }
      return false;
    },
    30000,
    1000
  );
  expect(dispatchLogId).toBeDefined();

  await request.post(`${BACKEND_URL}/api/v1/dispatch/${dispatchLogId}/respond`, {
    data: { response: "ACCEPT" },
    headers: { Authorization: `Bearer ${worker.token}` }
  });

  // Reload rather than rely on the socket push landing before the next
  // click — resyncs activeBooking via the REST poll-fallback path
  // (Section 1.1.5) regardless of live-socket timing, then the "Track
  // Request" banner picks up the now-ASSIGNED booking.
  await page.reload();
  await page.getByRole("button", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: /Track Request/i }).click();

  // Section 11.1 — ASSIGNED auto-confirms to CONFIRMED 60s after accept;
  // wait it out via the API (same fixed window the backend enforces),
  // then drive start/complete, reloading the page to resync the UI.
  await pollUntil(
    async () => {
      const booking = await apiGet<any>(request, `/bookings/${bookingId}`, worker.token);
      return booking.status === "CONFIRMED";
    },
    90000,
    3000
  );
  await request.patch(`${BACKEND_URL}/api/v1/bookings/${bookingId}/start`, {
    headers: { Authorization: `Bearer ${worker.token}` }
  });
  await request.patch(`${BACKEND_URL}/api/v1/bookings/${bookingId}/complete`, {
    headers: { Authorization: `Bearer ${worker.token}` }
  });

  // currentView isn't persisted (unlike activeBookingId) — onMounted's
  // session-restore path always resets it to "dashboard" on reload
  // (app.js), and "Rate & Review" only renders inside the
  // currentView === 'bookingConfirmed' view (index.html), so the same
  // Dashboard -> Track Request navigation used after the accept-reload
  // above is needed again here.
  await page.reload();
  await page.getByRole("button", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: /Track Request/i }).click();
  await expect(page.getByRole("button", { name: "Rate & Review" })).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Rate & Review" }).click();
  await page.getByRole("button", { name: "Submit Review" }).click();

  // submitRating (app.js) unconditionally closes the modal once its POST
  // resolves — the default 5s expect-timeout is too tight for this
  // environment's demonstrated worst-case per-request latency (up to
  // 45s+ elsewhere this phase), matching why every other assertion in
  // this spec already carries an explicit timeout.
  await expect(page.getByRole("button", { name: "Submit Review" })).toHaveCount(0, { timeout: 60000 });
});
