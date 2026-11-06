/**
 * Tools the LLM can call. Every "log_*" tool writes to Hindsight (retain);
 * the read tools use recall (specific history) or reflect (patterns / audit prep).
 */
import { normalizeOutlet, nowIST, OUTLETS } from "./config.js";
import type { ToolSpec } from "./llm.js";
import { memoryEnabled, recall, reflect, retain } from "./memory.js";

// ---------------------------------------------------------------------------
// Food-safety limits (FSSAI Schedule 4 style). Used to classify readings.
// ---------------------------------------------------------------------------
type Limit = { kind: "max" | "min"; value: number; label: string };

function limitFor(equipment: string): Limit {
  const e = equipment.toLowerCase();
  if (e.includes("freez")) return { kind: "max", value: -18, label: "≤ -18°C" };
  if (e.includes("hot") || e.includes("bain") || e.includes("holding cabinet")) return { kind: "min", value: 63, label: "≥ 63°C" };
  if (e.includes("cook") || e.includes("core")) return { kind: "min", value: 75, label: "≥ 75°C core" };
  // walk-in, reach-in, fridge, chiller, cold display, deliveries of chilled food
  return { kind: "max", value: 5, label: "≤ 5°C" };
}

function isBreach(reading: number, limit: Limit): boolean {
  return limit.kind === "max" ? reading > limit.value : reading < limit.value;
}

const outletEnum = { type: "string", enum: [...OUTLETS] };

function stamp(): string {
  return nowIST();
}

function requireOutlet(raw: unknown): string {
  const outlet = normalizeOutlet(String(raw ?? ""));
  if (!outlet) throw new Error(`Unknown outlet "${raw}". Use one of: ${OUTLETS.join(", ")}`);
  return outlet;
}

function bullets(lines: string[]): string {
  return lines.length ? lines.map((l) => `- ${l}`).join("\n") : "(no relevant memories)";
}

