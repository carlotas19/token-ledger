import OpenAI from "openai";
import type { ModelResponse } from "@/lib/types";

export function createGatewayClient() {
  const apiKey = process.env.NEON_AI_GATEWAY_TOKEN;
  const baseUrl = process.env.NEON_AI_GATEWAY_BASE_URL;

  if (!apiKey || !baseUrl) {
    throw new Error("NEON_AI_GATEWAY_TOKEN and NEON_AI_GATEWAY_BASE_URL must be set");
  }

  return new OpenAI({
    apiKey,
    baseURL: `${baseUrl.replace(/\/$/, "")}/v1`,
  });
}

export async function listEnabledModels(): Promise<string[]> {
  const baseUrl = process.env.NEON_AI_GATEWAY_BASE_URL;
  const token = process.env.NEON_AI_GATEWAY_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("AI Gateway env vars are not set");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/models`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to list models: ${response.status}`);
  }

  const payload = (await response.json()) as {
    data: Array<{ id: string; enabled?: boolean }>;
  };

  return payload.data.filter((model) => model.enabled !== false).map((model) => model.id);
}

export function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (typeof block === "string") return block;
      if (block && typeof block === "object" && "text" in block) {
        return String((block as { text?: string }).text ?? "");
      }
      return "";
    })
    .join("\n")
    .trim();
}

export function parseModelResponse(raw: string): ModelResponse | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? raw.trim();

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    return {
      classification: String(parsed.classification ?? ""),
      action: String(parsed.action ?? ""),
      escalate: Boolean(parsed.escalate),
      customerReply: String(parsed.customer_reply ?? parsed.customerReply ?? ""),
    };
  } catch {
    return null;
  }
}

export const SYSTEM_PROMPT = `You are a support agent for a developer platform.
Read the customer message, account context, and policy notes.
Return ONLY valid JSON with this shape:
{
  "classification": "billing|access|feature|security|refund|other",
  "action": "reply_only|reset_password|issue_credit|deny_request|escalate_security",
  "escalate": true|false,
  "customer_reply": "concise customer-facing reply"
}
Rules:
- Never invent account facts not present in the context.
- Escalate security incidents.
- Follow refund and credit policy strictly.
- Keep customer_reply under 120 words.`;
