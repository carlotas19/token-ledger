"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { BenchmarkSummary, ModelAggregate } from "@/lib/types";

interface SimpleLedgerProps {
  benchmark: BenchmarkSummary;
}

function tokensPerCompletion(model: ModelAggregate) {
  return model.tokensPerSuccess ??
    (model.successes > 0 ? model.totalTokens / model.successes : null);
}

function costPerCompletion(model: ModelAggregate) {
  return model.costPerSuccessUsd;
}

function rankModels(
  models: ModelAggregate[],
  metric: (model: ModelAggregate) => number | null | undefined,
) {
  return [...models]
    .filter((model) => metric(model) != null)
    .sort((a, b) => Number(metric(a)) - Number(metric(b)));
}

function rankClass(index: number, length: number) {
  if (index < 3) return "border-neon-green/30 bg-neon-green/5";
  if (index >= length - 3) return "border-red-400/25 bg-red-400/5";
  return "border-ledger-border/60";
}

export function SimpleLedger({ benchmark }: SimpleLedgerProps) {
  const tokenRanking = rankModels(benchmark.aggregates, tokensPerCompletion);
  const priceRanking = rankModels(benchmark.aggregates, costPerCompletion);
  const tokenLeader = tokenRanking[0];
  const tokenLast = tokenRanking[tokenRanking.length - 1];
  const priceLeader = priceRanking[0];
  const priceLast = priceRanking[priceRanking.length - 1];
  const chartData = benchmark.aggregates
    .map((model) => ({
      model: model.modelName,
      provider: model.provider,
      tokens: tokensPerCompletion(model),
      price: costPerCompletion(model),
      completed: model.successes,
      attempted: model.attempts,
    }))
    .filter((model) => model.tokens != null && model.price != null);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:px-0">
      <section className="rounded-2xl border border-ledger-border bg-ledger-panel/75 p-5 md:p-8">
        <h2 className="text-2xl font-light text-ledger-cream">
          Cost and tokens per completed task
        </h2>
        <div className="mt-3 grid gap-3 text-sm leading-relaxed text-ledger-cream/75 lg:grid-cols-2">
          <p>
            <span className="font-mono text-neon-green">
              {tokenLeader?.modelName}
            </span>{" "}
            used the fewest tokens per completed task.{" "}
            <span className="font-mono text-neon-green">
              {priceLeader?.modelName}
            </span>{" "}
            had the lowest estimated cost.
          </p>
          <p>
            <span className="font-mono text-red-300">
              {tokenLast?.modelName}
            </span>{" "}
            used the most tokens per completed task.{" "}
            <span className="font-mono text-red-300">
              {priceLast?.modelName}
            </span>{" "}
            had the highest estimated cost among priced models.
          </p>
        </div>
        <div className="mt-5 rounded-lg border border-ledger-border bg-ledger-charcoal/70 px-4 py-3 text-sm leading-relaxed text-ledger-muted">
          Every model attempted all 100 tasks. “Completed” means the response
          passed every deterministic policy and format check. The metric divides
          all tokens and cost from the 100 attempts by the number that passed, so
          failed attempts still count against efficiency.
        </div>
        <p className="mt-6 text-xs text-ledger-muted">
          Bottom-left is better. Bubble size represents tasks completed. Both
          axes use a logarithmic scale so the outliers do not hide the rest.
        </p>
        <p className="mt-4 text-xs uppercase tracking-[0.16em] text-ledger-muted">
          Estimated cost per completed task
        </p>
        <div className="mt-2 h-[460px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 15, right: 25, bottom: 22, left: 30 }}>
              <CartesianGrid stroke="rgba(127,145,136,0.14)" />
              <XAxis
                type="number"
                dataKey="tokens"
                name="Tokens per completed task"
                scale="log"
                domain={["auto", "auto"]}
                stroke="#7f9188"
                tick={{ fill: "#7f9188", fontSize: 12 }}
                tickFormatter={(value) =>
                  Number(value).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })
                }
              />
              <YAxis
                type="number"
                dataKey="price"
                name="Estimated cost per completed task"
                scale="log"
                domain={["auto", "auto"]}
                stroke="#7f9188"
                tick={{ fill: "#7f9188", fontSize: 12 }}
                width={72}
                tickFormatter={(value) => `$${Number(value).toFixed(4)}`}
              />
              <ZAxis
                type="number"
                dataKey="completed"
                name="Tasks completed"
                range={[70, 260]}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={<ChartTooltip />}
              />
              <Scatter data={chartData} fill="#00E599" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-center text-xs uppercase tracking-[0.16em] text-ledger-muted">
          Tokens per completed task
        </p>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <RankingTable
          title="Fewest tokens per completed task"
          description="All tokens from 100 attempts divided by responses that passed."
          models={tokenRanking}
          value={(model) =>
            `${Math.round(tokensPerCompletion(model) ?? 0).toLocaleString()} tokens`
          }
        />
        <RankingTable
          title="Lowest cost per completed task"
          description="Estimated cost of 100 attempts divided by responses that passed."
          models={priceRanking}
          value={(model) => `$${(costPerCompletion(model) ?? 0).toFixed(6)}`}
        />
      </section>

      <p className="mt-6 text-xs leading-relaxed text-ledger-muted">
        Green marks the top three. Red marks the bottom three. Models without
        published pricing stay in the token table but are omitted from the cost ranking.
      </p>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload as {
    model: string;
    tokens: number;
    price: number;
    completed: number;
    attempted: number;
  };

  return (
    <div className="min-w-64 rounded-xl border border-[#405148] bg-[#070b09] p-4 text-xs shadow-2xl">
      <p className="font-mono text-sm text-neon-green">{point.model}</p>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-5 gap-y-2">
        <dt className="text-ledger-muted">Tokens per completed task</dt>
        <dd className="font-mono text-ledger-cream">
          {Math.round(point.tokens).toLocaleString()}
        </dd>
        <dt className="text-ledger-muted">Estimated cost per completed task</dt>
        <dd className="font-mono text-ledger-cream">
          ${point.price.toFixed(6)}
        </dd>
        <dt className="text-ledger-muted">Responses passed</dt>
        <dd className="font-mono text-ledger-cream">
          {point.completed}/{point.attempted}
        </dd>
      </dl>
    </div>
  );
}

function RankingTable({
  title,
  description,
  models,
  value,
}: {
  title: string;
  description: string;
  models: ModelAggregate[];
  value: (model: ModelAggregate) => string;
}) {
  return (
    <div className="rounded-2xl border border-ledger-border bg-ledger-panel/70 p-5">
      <h2 className="text-xl font-light text-ledger-cream">{title}</h2>
      <p className="mt-2 text-sm text-ledger-muted">{description}</p>
      <ol className="mt-5 space-y-2">
        {models.map((model, index) => (
          <li
            key={model.modelId}
            className={`grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-lg border px-3 py-3 ${rankClass(index, models.length)}`}
          >
            <span className="font-mono text-xs text-ledger-muted">{index + 1}</span>
            <span>
              <span className="block font-mono text-sm text-ledger-cream">
                {model.modelId}
              </span>
              <span className="text-xs text-ledger-muted">
                {model.successes}/{model.attempts} responses passed
              </span>
            </span>
            <span className="font-mono text-sm text-ledger-cream">{value(model)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
