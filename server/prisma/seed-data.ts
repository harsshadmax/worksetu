// Single source of demo truth: every customer, worker, booking, review and
// notification the seeded platform contains is built here, so the dashboards,
// tables and totals all describe one coherent cooperative network rather than
// per-screen sample rows. People, phone numbers and addresses are fictional.
//
// Chennai is the dense market (most workers, most bookings, tightest
// localities); Delhi, Mumbai and Bengaluru carry smaller crews so the other
// three cooperatives are real places with real members rather than empty
// registry entries.

export type Availability = "AVAILABLE" | "ON_JOB" | "OFF_DUTY";
export type Verification = "APPROVED" | "PENDING";

export interface CustomerSeed {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  lng: number;
  lat: number;
  city: "Chennai" | "Delhi" | "Mumbai" | "Bengaluru";
  joinedDaysAgo: number;
}

export interface WorkerSeed {
  mockId: string;
  name: string;
  email: string;
  phone: string;
  skill: string;
  extraSkills?: string[];
  experience: number;
  location: string;
  lng: number;
  lat: number;
  cooperativeId: string;
  city: "Chennai" | "Delhi" | "Mumbai" | "Bengaluru";
  availabilityStatus: Availability;
  verification: Verification;
  joinedDaysAgo: number;
  serviceRadiusKm: number;
}

export interface BookingPlan {
  customerMockId: string;
  workerMockId: string | null;
  serviceId: string;
  description: string;
  daysAgo: number;
  hour: number;
  minute: number;
  hoursBilled: number;
  urgency: "NORMAL" | "URGENT";
  status:
    | "SETTLED"
    | "CANCELLED"
    | "REQUESTED"
    | "DISPATCHING_TOP3"
    | "DISPATCHING_POOL"
    | "ASSIGNED"
    | "CONFIRMED"
    | "IN_PROGRESS"
    | "COMPLETED";
  rating: number | null;
  review: string | null;
  cancelReason?: string;
  offeredToMockIds?: string[];
  declinedByMockIds?: string[];
}

