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
  const chartData = benchmark.aggregates
    .map((model) => ({
      model: model.modelId,
      provider: model.provider,
      tokens: tokensPerCompletion(model),
      price: costPerCompletion(model),
      completed: model.successes,
    }))
    .filter((model) => model.tokens != null && model.price != null);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:px-0">
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Support tickets per model" value={String(benchmark.ticketCount)} />
        <Stat label="Models tested" value={String(benchmark.modelCount)} />
        <Stat label="Neon branches" value={String(benchmark.modelCount)} />
      </section>

      <section className="mt-10 rounded-2xl border border-ledger-border bg-ledger-panel/75 p-5 md:p-8">
        <h2 className="text-2xl font-light text-ledger-cream">
          Tokens and price per completed ticket
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ledger-muted">
          Each point is one model. Further left means fewer tokens per completed
          ticket. Lower means a lower estimated price. Failed attempts remain in
          both totals, because those tokens were still spent.
        </p>
        <div className="mt-6 h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 25, bottom: 35, left: 15 }}>
              <CartesianGrid stroke="rgba(127,145,136,0.14)" />
              <XAxis
                type="number"
                dataKey="tokens"
                name="Tokens per completion"
                stroke="#7f9188"
                tick={{ fill: "#7f9188", fontSize: 12 }}
                label={{
                  value: "tokens per completed ticket",
                  fill: "#7f9188",
                  position: "insideBottom",
                  offset: -20,
                }}
              />
              <YAxis
                type="number"
                dataKey="price"
                name="Price per completion"
                stroke="#7f9188"
                tick={{ fill: "#7f9188", fontSize: 12 }}
                tickFormatter={(value) => `$${Number(value).toFixed(3)}`}
                label={{
                  value: "estimated $ per completed ticket",
                  fill: "#7f9188",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <ZAxis type="number" dataKey="completed" range={[80, 240]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value, name) => {
                  if (name === "Price per completion") {
                    return [`$${Number(value).toFixed(6)}`, name];
                  }
                  return [Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 }), name];
                }}
                contentStyle={{
                  background: "#121a16",
                  border: "1px solid #243028",
                  borderRadius: 12,
                }}
              />
              <Scatter data={chartData} fill="#00E599" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <RankingTable
          title="Fewest tokens per completion"
          description="Ordered from least to most total tokens spent per completed ticket."
          models={tokenRanking}
          value={(model) =>
            `${Math.round(tokensPerCompletion(model) ?? 0).toLocaleString()} tokens`
          }
        />
        <RankingTable
          title="Lowest price per completion"
          description="Ordered from lowest to highest estimated price per completed ticket."
          models={priceRanking}
          value={(model) => `$${(costPerCompletion(model) ?? 0).toFixed(6)}`}
        />
      </section>

      <p className="mt-6 text-xs leading-relaxed text-ledger-muted">
        Green marks the top three. Red marks the bottom three. Models without
        published pricing stay in the token table but are omitted from the price ranking.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ledger-border bg-ledger-panel/70 px-5 py-5">
      <p className="text-xs uppercase tracking-[0.18em] text-ledger-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl text-ledger-cream">{value}</p>
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
                {model.successes}/{model.attempts} tickets completed
              </span>
            </span>
            <span className="font-mono text-sm text-ledger-cream">{value(model)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
