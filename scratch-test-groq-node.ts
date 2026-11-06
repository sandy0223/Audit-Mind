import { config } from "./src/config.js";

async function testGroqFetch() {
  console.log("Testing fetch to Groq from Node...");
  const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.groq.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "AuditMind/1.0"
    },
    body: JSON.stringify({
      model: config.groq.model,
      messages: [{ role: "user", content: "ping" }]
    })
  });

  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Body:", text.slice(0, 200));
}

testGroqFetch().catch(console.error);