// Two seeded accounts are wired into the demo login buttons and must keep
// their identities: lavanya.krishnamoorthy.wsu@gmail.com / anand.verma.wsu@gmail.com (customers) and
// senthilkumar.arumugam.wsu@gmail.com / rajesh.kannan.wsu@gmail.com (workers).
export const customers: CustomerSeed[] = [
  { id: "cust-1", name: "Anand Verma", email: "anand.verma.wsu@gmail.com", phone: "9876543210", address: "12, Kasturba Gandhi Marg, Connaught Place, New Delhi", lng: 77.2167, lat: 28.6315, city: "Delhi", joinedDaysAgo: 412 },
  { id: "cust-2", name: "Lavanya Krishnamoorthy", email: "lavanya.krishnamoorthy.wsu@gmail.com", phone: "8765432109", address: "54, Gandhi Nagar Main Road, Adyar, Chennai", lng: 80.2569, lat: 13.0064, city: "Chennai", joinedDaysAgo: 388 },
  { id: "cust-3", name: "Sundar Rajagopal", email: "sundar.rajagopal.wsu@gmail.com", phone: "9840112207", address: "8/3, Rajaji Street, Chromepet, Chennai", lng: 80.1417, lat: 12.9516, city: "Chennai", joinedDaysAgo: 301 },
  { id: "cust-4", name: "Fathima Nasreen", email: "fathima.nasreen.wsu@gmail.com", phone: "9884503318", address: "22, Thillai Ganga Nagar, Nanganallur, Chennai", lng: 80.1892, lat: 12.9803, city: "Chennai", joinedDaysAgo: 264 },
  { id: "cust-5", name: "Gopinath Sekar", email: "gopinath.sekar.wsu@gmail.com", phone: "9790224419", address: "141, Velachery Main Road, Velachery, Chennai", lng: 80.2206, lat: 12.9791, city: "Chennai", joinedDaysAgo: 233 },
  { id: "cust-6", name: "Janaki Murugesan", email: "janaki.murugesan.wsu@gmail.com", phone: "9566318824", address: "3, Bharathi Salai, Tambaram West, Chennai", lng: 80.1063, lat: 12.9249, city: "Chennai", joinedDaysAgo: 198 },
  { id: "cust-7", name: "Aravind Chellappa", email: "aravind.chellappa.wsu@gmail.com", phone: "9500712236", address: "76, Lattice Bridge Road, Thiruvanmiyur, Chennai", lng: 80.2596, lat: 12.9829, city: "Chennai", joinedDaysAgo: 176 },
  { id: "cust-8", name: "Nithya Balasubramanian", email: "nithya.balasubramanian.wsu@gmail.com", phone: "9840667751", address: "19, Kamarajar Street, Porur, Chennai", lng: 80.1565, lat: 13.0359, city: "Chennai", joinedDaysAgo: 149 },
  { id: "cust-9", name: "Hari Prasad Iyer", email: "hariprasad.iyer.wsu@gmail.com", phone: "9789045512", address: "5, Ambedkar Nagar 2nd Street, Pallavaram, Chennai", lng: 80.1491, lat: 12.9675, city: "Chennai", joinedDaysAgo: 121 },
  { id: "cust-10", name: "Shalini Vaidyanathan", email: "shalini.vaidyanathan.wsu@gmail.com", phone: "9962238804", address: "27, Ramaniyam Enclave, Sholinganallur, Chennai", lng: 80.2279, lat: 12.9010, city: "Chennai", joinedDaysAgo: 96 },
  { id: "cust-11", name: "Mohan Krishnamurthy", email: "mohan.krishnamurthy.wsu@gmail.com", phone: "9445127739", address: "64, MTH Road, Ambattur, Chennai", lng: 80.1548, lat: 13.1143, city: "Chennai", joinedDaysAgo: 74 },
  { id: "cust-12", name: "Rukmini Desai", email: "rukmini.desai.wsu@gmail.com", phone: "9820441167", address: "402, Sai Darshan CHS, Andheri East, Mumbai", lng: 72.8697, lat: 19.1197, city: "Mumbai", joinedDaysAgo: 203 },
  { id: "cust-13", name: "Imran Qureshi", email: "imran.qureshi.wsu@gmail.com", phone: "9811336720", address: "B-14, Lajpat Nagar II, New Delhi", lng: 77.2432, lat: 28.5677, city: "Delhi", joinedDaysAgo: 158 },
  { id: "cust-14", name: "Chaitra Hegde", email: "chaitra.hegde.wsu@gmail.com", phone: "9740558812", address: "18, 12th Main, Indiranagar, Bengaluru", lng: 77.6408, lat: 12.9716, city: "Bengaluru", joinedDaysAgo: 112 }
];

