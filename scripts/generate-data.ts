/**
 * Generates 6 weeks of realistic compliance records for Spice Route Kitchens with
 * patterns PLANTED in them, so the demo can show the agent discovering them:
 *
 *   1. Koramangala walk-in fridge breaches every other morning in weeks 1–3.
 *      Thermometer replacement (week 2) does NOT fix it. Moving marination out of the
 *      walk-in (week 3) DOES — no breaches afterwards.
 *   2. FreshCo Poultry switched to a late-night delivery slot. 5 warm deliveries across
 *      all 3 outlets; 4 accepted by night-shift receivers, 1 rejected by day shift.
 *   3. Koramangala pest-control log has a 6-day gap in week 4 — and the March client
 *      audit already flagged pest logs there.
 *   4. Some harmless noise (one-off issues that were resolved) so it isn't too easy.
 *
 * Deterministic: the same output every run. Writes data/seed/events.json.
 *   npm run generate
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Outlet = "Indiranagar" | "Koramangala" | "HSR Layout";

export interface SeedEvent {
  date: string; // ISO timestamp of when it happened
  outlet: Outlet | "Group";
  context: string; // daily-log | delivery | corrective-action | fix-outcome | audit | note
  content: string;
}

// --- deterministic PRNG -----------------------------------------------------
let seed = 20260921;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const between = (min: number, max: number, dp = 1) => Number((min + rand() * (max - min)).toFixed(dp));
const chance = (p: number) => rand() < p;

// --- people -----------------------------------------------------------------
const staff: Record<Outlet, { manager: string; morning: string; day: string; night: string }> = {
  Indiranagar: { manager: "Priya Nair", morning: "Suresh Gowda", day: "Anita D'Souza", night: "Manjunath K" },
  Koramangala: { manager: "Arjun Menon", morning: "Ravi Kumar", day: "Fatima Sheikh", night: "Imran Pasha" },
  "HSR Layout": { manager: "Kavya Reddy", morning: "Naveen Rao", day: "Lakshmi Iyer", night: "Deepak Shetty" },
};
const OUTLETS = Object.keys(staff) as Outlet[];

// --- calendar ---------------------------------------------------------------
const START = new Date("2026-09-21T00:00:00+05:30"); // Monday
const DAYS = 42;

function dayStr(d: Date): string {
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}
function at(date: string, hhmm: string): string {
  return new Date(`${date}T${hhmm}:00+05:30`).toISOString();
}
function weekday(date: string): string {
  return new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" });
}

// --- planted pattern 1: Koramangala walk-in -----------------------------------
const KOR_WALKIN_BREACH_DAYS = new Set([
  "2026-09-22", "2026-09-24", "2026-09-26", "2026-09-29", "2026-10-01", "2026-10-03", "2026-10-06", "2026-10-08",
]);
const KOR_FIX_DATE = "2026-10-09"; // marination moved out of walk-in

// --- planted pattern 2: FreshCo late-night warm deliveries ---------------------
const FRESHCO_WARM: { date: string; outlet: Outlet; temp: number; accepted: boolean; shift: "night" | "day"; time: string }[] = [
  { date: "2026-09-25", outlet: "Indiranagar", temp: 8.1, accepted: true, shift: "night", time: "23:10" },
  { date: "2026-10-02", outlet: "Koramangala", temp: 7.4, accepted: true, shift: "night", time: "23:40" },
  { date: "2026-10-09", outlet: "HSR Layout", temp: 6.9, accepted: false, shift: "day", time: "11:20" },
  { date: "2026-10-16", outlet: "Indiranagar", temp: 7.8, accepted: true, shift: "night", time: "22:55" },
  { date: "2026-10-23", outlet: "HSR Layout", temp: 8.4, accepted: true, shift: "night", time: "23:25" },
];

// --- planted pattern 3: Koramangala pest-log gap -------------------------------
const KOR_PEST_GAP = new Set(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"]);

const events: SeedEvent[] = [];

// --- history before the 6 weeks: past audits ---------------------------------
events.push(
  {
    date: at("2026-03-14", "11:00"),
    outlet: "Koramangala",
    context: "audit",
    content:
      "2026-03-14 Koramangala: AUDIT by Northwind Corporate Catering (client audit) — result: pass with findings. Findings: (1) MINOR — pest control log incomplete, 4 days missing in February; (2) OBSERVATION — walk-in fridge read 5.8°C during the audit at 10:40am. Auditor said pest-log completeness will be checked again next visit.",
  },
  {
    date: at("2026-03-20", "15:00"),
    outlet: "Indiranagar",
    context: "audit",
    content: "2026-03-20 Indiranagar: AUDIT by FSSAI food safety officer — result: pass. No findings. Officer praised the receiving temperature log.",
  },
  {
    date: at("2026-04-02", "12:00"),
    outlet: "HSR Layout",
    context: "audit",
    content: "2026-04-02 HSR Layout: AUDIT by FSSAI food safety officer — result: pass with findings. Findings: MINOR — soap missing at the kitchen handwash station. Fixed same day; soap refill added to opening checklist.",
  },
);

// --- the 6 weeks ---------------------------------------------------------------
for (let i = 0; i < DAYS; i++) {
  const date = dayStr(new Date(START.getTime() + i * 86_400_000));

  for (const outlet of OUTLETS) {
    const s = staff[outlet];
    const parts: string[] = [];

    // Walk-in fridge (3 readings)
    let morning = between(2.6, 4.4);
    let morningNote = "";
    if (outlet === "Koramangala" && KOR_WALKIN_BREACH_DAYS.has(date)) {
      morning = between(6.4, 7.6);
      morningNote = ` — BREACH (limit ≤5°C), logged by ${s.morning}, morning shift, during prep`;
    }
    parts.push(
      `Walk-in fridge: 06:30 ${morning}°C${morningNote}; 14:00 ${between(2.8, 4.3)}°C; 21:30 ${between(2.5, 4.0)}°C.`,
    );

    // Reach-in, freezer, hot-holding
    parts.push(`Reach-in fridge: ${between(2.4, 4.2)}°C.`);
    let freezer = between(-21, -18.5);
    if (outlet === "HSR Layout" && date === "2026-10-05") freezer = -15.8;
    parts.push(
      `Freezer: ${freezer}°C${freezer > -18 ? " — BREACH (limit ≤ -18°C) after defrost cycle; rechecked at -19.2°C one hour later, stock not affected" : ""}.`,
    );
    let hot = between(64, 71);
    if (outlet === "Indiranagar" && date === "2026-10-20") hot = 61;
    parts.push(
      `Bain-marie hot holding: ${hot}°C${hot < 63 ? " — BREACH (limit ≥63°C); gravy reheated to 75°C and element setting corrected, rechecked 68°C" : ""}.`,
    );

    // Cleaning + pest
    parts.push("Cleaning schedule: completed and signed.");
    if (outlet === "Koramangala" && KOR_PEST_GAP.has(date)) {
      parts.push("Pest control check: NOT RECORDED (log left blank).");
    } else {
      parts.push("Pest control check: done, no activity.");
    }

    // Routine day-shift deliveries
    const routine: string[] = [];
    if (i % 2 === 0) routine.push(`Nandini Dairy milk & paneer at ${between(2.5, 4.5)}°C accepted by ${s.day}`);
    if (i % 3 === 0) routine.push(`Hopcoms vegetables accepted by ${s.day}`);
    if (i % 7 === 2) routine.push(`Sri Lakshmi Traders dry goods (rice, atta, spices) accepted by ${s.day}`);
    const freshcoWarm = FRESHCO_WARM.find((f) => f.date === date && f.outlet === outlet);
    if (!freshcoWarm && i % 3 === 1) {
      // Normal FreshCo deliveries: before the route change they're on day shift; after, at night but cold.
      const night = date >= "2026-09-23";
      routine.push(
        `FreshCo Poultry chicken at ${between(2.4, 4.6)}°C accepted by ${night ? s.night : s.day} (${night ? "night" : "day"} shift)`,
      );
    }
    if (routine.length) parts.push(`Deliveries: ${routine.join("; ")}.`);

    events.push({
      date: at(date, "22:00"),
      outlet,
      context: "daily-log",
      content: `${date} (${weekday(date)}) ${outlet} daily food-safety log, signed by ${s.manager}. ${parts.join(" ")}`,
    });

    // Planted warm FreshCo delivery as its own salient record
    if (freshcoWarm) {
      const receiver = freshcoWarm.shift === "night" ? s.night : s.day;
      events.push({
        date: at(date, freshcoWarm.time),
        outlet,
        context: "delivery",
        content: freshcoWarm.accepted
          ? `${date} ${freshcoWarm.time} ${outlet}: FreshCo Poultry chicken delivery arrived at ${freshcoWarm.temp}°C (limit ≤5°C) and was ACCEPTED by ${receiver} on the night shift. Note on the receiving log: "driver in a hurry, put straight into walk-in."`
          : `${date} ${freshcoWarm.time} ${outlet}: FreshCo Poultry chicken delivery arrived at ${freshcoWarm.temp}°C (limit ≤5°C) and was REJECTED by ${receiver} on the day shift. Supplier sent a replacement that evening at 3.6°C.`,
      });
    }
  }
}

// --- notes, corrective actions and outcomes -------------------------------------
events.push(
  {
    date: at("2026-09-23", "10:00"),
    outlet: "Indiranagar",
    context: "note",
    content: "2026-09-23 Indiranagar: Priya Nair noted that FreshCo Poultry has moved all three outlets to a late-night delivery slot (after 10pm) because of a new delivery route. Night shift now receives chicken.",
  },
  {
    date: at("2026-09-27", "12:00"),
    outlet: "Koramangala",
    context: "corrective-action",
    content: "2026-09-27 Koramangala: CORRECTIVE ACTION for repeated morning walk-in fridge breaches: replaced the walk-in fridge thermometer, suspecting a faulty probe. Owner: Arjun Menon. Outcome not yet known.",
  },
  {
    date: at("2026-10-04", "18:00"),
    outlet: "Koramangala",
    context: "fix-outcome",
    content: "2026-10-04 Koramangala: OUTCOME — replacing the walk-in fridge thermometer DID NOT WORK. Morning readings still 6.5–7.5°C on 29 Sep, 1 Oct and 3 Oct with the new thermometer. Afternoon and night readings normal, so the problem is specific to mornings.",
  },
  {
    date: at("2026-10-08", "16:00"),
    outlet: "Koramangala",
    context: "note",
    content: "2026-10-08 Koramangala: Arjun Menon observed that the morning prep team (Ravi Kumar) loads trays of freshly marinated chicken into the walk-in around 6am and the door stays open for long stretches during prep.",
  },
  {
    date: at("2026-10-09", "09:00"),
    outlet: "Koramangala",
    context: "corrective-action",
    content: `${KOR_FIX_DATE} Koramangala: CORRECTIVE ACTION for morning walk-in breaches: marination moved to the separate reach-in fridge 2, and walk-in door opening limited during prep. Owner: Arjun Menon. Outcome not yet known.`,
  },
  {
    date: at("2026-10-17", "18:00"),
    outlet: "Koramangala",
    context: "fix-outcome",
    content: "2026-10-17 Koramangala: OUTCOME — moving marination out of the walk-in WORKED. Walk-in morning readings 3–4°C every day from 10 Oct to 17 Oct.",
  },
  {
    date: at("2026-10-19", "10:00"),
    outlet: "Koramangala",
    context: "note",
    content: "2026-10-19 Koramangala: pest control contractor (PestGuard) confirmed they visited on 14 Oct, but the outlet's own daily pest check log is blank from 12 to 17 Oct — staff on leave during Ayudha Puja week, nobody covered the check.",
  },
  {
    date: at("2026-10-30", "11:00"),
    outlet: "Group",
    context: "note",
    content: "2026-10-30 Group: Meera Rao (Head of Compliance) noted that Northwind Corporate Catering will do a surprise-style audit at Koramangala on Friday 13 November 2026.",
  },
);

events.sort((a, b) => a.date.localeCompare(b.date));

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "data", "seed", "events.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(events, null, 2) + "\n");
console.log(`Wrote ${events.length} events to ${out}`);
