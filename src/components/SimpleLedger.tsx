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

function tokensPerCompletion(model?: ModelAggregate) {
  if (!model) return null;
  return model.tokensPerSuccess ??
    (model.successes > 0 ? model.totalTokens / model.successes : null);
}

function costPerCompletion(model?: ModelAggregate) {
  if (!model) return null;
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
      tokens: model.totalTokens,
      price: model.totalCostUsd,
      completed: model.successes,
      attempted: model.attempts,
      tokensPerTicket: tokensPerCompletion(model),
      costPerTicket: costPerCompletion(model),
    }))
    .filter((model) => model.tokens != null && model.price != null);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:px-0">
      <section className="rounded-xl border border-neon-green/20 bg-neon-green/[0.04] px-5 py-5">
        <p className="text-sm leading-relaxed text-ledger-cream/80">
          <span className="text-ledger-cream">The prompt:</span>{" "}
          “Use an LLM to reply to 100 support tickets.” Every model attempted all
          100 tickets, and each run stopped after the 100th response. A completed
          ticket is a response that passed every deterministic policy and format
          check. Failed responses still count toward the workload’s token use and
          cost.
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-ledger-border bg-ledger-panel/75 p-5 md:p-8">
        <div className="grid items-center gap-6 lg:grid-cols-[12rem_minmax(0,1fr)_12rem]">
          <div className="space-y-4">
            <OutcomeCallout
              label="Fewest tokens per completed ticket"
              model={tokenLeader?.modelName}
              value={`${Math.round(tokensPerCompletion(tokenLeader) ?? 0).toLocaleString()} tokens`}
              tone="best"
            />
            <OutcomeCallout
              label="Lowest cost per completed ticket"
              model={priceLeader?.modelName}
              value={`$${(costPerCompletion(priceLeader) ?? 0).toFixed(6)}`}
              tone="best"
            />
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-ledger-muted">
              Published cost for the full 100-ticket workload
            </p>
            <div className="mt-2 h-[460px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 15, right: 20, bottom: 22, left: 25 }}>
                  <CartesianGrid stroke="rgba(127,145,136,0.14)" />
                  <XAxis
                    type="number"
                    dataKey="tokens"
                    name="Total tokens for 100 tickets"
                    scale="log"
                    domain={["auto", "auto"]}
                    stroke="#7f9188"
                    tick={{ fill: "#7f9188", fontSize: 11 }}
                    tickFormatter={(value) =>
                      Number(value).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })
                    }
                  />
                  <YAxis
                    type="number"
                    dataKey="price"
                    name="Published cost for 100 tickets"
                    scale="log"
                    domain={["auto", "auto"]}
                    stroke="#7f9188"
                    tick={{ fill: "#7f9188", fontSize: 11 }}
                    width={62}
                    tickFormatter={(value) => `$${Number(value).toFixed(3)}`}
                  />
                  <ZAxis
                    type="number"
                    dataKey="completed"
                    name="Tickets completed"
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
              Total tokens for the full 100-ticket workload
            </p>
            <p className="mt-3 text-center text-[11px] uppercase tracking-[0.14em] text-ledger-muted/70">
              Logarithmic scale
            </p>
          </div>

          <div className="space-y-4">
            <OutcomeCallout
              label="Most tokens per completed ticket"
              model={tokenLast?.modelName}
              value={`${Math.round(tokensPerCompletion(tokenLast) ?? 0).toLocaleString()} tokens`}
              tone="worst"
            />
            <OutcomeCallout
              label="Highest cost per completed ticket"
              model={priceLast?.modelName}
              value={`$${(costPerCompletion(priceLast) ?? 0).toFixed(6)}`}
              tone="worst"
            />
          </div>
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-ledger-muted">
          Bubble size shows how many responses passed. Prices use the{" "}
          <a
            href={
              benchmark.pricingSource ??
              "https://neon.com/docs/ai-gateway/models#available-models"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-neon-green underline decoration-neon-green/30 underline-offset-4"
          >
            published Neon AI Gateway rates
          </a>
          .
        </p>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <RankingTable
          title="Fewest tokens per completed ticket"
          description="All tokens from 100 attempts divided by responses that passed."
          models={tokenRanking}
          value={(model) =>
            `${Math.round(tokensPerCompletion(model) ?? 0).toLocaleString()} tokens`
          }
        />
        <RankingTable
          title="Lowest cost per completed ticket"
          description="Cost at published prices for 100 attempts divided by responses that passed."
          models={priceRanking}
          value={(model) => `$${(costPerCompletion(model) ?? 0).toFixed(6)}`}
        />
      </section>

      <p className="mt-6 text-xs leading-relaxed text-ledger-muted">
        Green marks the top three. Red marks the bottom three. Prices were
        verified{" "}
        {new Date(
          benchmark.pricingSnapshotAt ?? benchmark.catalogSnapshotAt,
        ).toLocaleDateString()}.
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
    tokensPerTicket: number;
    costPerTicket: number;
  };

  return (
    <div className="min-w-64 rounded-xl border border-[#405148] bg-[#070b09] p-4 text-xs shadow-2xl">
      <p className="font-mono text-sm text-neon-green">{point.model}</p>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-5 gap-y-2">
        <dt className="text-ledger-muted">Total workload tokens</dt>
        <dd className="font-mono text-ledger-cream">
          {Math.round(point.tokens).toLocaleString()}
        </dd>
        <dt className="text-ledger-muted">Published workload cost</dt>
        <dd className="font-mono text-ledger-cream">
          ${point.price.toFixed(6)}
        </dd>
        <dt className="text-ledger-muted">Responses passed</dt>
        <dd className="font-mono text-ledger-cream">
          {point.completed}/{point.attempted}
        </dd>
        <dt className="border-t border-ledger-border pt-2 text-ledger-muted">
          Tokens per completed ticket
        </dt>
        <dd className="border-t border-ledger-border pt-2 font-mono text-ledger-cream">
          {Math.round(point.tokensPerTicket).toLocaleString()}
        </dd>
        <dt className="text-ledger-muted">Cost per completed ticket</dt>
        <dd className="font-mono text-ledger-cream">
          ${point.costPerTicket.toFixed(6)}
        </dd>
      </dl>
    </div>
  );
}

function OutcomeCallout({
  label,
  model,
  value,
  tone,
}: {
  label: string;
  model?: string;
  value: string;
  tone: "best" | "worst";
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tone === "best"
          ? "border-neon-green/25 bg-neon-green/[0.04]"
          : "border-red-400/20 bg-red-400/[0.04]"
      }`}
    >
      <p className="text-[10px] uppercase leading-relaxed tracking-[0.14em] text-ledger-muted">
        {label}
      </p>
      <p
        className={`mt-2 font-mono text-xs ${
          tone === "best" ? "text-neon-green" : "text-red-300"
        }`}
      >
        {model}
      </p>
      <p className="mt-1 font-mono text-xs text-ledger-cream/70">{value}</p>
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