export const workers: WorkerSeed[] = [
  // Chennai — Chennai Skilled Workers Cooperative (coop-1)
  { mockId: "worker-1", name: "Senthil Kumar Arumugam", email: "senthilkumar.arumugam.wsu@gmail.com", phone: "9876543211", skill: "plumbing", extraSkills: ["domesticHelp"], experience: 6, location: "Adyar, Chennai", lng: 80.2565, lat: 13.0012, cooperativeId: "coop-1", city: "Chennai", availabilityStatus: "AVAILABLE", verification: "APPROVED", joinedDaysAgo: 505, serviceRadiusKm: 12 },
  { mockId: "worker-2", name: "Priya Shanmugam", email: "priya.shanmugam.wsu@gmail.com", phone: "8765432112", skill: "plumbing", experience: 5, location: "Mylapore, Chennai", lng: 80.2707, lat: 13.0339, cooperativeId: "coop-1", city: "Chennai", availabilityStatus: "AVAILABLE", verification: "APPROVED", joinedDaysAgo: 468, serviceRadiusKm: 10 },
  { mockId: "worker-7", name: "Rajesh Kannan", email: "rajesh.kannan.wsu@gmail.com", phone: "9210987617", skill: "electrical", experience: 9, location: "Velachery, Chennai", lng: 80.2209, lat: 12.9756, cooperativeId: "coop-1", city: "Chennai", availabilityStatus: "AVAILABLE", verification: "APPROVED", joinedDaysAgo: 522, serviceRadiusKm: 15 },
  { mockId: "worker-9", name: "Saravanan Pandian", email: "saravanan.pandian.wsu@gmail.com", phone: "9840775513", skill: "electrical", extraSkills: ["carpentry"], experience: 13, location: "Tambaram, Chennai", lng: 80.1063, lat: 12.9249, cooperativeId: "coop-1", city: "Chennai", availabilityStatus: "ON_JOB", verification: "APPROVED", joinedDaysAgo: 431, serviceRadiusKm: 18 },
  { mockId: "worker-10", name: "Kavitha Raman", email: "kavitha.raman.wsu@gmail.com", phone: "9500334421", skill: "cleaning", experience: 4, location: "Chromepet, Chennai", lng: 80.1417, lat: 12.9516, cooperativeId: "coop-1", city: "Chennai", availabilityStatus: "AVAILABLE", verification: "APPROVED", joinedDaysAgo: 287, serviceRadiusKm: 9 },
  { mockId: "worker-11", name: "Murugan Thangavel", email: "murugan.thangavel.wsu@gmail.com", phone: "9789112234", skill: "carpentry", experience: 16, location: "Pallavaram, Chennai", lng: 80.1491, lat: 12.9675, cooperativeId: "coop-1", city: "Chennai", availabilityStatus: "AVAILABLE", verification: "APPROVED", joinedDaysAgo: 612, serviceRadiusKm: 14 },
  { mockId: "worker-12", name: "Selvi Manoharan", email: "selvi.manoharan.wsu@gmail.com", phone: "9962007745", skill: "caregiving", extraSkills: ["domesticHelp"], experience: 11, location: "Thiruvanmiyur, Chennai", lng: 80.2596, lat: 12.9829, cooperativeId: "coop-1", city: "Chennai", availabilityStatus: "ON_JOB", verification: "APPROVED", joinedDaysAgo: 354, serviceRadiusKm: 8 },
  { mockId: "worker-13", name: "Dinesh Karthik Raja", email: "dineshkarthik.raja.wsu@gmail.com", phone: "9445886620", skill: "painting", experience: 7, location: "Porur, Chennai", lng: 80.1565, lat: 13.0359, cooperativeId: "coop-1", city: "Chennai", availabilityStatus: "AVAILABLE", verification: "APPROVED", joinedDaysAgo: 265, serviceRadiusKm: 16 },
  { mockId: "worker-14", name: "Anitha Jeyaraman", email: "anitha.jeyaraman.wsu@gmail.com", phone: "9840229917", skill: "cleaning", extraSkills: ["domesticHelp"], experience: 3, location: "Velachery, Chennai", lng: 80.2206, lat: 12.9791, cooperativeId: "coop-1", city: "Chennai", availabilityStatus: "OFF_DUTY", verification: "APPROVED", joinedDaysAgo: 191, serviceRadiusKm: 7 },
  { mockId: "worker-15", name: "Bhaskaran Ilango", email: "bhaskaran.ilango.wsu@gmail.com", phone: "9790556631", skill: "gardening", experience: 18, location: "Sholinganallur, Chennai", lng: 80.2279, lat: 12.9010, cooperativeId: "coop-1", city: "Chennai", availabilityStatus: "AVAILABLE", verification: "APPROVED", joinedDaysAgo: 702, serviceRadiusKm: 20 },
  { mockId: "worker-16", name: "Yuvaraj Elangovan", email: "yuvaraj.elangovan.wsu@gmail.com", phone: "9566774428", skill: "plumbing", experience: 2, location: "Ambattur, Chennai", lng: 80.1548, lat: 13.1143, cooperativeId: "coop-1", city: "Chennai", availabilityStatus: "AVAILABLE", verification: "PENDING", joinedDaysAgo: 21, serviceRadiusKm: 10 },
  { mockId: "worker-17", name: "Revathi Subramani", email: "revathi.subramani.wsu@gmail.com", phone: "9500661132", skill: "domesticHelp", experience: 8, location: "Nanganallur, Chennai", lng: 80.1892, lat: 12.9803, cooperativeId: "coop-1", city: "Chennai", availabilityStatus: "AVAILABLE", verification: "APPROVED", joinedDaysAgo: 329, serviceRadiusKm: 9 },
  { mockId: "worker-18", name: "Karthikeyan Velu", email: "karthikeyan.velu.wsu@gmail.com", phone: "9840338826", skill: "painting", extraSkills: ["carpentry"], experience: 12, location: "Guindy, Chennai", lng: 80.2206, lat: 13.0067, cooperativeId: "coop-1", city: "Chennai", availabilityStatus: "AVAILABLE", verification: "APPROVED", joinedDaysAgo: 447, serviceRadiusKm: 17 },
  { mockId: "worker-19", name: "Sasikala Perumal", email: "sasikala.perumal.wsu@gmail.com", phone: "9789443317", skill: "caregiving", experience: 6, location: "Medavakkam, Chennai", lng: 80.1929, lat: 12.9180, cooperativeId: "coop-1", city: "Chennai", availabilityStatus: "AVAILABLE", verification: "PENDING", joinedDaysAgo: 9, serviceRadiusKm: 11 },

  // Delhi — Delhi Household & Labor Union (coop-2)
  { mockId: "worker-3", name: "Amit Singh", email: "amit.singh.wsu@gmail.com", phone: "7654321213", skill: "plumbing", experience: 8, location: "Connaught Place, New Delhi", lng: 77.2167, lat: 28.6315, cooperativeId: "coop-2", city: "Delhi", availabilityStatus: "AVAILABLE", verification: "APPROVED", joinedDaysAgo: 553, serviceRadiusKm: 14 },
  { mockId: "worker-20", name: "Harpreet Kaur", email: "harpreet.kaur.wsu@gmail.com", phone: "9811224436", skill: "cleaning", extraSkills: ["domesticHelp"], experience: 5, location: "Lajpat Nagar, New Delhi", lng: 77.2432, lat: 28.5677, cooperativeId: "coop-2", city: "Delhi", availabilityStatus: "AVAILABLE", verification: "APPROVED", joinedDaysAgo: 274, serviceRadiusKm: 12 },
  { mockId: "worker-21", name: "Naveen Chandra Joshi", email: "naveenchandra.joshi.wsu@gmail.com", phone: "9871556624", skill: "electrical", experience: 15, location: "Karol Bagh, New Delhi", lng: 77.1906, lat: 28.6519, cooperativeId: "coop-2", city: "Delhi", availabilityStatus: "OFF_DUTY", verification: "APPROVED", joinedDaysAgo: 638, serviceRadiusKm: 16 },

  // Mumbai — Mumbai Community & Caregivers Society (coop-3)
  { mockId: "worker-4", name: "Vikram Rathore", email: "vikram.rathore.wsu@gmail.com", phone: "9543210914", skill: "plumbing", experience: 4, location: "Andheri East, Mumbai", lng: 72.8697, lat: 19.1197, cooperativeId: "coop-3", city: "Mumbai", availabilityStatus: "AVAILABLE", verification: "APPROVED", joinedDaysAgo: 318, serviceRadiusKm: 11 },
  { mockId: "worker-8", name: "Meena Kumari", email: "meena.kumari.wsu@gmail.com", phone: "9109876518", skill: "caregiving", extraSkills: ["cleaning"], experience: 5, location: "Bandra West, Mumbai", lng: 72.8296, lat: 19.0596, cooperativeId: "coop-3", city: "Mumbai", availabilityStatus: "AVAILABLE", verification: "APPROVED", joinedDaysAgo: 366, serviceRadiusKm: 10 },

  // Bengaluru — Bangalore Technicians Cooperative Board (coop-4)
  { mockId: "worker-6", name: "Lakshmi Narayanan", email: "lakshmi.narayanan.wsu@gmail.com", phone: "9321098716", skill: "carpentry", extraSkills: ["painting"], experience: 7, location: "Indiranagar, Bengaluru", lng: 77.6408, lat: 12.9716, cooperativeId: "coop-4", city: "Bengaluru", availabilityStatus: "AVAILABLE", verification: "APPROVED", joinedDaysAgo: 402, serviceRadiusKm: 13 },
  { mockId: "worker-22", name: "Shivakumar Gowda", email: "shivakumar.gowda.wsu@gmail.com", phone: "9740117725", skill: "electrical", experience: 10, location: "Koramangala, Bengaluru", lng: 77.6245, lat: 12.9352, cooperativeId: "coop-4", city: "Bengaluru", availabilityStatus: "AVAILABLE", verification: "APPROVED", joinedDaysAgo: 239, serviceRadiusKm: 15 }
];

