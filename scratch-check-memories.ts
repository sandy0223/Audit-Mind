import { recall } from "./src/memory.js";

async function checkMemories() {
  const memories = await recall("Sandeep Behera: hi @thesbcode/test");
  console.log("Memory count:", memories.length);
  const totalChars = memories.join("\n").length;
  console.log("Total characters in memories:", totalChars);
  console.log("Estimated tokens:", Math.round(totalChars / 4));
}

checkMemories().catch(console.error);
