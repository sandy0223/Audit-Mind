/**
 * Loads the house standards and the 6-week synthetic history into Hindsight, in date order,
 * with each record's real timestamp (so temporal recall like "what happened in week 2?" works).
 *
 *   npm run seed                       # everything
 *   npm run seed -- --until 2026-10-01 # only up to a date — for "learning curve" demos
 *   npm run seed -- --dry-run          # print what would be stored
 *
 * Tip: use a fresh HINDSIGHT_BANK_ID each time you re-seed, so records aren't duplicated.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureBank, retain } from "../src/memory.js";

interface SeedEvent {
  date: string;
  outlet: string;
  context: string;
  content: string;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const untilIdx = args.indexOf("--until");
const until = untilIdx >= 0 ? args[untilIdx + 1] : undefined;
const dryRun = args.includes("--dry-run");
const CONCURRENCY = 4;

function knowledgeChunks(): { title: string; body: string }[] {
  const dir = join(root, "data", "knowledge");
  const chunks: { title: string; body: string }[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const text = readFileSync(join(dir, file), "utf8");
    // One memory per "## " section keeps each rule set focused.
    for (const section of text.split(/\n(?=## )/)) {
      const title = section.match(/^#+\s*(.+)/)?.[1] ?? file;
      chunks.push({ title, body: section.trim() });
    }
  }
  return chunks;
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

async function main() {
  const events: SeedEvent[] = JSON.parse(readFileSync(join(root, "data", "seed", "events.json"), "utf8"));
  const selected = until ? events.filter((e) => e.date.slice(0, 10) <= until) : events;
  const knowledge = knowledgeChunks();

  console.log(`Seeding ${knowledge.length} policy sections + ${selected.length}/${events.length} events${until ? ` (until ${until})` : ""}`);
  if (dryRun) {
    for (const k of knowledge) console.log(`[policy] ${k.title}`);
    for (const e of selected) console.log(`[${e.context}] ${e.content.slice(0, 140)}…`);
    return;
  }

  await ensureBank();

  for (const k of knowledge) {
    await retain({ context: "house-standards", content: k.body, metadata: { section: k.title } });
  }

  let done = 0;
  await runPool(selected, async (e) => {
    await retain({
      context: e.context,
      content: e.content,
      timestamp: new Date(e.date),
      metadata: { outlet: e.outlet, source: "seed" },
      background: true, // let Hindsight extract facts in the background; much faster for bulk loads
    });
    done++;
    if (done % 20 === 0 || done === selected.length) console.log(`  ${done}/${selected.length}`);
  });

  console.log("Done. Hindsight keeps processing in the background — give it a minute before asking for a risk briefing.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
