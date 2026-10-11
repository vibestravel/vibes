// Claude-powered engine with server-side tool calling.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { TOOL_SCHEMAS, TOOL_DESCRIPTIONS, executeTool, type ToolContext, type ToolName } from "./tools";

export type HistoryItem = { author: "CUSTOMER" | "AI" | "HUMAN" | "SYSTEM"; text: string };
export type EngineResult = { text: string; toolCalls: { name: string; input: unknown; output: unknown }[]; model?: string };

export function aiConfigured() { return Boolean(process.env.ANTHROPIC_API_KEY); }

const tools: Anthropic.Tool[] = (Object.keys(TOOL_SCHEMAS) as ToolName[]).map((name) => {
  const schema = z.toJSONSchema(TOOL_SCHEMAS[name], { io: "input" }) as Record<string, unknown>;
  delete schema.$schema;
  return { name, description: TOOL_DESCRIPTIONS[name], input_schema: schema as Anthropic.Tool.InputSchema };
});

function toMessages(history: HistoryItem[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const h of history) {
    if (h.author === "SYSTEM") continue;
    const role = h.author === "CUSTOMER" ? "user" : "assistant";
    // customer text is wrapped so it is always treated as data, never as instructions
    const text = h.author === "CUSTOMER" ? `<customer_message>\n${h.text}\n</customer_message>` : h.author === "HUMAN" ? `[رد من موظف فايبس] ${h.text}` : h.text;
    const prev = out.at(-1);
    if (prev && prev.role === role && typeof prev.content === "string") prev.content += `\n\n${text}`;
    else out.push({ role, content: text });
  }
  if (out[0]?.role === "assistant") out.unshift({ role: "user", content: "<customer_message>\n(بداية المحادثة)\n</customer_message>" });
  return out;
}

export async function runClaude(system: string, history: HistoryItem[], ctx: ToolContext): Promise<EngineResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  const messages = toMessages(history);
  const toolCalls: EngineResult["toolCalls"] = [];

  for (let step = 0; step < 6; step++) {
    const res = await client.messages.create({ model, max_tokens: 800, system, tools, messages });
    const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !uses.length) {
      const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
      return { text, toolCalls, model };
    }
    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const output = await executeTool(u.name, u.input, ctx);
      toolCalls.push({ name: u.name, input: u.input, output });
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(output) });
    }
    messages.push({ role: "user", content: results });
  }
  return { text: "", toolCalls, model };
}
