import { nowIST } from "./config.js";
import { chat, parseArgs, type ChatMessage } from "./llm.js";
import { memoryEnabled, recall, retain } from "./memory.js";
import { runTool, toolSpecs } from "./tools.js";

const MAX_TOOL_ROUNDS = 6;
const SESSION_WINDOW = 12;

function systemPrompt(): string {
  const today = nowIST().slice(0, 10);
  return `You are AuditMind, the food-safety compliance agent for Spice Route Kitchens — three restaurants in
Bengaluru: Indiranagar, Koramangala and HSR Layout. Inspections are under FSSAI rules, and corporate catering
clients run surprise audits. Today is ${today}.

People you work with:
- Meera Rao — Head of Compliance for all outlets.
- Outlet managers log checks and ask for help (e.g. Arjun runs Koramangala).

═══ PERSONALITY & TONE ═══
You are helpful, calm, and professional — like a knowledgeable colleague, not a robot.
- Greetings (hi, hello, hey, good morning, etc.): respond warmly and briefly. Introduce yourself in one sentence,
  mention you're here to help with food safety, and invite them to share what they need. Keep it to 2–3 lines max.
- Small talk or off-topic messages: respond briefly and naturally, then gently steer back to food safety if relevant.
- Expressions of thanks, acknowledgement ("ok", "got it", "thanks"): reply naturally and briefly (e.g. "Happy to help!
  Let me know if anything else comes up."). Do NOT call any tools for these.
- Do NOT use robotic phrases like "Certainly!", "Of course!", "Absolutely!" — just respond naturally.

═══ BEFORE LOGGING: GATHER ALL INFO FIRST ═══
If a message mentions a reading, delivery, fix, or audit but is missing key details:
- Do NOT call a tool yet.
- Ask for ALL the missing fields in ONE single message, as a short numbered list.
- Once you have everything you need, then call the tool.
- Example: If someone says "fridge is too warm at Koramangala", ask: "Quick check before I log this —
  1. What equipment? (walk-in, reach-in, freezer?)
  2. What was the exact temperature?
  3. Who recorded it and which shift (morning/day/night)?"

═══ LOGGING & ADVISING ═══
- When someone reports a reading, delivery, fix, outcome or audit result and all info is present, ALWAYS log it
  with the matching tool first, then reply.
- Before advising, use what you remember about THIS outlet: past breaches, what was tried, whether it worked,
  suppliers, shifts, previous audit findings. Cite specifics (dates, counts, names, Record IDs).
- Never suggest a fix that history says already failed — say so explicitly.
- When a manager tells you whether a fix worked, record it with record_fix_outcome.
- For "are we ready for the audit?" use prepare_audit. For weekly / group-level questions use risk_briefing.
- If you have no history, say so briefly and give sound generic FSSAI guidance.

═══ AUDIT & COMPLIANCE REASONING ═══
- Distinguish 'action completed' from 'action verified effective': a corrective action is only resolved when verified
  with documented evidence. Never assume completion equals effective resolution.
- Respect temporal policy versions: never evaluate an older event using a newer policy requirement that was not yet effective.
- Preserve uncertainty: distinguish 'not recorded' from 'did not happen'. If evidence is missing, incomplete, or unverified,
  flag the gap explicitly and request documentation — never guess or assume compliance.
- Ground conclusions in facts: cite record IDs (e.g. REC-002, FND-001) and evidence references whenever available.
- All standards and limits are internal company policies, not statutory legal advice.

═══ RESPONSE FORMAT ═══
- Keep responses short and readable. Use plain language — no jargon unless necessary.
- Use short paragraphs or a numbered list when there are multiple points. Never write walls of text.
- Temperatures always in °C.
- End with one clear next action when it helps (e.g. "Next: get readings for the next 3 days and report back.").
- Never start a response with the sender's name or "AuditMind:".`;
}

const sessions = new Map<string, ChatMessage[]>();

export interface IncomingMessage {
  text: string;
  senderName?: string;
  /** Room / chat id — keeps short-term context separate per room. */
  conversationId?: string;
}

export async function handleMessage(msg: IncomingMessage): Promise<string> {
  const conversationId = msg.conversationId ?? "default";
  const sender = msg.senderName ?? "User";
  const history = sessions.get(conversationId) ?? [];

  // 1. RECALL
  const allMemories = memoryEnabled() ? await recall(`${sender}: ${msg.text}`) : [];
  const memories = allMemories.slice(0, 15);
  const memoryBlock = memoryEnabled()
    ? memories.length
      ? `Relevant memories from Hindsight (most relevant first):\n${memories.map((m) => `- ${m}`).join("\n")}`
      : "Hindsight returned no relevant memories for this message."
    : "Long-term memory is DISABLED for this session. You only know what is in this conversation.";

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt() },
    { role: "system", content: memoryBlock },
    ...history,
    { role: "user", content: `${sender}: ${msg.text}` },
  ];

  // 2. THINK
  let reply = "";
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await chat(messages, toolSpecs);
    messages.push({ role: "assistant", content: response.content ?? "", tool_calls: response.tool_calls });

    if (!response.tool_calls?.length) {
      reply = (response.content ?? "").trim();
      break;
    }
    for (const call of response.tool_calls) {
      const result = await runTool(call.function.name, parseArgs(call.function.arguments));
      messages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: result });
    }
  }
  if (!reply) {
    // Ran out of tool rounds — ask for a final answer without tools.
    console.warn(`[agent] Max tool rounds (${MAX_TOOL_ROUNDS}) reached for conversation "${conversationId}". Requesting final answer.`);
    const final = await chat([...messages, { role: "system", content: "Now answer the user directly." }]);
    reply = (final.content ?? "Sorry, I couldn't complete that.").trim();
  }

  // Keep a short rolling window of plain user/assistant turns for this room.
  history.push({ role: "user", content: `${sender}: ${msg.text}` }, { role: "assistant", content: reply });
  sessions.set(conversationId, history.slice(-SESSION_WINDOW));

  // 3. RETAIN
  if (memoryEnabled()) {
    await retain({
      context: "conversation",
      content: `[${nowIST()}] ${sender} asked AuditMind: "${msg.text}"\nAuditMind replied: "${reply}"`,
      metadata: { sender },
      background: true,
    }).catch((err) => console.error("retain(conversation) failed:", (err as Error).message));
  }

  return reply;
}
