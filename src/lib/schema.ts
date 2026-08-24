export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS benchmark_runs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  ticket_count INTEGER NOT NULL,
  model_count INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  git_commit TEXT,
  catalog_snapshot_at TIMESTAMPTZ NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb
)`,
  `CREATE TABLE IF NOT EXISTS model_snapshots (
  benchmark_run_id TEXT NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  open_weights BOOLEAN NOT NULL DEFAULT FALSE,
  input_per_million NUMERIC,
  output_per_million NUMERIC,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (benchmark_run_id, model_id)
)`,
  `CREATE TABLE IF NOT EXISTS inference_runs (
  id TEXT PRIMARY KEY,
  benchmark_run_id TEXT NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC NOT NULL,
  passed BOOLEAN NOT NULL,
  grade_score NUMERIC NOT NULL,
  grade_checks JSONB NOT NULL,
  raw_response TEXT NOT NULL,
  parsed_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
  `CREATE INDEX IF NOT EXISTS idx_inference_runs_benchmark ON inference_runs(benchmark_run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_inference_runs_model ON inference_runs(benchmark_run_id, model_id)`,
];

export async function applySchema() {
  const { getSql } = await import("./db");
  const sql = getSql();
  for (const statement of SCHEMA_STATEMENTS) {
    await sql.query(statement);
  }
}
