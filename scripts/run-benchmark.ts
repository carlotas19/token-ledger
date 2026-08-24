import "./env";
import { tickets, buildUserPrompt } from "../src/data/tickets";
import {
  createGatewayClient,
  extractTextContent,
  listEnabledModels,
  parseModelResponse,
  SYSTEM_PROMPT,
} from "../src/lib/gateway";
import { gradeResponse } from "../src/lib/grader";
import {
  estimateCostUsd,
  fetchModelCatalog,
  providerLabel,
} from "../src/lib/pricing";
import { getSql } from "../src/lib/db";
import { applySchema } from "../src/lib/schema";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

interface RunOptions {
  sample?: boolean;
  modelLimit?: number;
}

function gitCommit(): string | null {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export async function runBenchmark(options: RunOptions = {}) {
  await applySchema();

  const sql = getSql();
  const benchmarkId = randomUUID();
  const catalog = await fetchModelCatalog();
  const enabledModelIds = await listEnabledModels();
  const selectedTickets = options.sample ? tickets.slice(0, 5) : tickets;

  let selectedModels = catalog.filter((model) =>
    enabledModelIds.includes(model.id),
  );

  if (selectedModels.length === 0) {
    selectedModels = catalog.filter((model) =>
      enabledModelIds.some(
        (id) => id === model.id || id.replace(/^databricks-/, "") === model.id,
      ),
    );
  }

  if (options.modelLimit) {
    selectedModels = selectedModels.slice(0, options.modelLimit);
  }

  if (selectedModels.length === 0) {
    throw new Error(
      `No catalog models matched enabled Gateway models. Enabled: ${enabledModelIds.join(", ") || "(none)"}`,
    );
  }

  await sql`
    INSERT INTO benchmark_runs (
      id, name, status, ticket_count, model_count, git_commit, catalog_snapshot_at, config
    ) VALUES (
      ${benchmarkId},
      ${options.sample ? "Token Ledger sample run" : "Token Ledger full run"},
      'running',
      ${selectedTickets.length},
      ${selectedModels.length},
      ${gitCommit()},
      ${new Date().toISOString()},
      ${JSON.stringify({ sample: Boolean(options.sample) })}
    )
  `;

  for (const model of selectedModels) {
    await sql`
      INSERT INTO model_snapshots (
        benchmark_run_id, model_id, model_name, provider, open_weights,
        input_per_million, output_per_million, enabled
      ) VALUES (
        ${benchmarkId},
        ${model.id},
        ${model.name},
        ${providerLabel(model.provider)},
        ${model.openWeights},
        ${model.pricing?.inputPerMillion ?? null},
        ${model.pricing?.outputPerMillion ?? null},
        true
      )
    `;
  }

  const client = createGatewayClient();

  for (const model of selectedModels) {
    for (const ticket of selectedTickets) {
      const started = Date.now();
      let rawResponse = "";
      let parsedResponse = null;
      let usage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        reasoningTokens: 0,
      };

      try {
        const completion = await client.chat.completions.create({
          model: model.id,
          temperature: 0,
          max_tokens: 500,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(ticket) },
          ],
        });

        rawResponse = extractTextContent(completion.choices[0]?.message?.content);
        parsedResponse = parseModelResponse(rawResponse);
        usage = {
          promptTokens: completion.usage?.prompt_tokens ?? 0,
          completionTokens: completion.usage?.completion_tokens ?? 0,
          totalTokens: completion.usage?.total_tokens ?? 0,
          reasoningTokens:
            (completion.usage as { reasoning_tokens?: number } | undefined)
              ?.reasoning_tokens ?? 0,
        };
      } catch (error) {
        rawResponse =
          error instanceof Error ? error.message : "Unknown inference error";
      }

      const grade = gradeResponse(ticket, parsedResponse, rawResponse);
      const estimatedCostUsd = estimateCostUsd(usage, model.pricing);

      await sql`
        INSERT INTO inference_runs (
          id, benchmark_run_id, model_id, ticket_id, latency_ms,
          prompt_tokens, completion_tokens, total_tokens, reasoning_tokens,
          estimated_cost_usd, passed, grade_score, grade_checks,
          raw_response, parsed_response
        ) VALUES (
          ${randomUUID()},
          ${benchmarkId},
          ${model.id},
          ${ticket.id},
          ${Date.now() - started},
          ${usage.promptTokens},
          ${usage.completionTokens},
          ${usage.totalTokens},
          ${usage.reasoningTokens},
          ${estimatedCostUsd},
          ${grade.passed},
          ${grade.score},
          ${JSON.stringify(grade.checks)},
          ${rawResponse},
          ${parsedResponse ? JSON.stringify(parsedResponse) : null}
        )
      `;

      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  await sql`
    UPDATE benchmark_runs
    SET status = 'completed', completed_at = NOW()
    WHERE id = ${benchmarkId}
  `;

  return benchmarkId;
}

const sample = process.argv.includes("--sample");
runBenchmark({ sample, modelLimit: sample ? 6 : undefined })
  .then((id) => {
    console.log(`Benchmark completed: ${id}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
