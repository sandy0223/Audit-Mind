import { Agent, GenericAdapter, loadAgentConfigFromEnv } from "@band-ai/sdk";
import { handleMessage } from "./agent.js";
import { config } from "./config.js";
import { ensureBank } from "./memory.js";

/** Read a field from an object whose exact shape we don't depend on. */
function pick(obj: unknown, ...paths: string[]): string | undefined {
  for (const path of paths) {
    let cur: unknown = obj;
    for (const key of path.split(".")) {
      if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[key];
      } else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === "string" && cur) return cur;
  }
  return undefined;
}

/** Strip our own @mention from the start of the message ("@AuditMind fridge at 7°C"). */
function stripMention(text: string): string {
  return text.replace(/^\s*@\S+(\s+\S+)?\s*[:,-]?\s*/i, (m) => (/@auditmind/i.test(m) ? "" : m)).trim();
}

type LooseTools = { sendMessage: (content: string, mentions?: unknown) => Promise<unknown> };

async function main() {
  await ensureBank();

  const agent = Agent.create({
    adapter: new GenericAdapter(async ({ message, tools }) => {
      const text = stripMention(pick(message, "content", "text") ?? "");
      if (!text) return;

      const senderName = pick(message, "sender.name", "senderName", "sender_name", "author.name");
      const senderHandle = pick(message, "sender.handle", "sender.id", "senderId", "sender_id");
      const conversationId = pick(message, "roomId", "room_id", "chatId", "chat_id", "room.id", "chat.id");

      const send = tools as unknown as LooseTools;
      let reply: string;
      try {
        reply = await handleMessage({ text, senderName, conversationId });
      } catch (err) {
        console.error(err);
        reply = "Sorry — I hit an error processing that. Please try again in a moment.";
      }

      try {
        await send.sendMessage(reply);
      } catch (err) {
        // Band routes by @mention; if a plain send is rejected, retry mentioning the sender.
        if (!senderHandle && !senderName) throw err;
        await send.sendMessage(reply, [senderHandle ?? senderName]);
      }
    }),
    config: loadAgentConfigFromEnv(),
  });

  console.log(`AuditMind is connecting to Band (memory ${config.memoryEnabled ? "ON" : "OFF"})…`);
  await agent.run();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
