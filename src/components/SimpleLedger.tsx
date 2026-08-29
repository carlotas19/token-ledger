"use client";

import { useMemo, useState } from "react";
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

function rankOf(models: ModelAggregate[], modelId: string) {
  const index = models.findIndex((model) => model.modelId === modelId);
  return index >= 0 ? index + 1 : null;
}

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function SimpleLedger({ benchmark }: SimpleLedgerProps) {
  const [modelQuery, setModelQuery] = useState("");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isModelListOpen, setIsModelListOpen] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const tokenRanking = rankModels(benchmark.aggregates, tokensPerCompletion);
  const priceRanking = rankModels(benchmark.aggregates, costPerCompletion);
  const workloadTokenRanking = rankModels(
    benchmark.aggregates,
    (model) => model.totalTokens,
  );
  const workloadPriceRanking = rankModels(
    benchmark.aggregates,
    (model) => model.totalCostUsd,
  );
  const workloadTokenLeader = workloadTokenRanking[0];
  const workloadTokenLast =
    workloadTokenRanking[workloadTokenRanking.length - 1];
  const workloadPriceLeader = workloadPriceRanking[0];
  const workloadPriceLast =
    workloadPriceRanking[workloadPriceRanking.length - 1];
  const passRateRanking = [...benchmark.aggregates].sort(
    (a, b) => b.passRate - a.passRate,
  );
  const filteredModels = useMemo(() => {
    const query = normalizeSearch(modelQuery.trim());
    return [...benchmark.aggregates]
      .filter((model) => {
        if (!query) return true;
        return [model.modelName, model.modelId, model.provider].some((value) =>
          normalizeSearch(value).includes(query),
        );
      })
      .sort((a, b) => a.modelName.localeCompare(b.modelName));
  }, [benchmark.aggregates, modelQuery]);
  const selectedModel = benchmark.aggregates.find(
    (model) => model.modelId === selectedModelId,
  );
  const chartData = benchmark.aggregates
    .map((model) => ({
      modelId: model.modelId,
      model: model.modelName,
      provider: model.provider,
      tokens: model.totalTokens,
      price: model.totalCostUsd,
      completed: model.successes,
      attempted: model.attempts,
      tokensPerTicket: tokensPerCompletion(model),
      costPerTicket: costPerCompletion(model),
      workloadCostRank: rankOf(workloadPriceRanking, model.modelId),
      workloadCostRankTotal: workloadPriceRanking.length,
      costPerTicketRank: rankOf(priceRanking, model.modelId),
      costPerTicketRankTotal: priceRanking.length,
      workloadTokenRank: rankOf(workloadTokenRanking, model.modelId),
      passRateRank: rankOf(passRateRanking, model.modelId),
    }))
    .filter((model) => model.tokens != null && model.price != null);
  const selectedChartPoint = chartData.find(
    (model) => model.modelId === selectedModelId,
  );

  function selectModel(model: ModelAggregate) {
    setSelectedModelId(model.modelId);
    setModelQuery(model.modelName);
    setIsModelListOpen(false);
    setActiveResultIndex(0);
  }

  function selectChartPoint(point: { modelId?: string }) {
    const model = benchmark.aggregates.find(
      (aggregate) => aggregate.modelId === point.modelId,
    );
    if (model) selectModel(model);
  }

  function clearSelectedModel() {
    setSelectedModelId(null);
    setModelQuery("");
    setIsModelListOpen(false);
    setActiveResultIndex(0);
  }

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
        <div
          className="relative z-20 mx-auto mb-7 max-w-xl"
          onBlur={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            ) {
              setIsModelListOpen(false);
            }
          }}
        >
          <label
            htmlFor="model-search"
            className="mb-2 block text-xs uppercase tracking-[0.16em] text-ledger-muted"
          >
            Find a model in the chart
          </label>
          <div className="flex items-center rounded-xl border border-ledger-border bg-[#090e0b] transition-colors focus-within:border-neon-green/50">
            <SearchIcon />
            <input
              id="model-search"
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="model-search-results"
              aria-expanded={isModelListOpen}
              aria-activedescendant={
                isModelListOpen && filteredModels[activeResultIndex]
                  ? `model-option-${filteredModels[activeResultIndex].modelId}`
                  : undefined
              }
              value={modelQuery}
              placeholder="Search by model or provider"
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-ledger-cream outline-none placeholder:text-ledger-muted/60"
              onFocus={() => setIsModelListOpen(true)}
              onChange={(event) => {
                setModelQuery(event.target.value);
                setSelectedModelId(null);
                setActiveResultIndex(0);
                setIsModelListOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && filteredModels.length > 0) {
                  event.preventDefault();
                  setIsModelListOpen(true);
                  setActiveResultIndex((index) =>
                    Math.min(index + 1, filteredModels.length - 1),
                  );
                }
                if (event.key === "ArrowUp" && filteredModels.length > 0) {
                  event.preventDefault();
                  setActiveResultIndex((index) => Math.max(index - 1, 0));
                }
                if (
                  event.key === "Enter" &&
                  isModelListOpen &&
                  filteredModels[activeResultIndex]
                ) {
                  event.preventDefault();
                  selectModel(filteredModels[activeResultIndex]);
                }
                if (event.key === "Escape") {
                  setIsModelListOpen(false);
                }
              }}
            />
            {selectedModelId || modelQuery ? (
              <button
                type="button"
                onClick={clearSelectedModel}
                className="p-3 text-ledger-muted transition-colors hover:text-ledger-cream"
                aria-label="Clear model selection"
              >
                <CloseIcon />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (!isModelListOpen) {
                  setModelQuery("");
                  setActiveResultIndex(0);
                }
                setIsModelListOpen((open) => !open);
              }}
              className="border-l border-ledger-border p-3 text-ledger-muted transition-colors hover:text-ledger-cream"
              aria-label={isModelListOpen ? "Hide model list" : "Show all models"}
              aria-expanded={isModelListOpen}
            >
              <ChevronIcon open={isModelListOpen} />
            </button>
          </div>

          {isModelListOpen && (
            <ul
              id="model-search-results"
              role="listbox"
              className="absolute left-0 right-0 top-full mt-2 max-h-72 overflow-y-auto rounded-xl border border-[#405148] bg-[#070b09] p-2 shadow-2xl"
            >
              {filteredModels.length > 0 ? (
                filteredModels.map((model, index) => (
                  <li
                    id={`model-option-${model.modelId}`}
                    key={model.modelId}
                    role="option"
                    aria-selected={index === activeResultIndex}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setActiveResultIndex(index)}
                      onClick={() => selectModel(model)}
                      className={`flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        index === activeResultIndex
                          ? "bg-orange-400/10 text-orange-300"
                          : "text-ledger-cream/80 hover:bg-ledger-panel"
                      }`}
                    >
                      <span>
                        <span className="block font-mono text-sm">
                          {model.modelName}
                        </span>
                        <span className="mt-0.5 block text-xs text-ledger-muted">
                          {model.provider} · {model.modelId}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-ledger-muted">
                        {model.successes}/{model.attempts}
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-4 text-sm text-ledger-muted">
                  No models match “{modelQuery}”.
                </li>
              )}
            </ul>
          )}
        </div>

        {selectedModel && (
          <SelectedModelCard
            model={selectedModel}
            workloadCostRank={rankOf(workloadPriceRanking, selectedModel.modelId)}
            workloadCostRankTotal={workloadPriceRanking.length}
            costPerTicketRank={rankOf(priceRanking, selectedModel.modelId)}
            costPerTicketRankTotal={priceRanking.length}
            workloadTokenRank={rankOf(workloadTokenRanking, selectedModel.modelId)}
            passRateRank={rankOf(passRateRanking, selectedModel.modelId)}
            modelCount={benchmark.modelCount}
            onClear={clearSelectedModel}
          />
        )}

        <div className="grid items-center gap-6 lg:grid-cols-[12rem_minmax(0,1fr)_12rem]">
          <div className="space-y-4">
            <OutcomeCallout
              label="Lowest workload token use"
              model={workloadTokenLeader?.modelName}
              value={`${Math.round(workloadTokenLeader?.totalTokens ?? 0).toLocaleString()} tokens`}
              tone="best"
            />
            <OutcomeCallout
              label="Lowest 100-ticket workload cost"
              model={workloadPriceLeader?.modelName}
              value={`$${(workloadPriceLeader?.totalCostUsd ?? 0).toFixed(6)}`}
              tone="best"
            />
          </div>

          <div>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
              <p className="rotate-180 text-center text-[10px] uppercase tracking-[0.14em] text-ledger-muted [writing-mode:vertical-rl]">
                Published cost for the full 100-ticket workload
              </p>
              <div className="h-[460px]">
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
                    domain={[30, 80]}
                    range={[40, 1800]}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={<ChartTooltip />}
                  />
                    <Scatter
                      data={chartData}
                      fill="#00E599"
                      fillOpacity={0.7}
                      stroke="#74ffd0"
                      strokeWidth={1}
                      className="cursor-pointer"
                      onClick={(point) =>
                        selectChartPoint(point as { modelId?: string })
                      }
                    />
                    {selectedChartPoint && (
                      <Scatter
                        data={[selectedChartPoint]}
                        fill="#fb923c"
                        fillOpacity={1}
                        stroke="#fed7aa"
                        strokeWidth={4}
                        className="cursor-pointer"
                        onClick={(point) =>
                          selectChartPoint(point as { modelId?: string })
                        }
                      />
                    )}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
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
              label="Highest workload token use"
              model={workloadTokenLast?.modelName}
              value={`${Math.round(workloadTokenLast?.totalTokens ?? 0).toLocaleString()} tokens`}
              tone="worst"
            />
            <OutcomeCallout
              label="Highest 100-ticket workload cost"
              model={workloadPriceLast?.modelName}
              value={`$${(workloadPriceLast?.totalCostUsd ?? 0).toFixed(6)}`}
              tone="worst"
            />
          </div>
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-ledger-muted">
          Bubble area shows how many responses passed. Prices use the{" "}
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
    workloadCostRank: number | null;
    workloadCostRankTotal: number;
    costPerTicketRank: number | null;
    costPerTicketRankTotal: number;
    workloadTokenRank: number;
    passRateRank: number;
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
        <dt className="border-t border-ledger-border pt-2 text-ledger-muted">
          Workload cost rank
        </dt>
        <dd className="border-t border-ledger-border pt-2 font-mono text-ledger-cream">
          #{point.workloadCostRank ?? "n/a"}/{point.workloadCostRankTotal}
        </dd>
        <dt className="text-ledger-muted">Cost per completed ticket rank</dt>
        <dd className="font-mono text-ledger-cream">
          #{point.costPerTicketRank ?? "n/a"}/{point.costPerTicketRankTotal}
        </dd>
      </dl>
    </div>
  );
}

