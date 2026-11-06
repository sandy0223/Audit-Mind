import { recall } from "./src/memory.js";
import { chat } from "./src/llm.js";
import { toolSpecs } from "./src/tools.js";

async function run() {
  console.log("Step 1: Recalling...");
  const t0 = Date.now();
  const memories = await recall("Sandeep Behera: hi @thesbcode/test");
  console.log(`Recalled ${memories.length} memories in ${Date.now() - t0}ms`);

  console.log("Step 2: Calling chat with Groq...");
  const t1 = Date.now();
  const messages = [
    { role: "system" as const, content: "You are AuditMind." },
    { role: "user" as const, content: "Sandeep Behera: hi @thesbcode/test" }
  ];
  
  try {
    const res = await chat(messages, toolSpecs);
    console.log(`Chat finished in ${Date.now() - t1}ms:`, res);
  } catch (e) {
    console.error("Chat error:", e);
  }
}

run();
