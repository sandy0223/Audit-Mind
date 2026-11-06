import { recall } from "./src/memory.js";
import { chat } from "./src/llm.js";
import { toolSpecs } from "./src/tools.js";

async function testFullLoop() {
  const sender = "Sandeep Behera";
  const text = "hi @thesbcode/test";
  
  console.log("1. Recalling memories...");
  const memories = await recall(`${sender}: ${text}`);
  console.log(`Recalled ${memories.length} memories.`);

  const memoryBlock = `Relevant memories from Hindsight (most relevant first):\n${memories.map((m) => `- ${m}`).join("\n")}`;
  
  const systemPrompt = `You are AuditMind, the food-safety compliance agent for Spice Route Kitchens...`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "system" as const, content: memoryBlock },
    { role: "user" as const, content: `${sender}: ${text}` }
  ];

  console.log("2. Calling chat(messages, toolSpecs)...");
  const t0 = Date.now();
  const response = await chat(messages, toolSpecs);
  console.log(`Chat returned in ${Date.now() - t0}ms:`);
  console.log("Content:", response.content);
  console.log("Tool calls:", response.tool_calls);
}

testFullLoop().catch(console.error);
