/**
 * Local REPL for developing and recording the demo without Band.
 *
 *   npm run cli
 *   > /as Arjun            switch who is speaking
 *   > /memory off          run the same agent without Hindsight (the "before" shot)
 *   > fridge at Koramangala is 7.1°C
 */
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { handleMessage } from "./agent.js";
import { config } from "./config.js";
import { ensureBank } from "./memory.js";

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

async function main() {
  await ensureBank();
  const rl = readline.createInterface({ input, output });
  let speaker = "Meera";

  console.log(bold("AuditMind — local console"));
  console.log("Commands: /as <name>, /memory on|off, /exit\n");

  for (;;) {
    const line = (await rl.question(`${bold(speaker)} [memory ${config.memoryEnabled ? "on" : "off"}] > `)).trim();
    if (!line) continue;
    if (line === "/exit") break;
    if (line.startsWith("/as ")) {
      speaker = line.slice(4).trim() || speaker;
      continue;
    }
    if (line.startsWith("/memory ")) {
      config.memoryEnabled = line.endsWith("on");
      continue;
    }
    try {
      const reply = await handleMessage({ text: line, senderName: speaker, conversationId: `cli-${speaker}` });
      console.log(`\n${green("AuditMind:")} ${reply}\n`);
    } catch (err) {
      console.error("Error:", (err as Error).message);
    }
  }
  rl.close();
}

main();
