/**
 * Lightweight smoke tests — no test framework needed, just `tsx src/tests.ts`.
 * Tests the pure logic in tools.ts and config.ts without hitting any external APIs.
 *
 *   npm run test
 */
import { normalizeOutlet, OUTLETS } from "./config.js";
import { stripMention } from "./band.js";

let passed = 0;
let failed = 0;

function assert(description: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.error(`  ❌ ${description}`);
    console.error(`     expected: ${JSON.stringify(expected)}`);
    console.error(`     actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

// --- normalizeOutlet ---
console.log("\nnormalizeOutlet:");
assert("exact canonical: Indiranagar",   normalizeOutlet("Indiranagar"),   "Indiranagar");
assert("exact canonical: Koramangala",   normalizeOutlet("Koramangala"),   "Koramangala");
assert("exact canonical: HSR Layout",    normalizeOutlet("HSR Layout"),    "HSR Layout");
assert("lowercase substring: indira",    normalizeOutlet("indira"),        "Indiranagar");
assert("koram abbreviation",             normalizeOutlet("koram"),         "Koramangala");
assert("hsr abbreviation",               normalizeOutlet("hsr"),           "HSR Layout");
assert("mixed case: KORAMANGALA",        normalizeOutlet("KORAMANGALA"),   "Koramangala");
assert("mixed case: Hsr Layout",         normalizeOutlet("Hsr Layout"),    "HSR Layout");
assert("with extra spaces: ' hsr '",     normalizeOutlet("  hsr  "),       "HSR Layout");
assert("unknown outlet",                 normalizeOutlet("Mumbai"),        undefined);
assert("empty string",                   normalizeOutlet(""),              undefined);
assert("undefined",                      normalizeOutlet(undefined),       undefined);

// --- OUTLETS constant ---
console.log("\nOUTLETS:");
assert("has 3 outlets",                  OUTLETS.length,                   3);
assert("contains Indiranagar",           OUTLETS.includes("Indiranagar"),  true);
assert("contains Koramangala",           OUTLETS.includes("Koramangala"),  true);
assert("contains HSR Layout",            OUTLETS.includes("HSR Layout"),   true);

// --- stripMention ---
console.log("\nstripMention:");
assert("leading @AuditMind mention",     stripMention("@AuditMind fridge at 7°C"),          "fridge at 7°C");
assert("trailing agent mention",         stripMention("hi @thesbcode/test"),                "hi");
assert("mention with colon prefix",      stripMention("@thesbcode/auditmind: check fridge"),"check fridge");
assert("bare mention returns empty",     stripMention("@thesbcode/test"),                   "");
assert("slack/band xml mention tag",     stripMention("<@U123456> what is the status?"),    "what is the status?");

// --- Temperature limit logic (inline, since limitFor is not exported) ---
console.log("\nTemperature breach logic (inline):");
type LimitKind = "max" | "min";
function isBreach(reading: number, kind: LimitKind, value: number) {
  return kind === "max" ? reading > value : reading < value;
}
assert("fridge 5°C is NOT breach (≤5)",       isBreach(5,    "max", 5),   false);
assert("fridge 5.1°C IS breach (≤5)",         isBreach(5.1,  "max", 5),   true);
assert("freezer -18°C is NOT breach (≤-18)",  isBreach(-18,  "max", -18), false);
assert("freezer -17.9°C IS breach (≤-18)",    isBreach(-17.9,"max", -18), true);
assert("hot-hold 63°C is NOT breach (≥63)",   isBreach(63,   "min", 63),  false);
assert("hot-hold 62.9°C IS breach (≥63)",     isBreach(62.9, "min", 63),  true);
assert("cooking 75°C is NOT breach (≥75)",    isBreach(75,   "min", 75),  false);
assert("cooking 74°C IS breach (≥75)",        isBreach(74,   "min", 75),  true);

// --- Summary ---
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
