import { handleMessage } from "./src/agent.js";

async function test() {
  console.log("Starting handleMessage test...");
  const t0 = Date.now();
  try {
    const res = await handleMessage({ text: "hi @thesbcode/test", senderName: "Sandeep Behera" });
    console.log(`Success in ${Date.now() - t0}ms:\n`, res);
  } catch (e) {
    console.error("Error in handleMessage:", e);
  }
}

test();