// Deterministic generator: the same dataset every run, so screenshots, totals
// and a re-seeded demo all agree with each other.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const JOB_DESCRIPTIONS: Record<string, string[]> = {
  plumbing: [
    "Overhead tank float valve keeps overflowing at night.",
    "Kitchen sink drain blocked; water backs up into the utility area.",
    "Bathroom mixer tap dripping continuously since last week.",
    "Replace corroded inlet pipe behind the washing machine.",
    "Geyser inlet hose leaking where it meets the wall valve.",
    "Wash basin outlet slow to drain in both bathrooms.",
    "Motor runs but no water reaches the second floor tank."
  ],
  electrical: [
    "Bedroom power points dead after last night's voltage fluctuation.",
    "Ceiling fan regulator heats up and smells of burning.",
    "MCB trips every time the air conditioner starts.",
    "Install two additional 15A points in the kitchen for the oven.",
    "Corridor lights flicker; suspect a loose neutral.",
    "Main distribution board needs rewiring after a short circuit."
  ],
  carpentry: [
    "Wardrobe sliding door off its lower track.",
    "Kitchen cabinet hinges loose; two shutters sagging.",
    "Fix termite-damaged window frame in the front bedroom.",
    "Build a small study table for the children's room.",
    "Main door swollen from the rains and not closing flush."
  ],
  painting: [
    "Seepage patch on the hall ceiling needs putty and repaint.",
    "Repaint two bedrooms in washable emulsion before Diwali.",
    "Touch up the exterior compound wall after the monsoon.",
    "Enamel work on all window grills, mild rust on the frames."
  ],
  caregiving: [
    "Post-surgery day attendant for my father, mobility support needed.",
    "Elder care for my mother for the weekend while we travel.",
    "Day attendant for a bedridden patient, three days a week.",
    "Physiotherapy support and medication reminders for my grandmother."
  ],
  gardening: [
    "Terrace garden needs pruning and a pest check on the curry leaf plants.",
    "Clear overgrowth along the compound and lay fresh soil in the beds.",
    "Monthly maintenance for the front lawn and potted plants."
  ],
  cleaning: [
    "Deep cleaning of a 2BHK before the new tenants move in.",
    "Post-renovation cleaning; cement dust everywhere.",
    "Kitchen chimney and cabinet degreasing.",
    "Full house cleaning before the festive season."
  ],
  domesticHelp: [
    "Daily cooking and kitchen help, South Indian vegetarian.",
    "Morning household help for cleaning and laundry, weekdays.",
    "Cooking assistance for a family function, two days."
  ]
};

