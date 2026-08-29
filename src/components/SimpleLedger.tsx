"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
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

function tokensPerCompletion(model?: ModelAggregate) {
  if (!model) return null;
  return model.tokensPerSuccess ??
    (model.successes > 0 ? model.totalTokens / model.successes : null);
}

function costPerCompletion(model?: ModelAggregate) {
  if (!model) return null;
  return model.costPerSuccessUsd;
}

function formatDuration(milliseconds?: number | null) {
  if (milliseconds == null) return "Not recorded";
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${(seconds % 60).toFixed(0)}s`;
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

const OPEN_WEIGHT_FILL = "#E8C547";
const OPEN_WEIGHT_STROKE = "#FFE58A";
const FRONTIER_FILL = "#00E599";
const FRONTIER_STROKE = "#74ffd0";
const SELECTED_FILL = "#fb923c";
const SELECTED_STROKE = "#fed7aa";

function bubbleColors(openWeights: boolean, selected: boolean) {
  if (selected) {
    return { fill: SELECTED_FILL, stroke: SELECTED_STROKE };
  }
  return openWeights
    ? { fill: OPEN_WEIGHT_FILL, stroke: OPEN_WEIGHT_STROKE }
    : { fill: FRONTIER_FILL, stroke: FRONTIER_STROKE };
}

type ChartPoint = {
  modelId: string;
  model: string;
  provider: string;
  openWeights: boolean;
  tokens: number;
  price: number | null;
  completed: number;
  attempted: number;
  tokensPerTicket: number | null;
  costPerTicket: number | null;
  workloadCostRank: number | null;
  workloadCostRankTotal: number;
  costPerTicketRank: number | null;
  costPerTicketRankTotal: number;
  workloadTokenRank: number | null;
  passRateRank: number | null;
  workloadDurationMs: number | null;
  medianLatencyMs: number;
  p95LatencyMs: number | null;
  workloadDurationRank: number | null;
  workloadDurationRankTotal: number;
};

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function SimpleLedger({ benchmark }: SimpleLedgerProps) {
  const [modelQuery, setModelQuery] = useState("");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isModelListOpen, setIsModelListOpen] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [pinnedBubble, setPinnedBubble] = useState<{ x: number; y: number } | null>(
    null,
  );
  const chartRef = useRef<HTMLDivElement>(null);
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
  const workloadDurationRanking = rankModels(
    benchmark.aggregates,
    (model) => model.totalWorkloadDurationMs,
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
  const chartData = benchmark.aggregates
    .map((model) => ({
      modelId: model.modelId,
      model: model.modelName,
      provider: model.provider,
      openWeights: model.openWeights,
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
      workloadDurationMs: model.totalWorkloadDurationMs ?? null,
      medianLatencyMs: model.medianLatencyMs ?? 0,
      p95LatencyMs: model.p95LatencyMs ?? null,
      workloadDurationRank: rankOf(workloadDurationRanking, model.modelId),
      workloadDurationRankTotal: workloadDurationRanking.length,
    }))
    .filter((model): model is ChartPoint => model.price != null);
  const selectedPoint = chartData.find(
    (model) => model.modelId === selectedModelId,
  );

  useLayoutEffect(() => {
    if (!selectedModelId) {
      setPinnedBubble(null);
      return;
    }

    let attempts = 0;
    let frame = 0;
    const locate = () => {
      const selected = chartRef.current?.querySelector(
        "circle[data-selected='true']",
      );
      if (selected instanceof SVGCircleElement) {
        const x = selected.cx.baseVal.value;
        const y = selected.cy.baseVal.value;
        setPinnedBubble((current) =>
          current && current.x === x && current.y === y ? current : { x, y },
        );
        return;
      }
      if (attempts < 20) {
        attempts += 1;
        frame = requestAnimationFrame(locate);
      }
    };

    locate();
    return () => cancelAnimationFrame(frame);
  }, [selectedModelId, selectedPoint?.tokens, selectedPoint?.price]);

  function selectModel(model: ModelAggregate) {
    setSelectedModelId(model.modelId);
    setModelQuery(model.modelName);
    setIsModelListOpen(false);
    setActiveResultIndex(0);
  }

  function selectChartPoint(point: {
    modelId?: string;
    payload?: { modelId?: string };
  }) {
    const modelId = point.modelId ?? point.payload?.modelId;
    const model = benchmark.aggregates.find(
      (aggregate) => aggregate.modelId === modelId,
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
                      <span className="flex min-w-0 items-start gap-2">
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                          style={{
                            background: model.openWeights
                              ? OPEN_WEIGHT_FILL
                              : FRONTIER_FILL,
                          }}
                          aria-hidden="true"
                        />
                        <span>
                          <span className="block font-mono text-sm">
                            {model.modelName}
                          </span>
                          <span className="mt-0.5 block text-xs text-ledger-muted">
                            {model.provider} ·{" "}
                            {model.openWeights ? "open-weight" : "frontier"}
                          </span>
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
              <div
                ref={chartRef}
                className="relative h-[460px] overflow-visible"
              >
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
                    content={({ active, payload }) => (
                      <ChartTooltip
                        active={active}
                        payload={payload}
                        selectedModelId={selectedModelId}
                      />
                    )}
                    isAnimationActive={false}
                  />
                    <Scatter
                      data={chartData}
                      fill={OPEN_WEIGHT_FILL}
                      fillOpacity={0.7}
                      stroke={OPEN_WEIGHT_STROKE}
                      strokeWidth={1}
                      isAnimationActive={false}
                      className="cursor-pointer"
                      shape={
                        ((props: {
                          cx?: number;
                          cy?: number;
                          size?: number;
                          payload?: ChartPoint;
                        }) => {
                          const isSelected =
                            props.payload?.modelId === selectedModelId;
                          const colors = bubbleColors(
                            Boolean(props.payload?.openWeights),
                            isSelected,
                          );
                          const radius = Math.sqrt(
                            Math.max(Number(props.size) || 0, 0) / Math.PI,
                          );
                          return (
                            <circle
                              cx={props.cx}
                              cy={props.cy}
                              r={radius}
                              data-selected={isSelected ? "true" : undefined}
                              fill={colors.fill}
                              fillOpacity={isSelected ? 1 : 0.7}
                              stroke={colors.stroke}
                              strokeWidth={isSelected ? 3 : 1}
                              className="cursor-pointer"
                            />
                          );
                        }) as never
                      }
                      onClick={(point) =>
                        selectChartPoint(
                          point as {
                            modelId?: string;
                            payload?: { modelId?: string };
                          },
                        )
                      }
                    />
                  </ScatterChart>
                </ResponsiveContainer>
                {selectedPoint && pinnedBubble && (
                  <div
                    className="pointer-events-none absolute z-10"
                    style={{
                      left: pinnedBubble.x,
                      top: pinnedBubble.y,
                      transform: "translate(12px, -16px)",
                    }}
                  >
                    <ModelInfoCard point={selectedPoint} highlighted />
                  </div>
                )}
              </div>
            </div>
            <p className="mt-2 text-center text-xs uppercase tracking-[0.16em] text-ledger-muted">
              Total tokens for the full 100-ticket workload
            </p>
            <p className="mt-3 text-center text-[11px] uppercase tracking-[0.14em] text-ledger-muted/70">
              Logarithmic scale
            </p>
            <div className="mt-4 flex items-center justify-center gap-5 text-[11px] uppercase tracking-[0.14em] text-ledger-muted">
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: OPEN_WEIGHT_FILL }}
                />
                Open-weight
              </span>
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: FRONTIER_FILL }}
                />
                Frontier
              </span>
            </div>
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

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
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
        <RankingTable
          title="Fastest 100-ticket workload"
          description="Sum of measured request latency across 100 sequential tickets."
          models={workloadDurationRanking}
          value={(model) => formatDuration(model.totalWorkloadDurationMs)}
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
  selectedModelId,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ChartPoint }>;
  selectedModelId: string | null;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point || point.modelId === selectedModelId) return null;
  return <ModelInfoCard point={point} />;
}

function ModelInfoCard({
  point,
  highlighted = false,
}: {
  point: ChartPoint;
  highlighted?: boolean;
}) {
  const family = point.openWeights ? "open" : "frontier";
  const cardTone = highlighted
    ? "border-orange-400/50 bg-[#140c07]"
    : family === "open"
      ? "border-neon-yellow/50 bg-[#120f06]"
      : "border-neon-green/40 bg-[#070b09]";
  const titleTone = highlighted
    ? "text-orange-300"
    : family === "open"
      ? "text-neon-yellow"
      : "text-neon-green";
  const dividerTone = highlighted
    ? "border-orange-400/20"
    : family === "open"
      ? "border-neon-yellow/20"
      : "border-ledger-border";
  const rankTone = highlighted
    ? "text-orange-200"
    : family === "open"
      ? "text-neon-yellow"
      : "text-ledger-cream";

  return (
    <div className={`min-w-64 rounded-xl border p-4 text-xs shadow-2xl ${cardTone}`}>
      <p className={`font-mono text-sm ${titleTone}`}>{point.model}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-ledger-muted">
        {point.openWeights ? "Open-weight" : "Frontier"}
      </p>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-5 gap-y-2">
        <dt className="text-ledger-muted">Total workload tokens</dt>
        <dd className="font-mono text-ledger-cream">
          {Math.round(point.tokens).toLocaleString()}
        </dd>
        <dt className="text-ledger-muted">Published workload cost</dt>
        <dd className="font-mono text-ledger-cream">
          {point.price != null ? `$${point.price.toFixed(6)}` : "Not priced"}
        </dd>
        <dt className="text-ledger-muted">Responses passed</dt>
        <dd className="font-mono text-ledger-cream">
          {point.completed}/{point.attempted}
        </dd>
        <dt className="text-ledger-muted">100-ticket run time</dt>
        <dd className="font-mono text-ledger-cream">
          {formatDuration(point.workloadDurationMs)}
        </dd>
        <dt className="text-ledger-muted">Median ticket latency</dt>
        <dd className="font-mono text-ledger-cream">
          {formatDuration(point.medianLatencyMs)}
        </dd>
        <dt className="text-ledger-muted">P95 ticket latency</dt>
        <dd className="font-mono text-ledger-cream">
          {formatDuration(point.p95LatencyMs)}
        </dd>
        <dt className={`border-t pt-2 text-ledger-muted ${dividerTone}`}>
          Tokens per completed ticket
        </dt>
        <dd
          className={`border-t pt-2 font-mono text-ledger-cream ${dividerTone}`}
        >
          {Math.round(point.tokensPerTicket ?? 0).toLocaleString()}
        </dd>
        <dt className="text-ledger-muted">Cost per completed ticket</dt>
        <dd className="font-mono text-ledger-cream">
          ${Number(point.costPerTicket ?? 0).toFixed(6)}
        </dd>
        <dt className={`border-t pt-2 text-ledger-muted ${dividerTone}`}>
          Workload cost rank
        </dt>
        <dd className={`border-t pt-2 font-mono ${dividerTone} ${rankTone}`}>
          #{point.workloadCostRank ?? "n/a"}/{point.workloadCostRankTotal}
        </dd>
        <dt className="text-ledger-muted">Cost per completed ticket rank</dt>
        <dd className={`font-mono ${rankTone}`}>
          #{point.costPerTicketRank ?? "n/a"}/{point.costPerTicketRankTotal}
        </dd>
        <dt className="text-ledger-muted">Workload time rank</dt>
        <dd className={`font-mono ${rankTone}`}>
          #{point.workloadDurationRank ?? "n/a"}/
          {point.workloadDurationRankTotal}
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
