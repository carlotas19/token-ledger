import type { ModelCatalogEntry, ModelPricing } from "@/lib/types";

interface ModelsJsonModel {
  id: string;
  name: string;
  provider: string;
  open_weights?: boolean;
  cost?: {
    input?: number;
    output?: number;
  };
}

interface ModelsJson {
  neon?: {
    models?: Record<string, ModelsJsonModel>;
  };
}

export async function fetchModelCatalog(): Promise<ModelCatalogEntry[]> {
  const response = await fetch("https://neon.com/models.json");
  if (!response.ok) {
    throw new Error(`Failed to fetch model catalog: ${response.status}`);
  }

  const data = (await response.json()) as ModelsJson;
  const models = data.neon?.models ?? {};

  return Object.values(models).map((model) => ({
    id: model.id,
    name: model.name,
    provider: model.provider,
    openWeights: Boolean(model.open_weights),
    pricing: model.cost
      ? {
          inputPerMillion: model.cost.input ?? 0,
          outputPerMillion: model.cost.output ?? 0,
        }
      : null,
  }));
}

export function estimateCostUsd(
  usage: {
    promptTokens: number;
    completionTokens: number;
    reasoningTokens?: number;
  },
  pricing: ModelPricing | null,
): number {
  if (!pricing) return 0;
  const outputTokens = usage.completionTokens + (usage.reasoningTokens ?? 0);
  const inputCost = (usage.promptTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return inputCost + outputCost;
}

export function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    meta: "Meta",
    alibaba: "Alibaba",
    moonshot: "Moonshot AI",
    moonshotai: "Moonshot AI",
    zhipu: "Zhipu AI",
    zhipuai: "Zhipu AI",
    thinkingmachines: "Thinking Machines",
    thinking_machines: "Thinking Machines",
  };
  return labels[provider] ?? provider;
}