const REVIEW_TEXT: Record<number, string[]> = {
  5: [
    "Arrived on time, finished in under an hour and cleaned up after the work.",
    "Explained the problem clearly before starting and charged exactly what was quoted.",
    "Very neat work. Carried all the spares needed, no second visit required.",
    "Polite and quick. The cooperative rate card was shared upfront.",
    "Came on a Sunday for an urgent issue and sorted it without fuss.",
    "Excellent workmanship. Will ask for the same person next time."
  ],
  4: [
    "Good work overall, arrived about twenty minutes late though.",
    "Job done properly. Had to go out to buy a part midway.",
    "Neat and professional, slightly slower than I expected.",
    "Solved the issue. Would have liked a little more cleanup afterwards."
  ],
  3: [
    "Work is acceptable but I had to call again for a small leak the next day.",
    "Average. The job took longer than the estimate given.",
    "Fixed it, but communication about the delay could have been better."
  ],
  2: [
    "Reached almost an hour late and the finish was not up to the mark.",
    "Had to follow up twice before the work was completed properly."
  ]
};

const CANCEL_REASONS = [
  "Customer cancelled before a worker accepted the offer",
  "Customer rescheduled to a later date",
  "No cooperative worker available in the service area at that time",
  "Issue resolved by the building maintenance team"
];

interface Ctx {
  rand: () => number;
  pick: <T>(list: T[]) => T;
}

function makeCtx(seed: number): Ctx {
  const rand = mulberry32(seed);
  return { rand, pick: (list) => list[Math.floor(rand() * list.length)] };
}

// A rating distribution with a real tail: most jobs go well, some don't.
function drawRating(rand: () => number): number {
  const r = rand();
  if (r < 0.55) return 5;
  if (r < 0.83) return 4;
  if (r < 0.95) return 3;
  return 2;
}

