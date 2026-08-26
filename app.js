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
    const authAcceptedTerms = ref(false);

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
    const walletInfo = ref({ availableBalance: 0, pendingBalance: 0, transactions: [] });
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

    const handleLogin = async () => {
      loginError.value = "";
      authBusy.value = true;
      try {
        const rolePath = currentRole.value === "customer" ? "customer" : currentRole.value === "worker" ? "worker" : "admin";
        const res = await api.request("POST", `/auth/${rolePath}/login`, {
          body: { identifier: authEmail.value.trim(), password: authPassword.value }
        });
        api.setAccessToken(res.token);
        startSession();
        await loadOwnProfile(res.role);
        await loadCatalog();
        currentView.value = "dashboard";
        await initializeRoleData(currentRole.value);
        authEmail.value = "";
        authPassword.value = "";
      } catch (err) {
        loginError.value = apiErrorMessage(err);
      } finally {
        authBusy.value = false;
      }
    };

    const handleRegister = async () => {
      registerError.value = "";
      authBusy.value = true;
      try {
        if (!authAcceptedTerms.value) {
          registerError.value = t("noDataFound");
          return;
        }
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
        authAcceptedTerms.value = false;
        authBusy.value = false;
      }
    };

    const handleLogout = async () => {
      await api.request("POST", "/auth/logout").catch(() => {});
      endSession();
      loggedInCustomer.value = null;
      loggedInWorker.value = null;
      loggedInAdmin.value = null;
      activeBookingId.value = null;
      activeBooking.value = null;
      currentRole.value = "landing";
      currentView.value = "home";
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
      navigateTo("requestForm");
    };

    const handleRequestSubmit = async () => {
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
        loginError.value = apiErrorMessage(err);
        return null;
      });
      if (!res) return;

      activeBookingId.value = res.bookingId;
      await refreshActiveBooking();
      navigateTo("matching");
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
      await api.request("POST", `/bookings/${bookingId}/cancel`, { body: { reason: reason || undefined } });
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
      const next = loggedInWorker.value.workerProfile.availabilityStatus === "AVAILABLE" ? "OFF_DUTY" : "AVAILABLE";
      try {
        await api.request("PATCH", "/workers/me/availability", { idempotencyKey: api.idempotencyKey(), body: { status: next } });
        loggedInWorker.value.workerProfile.availabilityStatus = next;
        if (next === "AVAILABLE") startLocationPinging();
        else if (locationPingInterval) {
          clearInterval(locationPingInterval);
          locationPingInterval = null;
        }
      } catch (err) {
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
      if (tab === "dashboard") loadAdminDashboard();
      else if (tab === "requests") loadAdminBookings();
      else if (tab === "monitoring") loadAdminDispatchActive();
      else if (tab === "liveWorkers") loadAdminLiveWorkers();
      else if (tab === "workers") loadAdminWorkers();
      else if (tab === "customers") loadAdminCustomers();
      else if (tab === "cooperatives") loadAdminCooperatives();
      else if (tab === "bookings") loadAdminBookingsLedger();
      else if (tab === "reports") loadAdminReports();
      else if (tab === "audit") loadAdminAuditLogs();
      else if (tab === "settings") loadAdminConfig();
    };

    const openRequestDetails = async (request) => {
      selectedRequest.value = { ...request, dispatchLog: await api.request("GET", `/admin/bookings/${request.id}/dispatch-log`).catch(() => []) };
      forceAssignForm.value = { workerId: "", reason: "" };
      forceAssignError.value = "";
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

    const openCustomerDetails = (customer) => (selectedCustomer.value = customer);
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
    const filteredWorkers = computed(() => adminWorkers.value.filter((w) => w.name.toLowerCase().includes(workerSearch.value.toLowerCase())));
    const filteredCustomers = computed(() => adminCustomers.value.filter((c) => c.name.toLowerCase().includes(customerSearch.value.toLowerCase())));

    // ----------------------------------------------------
    // Initialize Lifecycle
    // ----------------------------------------------------
    onMounted(async () => {
      applyThemeClass();
      await loadPlatformStats();
      await loadCatalog();

      // Section 6.4 — silently rotate an access token from the httpOnly
      // refresh cookie if one is already valid (page reload continuity),
      // since the access token itself is memory-only and lost on reload.
      try {
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
        currentRole.value = "landing";
        currentView.value = "home";
      }

      api.onExpired(() => {
        loggedInCustomer.value = null;
        loggedInWorker.value = null;
        loggedInAdmin.value = null;
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

      const setupScrollReveal = () => {
        if (typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver(
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
        document.querySelectorAll(".scroll-reveal").forEach((el) => observer.observe(el));
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
        await loadCustomerBookings();
      } else if (role === "worker" && loggedInWorker.value) {
        await Promise.all([loadWorkerIncoming(), loadWorkerActiveJob()]);
        if (loggedInWorker.value.workerProfile.availabilityStatus === "AVAILABLE") startLocationPinging();
      } else if (role === "admin" && loggedInAdmin.value) {
        setAdminTab("dashboard");
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

    const setupLandingStatsObserver = () => {
      setTimeout(() => {
        const statsEl = document.getElementById("landing-stats");
        if (statsEl) {
          animatedWorkers.value = 0;
          animatedDispatched.value = 0;
          animatedCooperatives.value = 0;
          statsAnimationCompleted.value = false;
          hasAnimatedOnce.value = false;
          const observer = new IntersectionObserver(
            (entries) => entries.forEach((entry) => entry.isIntersecting && triggerStatsAnimation()),
            { threshold: 0.15 }
          );
          observer.observe(statsEl);
        }
        setTimeout(() => {
          if (!hasAnimatedOnce.value) triggerStatsAnimation();
        }, 1500);
      }, 150);
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
      authAcceptedTerms,
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
      triggerStatsAnimation
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
      if (observer && elementRef.value) observer.disconnect();
    });

    return { displayValue, elementRef };
  },
  template: `<span ref="elementRef">{{ displayValue }}</span>`
});

app.mount("#app");
