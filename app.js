// Initialize and hook Vue 3 App
const { createApp, ref, computed, onMounted, onUnmounted, watch } = Vue;

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
    const currentView = ref("login"); // login, register, dashboard, etc.

    // ----------------------------------------------------
    // User Authentication States (Mock)
    // ----------------------------------------------------
    const loggedInCustomer = ref(null);
    const loggedInWorker = ref(null);
    const loggedInAdmin = ref(null);
    const loginError = ref("");
    const showPassword = ref(false);

    // Auth Form Bindings
    const authEmail = ref("");
    const authPassword = ref("");
    const authName = ref("");
    const authCoop = ref("");
    const authSkill = ref("");
    const authExperience = ref("");

    // ----------------------------------------------------
    // Services & Bookings State
    // ----------------------------------------------------
    const services = ref(window.mockData.services);
    const cooperatives = ref(window.mockData.cooperatives);
    const bookings = ref([]);
    
    // Active simulation booking and workflow trackers
    const activeBookingId = ref(null);
    const demoLogs = ref([]);
    
    // Worker matching state
    const matchingPhase = ref("idle"); // idle, top3, wider
    const matchingTimer = ref(15);
    const timerInterval = ref(null);
    
    // Top 3 workers list and wider list (reactive instances)
    const matchingTopWorkers = ref([]);
    const matchingWiderPool = ref([]);

    // ----------------------------------------------------
    // Service Request Form State
    // ----------------------------------------------------
    const requestForm = ref({
      serviceId: "plumbing",
      location: "",
      description: "",
      datetime: "",
      urgency: "Normal",
      baseRate: 250,
      hourlyRate: 150,
      estimate: 250
    });

    // Rating Modal state
    const ratingModal = ref({
      show: false,
      bookingId: null,
      rating: 5,
      review: ""
    });

    // Admin Panel States
    const adminTab = ref("dashboard");
    const selectedRequest = ref(null);
    const selectedWorker = ref(null);
    const selectedCustomer = ref(null);
    const selectedCooperative = ref(null);
    const selectedBooking = ref(null);

    // Search and Filter States
    const workerSearch = ref("");
    const workerFilterSkill = ref("");
    const workerFilterAvailability = ref("");
    const workerFilterCoop = ref("");
    const workerFilterVerification = ref("");

    const customerSearch = ref("");
    const customerFilterStatus = ref("");

    const requestSearch = ref("");
    const requestFilterStatus = ref("");

    const bookingSearch = ref("");
    const bookingFilterStatus = ref("");

    // Services management forms
    const showAddServiceModal = ref(false);
    const showEditServiceModal = ref(false);
    const newServiceData = ref({ id: "", translationKey: "", baseRate: 200, hourlyRate: 100, icon: "wrench", status: "Enabled" });
    const editingServiceData = ref({ id: "", translationKey: "", baseRate: 0, hourlyRate: 0, icon: "wrench", status: "Enabled" });

    // Notifications state
    const adminNotifications = ref([
      { id: "notif-1", type: "new_request", message: "New Plumbing request REQ-104 created by Deepika Ramaswamy.", time: "5 mins ago", read: false },
      { id: "notif-2", type: "worker_accepted", message: "Worker Ravi Kumar accepted Plumbing request REQ-104.", time: "4 mins ago", read: false },
      { id: "notif-3", type: "no_worker_accepted", message: "No worker accepted Carpentry request REQ-102 within response window.", time: "15 mins ago", read: true },
      { id: "notif-4", type: "wider_pool", message: "Request REQ-102 expanded to wider worker pool.", time: "14 mins ago", read: true },
      { id: "notif-5", type: "worker_verification", message: "New worker registration Amit Verma is pending verification.", time: "1 hour ago", read: false },
      { id: "notif-6", type: "service_completed", message: "Plumbing service REQ-101 completed by Ravi Kumar.", time: "2 hours ago", read: true }
    ]);

    // Upgraded Worker Portal States
    const earningsTab = ref("today"); // today, week, month
    const earningsFilterService = ref("");
    const earningsFilterType = ref("");
    const earningsFilterDate = ref("Today");
    const showFilterDrawer = ref(false);
    const selectedOrder = ref(null);
    const selectedIncentive = ref(null);
    const redemptionAmount = ref("");
    const redemptionError = ref("");
    const redemptionSuccess = ref("");

    // Redemption History (Requirement 8)
    const redemptionHistory = ref([
      { id: "TXN-901", date: "2026-08-20 18:30", amount: 1500, status: "COMPLETED" },
      { id: "TXN-902", date: "2026-08-22 19:15", amount: 800, status: "COMPLETED" },
      { id: "TXN-903", date: "2026-08-24 17:00", amount: 1500, status: "COMPLETED" },
      { id: "TXN-904", date: "2026-08-25 12:00", amount: 500, status: "PROCESSING" }
    ]);

    // Incentives (Requirement 9)
    const incentivesList = ref([
      { id: "inc-1", title: "Complete 10 Jobs this week", reward: 500, reason: "Weekly activity benchmark", progress: 7, target: 10, expiry: "2026-08-30", status: "PENDING" },
      { id: "inc-2", title: "Complete 20 Jobs this month", reward: 1000, reason: "Monthly activity benchmark", progress: 7, target: 20, expiry: "2026-08-31", status: "PENDING" },
      { id: "inc-3", title: "High Demand Bonus (Adyar)", reward: 200, reason: "Rainy day emergency response surge", progress: 1, target: 1, expiry: "2026-08-25", status: "COMPLETED" },
      { id: "inc-4", title: "Weekend Warrior", reward: 300, reason: "Complete 5 jobs on Saturday-Sunday", progress: 0, target: 5, expiry: "2026-08-23", status: "EXPIRED" }
    ]);

    // 5 Demo Job Requests (Requirement 6 / 20)
    const demoWorkerRequests = ref([
      { id: "REQ-201", service: "Plumbing", area: "Mylapore", distance: 1.5, eta: 10, estimatedEarnings: 350, skill: "plumbing", time: "Just now", description: "Leaky tap in balcony." },
      { id: "REQ-202", service: "Plumbing", area: "Alwarpet", distance: 2.1, eta: 15, estimatedEarnings: 400, skill: "plumbing", time: "2 mins ago", description: "Clogged bathroom sink drain." },
      { id: "REQ-203", service: "Plumbing", area: "Adyar", distance: 0.8, eta: 5, estimatedEarnings: 250, skill: "plumbing", time: "5 mins ago", description: "Flush tank adjustment." },
      { id: "REQ-204", service: "Plumbing", area: "Velachery", distance: 3.5, eta: 20, estimatedEarnings: 600, skill: "plumbing", time: "10 mins ago", description: "Main line water filter replacement." },
      { id: "REQ-205", service: "Plumbing", area: "Besant Nagar", distance: 2.7, eta: 18, estimatedEarnings: 450, skill: "plumbing", time: "15 mins ago", description: "Kitchen faucet dripping leak." }
    ]);



    // ----------------------------------------------------
    // Computed Properties
    // ----------------------------------------------------
    const activeBooking = computed(() => {
      return bookings.value.find(b => b.id === activeBookingId.value) || null;
    });

    const activeWorkerJob = computed(() => {
      if (!loggedInWorker.value) return null;
      return bookings.value.find(
        b => b.workerId === loggedInWorker.value.id && (b.status === "Assigned" || b.status === "InProgress")
      );
    });

    const workerJobHistory = computed(() => {
      if (!loggedInWorker.value) return [];
      return bookings.value.filter(
        b => b.workerId === loggedInWorker.value.id && b.status === "Completed"
      );
    });

    const customerBookings = computed(() => {
      if (!loggedInCustomer.value) return [];
      return bookings.value.filter(b => b.customerId === loggedInCustomer.value.id);
    });

    const allWorkersList = computed(() => {
      const combined = [];
      window.mockData.topWorkers.forEach(w => {
        combined.push({
          ...w,
          phone: w.phone || "+91 98765 43210",
          availability: w.status === "Accepted" ? "Busy" : "Available",
          verification: "Verified",
          currentJob: w.status === "Accepted" ? activeBookingId.value : null
        });
      });
      window.mockData.widerPool.forEach(w => {
        combined.push({
          ...w,
          phone: w.phone || "+91 95432 10987",
          availability: w.status === "Accepted" ? "Busy" : "Available",
          verification: w.id === "worker-6" ? "Pending" : "Verified",
          currentJob: w.status === "Accepted" ? activeBookingId.value : null
        });
      });
      return combined;
    });

    const adminStats = computed(() => {
      const allW = allWorkersList.value;
      const activeRequests = bookings.value.filter(b => b.status === "Top3Contacted" || b.status === "WiderPool" || b.status === "Finding").length;
      const pendingRequests = bookings.value.filter(b => b.status === "Created").length;
      const activeBookingsCount = bookings.value.filter(b => b.status === "Assigned" || b.status === "InProgress").length;
      const completedBookingsCount = bookings.value.filter(b => b.status === "Completed").length;
      
      return {
        totalWorkers: allW.length,
        availableWorkers: allW.filter(w => w.availability === "Available").length,
        busyWorkers: allW.filter(w => w.availability === "Busy").length,
        totalCustomers: window.mockData.customers.length + (loggedInCustomer.value ? 1 : 0),
        activeServiceRequests: activeRequests,
        pendingRequests: pendingRequests,
        activeBookings: activeBookingsCount,
        completedBookings: completedBookingsCount,
        registeredCooperatives: cooperatives.value.length,
        cooperatives: cooperatives.value.length
      };
    });

    const systemStats = adminStats; // backward compatibility link

    // Animated Stats for Landing Page (Scroll-triggered)
    const animatedWorkers = ref(0);
    const animatedDispatched = ref(0);
    const animatedCooperatives = ref(0);
    const statsAnimationCompleted = ref(false);
    const hasAnimatedOnce = ref(false);

    const triggerStatsAnimation = () => {
      const targetWorkers = adminStats.value.totalWorkers;
      const targetDispatched = adminStats.value.completedBookings + 1240;
      const targetCooperatives = adminStats.value.registeredCooperatives;

      const duration = 1800; // 1.8 seconds
      const startTime = performance.now();
      const startW = animatedWorkers.value;
      const startD = animatedDispatched.value;
      const startC = animatedCooperatives.value;

      statsAnimationCompleted.value = false;

      const animateStep = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing: easeOutQuad
        const ease = progress * (2 - progress);

        animatedWorkers.value = Math.floor(startW + (targetWorkers - startW) * ease);
        animatedDispatched.value = Math.floor(startD + (targetDispatched - startD) * ease);
        animatedCooperatives.value = Math.floor(startC + (targetCooperatives - startC) * ease);

        if (progress < 1) {
          requestAnimationFrame(animateStep);
        } else {
          animatedWorkers.value = targetWorkers;
          animatedDispatched.value = targetDispatched;
          animatedCooperatives.value = targetCooperatives;
          statsAnimationCompleted.value = true;
          hasAnimatedOnce.value = true;
        }
      };

      requestAnimationFrame(animateStep);
    };

    // Watch for updates to trigger smooth adjustments
    watch(
      () => [
        adminStats.value.totalWorkers,
        adminStats.value.completedBookings,
        adminStats.value.registeredCooperatives
      ],
      () => {
        if (hasAnimatedOnce.value) {
          triggerStatsAnimation();
        }
      }
    );

    const setupLandingStatsObserver = () => {
      setTimeout(() => {
        const statsEl = document.getElementById("landing-stats");
        if (statsEl) {
          // Reset values to 0 before animation begins
          animatedWorkers.value = 0;
          animatedDispatched.value = 0;
          animatedCooperatives.value = 0;
          statsAnimationCompleted.value = false;
          hasAnimatedOnce.value = false;

          const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                triggerStatsAnimation();
              }
            });
          }, { threshold: 0.15 });
          observer.observe(statsEl);
        }

        // Fallback safety trigger: if it hasn't animated after 1.5 seconds, start it automatically
        setTimeout(() => {
          if (!hasAnimatedOnce.value) {
            triggerStatsAnimation();
          }
        }, 1500);
      }, 150);
    };

    // Re-bind scroll observer whenever the role switches back to landing page
    watch(currentRole, (newRole) => {
      if (newRole === 'landing') {
        setupLandingStatsObserver();
      }
    });

    const filteredWorkers = computed(() => {
      return allWorkersList.value.filter(w => {
        const matchesSearch = w.name.toLowerCase().includes(workerSearch.value.toLowerCase()) || 
                             w.id.toLowerCase().includes(workerSearch.value.toLowerCase());
        const matchesSkill = !workerFilterSkill.value || w.skill === workerFilterSkill.value;
        const matchesAvailability = !workerFilterAvailability.value || w.availability === workerFilterAvailability.value;
        const matchesCoop = !workerFilterCoop.value || w.cooperative === workerFilterCoop.value;
        const matchesVerification = !workerFilterVerification.value || w.verification === workerFilterVerification.value;
        
        return matchesSearch && matchesSkill && matchesAvailability && matchesCoop && matchesVerification;
      });
    });

    const filteredCustomers = computed(() => {
      return window.mockData.customers.map(c => {
        const cBookings = bookings.value.filter(b => b.customerId === c.id);
        const activeB = cBookings.find(b => b.status !== "Completed" && b.status !== "Cancelled");
        return {
          ...c,
          totalBookings: cBookings.length,
          activeBooking: activeB ? activeB.id : "None",
          registrationDate: "2026-01-15",
          status: "Active"
        };
      }).filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(customerSearch.value.toLowerCase()) || 
                             c.id.toLowerCase().includes(customerSearch.value.toLowerCase());
        const matchesStatus = !customerFilterStatus.value || c.status === customerFilterStatus.value;
        return matchesSearch && matchesStatus;
      });
    });

    const filteredBookings = computed(() => {
      return bookings.value.filter(b => {
        const matchesSearch = b.id.toLowerCase().includes(bookingSearch.value.toLowerCase()) || 
                             b.customerName.toLowerCase().includes(bookingSearch.value.toLowerCase()) ||
                             (b.workerName && b.workerName.toLowerCase().includes(bookingSearch.value.toLowerCase()));
        const matchesStatus = !bookingFilterStatus.value || b.status === bookingFilterStatus.value;
        return matchesSearch && matchesStatus;
      });
    });

    const filteredRequests = computed(() => {
      return bookings.value.filter(b => {
        const matchesSearch = b.id.toLowerCase().includes(requestSearch.value.toLowerCase()) || 
                             b.customerName.toLowerCase().includes(requestSearch.value.toLowerCase());
        const matchesStatus = !requestFilterStatus.value || b.status === requestFilterStatus.value;
        return matchesSearch && matchesStatus;
      });
    });

    const cooperativeStatsList = computed(() => {
      return cooperatives.value.map(coop => {
        const coopWorkers = allWorkersList.value.filter(w => w.cooperative === coop.name);
        const coopBookings = bookings.value.filter(b => b.cooperative === coop.name);
        const activeJobs = coopBookings.filter(b => b.status === "Assigned" || b.status === "InProgress").length;
        const completedJobs = coopBookings.filter(b => b.status === "Completed").length;
        
        return {
          ...coop,
          totalWorkers: coopWorkers.length,
          availableWorkers: coopWorkers.filter(w => w.availability === "Available").length,
          activeJobs: activeJobs,
          completedJobs: completedJobs,
          status: "Active",
          performance: completedJobs > 0 ? (coopWorkers.reduce((acc, w) => acc + w.rating, 0) / coopWorkers.length).toFixed(1) + " ⭐" : "4.8 ⭐"
        };
      });
    });

    // ----------------------------------------------------
    // Watchers
    // ----------------------------------------------------
    watch(theme, (newTheme) => {
      localStorage.setItem("theme", newTheme);
      applyThemeClass();
    });

    watch(language, (newLang) => {
      localStorage.setItem("language", newLang);
    });

    watch(activeBookingId, (newId) => {
      if (newId) {
        localStorage.setItem("activeBookingId_sih2026", newId);
      } else {
        localStorage.removeItem("activeBookingId_sih2026");
      }
    });

    watch(activeBooking, (newBooking) => {
      if (newBooking) {
        if (["Finding", "Top3Contacted", "WiderPool"].includes(newBooking.status)) {
          if (newBooking.status === "WiderPool") {
            matchingPhase.value = "wider";
          } else {
            matchingPhase.value = "top3";
          }

          const serviceId = newBooking.serviceId;

          // Get matching workers, fallback to all demo workers if none found
          let topMatches = window.mockData.topWorkers.filter(w => w.skill === serviceId);
          if (topMatches.length < 3) {
            topMatches = window.mockData.topWorkers.map(w => ({
              ...w,
              skill: serviceId,
              serviceCategory: serviceId
            }));
          }

          let wideMatches = window.mockData.widerPool.filter(w => w.skill === serviceId);
          if (wideMatches.length < 3) {
            wideMatches = window.mockData.widerPool.map(w => ({
              ...w,
              skill: serviceId,
              serviceCategory: serviceId
            }));
          }

          // Populate with current statuses based on booking state
          matchingTopWorkers.value = topMatches.map(w => {
            let wStatus = "Waiting";
            if (newBooking.status === "WiderPool") {
              wStatus = "Timeout";
            } else if (newBooking.status === "Assigned" || newBooking.status === "InProgress" || newBooking.status === "Completed") {
              wStatus = newBooking.workerId === w.id ? "Accepted" : "Declined";
            }
            return { ...w, status: wStatus, currentStatus: wStatus };
          });

          matchingWiderPool.value = wideMatches.map(w => {
            let wStatus = "Waiting";
            if (newBooking.status === "Assigned" || newBooking.status === "InProgress" || newBooking.status === "Completed") {
              wStatus = newBooking.workerId === w.id ? "Accepted" : "Declined";
            }
            return { ...w, status: wStatus, currentStatus: wStatus };
          });
        }
      } else {
        matchingTopWorkers.value = [];
        matchingWiderPool.value = [];
        matchingPhase.value = "idle";
      }
    }, { immediate: true });

    // ----------------------------------------------------
    // Translations Helper
    // ----------------------------------------------------
    const t = (key, replacements = {}) => {
      const langTranslations = window.translations[language.value] || window.translations.en;
      let text = langTranslations[key] || window.translations.en[key] || key;
      
      // Perform placeholder replacements e.g. {yrs} -> 5
      Object.keys(replacements).forEach(placeholder => {
        text = text.replace(`{${placeholder}}`, replacements[placeholder]);
      });
      return text;
    };

    // Helper to get service name
    const getServiceName = (serviceId) => {
      return t(serviceId);
    };

    // ----------------------------------------------------
    // Theme application helper
    // ----------------------------------------------------
    const applyThemeClass = () => {
      const root = document.documentElement;
      if (theme.value === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    const toggleTheme = () => {
      theme.value = theme.value === "light" ? "dark" : "light";
    };

    const changeLanguage = (lang) => {
      language.value = lang;
    };

    // ----------------------------------------------------
    // Initialize Lifecycle
    // ----------------------------------------------------
    onMounted(() => {
      applyThemeClass();
      
      // Load bookings from LocalStorage, otherwise populate with initial mock bookings
      const storedBookings = localStorage.getItem("bookings_sih2026");
      if (storedBookings) {
        bookings.value = JSON.parse(storedBookings);
      } else {
        bookings.value = JSON.parse(JSON.stringify(window.mockData.initialBookings));
        localStorage.setItem("bookings_sih2026", JSON.stringify(bookings.value));
      }

      // Restore session from localStorage if exists
      const storedCustomer = localStorage.getItem("loggedInCustomer_sih2026");
      const storedWorker = localStorage.getItem("loggedInWorker_sih2026");
      const storedAdmin = localStorage.getItem("loggedInAdmin_sih2026");
      const storedRole = localStorage.getItem("currentRole_sih2026");
      const storedView = localStorage.getItem("currentView_sih2026");

      if (storedRole && storedView) {
        if (storedRole === "customer" && storedCustomer) {
          loggedInCustomer.value = JSON.parse(storedCustomer);
          currentRole.value = "customer";
          currentView.value = storedView;
        } else if (storedRole === "worker" && storedWorker) {
          loggedInWorker.value = JSON.parse(storedWorker);
          currentRole.value = "worker";
          currentView.value = storedView;
        } else if (storedRole === "admin" && storedAdmin) {
          loggedInAdmin.value = JSON.parse(storedAdmin);
          currentRole.value = "admin";
          currentView.value = storedView;
        }
      } else {
        currentRole.value = "landing";
        currentView.value = "home";
      }

      // Restore active booking session ONLY IF the customer is logged in
      const storedActiveId = localStorage.getItem("activeBookingId_sih2026");
      if (storedActiveId && bookings.value.some(b => b.id === storedActiveId)) {
        activeBookingId.value = storedActiveId;
        if (loggedInCustomer.value) {
          const activeB = bookings.value.find(b => b.id === storedActiveId);
          if (activeB) {
            if (["Finding", "Top3Contacted", "WiderPool"].includes(activeB.status)) {
              currentRole.value = "customer";
              currentView.value = "matching";
              
              if (activeB.status === "WiderPool") {
                matchingPhase.value = "wider";
              } else {
                matchingPhase.value = "top3";
                matchingTimer.value = activeB.urgency === "Urgent" ? 12 : 6;
                if (timerInterval.value) clearInterval(timerInterval.value);
                timerInterval.value = setInterval(() => {
                  if (matchingTimer.value > 0) {
                    matchingTimer.value--;
                    if (activeB.urgency === "Urgent" && matchingTimer.value === 8) {
                      if (matchingPhase.value === "top3" && activeBooking.value && activeBooking.value.status === "Top3Contacted") {
                        simulateWorkerAcceptancePathA();
                      }
                    }
                  } else {
                    clearInterval(timerInterval.value);
                    if (matchingPhase.value === "top3") {
                      simulateNoResponsePathB();
                      setTimeout(() => {
                        if (matchingPhase.value === "wider" && activeBooking.value && activeBooking.value.status === "WiderPool") {
                          simulatePoolWorkerAcceptance();
                        }
                      }, 4000);
                    }
                  }
                }, 1000);
              }
            } else if (["Assigned", "InProgress"].includes(activeB.status)) {
              currentRole.value = "customer";
              currentView.value = "bookingConfirmed";
            }
          }
        }
      }

      // Setup stats observer on load
      setupLandingStatsObserver();

      // Start simulated live worker coordinates movement
      startSimulatedMovement();

      // Setup Scroll Progress Bar & Parallax (Requirement 5 & 11)
      window.addEventListener('scroll', () => {
        const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
        
        // Progress Bar
        const progressBar = document.getElementById('scrollProgressBar');
        if (progressBar) {
          progressBar.style.width = scrolled + '%';
        }

        // Parallax translation
        const parallaxEls = document.querySelectorAll('.parallax-bg');
        parallaxEls.forEach(el => {
          const speed = 0.15; // premium subtle movement ratio
          el.style.transform = `translateY(${winScroll * speed}px)`;
        });
      });

      // Setup Scroll Reveal IntersectionObserver (Requirement 2 & 3)
      const setupScrollReveal = () => {
        if (typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              const staggeredChildren = entry.target.querySelectorAll('.stagger-item');
              staggeredChildren.forEach((child, index) => {
                setTimeout(() => {
                  child.classList.add('is-visible');
                }, index * 80);
              });
            }
          });
        }, { threshold: 0.05 });

        document.querySelectorAll('.scroll-reveal').forEach(el => {
          observer.observe(el);
        });
      };

      // Run on initial load
      setTimeout(setupScrollReveal, 100);

      // Re-trigger scroll reveal and tab transitions on view/role/tab changes (Requirement 4 & 6 & 12)
      watch([currentRole, currentView, adminTab], () => {
        setTimeout(setupScrollReveal, 150);
        
        // Trigger tab content animation reflow
        setTimeout(() => {
          document.querySelectorAll('main .space-y-6, main .space-y-8, main .max-w-2xl, main .max-w-5xl').forEach(el => {
            el.classList.remove('tab-content-transition');
            void el.offsetWidth; // trigger browser paint reflow
            el.classList.add('tab-content-transition');
          });
        }, 50);
      });

      // Setup Click Ripple Event Listener (Requirement 2 & 21)
      document.addEventListener('mousedown', (e) => {
        const btn = e.target.closest('button, .btn-interactive');
        if (!btn) return;
        
        btn.classList.add('ripple-container');
        
        const circle = document.createElement('span');
        const diameter = Math.max(btn.clientWidth, btn.clientHeight);
        const radius = diameter / 2;
        
        circle.style.width = circle.style.height = `${diameter}px`;
        const rect = btn.getBoundingClientRect();
        
        circle.style.left = `${e.clientX - rect.left - radius}px`;
        circle.style.top = `${e.clientY - rect.top - radius}px`;
        circle.classList.add('ripple');
        
        const prev = btn.querySelector('.ripple');
        if (prev) prev.remove();
        
        btn.appendChild(circle);
      });
    });

    // Save bookings state helper
    const saveBookings = () => {
      localStorage.setItem("bookings_sih2026", JSON.stringify(bookings.value));
    };

    // Add event log helper
    const addDemoLog = (message) => {
      const time = new Date().toLocaleTimeString();
      demoLogs.value.unshift(`[${time}] ${message}`);
    };

    // ----------------------------------------------------
    // Navigation / Router Logic
    // ----------------------------------------------------
    const setRole = (role) => {
      currentRole.value = role;
      
      // Clear login error and show/hide password states on role switch
      loginError.value = "";
      showPassword.value = false;

      // Do NOT prefill credentials automatically. Keep fields blank.
      authEmail.value = "";
      authPassword.value = "";

      // Set screen based on authenticated state
      if (role === "landing") {
        currentView.value = "home";
      } else if (role === "customer") {
        if (loggedInCustomer.value) {
          currentView.value = "dashboard";
        } else {
          currentView.value = "login";
        }
      } else if (role === "worker") {
        if (loggedInWorker.value) {
          currentView.value = "dashboard";
        } else {
          currentView.value = "login";
        }
      } else if (role === "admin") {
        if (loggedInAdmin.value) {
          currentView.value = "dashboard";
        } else {
          currentView.value = "login";
        }
      }
    };

    const navigateTo = (view) => {
      currentView.value = view;
      
      // Clear credentials and errors on view change
      loginError.value = "";
      showPassword.value = false;

      // Reset form states if returning to services or forms
      if (view === "services") {
        requestForm.value.location = loggedInCustomer.value ? loggedInCustomer.value.address : "";
        requestForm.value.description = "";
        requestForm.value.datetime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);
      }
    };

    // ----------------------------------------------------
    // Authentication Logic (Simulated)
    // ----------------------------------------------------
    const handleLogin = () => {
      loginError.value = "";
      if (currentRole.value === "customer") {
        const emailOrPhone = authEmail.value.trim();
        const pwd = authPassword.value;
        
        const matched = window.mockData.customers.find(c => c.email === emailOrPhone || c.phone === emailOrPhone);
        // Valid password is password123 (or custom password stored in registered customer)
        if (matched && (pwd === "password123" || matched.password === pwd)) {
          loggedInCustomer.value = matched;
          localStorage.setItem("loggedInCustomer_sih2026", JSON.stringify(matched));
          localStorage.setItem("currentRole_sih2026", "customer");
          localStorage.setItem("currentView_sih2026", "dashboard");
          addDemoLog(`Customer logged in: ${matched.name}`);
          currentView.value = "dashboard";
        } else {
          loginError.value = "Invalid customer credentials. Please check your username/password.";
          addDemoLog(`Customer login failed for: ${emailOrPhone}`);
          return;
        }
      } else if (currentRole.value === "worker") {
        const emailOrPhone = authEmail.value.trim();
        const pwd = authPassword.value;

        const allWorkers = [...window.mockData.topWorkers, ...window.mockData.widerPool];
        const matched = allWorkers.find(w => 
          w.phone === emailOrPhone || 
          w.phone.includes(emailOrPhone) || 
          (emailOrPhone.toLowerCase().startsWith("ravi") && w.id === "worker-1") ||
          (emailOrPhone.toLowerCase().startsWith("priya") && w.id === "worker-2") ||
          (emailOrPhone.toLowerCase().startsWith("amit") && w.id === "worker-3") ||
          (emailOrPhone.toLowerCase().startsWith("vikram") && w.id === "worker-4") ||
          (emailOrPhone.toLowerCase().startsWith("suresh") && w.id === "worker-5") ||
          (emailOrPhone.toLowerCase().startsWith("lakshmi") && w.id === "worker-6") ||
          (emailOrPhone.toLowerCase().startsWith("rajesh") && w.id === "worker-7") ||
          (emailOrPhone.toLowerCase().startsWith("meena") && w.id === "worker-8")
        );

        if (matched && (pwd === "password123" || matched.password === pwd)) {
          loggedInWorker.value = matched;
          localStorage.setItem("loggedInWorker_sih2026", JSON.stringify(matched));
          localStorage.setItem("currentRole_sih2026", "worker");
          localStorage.setItem("currentView_sih2026", "dashboard");
          addDemoLog(`Worker logged in: ${matched.name} (${matched.cooperative})`);
          currentView.value = "dashboard";
        } else {
          loginError.value = "Invalid worker credentials. Please check your username/password.";
          addDemoLog(`Worker login failed for: ${emailOrPhone}`);
          return;
        }
      } else if (currentRole.value === "admin") {
        const email = authEmail.value.trim();
        const pwd = authPassword.value;

        const isAdminEmail = email === "admin@sahayoggig.in" || email === "admin@sahayoggig.gov.in";
        const isAdminPassword = pwd === "admin123";

        if (isAdminEmail && isAdminPassword) {
          const adminUser = {
            name: "Cooperative Registrar (South)",
            email: email
          };
          loggedInAdmin.value = adminUser;
          localStorage.setItem("loggedInAdmin_sih2026", JSON.stringify(adminUser));
          localStorage.setItem("currentRole_sih2026", "admin");
          localStorage.setItem("currentView_sih2026", "dashboard");
          addDemoLog(`Administrator session started.`);
          currentView.value = "dashboard";
        } else {
          loginError.value = "Invalid administrator credentials. Username: admin@sahayoggig.in, Password: admin123.";
          addDemoLog(`Admin login failed for: ${email}`);
          return;
        }
      }
      
      // Reset input fields on success
      authEmail.value = "";
      authPassword.value = "";
      showPassword.value = false;
    };

    const handleRegister = () => {
      loginError.value = "";
      if (currentRole.value === "customer") {
        const email = authEmail.value.trim();
        const pwd = authPassword.value;
        const newCustomer = {
          id: `cust-${Date.now()}`,
          name: authName.value || "Anonymous Customer",
          email: email.includes("@") ? email : "customer@example.com",
          phone: !email.includes("@") ? email : "9876543210",
          password: pwd || "password123",
          address: "New Registered Address, Chennai"
        };
        window.mockData.customers.push(newCustomer);
        loggedInCustomer.value = newCustomer;
        localStorage.setItem("loggedInCustomer_sih2026", JSON.stringify(newCustomer));
        localStorage.setItem("currentRole_sih2026", "customer");
        localStorage.setItem("currentView_sih2026", "dashboard");
        addDemoLog(`New customer registered: ${newCustomer.name}`);
        currentView.value = "dashboard";
      } else if (currentRole.value === "worker") {
        const email = authEmail.value.trim();
        const pwd = authPassword.value;
        const newWorker = {
          id: `worker-${Date.now()}`,
          name: authName.value || "New Worker",
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
          skill: authSkill.value || "plumbing",
          serviceCategory: authSkill.value || "plumbing",
          rating: 5.0,
          distance: 2.1,
          experience: parseInt(authExperience.value) || 2,
          cooperative: authCoop.value || "Chennai Skilled Workers Cooperative",
          phone: email || "+91 99999 88888",
          password: pwd || "password123",
          location: "Chennai",
          availability: "Available",
          availabilityStatus: "Available",
          status: "Available",
          currentStatus: "Available",
          ranking: 9
        };
        window.mockData.widerPool.push(newWorker);
        loggedInWorker.value = newWorker;
        localStorage.setItem("loggedInWorker_sih2026", JSON.stringify(newWorker));
        localStorage.setItem("currentRole_sih2026", "worker");
        localStorage.setItem("currentView_sih2026", "dashboard");
        addDemoLog(`New worker registered: ${newWorker.name} associated with ${newWorker.cooperative}`);
        currentView.value = "dashboard";
      }
      // Reset forms
      authName.value = "";
      authEmail.value = "";
      authPassword.value = "";
      authCoop.value = "";
      authSkill.value = "";
      authExperience.value = "";
      showPassword.value = false;
    };

    const handleLogout = () => {
      loginError.value = "";
      showPassword.value = false;
      
      if (currentRole.value === "customer") {
        if (loggedInCustomer.value) {
          addDemoLog(`Customer ${loggedInCustomer.value.name} logged out.`);
        }
        loggedInCustomer.value = null;
        localStorage.removeItem("loggedInCustomer_sih2026");
      } else if (currentRole.value === "worker") {
        if (loggedInWorker.value) {
          addDemoLog(`Worker ${loggedInWorker.value.name} logged out.`);
        }
        loggedInWorker.value = null;
        localStorage.removeItem("loggedInWorker_sih2026");
      } else if (currentRole.value === "admin") {
        addDemoLog(`Admin session ended.`);
        loggedInAdmin.value = null;
        localStorage.removeItem("loggedInAdmin_sih2026");
      }
      
      localStorage.removeItem("currentRole_sih2026");
      localStorage.removeItem("currentView_sih2026");
      localStorage.removeItem("activeBookingId_sih2026");
      
      currentRole.value = "landing";
      currentView.value = "home";
    };

    // Active Route Protection Watcher
    watch([currentRole, currentView], ([newRole, newView]) => {
      if (newRole === "customer") {
        const publicViews = ["login", "register"];
        if (!loggedInCustomer.value && !publicViews.includes(newView)) {
          currentView.value = "login";
        }
      }
      else if (newRole === "worker") {
        const publicViews = ["login", "register"];
        if (!loggedInWorker.value && !publicViews.includes(newView)) {
          currentView.value = "login";
        }
      }
      else if (newRole === "admin") {
        const publicViews = ["login"];
        if (!loggedInAdmin.value && !publicViews.includes(newView)) {
          currentView.value = "login";
        }
      }
    }, { immediate: true });

    // ----------------------------------------------------
    // Customer Booking Form & Dispatch Logic
    // ----------------------------------------------------
    const selectService = (serviceId) => {
      const svc = services.value.find(s => s.id === serviceId);
      requestForm.value.serviceId = serviceId;
      requestForm.value.baseRate = svc.baseRate;
      requestForm.value.hourlyRate = svc.hourlyRate;
      requestForm.value.estimate = svc.baseRate + svc.hourlyRate; // default estimate 2 hrs
      requestForm.value.location = loggedInCustomer.value ? loggedInCustomer.value.address : "";
      requestForm.value.description = "";
      requestForm.value.datetime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);
      navigateTo("requestForm");
    };

    const handleRequestSubmit = () => {
      // 1. Create booking object
      const newBooking = {
        id: `book-${Date.now().toString().slice(-6)}`,
        customerId: loggedInCustomer.value.id,
        customerName: loggedInCustomer.value.name,
        serviceId: requestForm.value.serviceId,
        workerId: null,
        workerName: null,
        workerPhone: null,
        cooperative: null,
        location: requestForm.value.location,
        description: requestForm.value.description || "General maintenance requested.",
        datetime: requestForm.value.datetime,
        urgency: requestForm.value.urgency,
        estimatedCost: requestForm.value.estimate,
        status: "Finding", // Initial status
        rating: null,
        review: null,
        continuityTriggered: false
      };

      bookings.value.push(newBooking);
      activeBookingId.value = newBooking.id;
      saveBookings();

      addDemoLog(`Booking ${newBooking.id} created. Initializing worker continuity matching...`);
      adminNotifications.value.unshift({
        id: "notif-" + Date.now(),
        type: "new_request",
        message: `New ${getServiceName(newBooking.serviceId)} request ${newBooking.id} created by ${newBooking.customerName}.`,
        time: "Just now",
        read: false
      });

      // 2. Filter workers by service skill with fallback for demo mode
      let topMatches = window.mockData.topWorkers.filter(w => w.skill === requestForm.value.serviceId);
      if (topMatches.length < 3) {
        topMatches = window.mockData.topWorkers.map(w => ({
          ...w,
          skill: requestForm.value.serviceId,
          serviceCategory: requestForm.value.serviceId
        }));
      }
      let wideMatches = window.mockData.widerPool.filter(w => w.skill === requestForm.value.serviceId);
      if (wideMatches.length < 3) {
        wideMatches = window.mockData.widerPool.map(w => ({
          ...w,
          skill: requestForm.value.serviceId,
          serviceCategory: requestForm.value.serviceId
        }));
      }

      // Make a copy for local reactive tracing
      matchingTopWorkers.value = topMatches.map(w => ({ ...w, status: "Waiting", currentStatus: "Waiting" }));
      matchingWiderPool.value = wideMatches.map(w => ({ ...w, status: "Waiting", currentStatus: "Waiting" }));

      // 3. Kickoff state machine: Contact Top 3
      matchingPhase.value = "top3";
      // Set short timers for automated flow (Urgent = 15s, Normal = 8s)
      matchingTimer.value = requestForm.value.urgency === "Urgent" ? 15 : 8;
      
      addDemoLog(`Top 3 eligible workers notified: ${matchingTopWorkers.value.map(w => w.name).join(", ")}`);

      // 4. Update status in booking
      newBooking.status = "Top3Contacted";
      saveBookings();

      // Start countdown
      if (timerInterval.value) clearInterval(timerInterval.value);
      timerInterval.value = setInterval(() => {
        if (matchingTimer.value > 0) {
          matchingTimer.value--;
          
          // Automation: If Urgent, auto-accept after 4 seconds (timer goes from 15 to 11)
          if (newBooking.urgency === "Urgent" && matchingTimer.value === 11) {
            if (matchingPhase.value === "top3" && activeBooking.value && activeBooking.value.status === "Top3Contacted") {
              simulateWorkerAcceptancePathA();
            }
          }
        } else {
          // Timer timed out! Auto trigger Wider Pool transition (Path B: Normal)
          clearInterval(timerInterval.value);
          if (matchingPhase.value === "top3") {
            simulateNoResponsePathB();
            
            // Auto transition wider pool acceptance after 4 seconds
            setTimeout(() => {
              if (matchingPhase.value === "wider" && activeBooking.value && activeBooking.value.status === "WiderPool") {
                simulatePoolWorkerAcceptance();
              }
            }, 4000);
          }
        }
      }, 1000);

      navigateTo("matching");
    };

    // ----------------------------------------------------
    // Worker Continuity Simulator Methods
    // ----------------------------------------------------
    const simulateWorkerAcceptancePathA = (workerId = null) => {
      if (matchingPhase.value !== "top3") return;
      clearInterval(timerInterval.value);

      // Pick selected worker or default to first
      let chosenWorker = null;
      if (workerId) {
        chosenWorker = matchingTopWorkers.value.find(w => w.id === workerId);
      } else {
        chosenWorker = matchingTopWorkers.value[0]; // Ravi Kumar
      }

      if (!chosenWorker) return;

      // Update local UI states
      matchingTopWorkers.value.forEach(w => {
        if (w.id === chosenWorker.id) {
          w.status = "Accepted";
          w.currentStatus = "Accepted";
        } else {
          w.status = "Declined";
          w.currentStatus = "Declined";
        }
      });

      // Update core booking
      const bIndex = bookings.value.findIndex(b => b.id === activeBookingId.value);
      if (bIndex !== -1) {
        bookings.value[bIndex].status = "Assigned";
        bookings.value[bIndex].workerId = chosenWorker.id;
        bookings.value[bIndex].workerName = chosenWorker.name;
        bookings.value[bIndex].workerPhone = chosenWorker.phone;
        bookings.value[bIndex].cooperative = chosenWorker.cooperative;
        bookings.value[bIndex].continuityTriggered = false;
        saveBookings();
      }

      addDemoLog(`[MATCH SUCCESS] Top worker ${chosenWorker.name} accepted request ${activeBookingId.value}`);
      
      // Simulate status transition after 2 seconds to "In Progress"
      setTimeout(() => {
        const b = bookings.value.find(bk => bk.id === activeBookingId.value);
        if (b && b.status === "Assigned") {
          b.status = "InProgress";
          saveBookings();
          addDemoLog(`Worker ${chosenWorker.name} arrived at destination. Job status: In Progress.`);
        }
      }, 3000);

      navigateTo("bookingConfirmed");
    };

    const simulateNoResponsePathB = () => {
      if (matchingPhase.value !== "top3") return;
      clearInterval(timerInterval.value);

      // All top 3 workers status set to Timeout
      matchingTopWorkers.value.forEach(w => {
        w.status = "Timeout";
        w.currentStatus = "Timeout";
      });

      // Update core booking
      const bIndex = bookings.value.findIndex(b => b.id === activeBookingId.value);
      if (bIndex !== -1) {
        bookings.value[bIndex].status = "WiderPool";
        bookings.value[bIndex].continuityTriggered = true; // Flag indicating continuity triggered wider pool
        saveBookings();
      }

      matchingPhase.value = "wider";
      addDemoLog(`[TIMEOUT] Top 3 workers failed to accept within window. System automatically expanded dispatch to wider cooperative pool.`);
    };

    const simulatePoolWorkerAcceptance = (workerId = null) => {
      if (matchingPhase.value !== "wider") return;

      // Pick a wider pool worker
      let chosenWorker = null;
      if (workerId) {
        chosenWorker = matchingWiderPool.value.find(w => w.id === workerId);
      } else {
        chosenWorker = matchingWiderPool.value[0]; // Vikram Rathore
      }

      if (!chosenWorker) return;

      matchingWiderPool.value.forEach(w => {
        if (w.id === chosenWorker.id) {
          w.status = "Accepted";
          w.currentStatus = "Accepted";
        } else {
          w.status = "Declined";
          w.currentStatus = "Declined";
        }
      });

      // Update booking
      const bIndex = bookings.value.findIndex(b => b.id === activeBookingId.value);
      if (bIndex !== -1) {
        bookings.value[bIndex].status = "Assigned";
        bookings.value[bIndex].workerId = chosenWorker.id;
        bookings.value[bIndex].workerName = chosenWorker.name;
        bookings.value[bIndex].workerPhone = chosenWorker.phone;
        bookings.value[bIndex].cooperative = chosenWorker.cooperative;
        saveBookings();
      }

      addDemoLog(`[MATCH SUCCESS] Wider pool worker ${chosenWorker.name} accepted request ${activeBookingId.value}`);

      // Simulate status transition to "In Progress"
      setTimeout(() => {
        const b = bookings.value.find(bk => bk.id === activeBookingId.value);
        if (b && b.status === "Assigned") {
          b.status = "InProgress";
          saveBookings();
          addDemoLog(`Worker ${chosenWorker.name} arrived at destination. Job status: In Progress.`);
        }
      }, 3000);

      navigateTo("bookingConfirmed");
    };

    const resetDemoState = () => {
      if (timerInterval.value) clearInterval(timerInterval.value);
      bookings.value = JSON.parse(JSON.stringify(window.mockData.initialBookings));
      saveBookings();
      activeBookingId.value = null;
      matchingPhase.value = "idle";
      demoLogs.value = [];
      addDemoLog("Demo environment reset to default state.");
      navigateTo("dashboard");
    };

    // ----------------------------------------------------
    // Booking completion & Rating Methods
    // ----------------------------------------------------
    const completeJob = (bookingId) => {
      const b = bookings.value.find(bk => bk.id === bookingId);
      if (b) {
        b.status = "Completed";
        saveBookings();
        addDemoLog(`Job ${bookingId} marked as Completed by Customer.`);
        
        // Open Rating Modal
        ratingModal.value.bookingId = bookingId;
        ratingModal.value.rating = 5;
        ratingModal.value.review = "";
        ratingModal.value.show = true;
      }
    };

    const submitRating = () => {
      const b = bookings.value.find(bk => bk.id === ratingModal.value.bookingId);
      if (b) {
        b.rating = ratingModal.value.rating;
        b.review = ratingModal.value.review || "Very satisfied with the cooperative worker.";
        saveBookings();
        addDemoLog(`Rating of ${b.rating} stars submitted for worker ${b.workerName}.`);
      }
      ratingModal.value.show = false;
      navigateTo("myBookings");
    };

    // ----------------------------------------------------
    // Worker Dashboard Actions (Real-Time State Share)
    // ----------------------------------------------------
    // Computed list of incoming requests matching the current logged-in worker
    const workerIncomingRequests = computed(() => {
      if (!loggedInWorker.value) return [];
      // Off duty workers should not receive requests
      if (loggedInWorker.value.status !== 'Available') return [];
      
      // If there is an active booking looking for matching, and this worker is in the matching group
      const matchingActive = bookings.value.find(b => b.status === "Top3Contacted" || b.status === "WiderPool");
      if (!matchingActive) return [];

      // Check if current worker is in matching lists
      const isInTop3 = matchingTopWorkers.value.some(w => w.id === loggedInWorker.value.id && w.status === "Waiting");
      const isInWider = matchingWiderPool.value.some(w => w.id === loggedInWorker.value.id && w.status === "Waiting");

      if ((matchingActive.status === "Top3Contacted" && isInTop3) || 
          (matchingActive.status === "WiderPool" && isInWider)) {
        return [{
          id: matchingActive.id,
          customerName: matchingActive.customerName,
          service: getServiceName(matchingActive.serviceId),
          location: matchingActive.location,
          description: matchingActive.description,
          datetime: matchingActive.datetime,
          urgency: matchingActive.urgency,
          estimatedPayment: matchingActive.estimatedCost,
          countdown: matchingTimer.value,
          distance: isInTop3 ? matchingTopWorkers.value.find(w => w.id === loggedInWorker.value.id).distance : 
                             matchingWiderPool.value.find(w => w.id === loggedInWorker.value.id).distance
        }];
      }
      return [];
    });

    const handleWorkerAccept = (bookingId) => {
      // Simulate that the logged-in worker is the one who accepts!
      if (matchingPhase.value === "top3") {
        simulateWorkerAcceptancePathA(loggedInWorker.value.id);
      } else if (matchingPhase.value === "wider") {
        simulatePoolWorkerAcceptance(loggedInWorker.value.id);
      }
      currentView.value = "dashboard";
    };

    const acceptDemoRequest = (req) => {
      if (!loggedInWorker.value) return;
      
      const newBook = {
        id: req.id,
        customerId: "cust-1",
        customerName: "Anand Verma",
        serviceId: "plumbing",
        workerId: loggedInWorker.value.id,
        workerName: loggedInWorker.value.name,
        workerPhone: loggedInWorker.value.phone,
        cooperative: loggedInWorker.value.cooperative,
        location: req.area + ", Chennai",
        description: req.description,
        datetime: new Date().toISOString().slice(0, 16),
        urgency: "Normal",
        estimatedCost: req.estimatedEarnings,
        status: "Assigned",
        rating: null,
        review: null,
        continuityTriggered: false
      };

      bookings.value.push(newBook);
      saveBookings();
      activeBookingId.value = newBook.id;

      // Remove from demoRequests
      demoWorkerRequests.value = demoWorkerRequests.value.filter(r => r.id !== req.id);

      addDemoLog(`[WORKER GIG] Worker ${loggedInWorker.value.name} accepted request ${req.id}`);
      currentView.value = "dashboard";
    };

    const rejectDemoRequest = (reqId) => {
      demoWorkerRequests.value = demoWorkerRequests.value.filter(r => r.id !== reqId);
      addDemoLog(`[WORKER GIG] Worker rejected request ${reqId}`);
    };

    const handleRedeem = () => {
      redemptionError.value = "";
      redemptionSuccess.value = "";
      const amt = Number(redemptionAmount.value);
      if (!amt || amt <= 0) {
        redemptionError.value = "Please enter a valid amount.";
        return;
      }
      
      // Calculate available balance: completed jobs * 450 + 200 - redeemed amount
      const earningsValue = workerJobHistory.value.reduce((acc, b) => acc + Number(b.estimatedCost), 0);
      const redeemedAmt = redemptionHistory.value.reduce((acc, r) => acc + (r.status === 'COMPLETED' ? r.amount : 0), 0);
      const balance = earningsValue - redeemedAmt;
      
      if (amt > balance) {
        redemptionError.value = "Insufficient redeemable balance.";
        return;
      }

      redemptionHistory.value.unshift({
        id: "TXN-" + Date.now().toString().slice(-3),
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        amount: amt,
        status: "PROCESSING"
      });
      redemptionAmount.value = "";
      redemptionSuccess.value = "Redemption request of ₹" + amt + " submitted successfully!";
      addDemoLog(`[WELFARE PAY] Redemption request of ₹${amt} submitted.`);
    };

    const handleWorkerReject = (bookingId) => {
      addDemoLog(`Worker ${loggedInWorker.value.name} declined job request ${bookingId}.`);
      if (matchingPhase.value === "top3") {
        const localW = matchingTopWorkers.value.find(w => w.id === loggedInWorker.value.id);
        if (localW) localW.status = "Declined";
        
        // If all top 3 workers declined, automatically advance to wider pool
        const anyWaiting = matchingTopWorkers.value.some(w => w.status === "Waiting");
        if (!anyWaiting) {
          simulateNoResponsePathB();
        }
      } else if (matchingPhase.value === "wider") {
        const localW = matchingWiderPool.value.find(w => w.id === loggedInWorker.value.id);
        if (localW) localW.status = "Declined";
      }
    };

    const workerStartJob = (bookingId) => {
      const b = bookings.value.find(bk => bk.id === bookingId);
      if (b) {
        b.status = "InProgress";
        saveBookings();
        addDemoLog(`Worker ${b.workerName} started work on job ${bookingId}.`);
      }
    };

    const workerCompleteJob = (bookingId) => {
      const b = bookings.value.find(bk => bk.id === bookingId);
      if (b) {
        b.status = "Completed";
        saveBookings();
        addDemoLog(`Worker ${b.workerName} finished job ${bookingId}. Awaiting customer review.`);
        currentView.value = "dashboard";
      }
    };

    const setAdminTab = (tab) => {
      adminTab.value = tab;
    };

    // Live Worker Operations States
    const liveWorkerStats = ref([
      { id: "worker-1", name: "Ravi Kumar", skill: "Plumbing", cooperative: "Chennai Skilled Workers Cooperative", status: "AVAILABLE", x: 130, y: 140, destX: null, destY: null, progress: 0, eta: null, bookingId: null, currentWork: "None", clientArea: "Adyar", lastUpdated: "Just now", alert: false },
      { id: "worker-2", name: "Priya Sharma", skill: "Electrical", cooperative: "Chennai Skilled Workers Cooperative", status: "ON JOB", x: 200, y: 320, destX: null, destY: null, progress: 85, eta: null, bookingId: "BK1027", currentWork: "Wiring Repair", clientArea: "Velachery", lastUpdated: "Just now", alert: false },
      { id: "worker-3", name: "Suresh Kumar", skill: "Carpentry", cooperative: "Chennai Skilled Workers Cooperative", status: "AVAILABLE", x: 300, y: 200, destX: null, destY: null, progress: 0, eta: null, bookingId: null, currentWork: "None", clientArea: "Alwarpet", lastUpdated: "2 mins ago", alert: false },
      { id: "worker-4", name: "Anita Rao", skill: "Cleaning", cooperative: "Chennai Skilled Workers Cooperative", status: "TRAVELLING", x: 250, y: 180, destX: 450, destY: 300, progress: 30, eta: 12, bookingId: "BK1024", currentWork: "House Cleaning", clientArea: "Tambaram", lastUpdated: "Just now", alert: false },
      { id: "worker-5", name: "Rajesh Patel", skill: "Painting", cooperative: "Chennai Skilled Workers Cooperative", status: "OFF DUTY", x: 80, y: 250, destX: null, destY: null, progress: 0, eta: null, bookingId: null, currentWork: "None", clientArea: "Mylapore", lastUpdated: "1 hour ago", alert: false },
      { id: "worker-6", name: "Amit Verma", skill: "Gardening", cooperative: "Chennai Skilled Workers Cooperative", status: "AVAILABLE", x: 400, y: 150, destX: null, destY: null, progress: 0, eta: null, bookingId: null, currentWork: "None", clientArea: "Adyar", lastUpdated: "5 mins ago", alert: false },
      { id: "worker-7", name: "Lakshmi Nair", skill: "Caregiving", cooperative: "Chennai Skilled Workers Cooperative", status: "ON JOB", x: 350, y: 80, destX: null, destY: null, progress: 100, eta: null, bookingId: "BK1019", currentWork: "Elderly Care", clientArea: "Mylapore", lastUpdated: "Just now", alert: false },
      { id: "worker-8", name: "Vikram Singh", skill: "Cleaning", cooperative: "Chennai Skilled Workers Cooperative", status: "ON JOB", x: 200, y: 180, destX: null, destY: null, progress: 50, eta: null, bookingId: "BK1029", currentWork: "Office Cleaning", clientArea: "Mylapore", lastUpdated: "Just now", alert: true, alertReason: "Emergency alert / job issue" }
    ]);

    const selectedWorkerId = ref(null);
    const liveAdminFilterStatus = ref("All");
    const liveAdminFilterService = ref("All");
    const liveAdminFilterCoop = ref("All");
    const liveAdminFilterJobStatus = ref("All");

    const mapZoom = ref(1);
    const mapCenter = ref({ x: 250, y: 200 });

    const computedViewBox = computed(() => {
      const width = 500 / mapZoom.value;
      const height = 400 / mapZoom.value;
      const minX = mapCenter.value.x - width / 2;
      const minY = mapCenter.value.y - height / 2;
      return `${minX} ${minY} ${width} ${height}`;
    });

    const selectedLiveWorker = computed(() => {
      return liveWorkerStats.value.find(w => w.id === selectedWorkerId.value) || null;
    });

    const filteredLiveWorkers = computed(() => {
      return liveWorkerStats.value.filter(w => {
        const matchesStatus = liveAdminFilterStatus.value === "All" ||
          (liveAdminFilterStatus.value === "Attention" && w.alert) ||
          (liveAdminFilterStatus.value !== "Attention" && w.status === liveAdminFilterStatus.value);
          
        const matchesService = liveAdminFilterService.value === "All" || w.skill === liveAdminFilterService.value;
        const matchesCoop = liveAdminFilterCoop.value === "All" || w.cooperative === liveAdminFilterCoop.value;
        
        const matchesJobStatus = liveAdminFilterJobStatus.value === "All" ||
          (liveAdminFilterJobStatus.value === "Travelling" && w.status === "TRAVELLING") ||
          (liveAdminFilterJobStatus.value === "In Progress" && w.status === "ON JOB" && w.progress < 100) ||
          (liveAdminFilterJobStatus.value === "Completed" && w.progress === 100);
          
        return matchesStatus && matchesService && matchesCoop && matchesJobStatus;
      });
    });

    const liveStatsTotalWorkers = computed(() => liveWorkerStats.value.length);
    const liveStatsAvailable = computed(() => liveWorkerStats.value.filter(w => w.status === "AVAILABLE").length);
    const liveStatsOnJob = computed(() => liveWorkerStats.value.filter(w => w.status === "ON JOB").length);
    const liveStatsTravelling = computed(() => liveWorkerStats.value.filter(w => w.status === "TRAVELLING").length);
    const liveStatsOffDuty = computed(() => liveWorkerStats.value.filter(w => w.status === "OFF DUTY").length);
    const liveStatsActiveJobs = computed(() => liveWorkerStats.value.filter(w => w.bookingId !== null).length);

    const zoomIn = () => {
      mapZoom.value = Math.min(mapZoom.value + 0.25, 3);
    };

    const zoomOut = () => {
      mapZoom.value = Math.max(mapZoom.value - 0.25, 0.5);
    };

    const fitAll = () => {
      selectedWorkerId.value = null;
      const startX = mapCenter.value.x;
      const startY = mapCenter.value.y;
      const startZoom = mapZoom.value;
      const targetX = 250;
      const targetY = 200;
      const targetZoom = 1.0;

      const startTime = performance.now();
      const duration = 400; // fast 400ms transition

      const animateMap = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress * (2 - progress);

        mapCenter.value.x = startX + (targetX - startX) * ease;
        mapCenter.value.y = startY + (targetY - startY) * ease;
        mapZoom.value = startZoom + (targetZoom - startZoom) * ease;

        if (progress < 1) {
          requestAnimationFrame(animateMap);
        }
      };
      requestAnimationFrame(animateMap);
    };

    const focusWorker = (w) => {
      selectedWorkerId.value = w.id;
      const startX = mapCenter.value.x;
      const startY = mapCenter.value.y;
      const startZoom = mapZoom.value;
      const targetX = w.x;
      const targetY = w.y;
      const targetZoom = 2.0;

      const startTime = performance.now();
      const duration = 500; // smooth 500ms transition

      const animateMap = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress * (2 - progress);

        mapCenter.value.x = startX + (targetX - startX) * ease;
        mapCenter.value.y = startY + (targetY - startY) * ease;
        mapZoom.value = startZoom + (targetZoom - startZoom) * ease;

        if (progress < 1) {
          requestAnimationFrame(animateMap);
        }
      };
      requestAnimationFrame(animateMap);
    };

    const closeLiveWorkerDrawer = () => {
      selectedWorkerId.value = null;
    };

    const startSimulatedMovement = () => {
      setInterval(() => {
        liveWorkerStats.value.forEach(w => {
          if (w.status === "TRAVELLING" && w.destX !== null && w.destY !== null) {
            const dx = w.destX - w.x;
            const dy = w.destY - w.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 5) {
              w.x += (dx / dist) * 5;
              w.y += (dy / dist) * 5;
              w.progress = Math.min(w.progress + 3, 99);
              if (w.eta && w.eta > 1) {
                w.eta = Math.max(w.eta - 1, 1);
              }
              w.lastUpdated = "Just now";
            } else {
              w.x = w.destX;
              w.y = w.destY;
              w.status = "ON JOB";
              w.progress = 100;
              w.eta = null;
              w.destX = null;
              w.destY = null;
              w.lastUpdated = "Just now";
            }
          }
        });
      }, 3000);
    };

    // Admin Actions
    const openRequestDetails = (request) => {
      selectedRequest.value = request;
    };
    const openWorkerDetails = (worker) => {
      selectedWorker.value = worker;
    };
    const openCustomerDetails = (customer) => {
      selectedCustomer.value = customer;
    };
    const openCooperativeDetails = (coop) => {
      selectedCooperative.value = coop;
    };
    const openBookingDetails = (booking) => {
      selectedBooking.value = booking;
    };
    const closeAdminModals = () => {
      selectedRequest.value = null;
      selectedWorker.value = null;
      selectedCustomer.value = null;
      selectedCooperative.value = null;
      selectedBooking.value = null;
    };

    // Services management actions
    const openAddService = () => {
      newServiceData.value = { id: "", translationKey: "", baseRate: 200, hourlyRate: 100, icon: "wrench", status: "Enabled" };
      showAddServiceModal.value = true;
    };
    const openEditService = (svc) => {
      editingServiceData.value = { ...svc };
      showEditServiceModal.value = true;
    };
    const addService = () => {
      if (newServiceData.value.id) {
        services.value.push({
          id: newServiceData.value.id,
          translationKey: newServiceData.value.translationKey || newServiceData.value.id,
          baseRate: Number(newServiceData.value.baseRate),
          hourlyRate: Number(newServiceData.value.hourlyRate),
          icon: newServiceData.value.icon || "wrench",
          status: newServiceData.value.status || "Enabled"
        });
        showAddServiceModal.value = false;
        addDemoLog(`New service added: ${newServiceData.value.id}`);
        adminNotifications.value.unshift({
          id: "notif-" + Date.now(),
          type: "service_added",
          message: `New service category "${newServiceData.value.id}" has been created.`,
          time: "Just now",
          read: false
        });
      }
    };
    const editService = () => {
      const idx = services.value.findIndex(s => s.id === editingServiceData.value.id);
      if (idx !== -1) {
        services.value[idx] = {
          ...editingServiceData.value,
          baseRate: Number(editingServiceData.value.baseRate),
          hourlyRate: Number(editingServiceData.value.hourlyRate)
        };
        showEditServiceModal.value = false;
        addDemoLog(`Service ${editingServiceData.value.id} updated by Admin.`);
      }
    };
    const toggleServiceStatus = (svcId) => {
      const svc = services.value.find(s => s.id === svcId);
      if (svc) {
        svc.status = svc.status === "Enabled" ? "Disabled" : "Enabled";
        addDemoLog(`Service ${svcId} status changed to ${svc.status}.`);
      }
    };

    // Notifications actions
    const markNotificationRead = (notifId) => {
      const notif = adminNotifications.value.find(n => n.id === notifId);
      if (notif) notif.read = true;
    };
    const markAllNotificationsRead = () => {
      adminNotifications.value.forEach(n => n.read = true);
    };

    return {
      // App Configs
      theme,
      language,
      currentRole,
      currentView,
      t,
      getServiceName,
      toggleTheme,
      changeLanguage,
      setRole,
      navigateTo,
      
      // Auth States
      loggedInCustomer,
      loggedInWorker,
      loggedInAdmin,
      loginError,
      showPassword,
      authEmail,
      authPassword,
      authName,
      authCoop,
      authSkill,
      authExperience,
      handleLogin,
      handleRegister,
      handleLogout,

      // Booking State
      services,
      cooperatives,
      bookings,
      activeBookingId,
      activeBooking,
      activeWorkerJob,
      workerJobHistory,
      customerBookings,
      requestForm,
      ratingModal,
      selectService,
      handleRequestSubmit,
      completeJob,
      submitRating,

      // Worker Continuity state
      matchingPhase,
      matchingTimer,
      matchingTopWorkers,
      matchingWiderPool,
      demoLogs,
      
      // Simulation commands
      simulateWorkerAcceptancePathA,
      simulateNoResponsePathB,
      simulatePoolWorkerAcceptance,
      resetDemoState,

      // Worker actions & upgraded states
      workerIncomingRequests,
      handleWorkerAccept,
      handleWorkerReject,
      workerStartJob,
      workerCompleteJob,
      earningsTab,
      earningsFilterService,
      earningsFilterType,
      earningsFilterDate,
      showFilterDrawer,
      selectedOrder,
      selectedIncentive,
      redemptionAmount,
      redemptionError,
      redemptionSuccess,
      redemptionHistory,
      incentivesList,
      demoWorkerRequests,
      acceptDemoRequest,
      rejectDemoRequest,
      handleRedeem,
      animatedWorkers,
      animatedDispatched,
      animatedCooperatives,
      statsAnimationCompleted,
      triggerStatsAnimation,

      // Admin Panel States
      adminTab,
      setAdminTab,
      liveWorkerStats,
      selectedWorkerId,
      liveAdminFilterStatus,
      liveAdminFilterService,
      liveAdminFilterCoop,
      liveAdminFilterJobStatus,
      mapZoom,
      mapCenter,
      computedViewBox,
      selectedLiveWorker,
      filteredLiveWorkers,
      liveStatsTotalWorkers,
      liveStatsAvailable,
      liveStatsOnJob,
      liveStatsTravelling,
      liveStatsOffDuty,
      liveStatsActiveJobs,
      zoomIn,
      zoomOut,
      fitAll,
      focusWorker,
      closeLiveWorkerDrawer,
      systemStats,
      selectedRequest,
      selectedWorker,
      selectedCustomer,
      selectedCooperative,
      selectedBooking,

      // Search & Filters
      workerSearch,
      workerFilterSkill,
      workerFilterAvailability,
      workerFilterCoop,
      workerFilterVerification,
      customerSearch,
      customerFilterStatus,
      requestSearch,
      requestFilterStatus,
      bookingSearch,
      bookingFilterStatus,

      // Modals and notifications
      showAddServiceModal,
      showEditServiceModal,
      newServiceData,
      editingServiceData,
      adminNotifications,

      // Admin computed lists
      allWorkersList,
      adminStats,
      filteredWorkers,
      filteredCustomers,
      filteredBookings,
      filteredRequests,
      cooperativeStatsList,

      // Admin Methods
      openRequestDetails,
      openWorkerDetails,
      openCustomerDetails,
      openCooperativeDetails,
      openBookingDetails,
      closeAdminModals,
      openAddService,
      openEditService,
      addService,
      editService,
      toggleServiceStatus,
      markNotificationRead,
      markAllNotificationsRead
    };
  }
});