export function buildBookings(): BookingPlan[] {
  const ctx = makeCtx(20260923);
  const { rand, pick } = ctx;
  const plans: BookingPlan[] = [];

  const skillsOf = (w: WorkerSeed) => [w.skill, ...(w.extraSkills ?? [])];
  const workersFor = (service: string, city: string) =>
    workers.filter((w) => w.city === city && w.verification === "APPROVED" && skillsOf(w).includes(service));

  // Every customer has a history, weighted so the demo-login accounts and the
  // older members have more to show than someone who joined last month.
  for (const c of customers) {
    const tenure = Math.min(c.joinedDaysAgo, 150);
    const target = Math.max(1, Math.round((tenure / 150) * 7 * (0.6 + rand() * 0.9)));
    for (let i = 0; i < target; i++) {
      const service = pick(Object.keys(JOB_DESCRIPTIONS));
      const candidates = workersFor(service, c.city);
      if (candidates.length === 0) continue;
      const worker = pick(candidates);
      const daysAgo = 3 + Math.floor(rand() * Math.min(tenure, 140));
      const cancelled = rand() < 0.1;
      const rating = cancelled ? null : drawRating(rand);
      const hasText = rating !== null && rand() < 0.75;
      plans.push({
        customerMockId: c.id,
        workerMockId: cancelled ? null : worker.mockId,
        serviceId: service,
        description: pick(JOB_DESCRIPTIONS[service]),
        daysAgo,
        hour: 8 + Math.floor(rand() * 10),
        minute: pick([0, 15, 30, 45]),
        hoursBilled: rand() < 0.55 ? 1 : rand() < 0.85 ? 2 : 3,
        urgency: rand() < 0.18 ? "URGENT" : "NORMAL",
        status: cancelled ? "CANCELLED" : "SETTLED",
        rating,
        review: hasText ? pick(REVIEW_TEXT[rating!]) : null,
        cancelReason: cancelled ? pick(CANCEL_REASONS) : undefined
      });
    }
  }

  // Live board: one booking in each stage the dispatch engine can be in, so
  // the worker and admin screens have something to act on.
  plans.push(
    {
      customerMockId: "cust-5", workerMockId: null, serviceId: "plumbing",
      description: "Overhead tank float valve keeps overflowing at night.",
      daysAgo: 0, hour: 9, minute: 20, hoursBilled: 1, urgency: "NORMAL",
      status: "REQUESTED", rating: null, review: null
    },
    {
      customerMockId: "cust-6", workerMockId: null, serviceId: "electrical",
      description: "Ceiling fan wiring short-circuit needs urgent diagnosis.",
      daysAgo: 0, hour: 10, minute: 5, hoursBilled: 1, urgency: "URGENT",
      status: "DISPATCHING_TOP3", rating: null, review: null,
      offeredToMockIds: ["worker-7"]
    },
    {
      customerMockId: "cust-3", workerMockId: null, serviceId: "plumbing",
      description: "Multiple bathroom taps need washer replacement across the flat.",
      daysAgo: 0, hour: 10, minute: 40, hoursBilled: 2, urgency: "NORMAL",
      status: "DISPATCHING_POOL", rating: null, review: null,
      offeredToMockIds: ["worker-1"], declinedByMockIds: ["worker-2"]
    },
    {
      customerMockId: "cust-8", workerMockId: "worker-13", serviceId: "painting",
      description: "Seepage patch on the hall ceiling needs putty and repaint.",
      daysAgo: 0, hour: 11, minute: 15, hoursBilled: 3, urgency: "NORMAL",
      status: "ASSIGNED", rating: null, review: null
    },
    {
      customerMockId: "cust-2", workerMockId: "worker-9", serviceId: "electrical",
      description: "MCB trips every time the air conditioner starts.",
      daysAgo: 0, hour: 12, minute: 0, hoursBilled: 2, urgency: "NORMAL",
      status: "CONFIRMED", rating: null, review: null
    },
    {
      customerMockId: "cust-7", workerMockId: "worker-12", serviceId: "caregiving",
      description: "Day attendant for a bedridden patient, three days a week.",
      daysAgo: 0, hour: 8, minute: 30, hoursBilled: 4, urgency: "NORMAL",
      status: "IN_PROGRESS", rating: null, review: null
    },
    {
      customerMockId: "cust-10", workerMockId: "worker-15", serviceId: "gardening",
      description: "Terrace garden needs pruning and a pest check on the curry leaf plants.",
      daysAgo: 1, hour: 7, minute: 45, hoursBilled: 2, urgency: "NORMAL",
      status: "COMPLETED", rating: null, review: null
    }
  );

  return plans.sort((a, b) => b.daysAgo - a.daysAgo);
}
