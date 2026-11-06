/**
 * Minimal Groq client (OpenAI-compatible Chat Completions) with tool calling.
 *
 * No SDK dependency on purpose: it's ~one fetch call, and it lets us handle Groq's
 * function-calling failure modes explicitly (the hackathon brief warns about these):
 *   - HTTP 400 with code "tool_use_failed" when the model emits a malformed tool call
 *   - tool-call arguments that aren't valid JSON
 *   - 429 rate limits on the free tier
 */
import { config } from "./config.js";

export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: Role;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolSpec {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface CompletionResponse {
  choices: { message: ChatMessage; finish_reason: string }[];
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function chat(messages: ChatMessage[], tools?: ToolSpec[], attempt = 0): Promise<ChatMessage> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.groq.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.groq.model,
      messages,
      ...(tools && tools.length ? { tools, tool_choice: "auto" } : {}),
      // Nudge the temperature up on retries so a bad tool call isn't reproduced exactly.
      temperature: attempt === 0 ? 0.2 : 0.5,
    }),
  });

  if (res.ok) {
    const data = (await res.json()) as CompletionResponse;
    return data.choices[0].message;
  }

  const body = await res.text();

  if (res.status === 429 && attempt < 4) {
    const wait = Number(res.headers.get("retry-after")) * 1000 || 2000 * (attempt + 1);
    await sleep(wait);
    return chat(messages, tools, attempt + 1);
  }

  if (res.status === 400 && body.includes("tool_use_failed") && attempt < 2) {
    // The model produced a broken tool call. Retry, and on the last attempt drop tools
    // entirely so the user still gets a plain-text answer instead of an error.
    const retryTools = attempt === 1 ? undefined : tools;
    return chat(
      [
        ...messages,
        {
          role: "system",
          content:
            "Your previous tool call was malformed. If you call a tool, the arguments MUST be a single valid JSON object matching the schema.",
        },
      ],
      retryTools,
      attempt + 1,
    );
  }

  throw new Error(`Groq API error ${res.status}: ${body.slice(0, 500)}`);
}

/** Parse tool-call arguments defensively. Models sometimes wrap JSON in prose or code fences. */
export function parseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    }
    console.warn(`[llm] Could not parse tool arguments: ${raw.slice(0, 200)}`);
    return {};
  }
}
