// Initialize and hook Vue 3 App
const { createApp, ref, reactive, computed, onMounted, onUnmounted, watch } = Vue;
const api = window.ApiClient;

const app = createApp({
  setup() {
    // ----------------------------------------------------
    // Theme & Language State
    // ----------------------------------------------------
    const theme = ref(localStorage.getItem("theme") || "light");
    const language = ref(localStorage.getItem("language") || "en");

    // ----------------------------------------------------
    // Role & Navigation Routing
    // ----------------------------------------------------
    const currentRole = ref("landing"); // landing, customer, worker, admin
    const currentView = ref("login");

    // ----------------------------------------------------
    // Auth / Session State (Section 6 — real JWT + httpOnly refresh cookie)
    // ----------------------------------------------------
    const loggedInCustomer = ref(null);
    const loggedInWorker = ref(null);
    const loggedInAdmin = ref(null);
    const loginError = ref("");
    const registerError = ref("");
    const showPassword = ref(false);
    const authBusy = ref(false);
    const socketConnected = ref(false);

    // Auth Form Bindings
    const authEmail = ref(""); // login identifier, or register email/phone depending on field
    const authPassword = ref("");
    const authName = ref("");
    const authPhone = ref("");
    const authAddress = ref("");
    const authCoop = ref("");
    const authSkill = ref("");
    const authExperience = ref("");
    const authServiceRadiusKm = ref(5);

    // ----------------------------------------------------
    // Services & Cooperatives (Section 4.2 public catalog)
    // ----------------------------------------------------
    const services = ref([]);
    const cooperatives = ref([]);

    async function loadCatalog() {
      const [svc, coop] = await Promise.all([
        api.request("GET", "/services").catch(() => []),
        api.request("GET", "/public/cooperatives").catch(() => [])
      ]);
      services.value = svc;
      cooperatives.value = coop;
    }

    // ----------------------------------------------------
    // Platform Stats (Landing page)
    // ----------------------------------------------------
    const platformStats = ref({ totalWorkers: 0, completedBookings: 0, activeCooperatives: 0 });
    async function loadPlatformStats() {
      platformStats.value = await api.request("GET", "/public/stats").catch(() => platformStats.value);
    }

    // ----------------------------------------------------
    // Customer Booking State
    // ----------------------------------------------------
    const customerBookings = ref([]); // list summaries (GET /customers/me/bookings)
    const activeBookingId = ref(localStorage.getItem("activeBookingId_sih2026") || null);
    const activeBooking = ref(null); // full detail (GET /bookings/:id)
    const dispatchCandidates = ref({ phase: null, candidates: [] });
    const notifications = ref([]);
    const unreadNotificationCount = computed(() => notifications.value.filter((n) => !n.isRead).length);

    watch(activeBookingId, (newId) => {
      if (newId) localStorage.setItem("activeBookingId_sih2026", newId);
      else localStorage.removeItem("activeBookingId_sih2026");
    });

    const requestForm = ref({
      serviceId: "plumbing",
      location: "",
      description: "",
      datetime: "",
      urgency: "NORMAL",
      baseRate: 250,
      hourlyRate: 150,
      estimate: 250
    });

    const ratingModal = ref({ show: false, bookingId: null, punctuality: 5, quality: 5, professionalism: 5, communication: 5, review: "" });

    // Section 14.7 — honest "Payment Gateway Not Configured" state.
    const paymentGatewayModal = ref({ show: false, bookingId: null });
    const paymentMethodError = ref("");

    // ----------------------------------------------------
    // Worker Dashboard State
    // ----------------------------------------------------
    const workerBookings = ref([]);
    const workerIncoming = ref([]); // GET /workers/me/incoming
    const workerActiveJob = ref(null); // full detail of current ASSIGNED/CONFIRMED/IN_PROGRESS booking
    const walletInfo = ref({
      availableBalance: 0,
      pendingBalance: 0,
      dividendPayoutTotal: 0,
      dividendSharePercent: 0,
      todayEarnings: 0,
      workingLocation: "",
      serviceAreaRadiusKm: 0,
      transactions: []
    });
    const incentivesList = ref([]);
    const welfareInfo = ref({ hoursWorkedToday: 0, hoursWorkedThisWeek: 0, consecutiveJobStreak: 0, restRecommended: false });
    const demandHeatmap = ref([]);
    const redemptionAmount = ref("");
    const redemptionError = ref("");
    const redemptionSuccess = ref("");
    const payoutMethod = ref("BANK_TRANSFER_MOCK");
    const earningsTab = ref("today");
    const selectedOrder = ref(null);
    const workerDocuments = ref([]);
    const documentUploadError = ref("");
    const documentUploadSuccess = ref("");

    let locationPingInterval = null;

    // ----------------------------------------------------
    // Admin Panel State
    // ----------------------------------------------------
    const adminTab = ref("dashboard");
    const adminDashboard = ref({ totalWorkers: 0, availableWorkers: 0, totalCustomers: 0, activeBookings: 0, completedBookings: 0, totalCooperatives: 0, recentDispatchEvents: [] });
    const adminBookings = ref([]);
    const adminBookingsLedger = ref([]);
    const adminDispatchActive = ref([]);
    const adminLiveWorkers = ref([]);
    const adminWorkers = ref([]);
    const adminCustomers = ref([]);
    const adminCooperatives = ref([]);
    const adminAuditLogs = ref([]);
    const adminReports = ref({ topSectors: [], ratingDistribution: [] });
    const adminConfig = ref({ commissionPercent: 15, top3TimeoutSeconds: 45, poolTimeoutSeconds: 120 });
    const adminIsSuper = computed(() => !!loggedInAdmin.value?.adminProfile?.isSuper);

    const selectedRequest = ref(null);
    const selectedWorker = ref(null);
    const selectedCustomer = ref(null);
    const selectedCooperative = ref(null);
    const selectedBooking = ref(null);

    const workerSearch = ref("");
    const workerFilterVerification = ref("");
    const customerSearch = ref("");
    const customerFilterStatus = ref("");
    const requestFilterStatus = ref("");
    const bookingFilterStatus = ref("");

    const showAddServiceModal = ref(false);
    const showEditServiceModal = ref(false);
    const newServiceData = ref({ id: "", translationKey: "", baseRate: 200, hourlyRate: 100, icon: "wrench" });
    const editingServiceData = ref({ id: "", baseRate: 0, hourlyRate: 0, isEnabled: true });

    const forceAssignForm = ref({ workerId: "", reason: "" });
    const forceAssignError = ref("");
    const adminCancelReason = ref("");
    const rejectionReasonInput = ref("");
    const suspendReasonInput = ref("");
    const broadcastForm = ref({ audience: "ALL_CUSTOMERS", title: "", body: "" });
    const broadcastResult = ref("");
    const newCooperativeData = ref({ name: "", location: "", registrationNumber: "" });
    const walletAdjustmentForm = ref({ workerProfileId: "", amount: "", direction: "CREDIT", reason: "" });
    const walletAdjustmentResult = ref("");
    const demoResetBusy = ref(false);
    const demoResetResult = ref("");

    // ----------------------------------------------------
    // Translations Helper (Section 2.3 — fallback to en, then key itself)
    // ----------------------------------------------------
    const t = (key, replacements = {}) => {
      const langTranslations = window.translations[language.value] || window.translations.en;
      let text = langTranslations[key] ?? window.translations.en[key] ?? key;
      Object.keys(replacements).forEach((placeholder) => {
        text = text.replace(`{${placeholder}}`, replacements[placeholder]);
      });
      return text;
    };
    const getServiceName = (serviceId) => t(serviceId);

    // Backend BookingStatus (Section 3) -> existing translation "stage" keys.
    const STAGE_KEY_BY_STATUS = {
      REQUESTED: "stageCreated",
      DISPATCHING_TOP3: "stageTop3",
      DISPATCHING_POOL: "stageWider",
      ASSIGNED: "stageAssigned",
      CONFIRMED: "stageAssigned",
      IN_PROGRESS: "stageProgress",
      COMPLETED: "stageCompleted",
      SETTLED: "stageCompleted",
      CANCELLED: "statusCancelled"
    };
    const stageLabel = (status) => t(STAGE_KEY_BY_STATUS[status] || status);

    const OFFER_STATUS_KEY = { WAITING: "statusWaiting", ACCEPTED: "statusAccepted", DECLINED: "statusDeclined", TIMEOUT: "statusTimeout", LOCK_LOST: "statusDeclined" };
    const offerStatusLabel = (offerStatus) => t(OFFER_STATUS_KEY[offerStatus] || offerStatus);

    // Section 2.3 — Intl-formatted dates/currency, never a raw ISO/float.
    const formatDate = (iso) => (iso ? new Intl.DateTimeFormat(localeTag(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "");
    const formatCurrency = (n) => new Intl.NumberFormat(localeTag(), { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n) || 0);
    function localeTag() {
      return { en: "en-IN", hi: "hi-IN", ta: "ta-IN", bn: "bn-IN" }[language.value] || "en-IN";
    }

    function apiErrorMessage(err) {
      if (err instanceof api.ApiError) return err.message;
      return t("noDataFound");
    }

    // ----------------------------------------------------
    // Theme / language application
    // ----------------------------------------------------
    const applyThemeClass = () => {
      const root = document.documentElement;
      if (theme.value === "dark") root.classList.add("dark");
      else root.classList.remove("dark");
    };
    const toggleTheme = () => {
      theme.value = theme.value === "light" ? "dark" : "light";
    };
    watch(theme, (v) => {
      localStorage.setItem("theme", v);
      applyThemeClass();
    });

    // Section 2.3 — persisted client-side pre-auth, server-side (UserPreference) post-auth.
    const changeLanguage = async (lang) => {
      language.value = lang;
      localStorage.setItem("language", lang);
      if (loggedInCustomer.value || loggedInWorker.value || loggedInAdmin.value) {
        await api.request("PATCH", "/users/me/preferences", { body: { language: lang } }).catch(() => {});
      }
    };

    // ----------------------------------------------------
    // Socket.io lifecycle (Section 12)
    // ----------------------------------------------------
    function wireSocketEvents() {
      api.onSocketEvent("connect", () => (socketConnected.value = true));
      api.onSocketEvent("disconnect", () => (socketConnected.value = false));

      api.onSocketEvent("dispatch:update", async (payload) => {
        if (activeBooking.value && payload.bookingId === activeBooking.value.id) {
          await refreshActiveBooking();
        }
        if (currentRole.value === "admin") {
          await Promise.all([loadAdminDispatchActive(), loadAdminBookings()]);
        }
      });
      api.onSocketEvent("dispatch:exhausted", async (payload) => {
        if (activeBooking.value && payload.bookingId === activeBooking.value.id) {
          await refreshActiveBooking();
        }
      });
      api.onSocketEvent("dispatch:offer", async () => {
        if (loggedInWorker.value) await loadWorkerIncoming();
      });
      api.onSocketEvent("notification:new", (n) => {
        notifications.value.unshift(n);
      });
      api.onSocketEvent("worker:location", (payload) => {
        if (currentRole.value === "admin") {
          const idx = adminLiveWorkers.value.findIndex((w) => w.workerId === payload.workerId);
          if (idx !== -1) adminLiveWorkers.value[idx] = { ...adminLiveWorkers.value[idx], ...payload };
        }
      });
    }

    function startSession() {
      api.connectSocket();
      wireSocketEvents();
    }
    function endSession() {
      api.disconnectSocket();
      api.clearAccessToken();
      socketConnected.value = false;
      stopOfferTicker();
      clearToasts();
      closeHeaderDropdowns();
      if (locationPingInterval) {
        clearInterval(locationPingInterval);
        locationPingInterval = null;
      }
    }

    // ----------------------------------------------------
    // Navigation / Router Logic
    // ----------------------------------------------------
    const setRole = (role) => {
      currentRole.value = role;
      loginError.value = "";
      registerError.value = "";
      showPassword.value = false;
      authEmail.value = "";
      authPassword.value = "";

      if (role === "landing") currentView.value = "home";
      else if (role === "customer") currentView.value = loggedInCustomer.value ? "dashboard" : "login";
      else if (role === "worker") currentView.value = loggedInWorker.value ? "dashboard" : "login";
      else if (role === "admin") currentView.value = loggedInAdmin.value ? "dashboard" : "login";
    };

    const navigateTo = (view) => {
      currentView.value = view;
      loginError.value = "";
      showPassword.value = false;
      if (view === "services") {
        requestForm.value.location = loggedInCustomer.value?.customerProfile?.defaultAddress || "";
        requestForm.value.description = "";
        requestForm.value.datetime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);
      }
      if (view === "myBookings") loadCustomerBookings();
      if (view === "orders") loadWorkerBookings();
      if (view === "requests") loadWorkerIncoming();
      if (view === "cooperative") loadWallet();
      if (view === "earnings") loadWallet();
      if (view === "incentives") loadIncentives();
      if (view === "map") loadDemandHeatmap();
      if (view === "welfare") loadWelfare();
      if (view === "notifications") loadNotifications();
      if (view === "profile") loadWorkerDocuments();
    };

    // ----------------------------------------------------
    // Geolocation helper (used for booking address + worker location ping)
    // ----------------------------------------------------
    // Falls back to central Chennai when permission is denied/unavailable —
    // this is a demo-scope convenience, not a claim of real device GPS.
    function getCoordinates() {
      return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve({ lat: 13.0827, lng: 80.2707 });
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({ lat: 13.0827, lng: 80.2707 }),
          { timeout: 4000 }
        );
      });
    }

    // ----------------------------------------------------
    // Authentication (Section 6)
    // ----------------------------------------------------
    async function loadOwnProfile(role) {
      const profile = await api.request("GET", "/users/me");
      if (role === "CUSTOMER") loggedInCustomer.value = profile;
      else if (role === "WORKER") loggedInWorker.value = profile;
      else if (role === "ADMIN") loggedInAdmin.value = profile;
      return profile;
    }

    // The API runs on a free Render instance that sleeps when idle; the first
    // request after a sleep can hang for a minute or more with no feedback.
    // After a few seconds of waiting, the login forms explain why.
    const apiSlow = ref(false);
    let apiSlowTimer = null;
    // The refresh cookie is httpOnly, so JS can't see it. This flag records
    // that a sign-in happened on this browser, so first-time visitors skip a
    // refresh call that could only 401.
    const SESSION_HINT_KEY = "worksetu_session";
    function setSessionHint(on) {
      try {
        if (on) localStorage.setItem(SESSION_HINT_KEY, "1");
        else localStorage.removeItem(SESSION_HINT_KEY);
      } catch {}
    }
    function hasSessionHint() {
      try {
        return localStorage.getItem(SESSION_HINT_KEY) === "1";
      } catch {
        return true;
      }
    }

    const handleLogin = async () => {
      loginError.value = "";
      authBusy.value = true;
      apiSlow.value = false;
      clearTimeout(apiSlowTimer);
      apiSlowTimer = setTimeout(() => { apiSlow.value = true; }, 4000);
      try {
        const rolePath = currentRole.value === "customer" ? "customer" : currentRole.value === "worker" ? "worker" : "admin";
        const res = await api.request("POST", `/auth/${rolePath}/login`, {
          body: { identifier: authEmail.value.trim(), password: authPassword.value }
        });
        api.setAccessToken(res.token);
        setSessionHint(true);
        startSession();
        // loadOwnProfile (GET /users/me) and loadCatalog (GET /services +
        // /public/cooperatives) don't depend on each other, but were
        // previously awaited one after another -- an extra full network
        // round trip of perceived lag on every login under this
        // environment's demonstrated worst-case per-request latency.
        // loadCatalog is also redundant here in the common case: onMounted
        // already loads the catalog once at app boot, well before a user
        // reaches the login form, so re-fetching it again on every login is
        // wasted work -- only do it if that initial load hasn't landed yet.
        await Promise.all([loadOwnProfile(res.role), services.value.length === 0 ? loadCatalog() : Promise.resolve()]);
        currentView.value = "dashboard";
        authEmail.value = "";
        authPassword.value = "";
        // Show the dashboard as soon as the profile is in; its cards fill in
        // as their requests land instead of holding the sign-in spinner until
        // every one of them (up to five for a worker) has finished.
        initializeRoleData(currentRole.value).catch(() => {});
      } catch (err) {
        loginError.value = apiErrorMessage(err);
      } finally {
        clearTimeout(apiSlowTimer);
        apiSlow.value = false;
        authBusy.value = false;
      }
    };

    const handleRegister = async () => {
      registerError.value = "";
      authBusy.value = true;
      try {
        if (currentRole.value === "customer") {
          const { lat, lng } = await getCoordinates();
          const res = await api.request("POST", "/auth/customer/register", {
            body: {
              fullName: authName.value,
              email: authEmail.value.trim(),
              phone: authPhone.value.trim(),
              password: authPassword.value,
              address: authAddress.value,
              lat,
              lng,
              acceptedTerms: true
            }
          });
          api.setAccessToken(res.token);
          startSession();
          await loadOwnProfile("CUSTOMER");
          await loadCatalog();
          currentView.value = "dashboard";
          await initializeRoleData("customer");
        } else if (currentRole.value === "worker") {
          const { lat, lng } = await getCoordinates();
          const res = await api.request("POST", "/auth/worker/register", {
            body: {
              fullName: authName.value,
              email: authEmail.value.trim(),
              phone: authPhone.value.trim(),
              password: authPassword.value,
              cooperativeId: authCoop.value,
              primarySkillId: authSkill.value,
              experienceYears: Number(authExperience.value) || 0,
              homeLocation: { lat, lng, address: authAddress.value },
              serviceAreaRadiusKm: Number(authServiceRadiusKm.value) || 5,
              acceptedTerms: true
            }
          });
          api.setAccessToken(res.token);
          startSession();
          await loadOwnProfile("WORKER");
          currentView.value = "dashboard";
          await initializeRoleData("worker");
        }
      } catch (err) {
        registerError.value = apiErrorMessage(err);
      } finally {
        authName.value = "";
        authEmail.value = "";
        authPhone.value = "";
        authPassword.value = "";
        authAddress.value = "";
        authCoop.value = "";
        authSkill.value = "";
        authExperience.value = "";
        authBusy.value = false;
      }
    };

    const handleLogout = () => {
      // Confirmed live: awaiting the /auth/logout round trip before touching
      // any local state made the button appear to do nothing until the
      // network call resolved, under this environment's demonstrated
      // worst-case per-request latency. Revoking the server-side refresh
      // token is best-effort housekeeping the user doesn't need to wait
      // on -- the local session is what actually has to end immediately, so
      // reset it synchronously first and fire the request in the
      // background. The backend reads the refresh cookie for this route,
      // not the access token -- but the route itself sits behind
      // requireAnyRole, so the request has to be started while the access
      // token is still set. request() builds its headers synchronously, so
      // kicking it off first and clearing local state right after keeps
      // logout instant (confirmed live: clearing first made every logout
      // 401, leaving the refresh token unrevoked).
      const logoutRequest = api.request("POST", "/auth/logout").catch(() => {});
      endSession();
      setSessionHint(false);
      loggedInCustomer.value = null;
      loggedInWorker.value = null;
      loggedInAdmin.value = null;
      activeBookingId.value = null;
      activeBooking.value = null;
      currentRole.value = "landing";
      currentView.value = "home";
      return logoutRequest;
    };

    // Active Route Protection Watcher
    watch([currentRole, currentView], ([newRole, newView]) => {
      const publicViews = ["login", "register"];
      if (newRole === "customer" && !loggedInCustomer.value && !publicViews.includes(newView)) currentView.value = "login";
      else if (newRole === "worker" && !loggedInWorker.value && !publicViews.includes(newView)) currentView.value = "login";
      else if (newRole === "admin" && !loggedInAdmin.value && newView !== "login") currentView.value = "login";
    });

    // ----------------------------------------------------
    // Customer Booking Flow (Section 4.3, 4.4, 1.1.5, 11)
    // ----------------------------------------------------
    const selectService = (serviceId) => {
      const svc = services.value.find((s) => s.id === serviceId);
      requestForm.value.serviceId = serviceId;
      requestForm.value.baseRate = svc.baseRate;
      requestForm.value.hourlyRate = svc.hourlyRate;
      requestForm.value.estimate = svc.baseRate + svc.hourlyRate;
      requestForm.value.location = loggedInCustomer.value?.customerProfile?.defaultAddress || "";
      requestForm.value.description = "";
      requestForm.value.datetime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);
      previewService.value = null;
      requestStep.value = 1;
      navigateTo("requestForm");
    };

    const handleRequestSubmit = async () => {
      if (isSubmittingRequest.value) return;
      isSubmittingRequest.value = true;
      try {
        const { lat, lng } = await getCoordinates();
        const res = await api.request("POST", "/bookings/request", {
          idempotencyKey: api.idempotencyKey(),
          body: {
            serviceCategoryId: requestForm.value.serviceId,
            location: { address: requestForm.value.location, lat, lng },
            description: requestForm.value.description || "General maintenance requested",
            scheduledAt: null,
            urgency: requestForm.value.urgency
          }
        }).catch((err) => {
          showToast(t("actionFailedToast"), apiErrorMessage(err), "error", 5000);
          return null;
        });
        if (!res) return;

        activeBookingId.value = res.bookingId;
        // The matching/confirmation screens read service + description from the
        // list summary, which GET /bookings/:id doesn't include.
        await Promise.all([refreshActiveBooking(), loadCustomerBookings()]);
        navigateTo("matching");
      } finally {
        isSubmittingRequest.value = false;
      }
    };

    async function refreshActiveBooking() {
      if (!activeBookingId.value) return;
      activeBooking.value = await api.request("GET", `/bookings/${activeBookingId.value}`).catch(() => activeBooking.value);
      if (activeBooking.value && ["DISPATCHING_TOP3", "DISPATCHING_POOL"].includes(activeBooking.value.status)) {
        dispatchCandidates.value = await api
          .request("GET", `/dispatch/${activeBookingId.value}/candidates`)
          .catch(() => dispatchCandidates.value);
      }
    }

    let candidatePollInterval = null;
    watch(activeBooking, (booking) => {
      if (candidatePollInterval) clearInterval(candidatePollInterval);
      if (booking && ["DISPATCHING_TOP3", "DISPATCHING_POOL"].includes(booking.status)) {
        // Section 1.1.5 — poll fallback if the socket stream is disconnected.
        candidatePollInterval = setInterval(() => {
          if (!socketConnected.value) refreshActiveBooking();
        }, 4000);
      }
    });

    async function loadCustomerBookings() {
      const res = await api.request("GET", "/customers/me/bookings").catch(() => null);
      if (res) customerBookings.value = res.items;
    }

    const viewBooking = async (bookingId) => {
      activeBookingId.value = bookingId;
      await refreshActiveBooking();
      navigateTo(activeBooking.value && ["DISPATCHING_TOP3", "DISPATCHING_POOL"].includes(activeBooking.value.status) ? "matching" : "bookingConfirmed");
    };

    const cancelBooking = async (bookingId, reason) => {
      try {
        await api.request("POST", `/bookings/${bookingId}/cancel`, { body: { reason: reason || undefined } });
        showToast(t("bookingCancelledToast"), "", "success");
      } catch (err) {
        showToast(t("actionFailedToast"), apiErrorMessage(err), "error", 5000);
      }
      await Promise.all([refreshActiveBooking(), loadCustomerBookings()]);
    };

    const completeJob = (bookingId) => {
      ratingModal.value = { show: true, bookingId, punctuality: 5, quality: 5, professionalism: 5, communication: 5, review: "" };
    };

    const openPaymentMethod = (bookingId) => {
      paymentMethodError.value = "";
      paymentGatewayModal.value = { show: true, bookingId };
    };
    const choosePaymentMethod = async (method) => {
      paymentMethodError.value = "";
      try {
        await api.request("POST", `/bookings/${paymentGatewayModal.value.bookingId}/payment-method`, { body: { paymentMethod: method } });
        paymentGatewayModal.value.show = false;
      } catch (err) {
        // Section 14.7 — honest 501 PAYMENT_GATEWAY_NOT_CONFIGURED, not a silent failure.
        paymentMethodError.value = err instanceof api.ApiError && err.code === "PAYMENT_GATEWAY_NOT_CONFIGURED" ? t("paymentGatewayComingSoonBody") : apiErrorMessage(err);
      }
    };

    const submitRating = async () => {
      const m = ratingModal.value;
      try {
        await api.request("POST", `/bookings/${m.bookingId}/review`, {
          idempotencyKey: api.idempotencyKey(),
          body: { punctuality: m.punctuality, quality: m.quality, professionalism: m.professionalism, communication: m.communication, writtenFeedback: m.review || undefined }
        });
      } catch (err) {
        loginError.value = apiErrorMessage(err);
      }
      ratingModal.value.show = false;
      activeBookingId.value = null;
      activeBooking.value = null;
      await loadCustomerBookings();
      navigateTo("myBookings");
    };

    // ----------------------------------------------------
    // Worker Dashboard Actions
    // ----------------------------------------------------
    async function loadWorkerIncoming() {
      workerIncoming.value = await api.request("GET", "/workers/me/incoming").catch(() => []);
    }
    async function loadWorkerBookings() {
      const res = await api.request("GET", "/workers/me/bookings").catch(() => null);
      if (res) workerBookings.value = res.items;
    }
    async function loadWallet() {
      walletInfo.value = await api.request("GET", "/workers/me/wallet").catch(() => walletInfo.value);
    }
    async function loadIncentives() {
      incentivesList.value = await api.request("GET", "/workers/me/incentives").catch(() => []);
    }
    async function loadWelfare() {
      welfareInfo.value = await api.request("GET", "/workers/me/welfare").catch(() => welfareInfo.value);
    }
    async function loadDemandHeatmap() {
      demandHeatmap.value = await api.request("GET", "/workers/me/demand-heatmap").catch(() => []);
    }
    async function loadWorkerActiveJob() {
      // Uses the worker's own booking list (customerName + description already
      // included there) rather than GET /bookings/:id, whose response shape is
      // customer-oriented (worker info, no customer info).
      const res = await api.request("GET", "/workers/me/bookings").catch(() => null);
      if (!res) return;
      workerActiveJob.value = res.items.find((b) => ["ASSIGNED", "CONFIRMED", "IN_PROGRESS"].includes(b.status)) || null;
    }
    async function loadWorkerDocuments() {
      // Section 16 — no list-documents endpoint exists (upload/signed-url/delete
      // only); the upload panel is write-only feedback, not a directory browse.
    }

    const toggleAvailability = async () => {
      const profile = loggedInWorker.value.workerProfile;
      const previous = profile.availabilityStatus;
      const next = previous === "AVAILABLE" ? "OFF_DUTY" : "AVAILABLE";
      // Flip the switch immediately and roll back if the server refuses
      // (e.g. a suspended worker going AVAILABLE); waiting ~1-2s for the
      // round trip made the toggle feel broken.
      profile.availabilityStatus = next;
      try {
        await api.request("PATCH", "/workers/me/availability", { idempotencyKey: api.idempotencyKey(), body: { status: next } });
        if (next === "AVAILABLE") startLocationPinging();
        else if (locationPingInterval) {
          clearInterval(locationPingInterval);
          locationPingInterval = null;
        }
      } catch (err) {
        profile.availabilityStatus = previous;
        loginError.value = apiErrorMessage(err);
      }
    };

    function startLocationPinging() {
      if (locationPingInterval) clearInterval(locationPingInterval);
      const ping = async () => {
        const { lat, lng } = await getCoordinates();
        await api.request("POST", "/workers/location-ping", { body: { lat, lng } }).catch(() => {});
      };
      ping();
      locationPingInterval = setInterval(ping, 15000);
    }

    const handleWorkerAccept = async (dispatchLogId) => {
      await api.request("POST", `/dispatch/${dispatchLogId}/respond`, { idempotencyKey: api.idempotencyKey(), body: { response: "ACCEPT" } }).catch((err) => {
        loginError.value = apiErrorMessage(err);
      });
      await Promise.all([loadWorkerIncoming(), loadWorkerActiveJob()]);
      currentView.value = "dashboard";
    };
    const handleWorkerReject = async (dispatchLogId) => {
      await api.request("POST", `/dispatch/${dispatchLogId}/respond`, { body: { response: "DECLINE" } }).catch(() => {});
      await loadWorkerIncoming();
    };

    const workerStartJob = async (bookingId) => {
      await api.request("PATCH", `/bookings/${bookingId}/start`).catch((err) => (loginError.value = apiErrorMessage(err)));
      await loadWorkerActiveJob();
    };
    const workerCompleteJob = async (bookingId) => {
      await api.request("PATCH", `/bookings/${bookingId}/complete`, { idempotencyKey: api.idempotencyKey() }).catch((err) => (loginError.value = apiErrorMessage(err)));
      await loadWorkerActiveJob();
      currentView.value = "dashboard";
    };

    const handleRedeem = async () => {
      redemptionError.value = "";
      redemptionSuccess.value = "";
      const amt = Number(redemptionAmount.value);
      if (!amt || amt <= 0) {
        redemptionError.value = t("insufficientBalance");
        return;
      }
      try {
        await api.request("POST", "/workers/me/wallet/redeem", {
          idempotencyKey: api.idempotencyKey(),
          body: { amount: amt, payoutMethod: payoutMethod.value }
        });
        redemptionAmount.value = "";
        redemptionSuccess.value = t("redeemButton");
        await loadWallet();
      } catch (err) {
        redemptionError.value = apiErrorMessage(err);
      }
    };

    const uploadDocument = async (file, documentType) => {
      documentUploadError.value = "";
      documentUploadSuccess.value = "";
      try {
        const res = await api.uploadFile("/workers/documents", file, { documentType });
        workerDocuments.value.unshift(res);
        documentUploadSuccess.value = `${t("save")}: ${res.scanStatus}`;
      } catch (err) {
        documentUploadError.value = apiErrorMessage(err);
      }
    };

    // ----------------------------------------------------
    // Notifications (shared, all roles)
    // ----------------------------------------------------
    async function loadNotifications() {
      const res = await api.request("GET", "/notifications").catch(() => null);
      if (res) notifications.value = res.items;
    }
    const markNotificationRead = async (id) => {
      await api.request("PATCH", `/notifications/${id}/read`).catch(() => {});
      const n = notifications.value.find((x) => x.id === id);
      if (n) n.isRead = true;
    };
    const markAllNotificationsRead = async () => {
      await api.request("PATCH", "/notifications/read-all").catch(() => {});
      notifications.value.forEach((n) => (n.isRead = true));
    };

    // ----------------------------------------------------
    // Admin Console (Section 15, PHASE 11)
    // ----------------------------------------------------
    async function loadAdminDashboard() {
      adminDashboard.value = await api.request("GET", "/admin/dashboard/summary").catch(() => adminDashboard.value);
    }
    async function loadAdminBookings() {
      const res = await api.request("GET", "/admin/bookings", { params: { status: requestFilterStatus.value } }).catch(() => null);
      if (res) adminBookings.value = res.items;
    }
    async function loadAdminBookingsLedger() {
      const res = await api.request("GET", "/admin/bookings/ledger", { params: { status: bookingFilterStatus.value } }).catch(() => null);
      if (res) adminBookingsLedger.value = res.items;
    }
    async function loadAdminDispatchActive() {
      adminDispatchActive.value = await api.request("GET", "/admin/dispatch/active").catch(() => []);
    }
    async function loadAdminLiveWorkers() {
      adminLiveWorkers.value = await api.request("GET", "/admin/live/workers").catch(() => []);
    }
    async function loadAdminWorkers() {
      const res = await api.request("GET", "/admin/workers", { params: { verificationStatus: workerFilterVerification.value } }).catch(() => null);
      if (res) adminWorkers.value = res.items;
    }
    async function loadAdminCustomers() {
      const res = await api.request("GET", "/admin/customers", { params: { status: customerFilterStatus.value } }).catch(() => null);
      if (res) adminCustomers.value = res.items;
    }
    async function loadAdminCooperatives() {
      adminCooperatives.value = await api.request("GET", "/admin/cooperatives").catch(() => []);
    }
    async function loadAdminReports() {
      const [topSectors, ratingDistribution] = await Promise.all([
        api.request("GET", "/admin/reports/top-sectors").catch(() => []),
        api.request("GET", "/admin/reports/rating-distribution").catch(() => [])
      ]);
      adminReports.value = { topSectors, ratingDistribution };
    }
    async function loadAdminConfig() {
      adminConfig.value = await api.request("GET", "/admin/config").catch(() => adminConfig.value);
    }
    async function loadAdminAuditLogs() {
      const res = await api.request("GET", "/admin/audit-logs").catch(() => null);
      if (res) adminAuditLogs.value = res.items;
    }

    const setAdminTab = (tab) => {
      adminTab.value = tab;
      if (tab === "dashboard") Promise.all([loadAdminDashboard(), loadAdminDispatchActive(), loadAdminBookings()]);
      else if (tab === "requests") loadAdminBookings();
      else if (tab === "monitoring") loadAdminDispatchActive();
      else if (tab === "liveWorkers") loadAdminLiveWorkers();
      else if (tab === "workers") loadAdminWorkers();
      else if (tab === "customers") loadAdminCustomers();
      else if (tab === "cooperatives") loadAdminCooperatives();
      else if (tab === "bookings") loadAdminBookingsLedger();
      else if (tab === "reports") loadAdminReports();
      else if (tab === "audit") loadAdminAuditLogs();
      else if (tab === "settings") Promise.all([loadAdminConfig(), adminWorkers.value.length === 0 ? loadAdminWorkers() : null]);
    };

    const openRequestDetails = async (request) => {
      selectedRequest.value = { ...request, dispatchLog: await api.request("GET", `/admin/bookings/${request.id}/dispatch-log`).catch(() => []) };
      forceAssignForm.value = { workerId: "", reason: "" };
      forceAssignError.value = "";
      adminCancelReason.value = "";
      if (adminWorkers.value.length === 0) loadAdminWorkers();
    };
    const submitForceAssign = async () => {
      forceAssignError.value = "";
      try {
        await api.request("POST", `/admin/bookings/${selectedRequest.value.id}/force-assign`, {
          idempotencyKey: api.idempotencyKey(),
          body: { workerId: forceAssignForm.value.workerId, reason: forceAssignForm.value.reason }
        });
        selectedRequest.value = null;
        await loadAdminBookings();
      } catch (err) {
        forceAssignError.value = apiErrorMessage(err);
      }
    };
    const submitAdminCancel = async () => {
      await api.request("POST", `/admin/bookings/${selectedRequest.value.id}/cancel`, { body: { reason: adminCancelReason.value } }).catch((err) => (forceAssignError.value = apiErrorMessage(err)));
      selectedRequest.value = null;
      adminCancelReason.value = "";
      await loadAdminBookings();
    };

    const openWorkerDetails = (worker) => {
      selectedWorker.value = worker;
      rejectionReasonInput.value = "";
      suspendReasonInput.value = "";
    };
    const verifyWorker = async (decision) => {
      if (decision === "REJECTED" && !rejectionReasonInput.value.trim()) return;
      await api.request("PATCH", `/admin/workers/${selectedWorker.value.id}/verify`, {
        body: { decision, rejectionReason: decision === "REJECTED" ? rejectionReasonInput.value : undefined }
      });
      selectedWorker.value = null;
      await loadAdminWorkers();
    };
    const toggleWorkerSuspension = async (suspended) => {
      if (!suspendReasonInput.value.trim()) return;
      await api.request("PATCH", `/admin/workers/${selectedWorker.value.id}/status`, { body: { suspended, reason: suspendReasonInput.value } });
      selectedWorker.value = null;
      await loadAdminWorkers();
    };

    const openCustomerDetails = (customer) => {
      selectedCustomer.value = customer;
      customerStatusReason.value = "";
    };
    const setCustomerStatus = async (accountStatus, reason) => {
      if (!reason || !reason.trim()) return;
      await api.request("PATCH", `/admin/customers/${selectedCustomer.value.id}/status`, { body: { accountStatus, reason } });
      selectedCustomer.value = null;
      await loadAdminCustomers();
    };

    const openCooperativeDetails = async (coop) => {
      selectedCooperative.value = await api.request("GET", `/admin/cooperatives/${coop.id}`).catch(() => coop);
    };
    const createCooperative = async () => {
      await api.request("POST", "/admin/cooperatives", { body: newCooperativeData.value });
      newCooperativeData.value = { name: "", location: "", registrationNumber: "" };
      await loadAdminCooperatives();
    };

    const openBookingDetails = async (booking) => {
      selectedBooking.value = { ...booking, invoice: await api.request("GET", `/admin/bookings/${booking.bookingId}/invoice`).catch(() => null) };
    };

    const closeAdminModals = () => {
      selectedRequest.value = null;
      selectedWorker.value = null;
      selectedCustomer.value = null;
      selectedCooperative.value = null;
      selectedBooking.value = null;
    };

    const openAddService = () => {
      newServiceData.value = { id: "", translationKey: "", baseRate: 200, hourlyRate: 100, icon: "wrench" };
      showAddServiceModal.value = true;
    };
    const openEditService = (svc) => {
      editingServiceData.value = { id: svc.id, baseRate: svc.baseRate, hourlyRate: svc.hourlyRate, isEnabled: svc.isEnabled };
      showEditServiceModal.value = true;
    };
    const addService = async () => {
      await api.request("POST", "/admin/services", { body: newServiceData.value });
      showAddServiceModal.value = false;
      await loadCatalog();
    };
    const editService = async () => {
      await api.request("PATCH", `/admin/services/${editingServiceData.value.id}`, {
        body: { baseRate: Number(editingServiceData.value.baseRate), hourlyRate: Number(editingServiceData.value.hourlyRate) }
      });
      showEditServiceModal.value = false;
      await loadCatalog();
    };
    const toggleServiceStatus = async (svc) => {
      await api.request("PATCH", `/admin/services/${svc.id}`, { body: { isEnabled: !svc.isEnabled } });
      await loadCatalog();
    };

    const submitBroadcast = async () => {
      const res = await api.request("POST", "/admin/notifications/broadcast", { body: broadcastForm.value }).catch((err) => {
        broadcastResult.value = apiErrorMessage(err);
        return null;
      });
      if (res) {
        broadcastResult.value = `${res.recipientCount}`;
        broadcastForm.value.title = "";
        broadcastForm.value.body = "";
      }
    };

    const saveAdminConfig = async () => {
      adminConfig.value = await api.request("PATCH", "/admin/config", { body: adminConfig.value });
    };

    const submitWalletAdjustment = async () => {
      walletAdjustmentResult.value = "";
      try {
        const res = await api.request("POST", "/admin/wallet/adjustments", {
          idempotencyKey: api.idempotencyKey(),
          body: {
            workerProfileId: walletAdjustmentForm.value.workerProfileId,
            amount: Number(walletAdjustmentForm.value.amount),
            direction: walletAdjustmentForm.value.direction,
            reason: walletAdjustmentForm.value.reason
          }
        });
        walletAdjustmentResult.value = res.status;
      } catch (err) {
        walletAdjustmentResult.value = apiErrorMessage(err);
      }
    };

    const runDemoReset = async () => {
      demoResetBusy.value = true;
      demoResetResult.value = "";
      try {
        await api.request("POST", "/admin/demo/reset");
        demoResetResult.value = "OK";
        await handleLogout();
      } catch (err) {
        demoResetResult.value = apiErrorMessage(err);
      } finally {
        demoResetBusy.value = false;
      }
    };

    // ----------------------------------------------------
    // Computed filters (admin lists — server already filters by query param
    // for status/verification; search is applied client-side over the
    // current page for responsiveness)
    // ----------------------------------------------------
    const filteredWorkers = computed(() =>
      adminWorkers.value.filter(
        (w) =>
          w.name.toLowerCase().includes(workerSearch.value.toLowerCase()) &&
          (!workerFilterAvailability.value || w.availabilityStatus === workerFilterAvailability.value) &&
          (!workerFilterCoop.value || w.cooperativeName === workerFilterCoop.value)
      )
    );
    const filteredCustomers = computed(() => adminCustomers.value.filter((c) => c.name.toLowerCase().includes(customerSearch.value.toLowerCase())));

    // ----------------------------------------------------
    // Initialize Lifecycle
    // ----------------------------------------------------
    onMounted(async () => {
      applyThemeClass();
      // Stats and catalog are independent of each other and of session
      // restore; awaiting them one after another stacked round trips before
      // the page settled.
      const bootData = Promise.all([loadPlatformStats(), loadCatalog()]);

      // Section 6.4 — silently rotate an access token from the httpOnly
      // refresh cookie if one is already valid (page reload continuity),
      // since the access token itself is memory-only and lost on reload.
      try {
        if (!hasSessionHint()) throw new Error("NO_SESSION");
        const token = await api.refreshSession();
        api.setAccessToken(token);
        // No role hint survives a reload; probe /users/me and route by its role.
        const profile = await api.request("GET", "/users/me");
        startSession();
        if (profile.role === "CUSTOMER") {
          loggedInCustomer.value = profile;
          currentRole.value = "customer";
        } else if (profile.role === "WORKER") {
          loggedInWorker.value = profile;
          currentRole.value = "worker";
        } else {
          loggedInAdmin.value = profile;
          currentRole.value = "admin";
        }
        currentView.value = "dashboard";
      } catch {
        setSessionHint(false);
        currentRole.value = "landing";
        currentView.value = "home";
      }
      await bootData;

      api.onExpired(() => {
        // Mirrors handleLogout's cleanup: this fires on a passive expiry
        // (refresh cookie expired/invalid), not just the explicit Log Out
        // button, so it must also tear down the socket and worker
        // location-ping interval — confirmed live: without this, a
        // left-open tab kept retrying the WebSocket forever with the dead
        // token (infinite reconnection is socket.io's default) and kept
        // firing the location-ping interval, both failing with 401s.
        endSession();
        loggedInCustomer.value = null;
        loggedInWorker.value = null;
        loggedInAdmin.value = null;
        activeBookingId.value = null;
        activeBooking.value = null;
        currentRole.value = "landing";
        currentView.value = "home";
      });

      setupLandingStatsObserver();

      window.addEventListener("scroll", () => {
        const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
        const progressBar = document.getElementById("scrollProgressBar");
        if (progressBar) progressBar.style.width = scrolled + "%";
        document.querySelectorAll(".parallax-bg").forEach((el) => {
          el.style.transform = `translateY(${winScroll * 0.15}px)`;
        });
      });

      // Re-armed on every role/view/tab change via the watch() below --
      // confirmed live (alongside the identical pattern in
      // setupLandingStatsObserver) that nothing previously disconnected
      // the prior observer, so every navigation anywhere in the app (not
      // just login/logout) permanently leaked one more IntersectionObserver
      // watching every .scroll-reveal element on the page. This was the
      // dominant contributor to the reported lag, since it fires on every
      // click that changes currentRole/currentView/adminTab, not only auth.
      let scrollRevealObserver = null;
      const setupScrollReveal = () => {
        if (typeof IntersectionObserver === "undefined") return;
        if (scrollRevealObserver) {
          scrollRevealObserver.disconnect();
          scrollRevealObserver = null;
        }
        scrollRevealObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                entry.target.querySelectorAll(".stagger-item").forEach((child, index) => {
                  setTimeout(() => child.classList.add("is-visible"), index * 80);
                });
              }
            });
          },
          { threshold: 0.05 }
        );
        document.querySelectorAll(".scroll-reveal").forEach((el) => scrollRevealObserver.observe(el));
      };
      setTimeout(setupScrollReveal, 100);

      watch([currentRole, currentView, adminTab], () => {
        setTimeout(setupScrollReveal, 150);
        setTimeout(() => {
          document.querySelectorAll("main .space-y-6, main .space-y-8, main .max-w-2xl, main .max-w-5xl").forEach((el) => {
            el.classList.remove("tab-content-transition");
            void el.offsetWidth;
            el.classList.add("tab-content-transition");
          });
        }, 50);
      });

      document.addEventListener("mousedown", (e) => {
        const btn = e.target.closest("button, .btn-interactive");
        if (!btn) return;
        btn.classList.add("ripple-container");
        const circle = document.createElement("span");
        const diameter = Math.max(btn.clientWidth, btn.clientHeight);
        const radius = diameter / 2;
        circle.style.width = circle.style.height = `${diameter}px`;
        const rect = btn.getBoundingClientRect();
        circle.style.left = `${e.clientX - rect.left - radius}px`;
        circle.style.top = `${e.clientY - rect.top - radius}px`;
        circle.classList.add("ripple");
        const prev = btn.querySelector(".ripple");
        if (prev) prev.remove();
        btn.appendChild(circle);
      });
    });

    onUnmounted(() => {
      if (locationPingInterval) clearInterval(locationPingInterval);
      if (candidatePollInterval) clearInterval(candidatePollInterval);
      stopOfferTicker();
      clearToasts();
    });

    // React to role switches by loading that role's dashboard data.
    // Section 15/1.2 — loads each role's initial dashboard data. Called both
    // by the currentRole watcher (session-restore-on-reload path, where
    // currentRole actually transitions from its "landing" default) and
    // directly from handleLogin/handleRegister (fresh-login path, where the
    // user already selected their role tab before authenticating, so
    // currentRole never changes value and the watcher alone would never fire).
    async function initializeRoleData(role) {
      if (role === "landing") {
        setupLandingStatsObserver();
      } else if (role === "customer" && loggedInCustomer.value) {
        // activeBookingId restores from localStorage on its own (the ref's
        // initializer reads it directly), but activeBooking — the detail
        // object gating the Track Request banner (index.html "v-if=
        // activeBooking") — does not: without this, a customer who reloads
        // mid-booking loses the banner and tracking button entirely even
        // though they still have an active booking, confirmed live via a
        // Playwright E2E run (Section 1.1.5's own "REST poll-fallback"
        // resync never actually ran on reload for the customer role, only
        // on explicit navigation). Mirrors the worker branch below, which
        // already restores its own active-job state on reload.
        await Promise.all([loadCustomerBookings(), refreshActiveBooking(), loadNotifications()]);
      } else if (role === "worker" && loggedInWorker.value) {
        // loadWallet/loadDemandHeatmap already existed for the separate
        // Earnings/Map & Demand pages (only triggered when navigating to
        // them) -- also loading them here so the dashboard's own earnings/
        // dividends/service-area-demand cards have real data immediately,
        // without a second nav-triggered fetch.
        await Promise.all([loadWorkerIncoming(), loadWorkerActiveJob(), loadWallet(), loadDemandHeatmap(), loadNotifications()]);
        if (loggedInWorker.value.workerProfile.availabilityStatus === "AVAILABLE") startLocationPinging();
      } else if (role === "admin" && loggedInAdmin.value) {
        setAdminTab("dashboard");
        loadNotifications();
      }
    }

    watch(currentRole, initializeRoleData);

    // ----------------------------------------------------
    // Landing page stats animation (unchanged visual behavior, now driven
    // by real GET /public/stats + GET /admin/dashboard/summary data)
    // ----------------------------------------------------
    const animatedWorkers = ref(0);
    const animatedDispatched = ref(0);
    const animatedCooperatives = ref(0);
    const statsAnimationCompleted = ref(false);
    const hasAnimatedOnce = ref(false);

    const triggerStatsAnimation = () => {
      const targetWorkers = platformStats.value.totalWorkers;
      const targetDispatched = platformStats.value.completedBookings;
      const targetCooperatives = platformStats.value.activeCooperatives;
      const duration = 1800;
      const startTime = performance.now();
      const startW = animatedWorkers.value;
      const startD = animatedDispatched.value;
      const startC = animatedCooperatives.value;
      statsAnimationCompleted.value = false;

      const animateStep = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress * (2 - progress);
        animatedWorkers.value = Math.floor(startW + (targetWorkers - startW) * ease);
        animatedDispatched.value = Math.floor(startD + (targetDispatched - startD) * ease);
        animatedCooperatives.value = Math.floor(startC + (targetCooperatives - startC) * ease);
        if (progress < 1) requestAnimationFrame(animateStep);
        else {
          animatedWorkers.value = targetWorkers;
          animatedDispatched.value = targetDispatched;
          animatedCooperatives.value = targetCooperatives;
          statsAnimationCompleted.value = true;
          hasAnimatedOnce.value = true;
        }
      };
      requestAnimationFrame(animateStep);
    };

    watch(() => [platformStats.value.totalWorkers, platformStats.value.completedBookings, platformStats.value.activeCooperatives], () => {
      if (hasAnimatedOnce.value) triggerStatsAnimation();
    });

    // Re-armed on every return to the landing page (initializeRoleData's
    // "landing" branch runs on every logout via watch(currentRole, ...)).
    // Confirmed live: nothing previously disconnected the prior
    // IntersectionObserver or cleared the prior setTimeouts, so each
    // login/logout cycle left one more observer permanently watching
    // #landing-stats -- with N leaked observers all firing
    // triggerStatsAnimation() together, N independent requestAnimationFrame
    // loops end up writing the same three refs every frame, and the UI
    // (including the login/logout buttons) gets laggier with every cycle.
    // Tracking and tearing down the previous observer/timers here keeps
    // exactly one of each alive at a time.
    let landingStatsObserver = null;
    let landingStatsTimeout1 = null;
    let landingStatsTimeout2 = null;
    const setupLandingStatsObserver = () => {
      if (landingStatsObserver) {
        landingStatsObserver.disconnect();
        landingStatsObserver = null;
      }
      if (landingStatsTimeout1) clearTimeout(landingStatsTimeout1);
      if (landingStatsTimeout2) clearTimeout(landingStatsTimeout2);

      landingStatsTimeout1 = setTimeout(() => {
        const statsEl = document.getElementById("landing-stats");
        if (statsEl) {
          animatedWorkers.value = 0;
          animatedDispatched.value = 0;
          animatedCooperatives.value = 0;
          statsAnimationCompleted.value = false;
          hasAnimatedOnce.value = false;
          landingStatsObserver = new IntersectionObserver(
            (entries) => entries.forEach((entry) => entry.isIntersecting && triggerStatsAnimation()),
            { threshold: 0.15 }
          );
          landingStatsObserver.observe(statsEl);
        }
        landingStatsTimeout2 = setTimeout(() => {
          if (!hasAnimatedOnce.value) triggerStatsAnimation();
        }, 1500);
      }, 150);
    };

    // ====================================================
    // Round-2 UI layer: presentational state and view-models derived from the
    // API-backed refs above. Nothing below fabricates data or calls an
    // endpoint that the handlers above don't already call.
    // ====================================================

    // ---------------- Session helpers ----------------
    const currentActiveUser = computed(() => {
      if (currentRole.value === "customer") return loggedInCustomer.value;
      if (currentRole.value === "worker") return loggedInWorker.value;
      if (currentRole.value === "admin") return loggedInAdmin.value;
      return loggedInCustomer.value || loggedInWorker.value || loggedInAdmin.value || null;
    });

    // ---------------- Toasts ----------------
    const toasts = ref([]);
    const toastTimers = new Map();
    const dismissToast = (id) => {
      if (toastTimers.has(id)) {
        clearTimeout(toastTimers.get(id));
        toastTimers.delete(id);
      }
      toasts.value = toasts.value.filter((toast) => toast.id !== id);
    };
    const showToast = (title, message = "", type = "info", duration = 3500) => {
      const id = Date.now() + Math.random();
      toasts.value.push({ id, title, message, type });
      toastTimers.set(id, setTimeout(() => dismissToast(id), duration));
    };
    function clearToasts() {
      toastTimers.forEach((timer) => clearTimeout(timer));
      toastTimers.clear();
      toasts.value = [];
    }

    // ---------------- Header dropdowns ----------------
    const isNotificationDropdownOpen = ref(false);
    const isProfileMenuOpen = ref(false);
    const toggleNotifications = () => {
      isNotificationDropdownOpen.value = !isNotificationDropdownOpen.value;
      if (isNotificationDropdownOpen.value) {
        isProfileMenuOpen.value = false;
        if (currentActiveUser.value) loadNotifications();
      }
    };
    const toggleProfileMenu = () => {
      isProfileMenuOpen.value = !isProfileMenuOpen.value;
      if (isProfileMenuOpen.value) isNotificationDropdownOpen.value = false;
    };
    const closeHeaderDropdowns = () => {
      isNotificationDropdownOpen.value = false;
      isProfileMenuOpen.value = false;
    };

    // ---------------- Service catalog ----------------
    const serviceSearchQuery = ref("");
    const selectedServiceCategory = ref("all");
    const previewService = ref(null);
    const SERVICE_CATEGORY_MEMBERS = {
      repairs: ["plumbing", "electrical", "carpentry", "painting"],
      cleaning: ["cleaning"],
      care: ["caregiving", "domesticHelp"],
      outdoor: ["gardening"]
    };
    const serviceCategories = computed(() => [
      { id: "all", label: t("categoryAll"), icon: "fa-solid fa-border-all" },
      { id: "repairs", label: t("categoryRepairs"), icon: "fa-solid fa-wrench" },
      { id: "cleaning", label: t("categoryCleaning"), icon: "fa-solid fa-broom" },
      { id: "care", label: t("categoryCare"), icon: "fa-solid fa-heart" },
      { id: "outdoor", label: t("categoryOutdoor"), icon: "fa-solid fa-seedling" }
    ]);
    const getServiceDescription = (serviceId) => {
      const key = "serviceDesc_" + serviceId;
      const text = t(key);
      return text === key ? t("serviceDescFallback") : text;
    };
    const filteredServices = computed(() => {
      let list = services.value || [];
      const members = SERVICE_CATEGORY_MEMBERS[selectedServiceCategory.value];
      if (members) list = list.filter((svc) => members.includes(svc.id));
      const query = serviceSearchQuery.value.trim().toLowerCase();
      if (query) {
        list = list.filter((svc) =>
          [t(svc.translationKey), svc.id, getServiceDescription(svc.id)].some((text) => String(text).toLowerCase().includes(query))
        );
      }
      return list;
    });
    const openServicePreview = (svc) => {
      previewService.value = svc;
    };
    const closeServicePreview = () => {
      previewService.value = null;
    };

    const recentServices = computed(() => {
      const seen = new Set();
      const recent = [];
      for (const booking of customerBookings.value) {
        if (seen.has(booking.serviceCategoryId)) continue;
        seen.add(booking.serviceCategoryId);
        recent.push({
          id: booking.serviceCategoryId,
          label: getServiceName(booking.serviceCategoryId),
          when: new Intl.DateTimeFormat(localeTag(), { dateStyle: "medium" }).format(new Date(booking.createdAt))
        });
        if (recent.length === 3) break;
      }
      return recent;
    });
    const selectRecentService = (serviceId) => {
      const svc = services.value.find((s) => s.id === serviceId);
      if (svc) openServicePreview(svc);
    };

    // Service illustration SVGs (static markup from the round-2 design)
    const serviceSvgMap = {
      plumbing: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-7 h-7">
        <path d="M4 15h6v4H4z" fill="#93C5FD"/>
        <path d="M4 13.5h2.5v7H4z" fill="#60A5FA"/>
        <path d="M8 15h6a3 3 0 013 3v2h-4v-2a1 1 0 00-1-1H8v-2z" fill="#2563EB"/>
        <rect x="9.5" y="8" width="5" height="2.5" rx="1" fill="#1D4ED8"/>
        <rect x="8" y="7" width="8" height="2" rx="1" fill="#60A5FA"/>
        <circle cx="12" cy="8" r="0.6" fill="#FFFFFF"/>
        <path d="M13 17h4a2 2 0 012 2v2h-3.5a1 1 0 01-1-1v-2a1 1 0 00-1-1h-.5z" fill="#1D4ED8"/>
        <rect x="15.5" y="20.5" width="4" height="1.5" rx="0.75" fill="#60A5FA"/>
        <path d="M17.5 24c0 0-1.8 1.8-1.8 2.8a1.8 1.8 0 003.6 0c0-1-1.8-2.8-1.8-2.8z" fill="#38BDF8"/>
        <circle cx="18" cy="26.3" r="0.4" fill="#FFFFFF"/>
        <path d="M22 8l4 4-2 2-1.5-1.5-3 3 1.5 1.5-2 2-4-4 2-2 1.5 1.5 3-3L20 10l2-2z" fill="#93C5FD" opacity="0.85"/>
        <circle cx="24.5" cy="10.5" r="0.9" fill="#FFFFFF"/>
      </svg>`,

      electrical: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-7 h-7">
        <rect x="5" y="16" width="9" height="9" rx="2" fill="#1D4ED8"/>
        <rect x="6.5" y="14" width="6" height="2" rx="0.5" fill="#60A5FA"/>
        <rect x="6.5" y="9" width="1.8" height="5" rx="0.5" fill="#93C5FD"/>
        <rect x="10.7" y="9" width="1.8" height="5" rx="0.5" fill="#93C5FD"/>
        <circle cx="7.4" cy="11" r="0.4" fill="#1D4ED8"/>
        <circle cx="11.6" cy="11" r="0.4" fill="#1D4ED8"/>
        <path d="M9.5 25v2.5a2 2 0 002 2h3" stroke="#93C5FD" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M22 3.5l-7.5 11.5h5.5l-3.5 12.5 11-14.5h-6l4-9.5z" fill="#2563EB"/>
        <path d="M21 5.5l-5.5 8.5h4.5l-2.5 9 8-11h-4.8l2.8-6.5z" fill="#60A5FA"/>
        <circle cx="20.5" cy="8.5" r="0.75" fill="#FFFFFF"/>
      </svg>`,

      carpentry: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-7 h-7">
        <rect x="4" y="21" width="24" height="6" rx="2" fill="#DBEAFE"/>
        <path d="M7 24h18" stroke="#93C5FD" stroke-width="1" stroke-dasharray="3 2"/>
        <path d="M13 6.5l4.8-3.2 2.4 3.4-1.8 1.2 3.8 5.4-2.6 1.8-3.8-5.4-1.4 1-2.4-3.4 1-.8z" fill="#1D4ED8"/>
        <path d="M18.2 3.1l2.4 3.4-0.8 0.5-2.4-3.4 0.8-0.5z" fill="#60A5FA"/>
        <path d="M13 6.5c-1.8 0-3.6 1.3-4.5 3 1.3-.4 2.7-.4 4 0l.5-3z" fill="#60A5FA"/>
        <path d="M16.2 12.8l8.2 11.6a1.5 1.5 0 01-2.5 1.8l-8.2-11.6 2.5-1.8z" fill="#2563EB"/>
        <rect x="21.5" y="22" width="3" height="3" rx="1" fill="#60A5FA"/>
        <path d="M8 17.5v3.5" stroke="#60A5FA" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="8" cy="17" r="1.1" fill="#1D4ED8"/>
      </svg>`,

      painting: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-7 h-7">
        <rect x="6" y="4" width="16" height="5" rx="2" fill="#DBEAFE"/>
        <rect x="7" y="5" width="14" height="6" rx="2.5" fill="#2563EB"/>
        <rect x="9" y="6" width="10" height="2" rx="1" fill="#60A5FA"/>
        <circle cx="8" cy="8" r="0.75" fill="#FFFFFF"/>
        <path d="M21 8h3a1 1 0 011 1v5.5a1 1 0 01-1 1h-6v4" stroke="#1D4ED8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="16.5" y="19.5" width="3" height="7" rx="1.5" fill="#60A5FA"/>
        <path d="M5 22l3-3 3.5 3.5-3 3H5v-3.5z" fill="#1D4ED8"/>
        <path d="M8 19l2-2 1.5 1.5-2 2L8 19z" fill="#93C5FD"/>
        <path d="M9.5 24.5l-2.5 2.5" stroke="#38BDF8" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="6" cy="27.5" r="1.2" fill="#38BDF8"/>
        <circle cx="11" cy="27" r="0.75" fill="#60A5FA"/>
      </svg>`,

      caregiving: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-7 h-7">
        <path d="M16 8c-2.4-3.3-6.8-2.3-7.8 1.4-.9 3.8 4.3 8 7.8 11 3.4-3 8.7-7.2 7.8-11-.9-3.7-5.4-4.7-7.8-1.4z" fill="#2563EB"/>
        <path d="M16 10.5c-1.8-2.4-5-1.7-5.7 1-.7 2.7 3.1 5.8 5.7 7.8 2.6-2 6.4-5.1 5.7-7.8-.7-2.7-3.9-3.4-5.7-1z" fill="#60A5FA" opacity="0.65"/>
        <path d="M5 20c2 1.2 5 0.8 7-1l4 4-2.5 3c-4 1-7-1-9-3l.5-3z" fill="#60A5FA"/>
        <path d="M27 20c-2 1.2-5 0.8-7-1l-4 4 2.5 3c4 1 7-1 9-3l-.5-3z" fill="#1D4ED8"/>
        <rect x="15" y="11" width="2" height="5.5" rx="0.5" fill="#FFFFFF"/>
        <rect x="13.25" y="12.75" width="5.5" height="2" rx="0.5" fill="#FFFFFF"/>
      </svg>`,

      gardening: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-7 h-7">
        <path d="M4 27c3-2 8-2 12 0 4-2 9-2 12 0H4z" fill="#DBEAFE"/>
        <path d="M6 26c3-1.5 7-1.5 10 0" stroke="#93C5FD" stroke-width="1" stroke-linecap="round"/>
        <path d="M14 26c0-7 2-12 5-15" stroke="#1D4ED8" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M16 19c-4 0-7-2-8-6 4-1 8 1 8 6z" fill="#60A5FA"/>
        <path d="M12 16c2 1 4 2 4 3" stroke="#FFFFFF" stroke-width="0.8" stroke-linecap="round"/>
        <path d="M19 11c1-4 4-6 8-6 0 4-3 7-8 6z" fill="#2563EB"/>
        <path d="M22 8c-1 2-2 3-3 3" stroke="#93C5FD" stroke-width="0.8" stroke-linecap="round"/>
        <path d="M23 16l3 3-5 5-2-1 4-7z" fill="#2563EB"/>
        <path d="M24 21l3 3" stroke="#1D4ED8" stroke-width="2" stroke-linecap="round"/>
        <circle cx="26.5" cy="23.5" r="0.6" fill="#FFFFFF"/>
      </svg>`,

      cleaning: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-7 h-7">
        <path d="M6 13.5L14 6.5l8 7V24a2 2 0 01-2 2H8a2 2 0 01-2-2V13.5z" fill="#DBEAFE"/>
        <path d="M4 15L14 6.5 24 15" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="11.5" y="13.5" width="5" height="5" rx="1" fill="#FFFFFF"/>
        <line x1="14" y1="13.5" x2="14" y2="18.5" stroke="#93C5FD" stroke-width="0.8"/>
        <line x1="11.5" y1="16" x2="16.5" y2="16" stroke="#93C5FD" stroke-width="0.8"/>
        <line x1="28" y1="9" x2="19" y2="21" stroke="#1D4ED8" stroke-width="2" stroke-linecap="round"/>
        <path d="M18 20.5l3.5 2-2.5 5.5a1.5 1.5 0 01-2.5-.5L18 20.5z" fill="#2563EB"/>
        <path d="M17.5 22.5l3 1.8" stroke="#60A5FA" stroke-width="1.2"/>
        <path d="M26 3.5l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8.8-1.8z" fill="#38BDF8"/>
        <path d="M7 6.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2z" fill="#60A5FA"/>
        <circle cx="28.5" cy="18" r="0.75" fill="#38BDF8"/>
      </svg>`,

      domestichelp: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-7 h-7">
        <path d="M4 22h24a1 1 0 011 1v1H3v-1a1 1 0 011-1z" fill="#1D4ED8"/>
        <rect x="6" y="24" width="20" height="2" rx="1" fill="#60A5FA"/>
        <path d="M6 21a10 10 0 0120 0H6z" fill="#2563EB"/>
        <circle cx="16" cy="10" r="2" fill="#60A5FA"/>
        <rect x="15" y="11" width="2" height="1" fill="#1D4ED8"/>
        <path d="M9 19a7 7 0 016-7" stroke="#93C5FD" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M13 6.5c0-1.5 1-2 1-3" stroke="#38BDF8" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M16 5.5c0-1.5 1-2 1-3" stroke="#93C5FD" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M19 6.5c0-1.5 1-2 1-3" stroke="#38BDF8" stroke-width="1.2" stroke-linecap="round"/>
      </svg>`,

      appliance: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-7 h-7">
        <rect x="5" y="8" width="16" height="18" rx="2" fill="#DBEAFE"/>
        <rect x="7" y="11" width="12" height="7" rx="1" fill="#2563EB"/>
        <circle cx="9" cy="14.5" r="1.5" fill="#FFFFFF"/>
        <rect x="13" y="13" width="4" height="3" rx="0.5" fill="#60A5FA"/>
        <circle cx="10" cy="22" r="1.5" fill="#1D4ED8"/>
        <circle cx="16" cy="22" r="1.5" fill="#1D4ED8"/>
        <path d="M22 6l5 5-2.5 2.5-1.5-1.5-3 3 1.5 1.5-2.5 2.5-5-5 2.5-2.5 1.5 1.5 3-3-1.5-1.5L22 6z" fill="#2563EB"/>
        <path d="M23 7l2 2-1 1-2-2 1-1z" fill="#60A5FA"/>
      </svg>`,

      ac: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-7 h-7">
        <rect x="4" y="6" width="24" height="11" rx="2" fill="#2563EB"/>
        <rect x="7" y="9" width="18" height="2" rx="0.5" fill="#93C5FD"/>
        <rect x="22" y="13" width="3" height="1.5" rx="0.5" fill="#38BDF8"/>
        <path d="M6 17h20v2a1 1 0 01-1 1H7a1 1 0 01-1-1v-2z" fill="#1D4ED8"/>
        <path d="M10 23c2 2 4 2 6 0s4-2 6 0" stroke="#38BDF8" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M8 26c2 2 4 2 6 0s4-2 6 0" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="16" cy="28" r="0.75" fill="#93C5FD"/>
      </svg>`,

      pestcontrol: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-7 h-7">
        <path d="M16 4l10 4v8c0 6-4.5 11-10 13-5.5-2-10-7-10-13V8l10-4z" fill="#2563EB"/>
        <path d="M16 6.5l7.5 3v6c0 4.5-3.5 8.5-7.5 10-4-1.5-7.5-5.5-7.5-10v-6l7.5-3z" fill="#60A5FA" opacity="0.6"/>
        <circle cx="16" cy="15" r="4" stroke="#FFFFFF" stroke-width="1.5"/>
        <line x1="16" y1="9" x2="16" y2="21" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="10" y1="15" x2="22" y2="15" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="16" cy="15" r="1.5" fill="#FFFFFF"/>
      </svg>`,

      moving: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-7 h-7">
        <path d="M6 13l10-5 10 5v11a2 2 0 01-2 2H8a2 2 0 01-2-2V13z" fill="#2563EB"/>
        <path d="M6 13l10 5 10-5" stroke="#1D4ED8" stroke-width="1.5"/>
        <path d="M16 18v9" stroke="#1D4ED8" stroke-width="1.5"/>
        <path d="M12 10.5l4 2 4-2" stroke="#93C5FD" stroke-width="1.5"/>
        <rect x="13.5" y="14" width="5" height="4" rx="0.5" fill="#60A5FA"/>
        <circle cx="25" cy="27" r="2.5" fill="#1D4ED8"/>
        <circle cx="25" cy="27" r="1" fill="#FFFFFF"/>
      </svg>`,

      default: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-7 h-7">
        <rect x="5" y="10" width="22" height="16" rx="3" fill="#2563EB"/>
        <path d="M11 10V7a2 2 0 012-2h6a2 2 0 012 2v3" stroke="#1D4ED8" stroke-width="2" stroke-linecap="round"/>
        <rect x="5" y="15" width="22" height="3" fill="#1D4ED8"/>
        <rect x="13" y="14" width="6" height="5" rx="1" fill="#60A5FA"/>
        <circle cx="16" cy="16.5" r="1" fill="#FFFFFF"/>
      </svg>`
    };

    // Aliases for common icon or category identifiers
    serviceSvgMap.wrench = serviceSvgMap.plumbing;
    serviceSvgMap.zap = serviceSvgMap.electrical;
    serviceSvgMap.bolt = serviceSvgMap.electrical;
    serviceSvgMap.hammer = serviceSvgMap.carpentry;
    serviceSvgMap["paint-brush"] = serviceSvgMap.painting;
    serviceSvgMap.paintbrush = serviceSvgMap.painting;
    serviceSvgMap.heart = serviceSvgMap.caregiving;
    serviceSvgMap.flower = serviceSvgMap.gardening;
    serviceSvgMap.sparkles = serviceSvgMap.cleaning;
    serviceSvgMap.utensils = serviceSvgMap.domestichelp;
    serviceSvgMap.cooling = serviceSvgMap.ac;

    const getServiceSvg = (serviceId) => {
      if (!serviceId) return serviceSvgMap.default;
      const key = String(serviceId).toLowerCase().replace(/[\s_-]/g, "");
      return serviceSvgMap[key] || serviceSvgMap[String(serviceId).toLowerCase()] || serviceSvgMap.default;
    };

    // ---------------- Multi-step request wizard ----------------
    const requestStep = ref(1);
    const isSubmittingRequest = ref(false);
    const canContinueRequestStep = computed(() => {
      if (requestStep.value === 1) return !!requestForm.value.serviceId;
      if (requestStep.value === 2) return !!requestForm.value.datetime;
      if (requestStep.value === 3) return !!requestForm.value.location && requestForm.value.location.trim().length >= 3;
      return true;
    });
    const nextRequestStep = () => {
      if (!canContinueRequestStep.value) {
        showToast(t("stepIncompleteToast"), "", "warning", 2500);
        return;
      }
      if (requestStep.value < 4) requestStep.value++;
    };
    const prevRequestStep = () => {
      if (requestStep.value > 1) requestStep.value--;
      else navigateTo("dashboard");
    };
    const goToRequestStep = (step) => {
      const f = requestForm.value;
      if (step === 1) requestStep.value = 1;
      else if (step === 2 && f.serviceId) requestStep.value = 2;
      else if (step === 3 && f.serviceId && f.datetime) requestStep.value = 3;
      else if (step === 4 && f.serviceId && f.datetime && f.location) requestStep.value = 4;
    };
    // datetime-local inputs take local wall-clock time, not UTC.
    const toLocalInputValue = (date) => {
      const pad = (n) => String(n).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    const setQuickDatePreset = (preset) => {
      const d = new Date();
      if (preset === "today_2h") d.setHours(d.getHours() + 2);
      else if (preset === "tomorrow_morning") {
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
      } else if (preset === "tomorrow_evening") {
        d.setDate(d.getDate() + 1);
        d.setHours(16, 0, 0, 0);
      }
      requestForm.value.datetime = toLocalInputValue(d);
    };
    // No reverse-geocoding service exists, so this fills the device's real
    // coordinates (or getCoordinates' documented demo fallback) rather than
    // inventing a street address.
    const useCurrentLocation = async () => {
      const { lat, lng } = await getCoordinates();
      requestForm.value.location = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      showToast(t("locationDetectedToast"), requestForm.value.location, "success", 3000);
    };

    const activeBookingSummary = computed(() => customerBookings.value.find((b) => b.id === activeBookingId.value) || null);
    const customerBookingSearch = ref("");
    const filteredCustomerBookings = computed(() => {
      const query = customerBookingSearch.value.trim().toLowerCase();
      if (!query) return customerBookings.value;
      return customerBookings.value.filter((b) =>
        [b.id, b.description, b.workerName || "", getServiceName(b.serviceCategoryId), stageLabel(b.status)].some((text) => String(text).toLowerCase().includes(query))
      );
    });

    // Display-only candidate card expansion (customer matching) and admin worker row expansion.
    const expandedWorkerId = ref(null);
    const toggleExpandWorker = (id) => {
      expandedWorkerId.value = expandedWorkerId.value === id ? null : id;
    };

    // ---------------- Worker ----------------
    const availabilityBusy = ref(false);
    const toggleAvailabilityWithFeedback = async () => {
      if (availabilityBusy.value) return;
      availabilityBusy.value = true;
      loginError.value = "";
      try {
        await toggleAvailability();
        if (loginError.value) showToast(t("actionFailedToast"), loginError.value, "error");
      } finally {
        availabilityBusy.value = false;
      }
    };

    const jobActionBusy = ref(false);
    const runJobAction = async (action) => {
      if (jobActionBusy.value) return;
      jobActionBusy.value = true;
      loginError.value = "";
      try {
        await action();
        if (loginError.value) showToast(t("actionFailedToast"), loginError.value, "error");
      } finally {
        jobActionBusy.value = false;
      }
    };

    const offerBusy = reactive({});
    const respondToOffer = async (dispatchLogId, response) => {
      if (offerBusy[dispatchLogId]) return;
      offerBusy[dispatchLogId] = response;
      loginError.value = "";
      try {
        if (response === "ACCEPT") await handleWorkerAccept(dispatchLogId);
        else await handleWorkerReject(dispatchLogId);
        if (loginError.value) showToast(t("actionFailedToast"), loginError.value, "error");
        else if (response === "ACCEPT") showToast(t("offerAcceptedToast"), "", "success");
      } finally {
        delete offerBusy[dispatchLogId];
      }
    };

    // One 1s ticker drives the offer countdowns (display only — the server
    // enforces expiry). It only runs while offers are on screen and is torn
    // down on logout/expiry/unmount.
    const nowTick = ref(Date.now());
    let offerTickInterval = null;
    function stopOfferTicker() {
      if (offerTickInterval) {
        clearInterval(offerTickInterval);
        offerTickInterval = null;
      }
    }
    watch(
      () => workerIncoming.value.length,
      (count) => {
        if (count > 0 && !offerTickInterval) {
          nowTick.value = Date.now();
          offerTickInterval = setInterval(() => (nowTick.value = Date.now()), 1000);
        } else if (count === 0) stopOfferTicker();
      }
    );
    const offerSecondsLeft = (job) => Math.max(0, Math.round((new Date(job.offerExpiresAt).getTime() - nowTick.value) / 1000));

    const workerJobStageIndex = (status) => ({ ASSIGNED: 0, CONFIRMED: 0, IN_PROGRESS: 1, COMPLETED: 2, SETTLED: 2 })[status] ?? 0;

    const workerOrderStatusFilter = ref("");
    const ORDER_FILTER_STATUSES = { ACTIVE: ["ASSIGNED", "CONFIRMED", "IN_PROGRESS"], DONE: ["COMPLETED", "SETTLED"], CANCELLED: ["CANCELLED"] };
    const filteredWorkerBookings = computed(() => {
      const allowed = ORDER_FILTER_STATUSES[workerOrderStatusFilter.value];
      return allowed ? workerBookings.value.filter((b) => allowed.includes(b.status)) : workerBookings.value;
    });

    const earningsFilterType = ref("");
    const earningsFilterStatus = ref("");
    const showFilterDrawer = ref(false);
    const filteredTransactions = computed(() =>
      walletInfo.value.transactions.filter(
        (tx) => (!earningsFilterType.value || tx.type === earningsFilterType.value) && (!earningsFilterStatus.value || tx.status === earningsFilterStatus.value)
      )
    );
    const txnTypeLabel = (type) => {
      const key = "txnType_" + type;
      const text = t(key);
      return text === key ? type : text;
    };
    // "today" uses the server's figure (computed over the full ledger); week/
    // month are derived from the latest transactions the wallet endpoint returns.
    const earningsPeriodTotal = computed(() => {
      if (earningsTab.value === "today") return walletInfo.value.todayEarnings;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      if (earningsTab.value === "week") start.setDate(start.getDate() - start.getDay());
      else start.setDate(1);
      return walletInfo.value.transactions
        .filter((tx) => tx.type === "JOB_PAYOUT" && tx.status === "COMPLETED" && new Date(tx.createdAt) >= start)
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
    });
    const redemptionHistory = computed(() => walletInfo.value.transactions.filter((tx) => tx.type === "REDEMPTION"));

    const selectedIncentive = ref(null);
    const incentiveStatusLabel = (status) => t("incentiveStatus" + status.charAt(0) + status.slice(1).toLowerCase());
    const verificationLabel = (status) => t("verification" + status.charAt(0) + status.slice(1).toLowerCase());
    const AVAILABILITY_KEY = { AVAILABLE: "available", ON_JOB: "statusOnJob", TRAVELLING: "statusTravelling", OFF_DUTY: "statusOffDuty" };
    const availabilityLabel = (status) => t(AVAILABILITY_KEY[status] || status);

    const selectedMapZone = ref(null);
    const selectMapZone = (cell) => {
      selectedMapZone.value = selectedMapZone.value && selectedMapZone.value.cellId === cell.cellId ? null : cell;
    };
    // Projects real lat/lng into a 0-100% box, preserving relative position only.
    function projectPoints(items, getLat, getLng, minPct, maxPct) {
      const withCoords = items.filter((item) => getLat(item) !== null && getLat(item) !== undefined && getLng(item) !== null && getLng(item) !== undefined);
      if (withCoords.length === 0) return [];
      const lats = withCoords.map(getLat);
      const lngs = withCoords.map(getLng);
      const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
      const scale = (value, min, max) => (max - min < 1e-9 ? 0.5 : (value - min) / (max - min));
      return withCoords.map((item) => ({
        item,
        x: minPct + scale(getLng(item), minLng, maxLng) * (maxPct - minPct),
        y: minPct + (1 - scale(getLat(item), minLat, maxLat)) * (maxPct - minPct)
      }));
    }
    const demandPlotPoints = computed(() =>
      projectPoints(demandHeatmap.value, (c) => c.centroid.lat, (c) => c.centroid.lng, 12, 88).map((p) => ({ cell: p.item, x: p.x, y: p.y }))
    );
    const myCooperative = computed(() => {
      const id = loggedInWorker.value?.workerProfile?.cooperativeId;
      return cooperatives.value.find((c) => c.id === id) || null;
    });

    // ---------------- Admin ----------------
    const adminActionBusy = ref(false);
    const runAdminAction = async (action, successMessage) => {
      if (adminActionBusy.value) return;
      adminActionBusy.value = true;
      try {
        await action();
        if (successMessage) showToast(successMessage, "", "success");
      } catch (err) {
        showToast(t("actionFailedToast"), apiErrorMessage(err), "error", 5000);
      } finally {
        adminActionBusy.value = false;
      }
    };
    const confirmDemoReset = () => {
      if (window.confirm(t("demoResetWarning"))) runDemoReset();
    };

    const STATUS_BADGE = {
      COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
      SETTLED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
      CANCELLED: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      ASSIGNED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
      CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
      IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
    };
    const statusBadgeClass = (status) => STATUS_BADGE[status] || "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";

    const adminAvailablePct = computed(() => {
      const { totalWorkers, availableWorkers } = adminDashboard.value;
      return totalWorkers ? Math.round((availableWorkers / totalWorkers) * 100) : 0;
    });

    const matchesQuery = (query, fields) => !query || fields.some((field) => String(field ?? "").toLowerCase().includes(query));
    const requestSearch = ref("");
    const filteredRequests = computed(() => {
      const query = requestSearch.value.trim().toLowerCase();
      return adminBookings.value.filter((b) => matchesQuery(query, [b.id, b.customerName, b.workerName, getServiceName(b.serviceCategoryId)]));
    });
    const bookingSearch = ref("");
    const filteredBookings = computed(() => {
      const query = bookingSearch.value.trim().toLowerCase();
      return adminBookingsLedger.value.filter((b) => matchesQuery(query, [b.bookingId, b.paymentMethod, b.paymentStatus]));
    });
    const auditSearch = ref("");
    const filteredAuditLogs = computed(() => {
      const query = auditSearch.value.trim().toLowerCase();
      return adminAuditLogs.value.filter((log) => matchesQuery(query, [log.action, log.entityType, log.entityId]));
    });

    const workerFilterAvailability = ref("");
    const workerFilterCoop = ref("");
    const customerStatusReason = ref("");

    const forceAssignCandidates = computed(() => {
      const logs = selectedRequest.value?.dispatchLog || [];
      const seen = new Set();
      const fromLog = logs
        .filter((log) => !seen.has(log.workerId) && seen.add(log.workerId))
        .map((log) => ({ id: log.workerId, name: log.workerName }));
      if (fromLog.length) return fromLog;
      return adminWorkers.value.filter((w) => w.verificationStatus === "APPROVED" && !w.suspended).map((w) => ({ id: w.id, name: w.name }));
    });

    const topSectorMax = computed(() => Math.max(0, ...adminReports.value.topSectors.map((s) => s.completedCount)));
    const broadcastResultLabel = computed(() =>
      /^\d+$/.test(broadcastResult.value) ? t("broadcastSentTo", { count: broadcastResult.value }) : broadcastResult.value
    );

    // Live operations: real positions from GET /admin/live/workers, kept current by
    // the worker:location socket event. Zoom/pan only changes the SVG viewBox.
    const liveAdminFilterStatus = ref("All");
    const liveWorkerSearch = ref("");
    const filteredLiveWorkers = computed(() => {
      const query = liveWorkerSearch.value.trim().toLowerCase();
      return adminLiveWorkers.value.filter(
        (w) => (liveAdminFilterStatus.value === "All" || w.status === liveAdminFilterStatus.value) && matchesQuery(query, [w.name])
      );
    });
    const liveStatsTotalWorkers = computed(() => adminLiveWorkers.value.length);
    const liveStatsAvailable = computed(() => adminLiveWorkers.value.filter((w) => w.status === "AVAILABLE").length);
    const liveStatsOnJob = computed(() => adminLiveWorkers.value.filter((w) => w.status === "ON_JOB").length);
    const liveStatsTravelling = computed(() => adminLiveWorkers.value.filter((w) => w.status === "TRAVELLING").length);
    const liveStatsOffDuty = computed(() => adminLiveWorkers.value.filter((w) => w.status === "OFF_DUTY").length);
    const liveStatsActiveJobs = computed(() => adminLiveWorkers.value.filter((w) => w.bookingId).length);

    const MAP_W = 600;
    const MAP_H = 400;
    const mapZoom = ref(1);
    const mapCenter = ref({ x: MAP_W / 2, y: MAP_H / 2 });
    const computedViewBox = computed(() => {
      const w = MAP_W / mapZoom.value;
      const h = MAP_H / mapZoom.value;
      return `${mapCenter.value.x - w / 2} ${mapCenter.value.y - h / 2} ${w} ${h}`;
    });
    // Workers cluster tightly (most share a city), so a name label is only drawn
    // when its on-screen box doesn't overlap one already placed. Zooming in
    // spreads points apart, so more labels appear as the user zooms.
    const LABEL_W = 70;
    const LABEL_H = 14;
    const livePlotPoints = computed(() => {
      const zoom = mapZoom.value;
      const placed = [];
      return projectPoints(filteredLiveWorkers.value, (w) => w.lat, (w) => w.lng, 8, 92).map((p) => {
        const x = (p.x / 100) * MAP_W;
        const y = (p.y / 100) * MAP_H;
        const sx = x * zoom;
        const sy = y * zoom;
        const showLabel = !placed.some((q) => Math.abs(q.sx - sx) < LABEL_W && Math.abs(q.sy - sy) < LABEL_H);
        if (showLabel) placed.push({ sx, sy });
        return { worker: p.item, x, y, showLabel };
      });
    });
    const zoomIn = () => (mapZoom.value = Math.min(6, mapZoom.value * 1.5));
    const zoomOut = () => (mapZoom.value = Math.max(1, mapZoom.value / 1.5));
    const fitAll = () => {
      mapZoom.value = 1;
      mapCenter.value = { x: MAP_W / 2, y: MAP_H / 2 };
    };
    const selectedWorkerId = ref(null);
    const selectedLiveWorker = computed(() => adminLiveWorkers.value.find((w) => w.workerId === selectedWorkerId.value) || null);
    const focusWorker = (worker) => {
      selectedWorkerId.value = worker.workerId;
      const point = livePlotPoints.value.find((p) => p.worker.workerId === worker.workerId);
      if (point) {
        mapCenter.value = { x: point.x, y: point.y };
        mapZoom.value = Math.max(mapZoom.value, 2);
      }
    };
    const closeLiveWorkerDrawer = () => {
      selectedWorkerId.value = null;
      fitAll();
    };

    return {
      theme,
      language,
      currentRole,
      currentView,
      t,
      getServiceName,
      stageLabel,
      offerStatusLabel,
      formatDate,
      formatCurrency,
      toggleTheme,
      changeLanguage,
      setRole,
      navigateTo,
      socketConnected,
      authBusy,

      loggedInCustomer,
      loggedInWorker,
      loggedInAdmin,
      loginError,
      registerError,
      showPassword,
      authEmail,
      authPassword,
      authName,
      authPhone,
      authAddress,
      authCoop,
      authSkill,
      authExperience,
      authServiceRadiusKm,
      handleLogin,
      handleRegister,
      handleLogout,

      services,
      cooperatives,
      platformStats,
      customerBookings,
      activeBookingId,
      activeBooking,
      dispatchCandidates,
      requestForm,
      ratingModal,
      paymentGatewayModal,
      paymentMethodError,
      selectService,
      handleRequestSubmit,
      viewBooking,
      cancelBooking,
      completeJob,
      submitRating,
      openPaymentMethod,
      choosePaymentMethod,

      workerBookings,
      workerIncoming,
      workerActiveJob,
      walletInfo,
      incentivesList,
      welfareInfo,
      demandHeatmap,
      redemptionAmount,
      redemptionError,
      redemptionSuccess,
      payoutMethod,
      earningsTab,
      selectedOrder,
      workerDocuments,
      documentUploadError,
      documentUploadSuccess,
      toggleAvailability,
      handleWorkerAccept,
      handleWorkerReject,
      workerStartJob,
      workerCompleteJob,
      handleRedeem,
      uploadDocument,

      notifications,
      unreadNotificationCount,
      markNotificationRead,
      markAllNotificationsRead,

      adminTab,
      setAdminTab,
      adminIsSuper,
      adminDashboard,
      adminBookings,
      adminBookingsLedger,
      adminDispatchActive,
      adminLiveWorkers,
      adminWorkers,
      adminCustomers,
      adminCooperatives,
      adminAuditLogs,
      adminReports,
      adminConfig,
      selectedRequest,
      selectedWorker,
      selectedCustomer,
      selectedCooperative,
      selectedBooking,
      workerSearch,
      workerFilterVerification,
      customerSearch,
      customerFilterStatus,
      requestFilterStatus,
      bookingFilterStatus,
      filteredWorkers,
      filteredCustomers,
      // Bound to the status-filter <select>'s @change on 4 admin pages
      // (Service Dispatch Requests, Workers Directory, Customers Directory,
      // Bookings Ledger) -- each page's initial load worked (called
      // directly from other in-scope functions), but the filter dropdowns
      // were silently dead without these exposed: Vue can only resolve a
      // template's @change="fnName" against setup()'s returned object, not
      // an unreturned local closure. Confirmed live via a Vue warning
      // ("Property ... was accessed during render but is not defined on
      // instance") and by reproducing each filter doing nothing.
      loadAdminBookings,
      loadAdminWorkers,
      loadAdminCustomers,
      loadAdminBookingsLedger,
      showAddServiceModal,
      showEditServiceModal,
      newServiceData,
      editingServiceData,
      forceAssignForm,
      forceAssignError,
      adminCancelReason,
      rejectionReasonInput,
      suspendReasonInput,
      broadcastForm,
      broadcastResult,
      newCooperativeData,
      walletAdjustmentForm,
      walletAdjustmentResult,
      demoResetBusy,
      demoResetResult,
      openRequestDetails,
      submitForceAssign,
      submitAdminCancel,
      openWorkerDetails,
      verifyWorker,
      toggleWorkerSuspension,
      openCustomerDetails,
      setCustomerStatus,
      openCooperativeDetails,
      createCooperative,
      openBookingDetails,
      closeAdminModals,
      openAddService,
      openEditService,
      addService,
      editService,
      toggleServiceStatus,
      submitBroadcast,
      saveAdminConfig,
      submitWalletAdjustment,
      runDemoReset,

      animatedWorkers,
      animatedDispatched,
      animatedCooperatives,
      statsAnimationCompleted,
      triggerStatsAnimation,

      currentActiveUser,
      toasts,
      showToast,
      dismissToast,
      isNotificationDropdownOpen,
      isProfileMenuOpen,
      toggleNotifications,
      toggleProfileMenu,
      closeHeaderDropdowns,
      serviceSearchQuery,
      selectedServiceCategory,
      previewService,
      serviceCategories,
      getServiceDescription,
      filteredServices,
      openServicePreview,
      closeServicePreview,
      recentServices,
      selectRecentService,
      getServiceSvg,
      requestStep,
      isSubmittingRequest,
      canContinueRequestStep,
      nextRequestStep,
      prevRequestStep,
      goToRequestStep,
      setQuickDatePreset,
      useCurrentLocation,
      activeBookingSummary,
      customerBookingSearch,
      filteredCustomerBookings,
      expandedWorkerId,
      toggleExpandWorker,
      availabilityBusy,
      toggleAvailabilityWithFeedback,
      jobActionBusy,
      runJobAction,
      offerBusy,
      respondToOffer,
      offerSecondsLeft,
      workerJobStageIndex,
      workerOrderStatusFilter,
      filteredWorkerBookings,
      earningsFilterType,
      earningsFilterStatus,
      showFilterDrawer,
      filteredTransactions,
      txnTypeLabel,
      earningsPeriodTotal,
      redemptionHistory,
      selectedIncentive,
      incentiveStatusLabel,
      verificationLabel,
      availabilityLabel,
      selectedMapZone,
      selectMapZone,
      demandPlotPoints,
      myCooperative,
      adminActionBusy,
      runAdminAction,
      confirmDemoReset,
      statusBadgeClass,
      adminAvailablePct,
      requestSearch,
      filteredRequests,
      bookingSearch,
      filteredBookings,
      auditSearch,
      filteredAuditLogs,
      workerFilterAvailability,
      workerFilterCoop,
      customerStatusReason,
      forceAssignCandidates,
      topSectorMax,
      broadcastResultLabel,
      liveAdminFilterStatus,
      liveWorkerSearch,
      filteredLiveWorkers,
      liveStatsTotalWorkers,
      liveStatsAvailable,
      liveStatsOnJob,
      liveStatsTravelling,
      liveStatsOffDuty,
      liveStatsActiveJobs,
      computedViewBox,
      apiSlow,
      mapZoom,
      livePlotPoints,
      zoomIn,
      zoomOut,
      fitAll,
      selectedWorkerId,
      selectedLiveWorker,
      focusWorker,
      closeLiveWorkerDrawer
    };
  }
});

app.component("animated-number", {
  props: {
    value: { type: [Number, String], required: true },
    duration: { type: Number, default: 1500 },
    formatCurrency: { type: Boolean, default: false },
    formatPercent: { type: Boolean, default: false }
  },
  setup(props) {
    const displayValue = ref("0");
    const elementRef = ref(null);
    let observer = null;
    let hasAnimated = false;
    let animationFrameId = null;

    const getNumericValue = (val) => {
      if (typeof val === "number") return val;
      const clean = String(val).replace(/[^0-9.-]/g, "");
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    };

    const formatValue = (num) => {
      const originalStr = String(props.value);
      const hasCurrencySymbol = originalStr.includes("₹") || props.formatCurrency;
      const hasPercentSymbol = originalStr.includes("%") || props.formatPercent;
      const hasStar = originalStr.includes("★") || originalStr.includes("⭐");
      const hasKm = originalStr.includes("km");
      const hasHrs = originalStr.includes("hrs");
      const hasCases = originalStr.includes("Cases");
      const hasMembers = originalStr.includes("Members");

      let formatted = num;
      if (originalStr.includes(".") || hasStar || hasKm) formatted = num.toFixed(1);
      else formatted = Math.floor(num);
      if (Math.abs(formatted) >= 1000) formatted = Number(formatted).toLocaleString("en-IN");
      if (hasCurrencySymbol) formatted = "₹" + formatted;
      if (hasPercentSymbol) formatted = formatted + "%";
      if (hasStar) formatted = formatted + (originalStr.includes("★") ? " ★" : " ⭐");
      if (hasKm) formatted = formatted + " km";
      if (hasHrs) formatted = formatted + " hrs";
      if (hasCases) formatted = formatted + " Cases";
      if (hasMembers) formatted = formatted + " Members";
      return formatted;
    };

    const triggerAnimation = (newVal, oldVal = 0) => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      const target = getNumericValue(newVal);
      const start = getNumericValue(oldVal);
      const startTime = performance.now();

      const animateStep = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / props.duration, 1);
        const ease = progress * (2 - progress);
        const current = start + (target - start) * ease;
        displayValue.value = formatValue(current);
        if (progress < 1) animationFrameId = requestAnimationFrame(animateStep);
        else {
          displayValue.value = formatValue(target);
          hasAnimated = true;
        }
      };
      animationFrameId = requestAnimationFrame(animateStep);
    };

    watch(
      () => props.value,
      (newVal, oldVal) => {
        if (hasAnimated) triggerAnimation(newVal, oldVal);
        else displayValue.value = formatValue(0);
      }
    );

    onMounted(() => {
      displayValue.value = formatValue(0);
      if (elementRef.value && typeof IntersectionObserver !== "undefined") {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && !hasAnimated) triggerAnimation(props.value, 0);
            });
          },
          { threshold: 0.05 }
        );
        observer.observe(elementRef.value);
      } else {
        triggerAnimation(props.value, 0);
      }
    });

    onUnmounted(() => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      // Confirmed live: gating this on elementRef.value (rather than just
      // `observer` itself) meant disconnect() effectively never ran --
      // Vue has already nulled the template ref by the time onUnmounted
      // fires, well before this check, so every mount of this component
      // (all 3 landing-page hero stats, remounted on every logout) leaked
      // its own IntersectionObserver. observer.disconnect() itself doesn't
      // need the element to still exist.
      if (observer) observer.disconnect();
    });

    return { displayValue, elementRef };
  },
  template: `<span ref="elementRef">{{ displayValue }}</span>`
});

app.mount("#app");