// ---------------------------------------------------------------------------
// Tool specs (JSON schema, OpenAI/Groq format)
// ---------------------------------------------------------------------------
export const toolSpecs: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "log_temperature_check",
      description: "Record a temperature reading for a fridge, freezer, hot-holding unit or cooked item. Only call this once you have outlet, equipment name, and the temperature reading. Returns whether it breaches the limit and relevant history if it does.",
      parameters: {
        type: "object",
        properties: {
          outlet: outletEnum,
          equipment: { type: "string", description: "e.g. 'walk-in fridge', 'reach-in fridge 2', 'freezer', 'bain-marie'" },
          reading_c: { type: "number", description: "Temperature in °C" },
          recorded_by: { type: "string" },
          shift: { type: "string", enum: ["morning", "day", "night"] },
        },
        required: ["outlet", "equipment", "reading_c"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_delivery",
      description: "Record an incoming delivery. Only call once you have outlet, supplier name, item, and whether it was accepted. Temperature and receiver are optional but very useful — ask for them if not provided.",
      parameters: {
        type: "object",
        properties: {
          outlet: outletEnum,
          supplier: { type: "string" },
          item: { type: "string" },
          temp_c: { type: "number", description: "Temperature on arrival in °C (omit for ambient dry goods)" },
          accepted: { type: "boolean" },
          received_by: { type: "string" },
          shift: { type: "string", enum: ["morning", "day", "night"] },
        },
        required: ["outlet", "supplier", "item", "accepted"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_corrective_action",
      description: "Record a corrective action taken (or planned) for a food-safety issue.",
      parameters: {
        type: "object",
        properties: {
          outlet: outletEnum,
          issue: { type: "string" },
          action: { type: "string" },
          owner: { type: "string" },
        },
        required: ["outlet", "issue", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_fix_outcome",
      description: "Record whether a previous corrective action actually worked. This is how the agent learns which fixes hold.",
      parameters: {
        type: "object",
        properties: {
          outlet: outletEnum,
          issue: { type: "string" },
          action: { type: "string", description: "The corrective action being evaluated" },
          worked: { type: "boolean" },
          evidence: { type: "string", description: "e.g. 'readings 3-4°C for 7 days'" },
        },
        required: ["outlet", "issue", "action", "worked"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_audit_result",
      description: "Record the result of an inspection or audit (FSSAI, client, internal) including findings.",
      parameters: {
        type: "object",
        properties: {
          outlet: outletEnum,
          auditor: { type: "string", description: "e.g. 'FSSAI', 'Northwind corporate catering', 'internal'" },
          date: { type: "string", description: "YYYY-MM-DD" },
          result: { type: "string", enum: ["pass", "pass with findings", "fail"] },
          findings: { type: "string" },
        },
        required: ["outlet", "auditor", "result", "findings"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_outlet_history",
      description: "Look up what is remembered about an outlet, optionally on a topic (equipment, supplier, staff, past audits).",
      parameters: {
        type: "object",
        properties: {
          outlet: outletEnum,
          topic: { type: "string" },
        },
        required: ["outlet"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_audit",
      description: "Prepare an outlet for an upcoming audit: ranked risks based on THIS outlet's history, open issues, evidence to have ready.",
      parameters: {
        type: "object",
        properties: {
          outlet: outletEnum,
          audit_date: { type: "string" },
          auditor: { type: "string" },
        },
        required: ["outlet"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "risk_briefing",
      description: "Weekly risk briefing across all outlets (or one): recurring problems, suppliers, shifts, fixes that did/didn't work, and recommendations.",
      parameters: {
        type: "object",
        properties: {
          outlet: { type: "string", description: "Optional — omit for the whole group" },
        },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
type Handler = (args: Record<string, unknown>) => Promise<string>;

const handlers: Record<string, Handler> = {
  async log_temperature_check(a) {
    const outlet = requireOutlet(a.outlet);
    const equipment = String(a.equipment);
    const reading = Number(a.reading_c);
    const limit = limitFor(equipment);
    const breach = isBreach(reading, limit);
    const who = a.recorded_by ? ` by ${a.recorded_by}` : "";
    const shift = a.shift ? ` (${a.shift} shift)` : "";

    await retain({
      context: "temperature-check",
      content: `[${stamp()}] ${outlet}: ${equipment} read ${reading}°C${who}${shift}. Limit ${limit.label}. ${breach ? "BREACH." : "Within limit."}`,
      metadata: { outlet, equipment, breach: String(breach) },
    });

    if (!breach) return `✅ Logged — ${reading}°C is within the safe limit (${limit.label}) for ${equipment} at ${outlet}.`;

    const history = await recall(`${outlet} ${equipment} temperature breaches, causes, corrective actions and whether they worked`);
    return [
      `⚠️ Logged — BREACH: ${equipment} at ${outlet} read ${reading}°C (limit is ${limit.label}).`,
      memoryEnabled() ? `History for ${outlet} ${equipment}:\n${bullets(history)}` : "No history available (memory is off).",
    ].join("\n");
  },

  async log_delivery(a) {
    const outlet = requireOutlet(a.outlet);
    const temp = a.temp_c === undefined ? undefined : Number(a.temp_c);
    const warm = temp !== undefined && temp > 5;
    const accepted = Boolean(a.accepted);
    const who = a.received_by ? `received by ${a.received_by}` : "receiver not recorded";
    const shift = a.shift ? ` on ${a.shift} shift` : "";

    await retain({
      context: "delivery",
      content: `[${stamp()}] ${outlet}: delivery from ${a.supplier} — ${a.item}${temp !== undefined ? ` at ${temp}°C` : ""}, ${accepted ? "ACCEPTED" : "REJECTED"}, ${who}${shift}.${warm ? ` Above 5°C chilled limit${accepted ? " but accepted anyway" : ""}.` : ""}`,
      metadata: { outlet, supplier: String(a.supplier), warm: String(warm), accepted: String(accepted) },
    });

    if (!warm) return `✅ Delivery logged — ${a.item} from ${a.supplier} accepted at ${outlet}${temp !== undefined ? ` (${temp}°C, within limit)` : ""}.`;
    const history = await recall(`deliveries from ${a.supplier} above temperature limit across all outlets, who received them, which shift`);
    return [
      `⚠️ Logged — WARNING: ${a.supplier} ${a.item} arrived at ${temp}°C (limit is ≤5°C for chilled goods)${accepted ? " and was accepted anyway" : ""}.`,
      memoryEnabled() ? `Supplier history:\n${bullets(history)}` : "No supplier history available (memory is off).",
    ].join("\n");
  },

  async log_corrective_action(a) {
    const outlet = requireOutlet(a.outlet);
    await retain({
      context: "corrective-action",
      content: `[${stamp()}] ${outlet}: CORRECTIVE ACTION for "${a.issue}": ${a.action}${a.owner ? ` (owner: ${a.owner})` : ""}. Outcome not yet known.`,
      metadata: { outlet },
    });
    return `✅ Corrective action logged for "${a.issue}" at ${outlet}. I'll remind the team to report back once you know if it worked.`;
  },

  async record_fix_outcome(a) {
    const outlet = requireOutlet(a.outlet);
    const worked = Boolean(a.worked);
    await retain({
      context: "fix-outcome",
      content: `[${stamp()}] ${outlet}: OUTCOME — the fix "${a.action}" for "${a.issue}" ${worked ? "WORKED" : "DID NOT WORK"}.${a.evidence ? ` Evidence: ${a.evidence}.` : ""}`,
      metadata: { outlet, worked: String(worked) },
    });
    return `✅ Outcome recorded — the fix "${a.action}" for "${a.issue}" at ${outlet} ${worked ? "**worked** ✓" : "**did not work** ✗"}. I'll factor this into future advice.`;
  },

  async log_audit_result(a) {
    const outlet = requireOutlet(a.outlet);
    const date = a.date ? String(a.date) : stamp().slice(0, 10);
    await retain({
      context: "audit",
      timestamp: a.date ? new Date(String(a.date)) : undefined,
      content: `${date} ${outlet}: AUDIT by ${a.auditor} — result: ${a.result}. Findings: ${a.findings}`,
      metadata: { outlet, auditor: String(a.auditor), result: String(a.result) },
    });
    return `✅ Audit result logged — ${outlet}, ${date}, ${a.auditor}: ${a.result}.`;
  },

  async get_outlet_history(a) {
    const outlet = requireOutlet(a.outlet);
    if (!memoryEnabled()) return "Memory is currently off — no history available. Turn memory on to access outlet records.";
    const memories = await recall(`${outlet} ${a.topic ?? "recent food safety issues, audits and corrective actions"}`, { budget: "high" });
    return bullets(memories);
  },

  async prepare_audit(a) {
    const outlet = requireOutlet(a.outlet);
    const when = a.audit_date ? ` on ${a.audit_date}` : "";
    const who = a.auditor ? ` by ${a.auditor}` : "";
    const answer = await reflect(
      `${outlet} has an upcoming audit${who}${when}. Using everything known about ${outlet} (and group-wide issues such as suppliers, policy changes, or cross-outlet patterns), prepare a structured audit-readiness briefing:
1. Prior audit findings: severity, status, and recurrence.
2. Remediation status: clearly distinguish actions completed from actions verified as effective with evidence.
3. Evidence gaps: highlight missing, incomplete, or unverified records.
4. Ranked risks & prioritized next actions: cite specific record IDs and dates.
State that standards are internal company policies, not statutory laws.`,
      { context: "audit preparation", budget: "high" },
    );
    return answer ?? "No outlet history available (memory is turned off). Give a generic internal audit checklist.";
  },

  async risk_briefing(a) {
    const scope = normalizeOutlet(String(a.outlet ?? "")) ?? "all three outlets";
    const answer = await reflect(
      `Weekly risk briefing for ${scope}. Identify recurring problems and their likely root causes, patterns that span outlets (suppliers, shifts, staff, times of day), corrective actions that did and did not work, gaps in logs, and the 3 most important recommendations. Be specific with counts and dates.`,
      { context: "weekly risk briefing", budget: "high" },
    );
    return answer ?? "No history available (memory is turned off). Give generic food-safety advice.";
  },
};

export async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  const handler = handlers[name];
  if (!handler) return `Error: unknown tool "${name}".`;
  try {
    return await handler(args);
  } catch (err) {
    // Return errors to the model instead of crashing, so it can correct itself.
    return `Error running ${name}: ${(err as Error).message}`;
  }
}