function SelectedModelCard({
  model,
  workloadCostRank,
  workloadCostRankTotal,
  costPerTicketRank,
  costPerTicketRankTotal,
  workloadTokenRank,
  passRateRank,
  modelCount,
  onClear,
}: {
  model: ModelAggregate;
  workloadCostRank: number | null;
  workloadCostRankTotal: number;
  costPerTicketRank: number | null;
  costPerTicketRankTotal: number;
  workloadTokenRank: number | null;
  passRateRank: number | null;
  modelCount: number;
  onClear: () => void;
}) {
  return (
    <div className="mb-8 rounded-2xl border border-orange-400/40 bg-orange-400/[0.06] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-orange-300">
            Selected model
          </p>
          <h2 className="mt-2 font-mono text-xl text-ledger-cream">
            {model.modelName}
          </h2>
          <p className="mt-1 text-xs text-ledger-muted">
            {model.provider} · {model.modelId}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-orange-400/25 p-2 text-orange-200 transition-colors hover:bg-orange-400/10"
          aria-label={`Clear ${model.modelName} selection`}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectedMetric
          label="Published workload cost"
          value={
            model.totalCostUsd != null
              ? `$${model.totalCostUsd.toFixed(6)}`
              : "Not priced"
          }
        />
        <SelectedMetric
          label="Total workload tokens"
          value={model.totalTokens.toLocaleString()}
        />
        <SelectedMetric
          label="Responses passed"
          value={`${model.successes}/${model.attempts}`}
        />
        <SelectedMetric
          label="Cost per completed ticket"
          value={
            model.costPerSuccessUsd != null
              ? `$${model.costPerSuccessUsd.toFixed(6)}`
              : "Not priced"
          }
        />
      </div>

      <div className="mt-5 grid gap-2 border-t border-orange-400/20 pt-4 text-sm sm:grid-cols-2">
        <p className="text-ledger-cream/80">
          <span className="font-mono text-orange-300">
            {costPerTicketRank ?? "n/a"}/{costPerTicketRankTotal}
          </span>{" "}
          model in cost per completed ticket
        </p>
        <p className="text-ledger-cream/80">
          <span className="font-mono text-orange-300">
            {workloadCostRank ?? "n/a"}/{workloadCostRankTotal}
          </span>{" "}
          model in published workload cost
        </p>
        <p className="text-ledger-cream/80">
          <span className="font-mono text-orange-300">
            {workloadTokenRank ?? "n/a"}/{modelCount}
          </span>{" "}
          model in total token use
        </p>
        <p className="text-ledger-cream/80">
          <span className="font-mono text-orange-300">
            {passRateRank ?? "n/a"}/{modelCount}
          </span>{" "}
          model in pass rate
        </p>
      </div>
    </div>
  );
}

function SelectedMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-orange-400/15 bg-[#090e0b]/70 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-ledger-muted">
        {label}
      </p>
      <p className="mt-2 font-mono text-sm text-ledger-cream">{value}</p>
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

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="ml-3 h-4 w-4 shrink-0 text-ledger-muted"
    >
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path
        d="m7 7 10 10M17 7 7 17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="m7 10 5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
