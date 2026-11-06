import { handleMessage } from "./src/agent.js";

async function run() {
  console.log("Testing handleMessage with full prompt and memories...");
  const t0 = Date.now();
  try {
    const reply = await handleMessage({
      text: "hi @thesbcode/test",
      senderName: "Sandeep Behera",
      conversationId: "test-room-1"
    });
    console.log(`\nReply received in ${Date.now() - t0}ms:\n`, reply);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
