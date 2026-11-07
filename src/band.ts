import "./config.js";
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

/** Strip @mentions anywhere in the message ("@AuditMind fridge at 7°C", "hi @thesbcode/test"). */
export function stripMention(text: string): string {
  return text
    .replace(/<@[^>]+>/g, "")
    .replace(/@[\w\-./]+/g, "")
    .replace(/^[\s:,-]+/, "")
    .replace(/[\s:,-]+$/, "")
    .trim();
}

type LooseTools = { sendMessage: (content: string, mentions?: unknown) => Promise<unknown> };

async function main() {
  await ensureBank();

  const agent = Agent.create({
    adapter: new GenericAdapter(async ({ message, tools }) => {
      const raw = pick(message, "content", "text") ?? "";
      let text = stripMention(raw);
      if (!text) {
        text = "hi";
      }

      const senderName = pick(message, "sender.name", "senderName", "sender_name", "author.name") ?? "User";
      const senderHandle = pick(message, "sender.handle", "sender.id", "senderId", "sender_id");
      const conversationId = pick(message, "roomId", "room_id", "chatId", "chat_id", "room.id", "chat.id");

      console.log(`[band] Received message from "${senderName}": "${text}"`);

      const send = tools as unknown as LooseTools;
      let reply: string;
      try {
        reply = await handleMessage({ text, senderName, conversationId });
      } catch (err) {
        console.error(`[band] Error in handleMessage:`, err);
        reply = "Sorry — I hit an error processing that. Please try again in a moment.";
      }

      console.log(`[band] Sending reply (${reply.length} chars)...`);
      try {
        await send.sendMessage(reply);
        console.log(`[band] Reply delivered successfully.`);
      } catch (err) {
        console.warn(`[band] Plain send rejected, trying with mention:`, (err as Error).message);
        try {
          const mentionTarget = senderHandle ?? (!senderName.includes(" ") ? senderName : undefined);
          if (mentionTarget) {
            await send.sendMessage(reply, [mentionTarget]);
            console.log(`[band] Reply delivered with mention to "${mentionTarget}".`);
          } else {
            console.error(`[band] Cannot route mention (no valid handle). Original error:`, err);
          }
        } catch (mentionErr) {
          console.error(`[band] Delivery failed:`, mentionErr);
        }
      }
    }),
    config: loadAgentConfigFromEnv(),
  });

  console.log(`AuditMind is connecting to Band (memory ${config.memoryEnabled ? "ON" : "OFF"})…`);
  await agent.run();
}

const isMain = Boolean(process.argv[1] && /band\.(ts|js)$/.test(process.argv[1]));
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
