export type Tab = "ledger" | "report" | "methodology";

export interface Ticket {
  id: string;
  title: string;
  category: TicketCategory;
  customerMessage: string;
  accountContext: string;
  policyNotes: string;
  expected: {
    classification: TicketCategory;
    escalate: boolean;
    allowedActions: string[];
    preferredAction?: string;
    mustMention?: string[];
    mustNotMention?: string[];
  };
}

export type TicketCategory =
  | "billing"
  | "access"
  | "feature"
  | "security"
  | "refund"
  | "other";

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

export interface ModelCatalogEntry {
  id: string;
  name: string;
  provider: string;
  openWeights: boolean;
  pricing: ModelPricing | null;
}

export interface ModelResponse {
  classification: string;
  action: string;
  escalate: boolean;
  customerReply: string;
}

export interface GradeResult {
  passed: boolean;
  score: number;
  checks: Array<{ id: string; passed: boolean; detail?: string }>;
}

export interface RunUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
}

export interface InferenceRun {
  id: string;
  benchmarkRunId: string;
  modelId: string;
  ticketId: string;
  latencyMs: number;
  usage: RunUsage;
  estimatedCostUsd: number;
  grade: GradeResult;
  rawResponse: string;
  parsedResponse: ModelResponse | null;
  createdAt: string;
}

export interface ModelAggregate {
  modelId: string;
  modelName: string;
  provider: string;
  openWeights: boolean;
  attempts: number;
  successes: number;
  passRate: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalCostUsd: number;
  costPerSuccessUsd: number | null;
  medianLatencyMs: number;
  costPerThousandSuccessesUsd: number | null;
}

export interface BenchmarkSummary {
  id: string;
  name: string;
  status: "running" | "completed" | "failed";
  ticketCount: number;
  modelCount: number;
  startedAt: string;
  completedAt: string | null;
  gitCommit: string | null;
  catalogSnapshotAt: string;
  aggregates: ModelAggregate[];
}

export interface ReportInsight {
  id: string;
  title: string;
  body: string;
  metric?: string;
}
