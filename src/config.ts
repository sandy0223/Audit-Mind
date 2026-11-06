import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export const config = {
  hindsight: {
    baseUrl: process.env.HINDSIGHT_BASE_URL ?? "https://api.hindsight.vectorize.io",
    apiKey: process.env.HINDSIGHT_API_KEY,
    bankId: process.env.HINDSIGHT_BANK_ID ?? "spice-route-compliance",
  },
  groq: {
    get apiKey() {
      return required("GROQ_API_KEY");
    },
    model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
  },
  memoryEnabled: (process.env.MEMORY_ENABLED ?? "true").toLowerCase() !== "false",
  memoryTrace: (process.env.MEMORY_TRACE ?? "false").toLowerCase() !== "false",
};

/** "YYYY-MM-DD HH:MM" in India time — the outlets are in Bengaluru. */
export function nowIST(date: Date = new Date()): string {
  return new Date(date.getTime() + 5.5 * 3600_000).toISOString().slice(0, 16).replace("T", " ") + " IST";
}

/** The restaurant group in our scenario. Kept in one place so prompts, tools and data agree. */
export const OUTLETS = ["Indiranagar", "Koramangala", "HSR Layout"] as const;
export type Outlet = (typeof OUTLETS)[number];

/** Normalize free-text outlet names to canonical values, tolerant of common abbreviations and typos. */
export function normalizeOutlet(input: string | undefined): Outlet | undefined {
  if (!input) return undefined;
  const s = input.toLowerCase().trim();
  if (!s) return undefined;
  // Exact canonical match first
  for (const o of OUTLETS) {
    if (s === o.toLowerCase()) return o;
  }
  // Substring / abbreviation matching (order matters — check more specific before generic)
  if (s.includes("indira") || s.includes("indiranag")) return "Indiranagar";
  if (s.includes("koram") || s === "kora") return "Koramangala";
  if (s.includes("hsr") || s.includes("hsr layout") || s.includes("hsr l")) return "HSR Layout";
  // Fallback: partial match against each outlet's words
  for (const o of OUTLETS) {
    if (o.toLowerCase().split(" ").some((word) => s.includes(word) && word.length > 3)) return o;
  }
  return undefined;
}
