/**
 * Memory layer — every read and write to Hindsight goes through this file.
 *
 * Hindsight gives us three operations:
 *   retain  — store an event (a check, a delivery, a fix, an outcome, a conversation)
 *   recall  — fetch the memories relevant to a question (semantic + keyword + graph + temporal)
 *   reflect — let Hindsight reason over everything it holds and answer / find patterns
 *
 * We use ONE bank for the whole restaurant group (not one per outlet), so reflect can
 * connect dots across outlets — e.g. the same supplier causing breaches at three sites.
 */
import { HindsightClient } from "@vectorize-io/hindsight-client";
import { config } from "./config.js";

const client = new HindsightClient({
  baseUrl: config.hindsight.baseUrl,
  ...(config.hindsight.apiKey ? { apiKey: config.hindsight.apiKey } : {}),
});

const bankId = config.hindsight.bankId;

const BANK_MISSION = `You are the long-term compliance memory for Spice Route Kitchens, a group of three
restaurants in Bengaluru (Indiranagar, Koramangala, HSR Layout) audited under FSSAI rules and by
corporate catering clients. Track every temperature check, delivery, cleaning and pest-control log,
audit finding, corrective action and — most importantly — whether each corrective action actually
worked. Pay attention to recurring failures, which suppliers, shifts and staff are involved, and
which fixes held. Prefer what actually worked at these outlets over generic best practice.`;

// ---------------------------------------------------------------------------
// Tracing — prints memory calls to the console so the demo can show them live.
// ---------------------------------------------------------------------------
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const magenta = (s: string) => `\x1b[35m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

function trace(kind: "RETAIN" | "RECALL" | "REFLECT", detail: string) {
  if (!config.memoryTrace) return;
  const color = kind === "RETAIN" ? cyan : kind === "RECALL" ? magenta : yellow;
  console.log(`${color(`[hindsight:${kind}]`)} ${dim(detail.replace(/\s+/g, " ").slice(0, 220))}`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function memoryEnabled(): boolean {
  return config.memoryEnabled;
}

/** Create the bank with our mission + disposition. Safe to call when it already exists. */
export async function ensureBank(): Promise<void> {
  if (!config.memoryEnabled) return;
  try {
    await client.createBank(bankId, {
      name: "Spice Route Kitchens — Compliance",
      mission: BANK_MISSION,
      disposition: {
        skepticism: 4, // flag contradictions (e.g. "fixed" but readings still high)
        literalism: 3,
        empathy: 2, // this is an auditor, not a therapist
      },
    });
  } catch (err) {
    // Most commonly: the bank already exists. That's fine.
    if (config.memoryTrace) console.log(dim(`[hindsight] createBank skipped: ${(err as Error).message}`));
  }
}

export interface RetainInput {
  content: string;
  /** When the event happened (not when we stored it). Enables "what happened in week 2?" recall. */
  timestamp?: Date;
  /** Short label for what kind of record this is: daily-log, delivery, audit, corrective-action, ... */
  context: string;
  metadata?: Record<string, string>;
  /** Fire-and-forget (used by the bulk seeder). */
  background?: boolean;
}

export async function retain(input: RetainInput): Promise<void> {
  if (!config.memoryEnabled) return;
  trace("RETAIN", `(${input.context}) ${input.content}`);
  await client.retain(bankId, input.content, {
    timestamp: input.timestamp ?? new Date(),
    context: input.context,
    metadata: input.metadata,
    async: input.background ?? false,
  });
}

/** Returns the recalled memory texts (empty when memory is off). */
export async function recall(query: string, opts: { budget?: "low" | "mid" | "high"; maxTokens?: number } = {}): Promise<string[]> {
  if (!config.memoryEnabled) return [];
  trace("RECALL", query);
  const response = await client.recall(bankId, query, {
    budget: opts.budget ?? "mid",
    maxTokens: opts.maxTokens ?? 1024,
  });
  const texts = (response.results ?? []).map((r) => r.text).filter(Boolean);
  trace("RECALL", `→ ${texts.length} memories`);
  return texts;
}

/** Ask Hindsight to reason over the whole bank. Returns undefined when memory is off. */
export async function reflect(query: string, opts: { context?: string; budget?: "low" | "mid" | "high" } = {}): Promise<string | undefined> {
  if (!config.memoryEnabled) return undefined;
  trace("REFLECT", query);
  const answer = await client.reflect(bankId, query, {
    budget: opts.budget ?? "mid",
    ...(opts.context ? { context: opts.context } : {}),
  });
  return answer.text;
}