app.component('animated-number', {
  props: {
    value: {
      type: [Number, String],
      required: true
    },
    duration: {
      type: Number,
      default: 1500
    },
    formatCurrency: {
      type: Boolean,
      default: false
    },
    formatPercent: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const displayValue = ref("0");
    const elementRef = ref(null);
    let observer = null;
    let hasAnimated = false;
    let animationFrameId = null;

    const getNumericValue = (val) => {
      if (typeof val === 'number') return val;
      const clean = String(val).replace(/[^0-9.-]/g, '');
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    };

    const formatValue = (num) => {
      const originalStr = String(props.value);
      
      const hasCurrencySymbol = originalStr.includes('₹') || props.formatCurrency;
      const hasPercentSymbol = originalStr.includes('%') || props.formatPercent;
      const hasStar = originalStr.includes('★') || originalStr.includes('⭐');
      const hasKm = originalStr.includes('km');
      const hasHrs = originalStr.includes('hrs');
      const hasCases = originalStr.includes('Cases');
      const hasMembers = originalStr.includes('Members');
      
      let formatted = num;

      if (originalStr.includes('.') || hasStar || hasKm) {
        formatted = num.toFixed(1);
      } else {
        formatted = Math.floor(num);
      }

      if (Math.abs(formatted) >= 1000) {
        formatted = Number(formatted).toLocaleString('en-IN');
      }

      if (hasCurrencySymbol) {
        formatted = '₹' + formatted;
      }
      if (hasPercentSymbol) {
        formatted = formatted + '%';
      }
      if (hasStar) {
        formatted = formatted + (originalStr.includes('★') ? ' ★' : ' ⭐');
      }
      if (hasKm) {
        formatted = formatted + ' km';
      }
      if (hasHrs) {
        formatted = formatted + ' hrs';
      }
      if (hasCases) {
        formatted = formatted + ' Cases';
      }
      if (hasMembers) {
        formatted = formatted + ' Members';
      }

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
        
        // Easing: easeOutQuad
        const ease = progress * (2 - progress);
        const current = start + (target - start) * ease;

        displayValue.value = formatValue(current);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animateStep);
        } else {
          displayValue.value = formatValue(target);
          hasAnimated = true;
        }
      };

      animationFrameId = requestAnimationFrame(animateStep);
    };

    watch(() => props.value, (newVal, oldVal) => {
      if (hasAnimated) {
        triggerAnimation(newVal, oldVal);
      } else {
        displayValue.value = formatValue(0);
      }
    });

    onMounted(() => {
      displayValue.value = formatValue(0);

      if (elementRef.value && typeof IntersectionObserver !== 'undefined') {
        observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting && !hasAnimated) {
              triggerAnimation(props.value, 0);
            }
          });
        }, { threshold: 0.05 });
        observer.observe(elementRef.value);
      } else {
        triggerAnimation(props.value, 0);
      }
    });

    onUnmounted(() => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (observer && elementRef.value) observer.disconnect();
    });

    return {
      displayValue,
      elementRef
    };
  },
  template: `<span ref="elementRef">{{ displayValue }}</span>`
});

app.mount("#app");
