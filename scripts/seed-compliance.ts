/**
 * Seeds the compliance_dataset.json into Hindsight with rich, human-readable memory records.
 *
 * Unlike the basic seed.ts (which loads flat daily-log events), this loader understands the
 * structured dataset format: sources, requirements, controls, and typed records (audit, finding,
 * remediation, verification, policy_change, evidence, note, control_test).
 *
 * Each record is converted into a focused natural-language memory so the agent can retrieve
 * and reason over it via recall() and reflect().
 *
 *   npm run seed:compliance               # seed everything
 *   npm run seed:compliance -- --dry-run  # preview without writing
 *   npm run seed:compliance -- --type finding  # seed only one record type
 *
 * Use a fresh HINDSIGHT_BANK_ID each run to avoid duplicate records.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureBank, retain } from "../src/memory.js";

// ---------------------------------------------------------------------------
// Dataset types (matches compliance_dataset.json shape)
// ---------------------------------------------------------------------------
interface Source {
  id: string;
  name: string;
  type: string;
  version: string;
  effective_from: string;
  effective_to: string | null;
  supersedes?: string;
  description: string;
}

interface Requirement {
  id: string;
  title: string;
  summary: string;
  source_id: string;
  effective_from: string;
  effective_to: string | null;
  superseded_by?: string;
  supersedes?: string;
}

interface Control {
  id: string;
  name: string;
  purpose: string;
  requirement_ids: string[];
  frequency: string;
  responsible_role: string;
  acceptable_evidence: string[];
  threshold?: { minimum_celsius?: number; maximum_celsius?: number; synthetic: boolean };
}

interface DataRecord {
  id: string;
  type: string;
  occurred_at: string;
  site_id: string | null;
  related_ids: string[];
  source_id: string | null;
  facts: Record<string, unknown>;
  confidence: "documented" | "uncertain";
}

interface Dataset {
  dataset_metadata: {
    organization: string;
    date_range: { start: string; end: string };
    limitations: string[];
  };
  sources: Source[];
  sites: { id: string; name: string; location: string }[];
  requirements: Requirement[];
  controls: Control[];
  records: DataRecord[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const typeFilter = (() => {
  const idx = args.indexOf("--type");
  return idx >= 0 ? args[idx + 1] : undefined;
})();
const CONCURRENCY = 3;

function fmt(val: unknown): string {
  if (val === null || val === undefined) return "not recorded";
  if (typeof val === "boolean") return val ? "yes" : "no";
  if (Array.isArray(val)) return val.map(fmt).join(", ");
  return String(val);
}

async function runPool<T>(items: T[], worker: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await worker(items[i], i);
      }
    }),
  );
}

// ---------------------------------------------------------------------------
// Record → human-readable content converters
// ---------------------------------------------------------------------------
function siteLabel(siteId: string | null, sites: Dataset["sites"]): string {
  if (!siteId) return "all sites";
  return sites.find((s) => s.id === siteId)?.name ?? siteId;
}

function buildContent(rec: DataRecord, ds: Dataset): string {
  const site = siteLabel(rec.site_id, ds.sites);
  const f = rec.facts;
  const ts = rec.occurred_at.slice(0, 10);
  const confidence = rec.confidence === "uncertain" ? " [CONFIDENCE: uncertain — treat as unverified claim]" : "";
  const related = rec.related_ids.length ? ` Related: ${rec.related_ids.join(", ")}.` : "";

  switch (rec.type) {
    case "control_test": {
      const temp = f.temperature_celsius !== undefined ? ` Temperature: ${f.temperature_celsius}°C.` : "";
      const result = String(f.result ?? "unknown").toUpperCase();
      const test = f.test ? ` Test: ${f.test}.` : "";
      const resp = f.immediate_response ? ` Immediate response: ${f.immediate_response}` : "";
      const lim = f.limitation ? ` Limitation: ${f.limitation}` : "";
      const ref = f.evidence_reference ? ` Evidence ref: ${f.evidence_reference}.` : "";
      return `[${ts}] CONTROL TEST — ${site}.${test}${temp} Result: ${result}.${resp}${lim}${ref}${confidence}${related}`;
    }

    case "audit": {
      const findings = f.finding_ids ? ` Findings raised: ${fmt(f.finding_ids)}.` : " No findings raised.";
      const prev = f.previous_findings_reviewed ? ` Previous findings reviewed: ${fmt(f.previous_findings_reviewed)}.` : "";
      return `[${ts}] AUDIT — ${site}. Reference: ${fmt(f.audit_reference)}. Type: ${fmt(f.audit_type)}. Auditor: ${fmt(f.auditor)}. Result: ${fmt(f.result)}.${findings}${prev}${related}`;
    }

    case "finding": {
      const repeat = f.repeat_finding
        ? ` REPEAT FINDING — recurs from ${f.recurs_from ?? "prior finding"}.`
        : " First occurrence.";
      const evidence = f.evidence ? ` Evidence records: ${fmt(f.evidence)}.` : "";
      const note = f.note ? ` Note: ${f.note}` : "";
      return `[${ts}] FINDING ${f.finding_id} (${fmt(f.severity).toUpperCase()}) — ${site}. Status: ${fmt(f.status)}.${repeat} Description: ${f.description}${evidence}${note}${related}`;
    }

    case "remediation": {
      const due = f.due_date ? ` Due: ${f.due_date}.` : "";
      const completed = f.completion_date ? ` Completed: ${f.completion_date}.` : " Completion date: not recorded.";
      const verif = f.verification_status ? ` Verification: ${f.verification_status}.` : "";
      const evidence = f.completion_evidence ? ` Completion evidence: ${f.completion_evidence}.` : "";
      return `[${ts}] CORRECTIVE ACTION — ${site}. For: ${fmt(rec.related_ids.filter((id) => id.startsWith("FND")))}. Action: ${f.action} Owner role: ${fmt(f.owner_role)}.${due}${completed} Status: ${fmt(f.status)}.${evidence}${verif}${related}`;
    }

    case "verification": {
      const result = String(f.result ?? "unknown").toUpperCase();
      const ref = f.evidence_reference ? ` Evidence ref: ${f.evidence_reference}.` : "";
      const lim = f.limitation ? ` Limitation: ${f.limitation}` : "";
      const records = f.records_reviewed !== undefined ? ` Records reviewed: ${f.records_reviewed}.` : "";
      const temp = f.temperature_celsius !== undefined ? ` Verification temperature: ${f.temperature_celsius}°C.` : "";
      return `[${ts}] VERIFICATION — ${site}. Method: ${fmt(f.verification_method)}.${temp}${records} Result: ${result}. Finding status after verification: ${fmt(f.finding_status)}.${ref}${lim}${confidence}${related}`;
    }

    case "policy_change": {
      const changes = Array.isArray(f.changes)
        ? (f.changes as Array<{ old_requirement: string | null; new_requirement: string; description: string }>)
            .map((c) => `${c.old_requirement ?? "new"} → ${c.new_requirement}: ${c.description}`)
            .join("; ")
        : "";
      return `[${ts}] POLICY CHANGE — Reference: ${fmt(f.change_reference)}. Announced: ${fmt(f.announcement_date)}. Effective: ${fmt(f.effective_date)}. Changes: ${changes}. Affected sites: ${fmt(f.affected_sites)}.${related}`;
    }

    case "evidence": {
      const result = f.result ? ` Result: ${fmt(f.result).toUpperCase()}.` : "";
      const lim = f.limitation ? ` Limitation: ${f.limitation}` : "";
      const gap = f.evidence_gap_type ? ` Evidence gap type: ${f.evidence_gap_type}.` : "";
      const desc = f.description ? ` ${f.description}` : "";
      const ref = f.evidence_reference ? ` Evidence ref: ${f.evidence_reference}.` : "";
      return `[${ts}] EVIDENCE — ${site}.${desc}${result}${gap}${lim}${ref}${confidence}${related}`;
    }

    case "note": {
      return `[${ts}] NOTE — ${site}. ${f.note}${confidence}${related}`;
    }

    default:
      return `[${ts}] RECORD (${rec.type}) — ${site}. ${JSON.stringify(f)}${confidence}${related}`;
  }
}

// ---------------------------------------------------------------------------
// Policy / framework knowledge loaders
// ---------------------------------------------------------------------------
function sourcesToMemories(sources: Source[]): { content: string; date: Date }[] {
  return sources.map((s) => ({
    content: `POLICY SOURCE ${s.id}: "${s.name}" (v${s.version}). Type: ${s.type}. Effective from ${s.effective_from}${s.effective_to ? ` to ${s.effective_to}` : " (ongoing)"}. ${s.supersedes ? `Supersedes: ${s.supersedes}. ` : ""}${s.description}`,
    date: new Date(s.effective_from),
  }));
}

function requirementsToMemories(reqs: Requirement[]): { content: string; date: Date }[] {
  return reqs.map((r) => ({
    content: `REQUIREMENT ${r.id}: "${r.title}". Effective ${r.effective_from}${r.effective_to ? ` to ${r.effective_to}` : " (ongoing)"}. ${r.superseded_by ? `Superseded by ${r.superseded_by} from ${r.effective_to ?? "?"}. ` : ""}${r.supersedes ? `Supersedes ${r.supersedes}. ` : ""}Summary: ${r.summary} Source: ${r.source_id}.`,
    date: new Date(r.effective_from),
  }));
}

function controlsToMemories(controls: Control[]): { content: string; date: Date }[] {
  return controls.map((c) => ({
    content: `CONTROL ${c.id}: "${c.name}". Purpose: ${c.purpose} Frequency: ${c.frequency}. Responsible: ${c.responsible_role}. Requirements covered: ${c.requirement_ids.join(", ")}. Acceptable evidence: ${c.acceptable_evidence.join(", ")}.${c.threshold ? ` Temperature threshold: ${c.threshold.minimum_celsius ?? 0}°C–${c.threshold.maximum_celsius ?? "?"}°C (illustrative internal standard).` : ""}`,
    date: new Date("2025-11-01"),
  }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const ds: Dataset = JSON.parse(
    readFileSync(join(root, "data", "seed", "compliance_dataset.json"), "utf8"),
  );

  const records = typeFilter ? ds.records.filter((r) => r.type === typeFilter) : ds.records;

  const policyMemories = [
    ...sourcesToMemories(ds.sources),
    ...requirementsToMemories(ds.requirements),
    ...controlsToMemories(ds.controls),
  ];

  console.log(`\nCompliance dataset: ${ds.dataset_metadata.organization}`);
  console.log(`Period: ${ds.dataset_metadata.date_range.start} → ${ds.dataset_metadata.date_range.end}`);
  console.log(`Policy memories: ${policyMemories.length} | Records to seed: ${records.length}${typeFilter ? ` (filtered: ${typeFilter})` : ""}`);
  if (dryRun) console.log("\n[DRY RUN — no data will be written]\n");

  if (dryRun) {
    for (const m of policyMemories) console.log(`[policy] ${m.content.slice(0, 120)}…`);
    for (const r of records) {
      const content = buildContent(r, ds);
      console.log(`[${r.type}] ${content.slice(0, 140)}…`);
    }
    return;
  }

  await ensureBank();

  // 1. Seed policy framework (sources, requirements, controls)
  console.log("\nSeeding policy framework…");
  for (const m of policyMemories) {
    await retain({
      context: "compliance-policy",
      content: m.content,
      timestamp: m.date,
      metadata: { source: "compliance_dataset", synthetic: "true" },
    });
  }
  console.log(`  ${policyMemories.length} policy memories written.`);

  // 2. Seed operational records in chronological order
  const sorted = [...records].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  let done = 0;

  console.log("\nSeeding operational records…");
  await runPool(sorted, async (rec) => {
    const content = buildContent(rec, ds);
    await retain({
      context: rec.type,
      content,
      timestamp: new Date(rec.occurred_at),
      metadata: {
        record_id: rec.id,
        site_id: rec.site_id ?? "group",
        confidence: rec.confidence,
        source: "compliance_dataset",
        synthetic: "true",
      },
      background: true,
    });
    done++;
    if (done % 10 === 0 || done === sorted.length) process.stdout.write(`\r  ${done}/${sorted.length}`);
  });

  console.log(`\n\nDone. ${policyMemories.length + sorted.length} total memories written.`);
  console.log("Hindsight processes memories in the background — wait ~60 s before running reflect queries.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
