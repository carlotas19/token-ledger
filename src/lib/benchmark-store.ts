import { getSql } from "@/lib/db";
import type { BenchmarkSummary, InferenceRun, ModelAggregate } from "@/lib/types";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export async function getLatestBenchmark(): Promise<BenchmarkSummary | null> {
  const sql = getSql();
  const runs = await sql`
    SELECT *
    FROM benchmark_runs
    ORDER BY started_at DESC
    LIMIT 1
  `;

  if (runs.length === 0) return null;
  const run = runs[0];
  const aggregates = await buildAggregates(String(run.id));
  return {
    id: String(run.id),
    name: String(run.name),
    status: run.status as BenchmarkSummary["status"],
    ticketCount: Number(run.ticket_count),
    modelCount: Number(run.model_count),
    startedAt: new Date(run.started_at as string).toISOString(),
    completedAt: run.completed_at
      ? new Date(run.completed_at as string).toISOString()
      : null,
    gitCommit: run.git_commit ? String(run.git_commit) : null,
    catalogSnapshotAt: new Date(run.catalog_snapshot_at as string).toISOString(),
    aggregates,
  };
}

export async function buildAggregates(
  benchmarkRunId: string,
): Promise<ModelAggregate[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      ms.model_id,
      ms.model_name,
      ms.provider,
      ms.open_weights,
      COUNT(*)::int AS attempts,
      SUM(CASE WHEN ir.passed THEN 1 ELSE 0 END)::int AS successes,
      COALESCE(SUM(ir.total_tokens), 0)::int AS total_tokens,
      COALESCE(SUM(ir.prompt_tokens), 0)::int AS input_tokens,
      COALESCE(SUM(ir.completion_tokens), 0)::int AS output_tokens,
      COALESCE(SUM(ir.reasoning_tokens), 0)::int AS reasoning_tokens,
      COALESCE(SUM(ir.estimated_cost_usd), 0)::float AS total_cost_usd,
      COALESCE(
        SUM(CASE WHEN ir.passed THEN ir.estimated_cost_usd ELSE 0 END),
        0
      )::float AS success_cost_usd,
      ARRAY_AGG(ir.latency_ms) AS latencies
    FROM model_snapshots ms
    LEFT JOIN inference_runs ir
      ON ir.benchmark_run_id = ms.benchmark_run_id
      AND ir.model_id = ms.model_id
    WHERE ms.benchmark_run_id = ${benchmarkRunId}
    GROUP BY ms.model_id, ms.model_name, ms.provider, ms.open_weights
    ORDER BY success_cost_usd ASC NULLS LAST, total_cost_usd ASC
  `;

  return rows.map((row) => {
    const attempts = Number(row.attempts ?? 0);
    const successes = Number(row.successes ?? 0);
    const totalCostUsd = Number(row.total_cost_usd ?? 0);
    const successCostUsd = Number(row.success_cost_usd ?? 0);
    const latencies = (row.latencies as number[] | null)?.filter(Boolean) ?? [];
    const passRate = attempts > 0 ? successes / attempts : 0;
    const costPerSuccessUsd = successes > 0 ? successCostUsd / successes : null;
    const costPerThousandSuccessesUsd =
      successes > 0 ? (successCostUsd / successes) * 1000 : null;

    return {
      modelId: String(row.model_id),
      modelName: String(row.model_name),
      provider: String(row.provider),
      openWeights: Boolean(row.open_weights),
      attempts,
      successes,
      passRate,
      totalTokens: Number(row.total_tokens ?? 0),
      inputTokens: Number(row.input_tokens ?? 0),
      outputTokens: Number(row.output_tokens ?? 0),
      reasoningTokens: Number(row.reasoning_tokens ?? 0),
      totalCostUsd,
      costPerSuccessUsd,
      medianLatencyMs: median(latencies),
      costPerThousandSuccessesUsd,
    };
  });
}

export async function getInferenceRuns(
  benchmarkRunId: string,
  modelId?: string,
): Promise<InferenceRun[]> {
  const sql = getSql();
  const rows = modelId
    ? await sql`
        SELECT *
        FROM inference_runs
        WHERE benchmark_run_id = ${benchmarkRunId}
          AND model_id = ${modelId}
        ORDER BY created_at ASC
      `
    : await sql`
        SELECT *
        FROM inference_runs
        WHERE benchmark_run_id = ${benchmarkRunId}
        ORDER BY created_at ASC
      `;

  return rows.map((row) => ({
    id: String(row.id),
    benchmarkRunId: String(row.benchmark_run_id),
    modelId: String(row.model_id),
    ticketId: String(row.ticket_id),
    latencyMs: Number(row.latency_ms),
    usage: {
      promptTokens: Number(row.prompt_tokens),
      completionTokens: Number(row.completion_tokens),
      totalTokens: Number(row.total_tokens),
      reasoningTokens: Number(row.reasoning_tokens),
    },
    estimatedCostUsd: Number(row.estimated_cost_usd),
    grade: {
      passed: Boolean(row.passed),
      score: Number(row.grade_score),
      checks: row.grade_checks as InferenceRun["grade"]["checks"],
    },
    rawResponse: String(row.raw_response),
    parsedResponse: row.parsed_response as InferenceRun["parsedResponse"],
    createdAt: new Date(row.created_at as string).toISOString(),
  }));
}
