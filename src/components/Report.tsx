"use client";

import { useMemo, useState } from "react";
import type { BenchmarkSummary } from "@/lib/types";

interface ReportProps {
  benchmark: BenchmarkSummary;
}

export function Report({ benchmark }: ReportProps) {
  const [monthlyTickets, setMonthlyTickets] = useState(10000);
  const [selectedModelId, setSelectedModelId] = useState(
    benchmark.aggregates[0]?.modelId ?? "",
  );

  const selected = benchmark.aggregates.find((row) => row.modelId === selectedModelId);
  const cheapest = useMemo(
    () =>
      [...benchmark.aggregates].sort(
        (a, b) =>
          (a.costPerThousandSuccessesUsd ?? Number.POSITIVE_INFINITY) -
          (b.costPerThousandSuccessesUsd ?? Number.POSITIVE_INFINITY),
      )[0],
    [benchmark.aggregates],
  );

  const monthlySpend =
    ((selected?.costPerThousandSuccessesUsd ?? 0) * monthlyTickets) / 1000;
  const cheapestMonthlySpend =
    ((cheapest?.costPerThousandSuccessesUsd ?? 0) * monthlyTickets) / 1000;
  const delta = monthlySpend - cheapestMonthlySpend;

  const insights = [
    {
      title: "Tokens are a unit cost, not a vanity metric",
      body: "A model that uses fewer tokens but fails the task still burns money on retries, escalations, and human cleanup. Token Ledger ranks models only after they pass deterministic checks.",
    },
    {
      title: "Price per token is only half the equation",
      body: "Some models answer in fewer tokens. Others need longer replies or extra reasoning tokens. The scatter plot shows models that are both accurate enough and cheap enough for production routing.",
    },
    {
      title: "Open-weight models can win on economics",
      body: "When pass rates are close, lower per-token pricing and shorter completions can beat larger frontier models on monthly spend. The leaderboard makes that tradeoff visible.",
    },
    {
      title: "AI Gateway turns comparison into routing",
      body: "Because every model shares one credential and one chat-completions interface, the cheapest passing model is a config change, not a migration project.",
    },
  ];

  return (
    <article className="mx-auto max-w-4xl px-6 py-12 lg:px-0">
      <header className="mb-10">
        <p className="text-sm uppercase tracking-[0.3em] text-ledger-muted">Report</p>
        <h2 className="mt-3 text-4xl font-light text-ledger-cream">Token economics thesis</h2>
        <p className="mt-4 text-lg leading-relaxed text-ledger-cream/75">
          Software teams already track gross margin per customer. As AI features ship, they also
          need margin per successful AI outcome. This report translates the benchmark into that
          language.
        </p>
      </header>

      <section className="rounded-2xl border border-ledger-border bg-ledger-panel/70 p-6 backdrop-blur">
        <h3 className="text-xl font-light text-ledger-cream">Business calculator</h3>
        <p className="mt-2 text-sm text-ledger-muted">
          Estimate monthly token spend from benchmarked cost per successful ticket resolution.
          Costs use catalog rates from the snapshot date and are labeled as estimates.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <label className="block">
            <span className="text-sm text-ledger-muted">Monthly successful tickets</span>
            <input
              type="range"
              min={1000}
              max={100000}
              step={1000}
              value={monthlyTickets}
              onChange={(event) => setMonthlyTickets(Number(event.target.value))}
              className="mt-3 w-full accent-neon-green"
            />
            <span className="mt-2 block font-mono text-ledger-cream">
              {monthlyTickets.toLocaleString()}
            </span>
          </label>

          <label className="block">
            <span className="text-sm text-ledger-muted">Model</span>
            <select
              value={selectedModelId}
              onChange={(event) => setSelectedModelId(event.target.value)}
              className="mt-3 w-full rounded-lg border border-ledger-border bg-ledger-charcoal px-3 py-2 font-mono text-sm text-ledger-cream"
            >
              {benchmark.aggregates.map((row) => (
                <option key={row.modelId} value={row.modelId}>
                  {row.modelId}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Metric label="Estimated monthly spend" value={`$${monthlySpend.toFixed(2)}`} />
          <Metric
            label="Cheapest passing model"
            value={cheapest ? cheapest.modelId : "—"}
          />
          <Metric
            label="Delta vs cheapest"
            value={`$${delta.toFixed(2)} / month`}
            accent={delta > 0}
          />
        </div>
      </section>

      <section className="mt-12 space-y-6">
        {insights.map((insight) => (
          <div
            key={insight.title}
            className="rounded-2xl border border-ledger-border bg-ledger-panel/50 p-6"
          >
            <h3 className="text-lg text-ledger-cream">{insight.title}</h3>
            <p className="mt-3 leading-relaxed text-ledger-cream/75">{insight.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-12 rounded-2xl border border-ledger-border bg-ledger-panel/70 p-6">
        <h3 className="text-xl font-light text-ledger-cream">What we would publish next</h3>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ledger-cream/75">
          <li>
            A blog post that opens on one ticket replayed across the full catalog, then walks
            through cost per successful resolution and the monthly calculator above.
          </li>
          <li>
            A second task family (SQL generation or changelog drafting) to show that the unit
            economics curve changes by workload.
          </li>
          <li>
            Scheduled reruns stored in Lakebase Postgres so the public URL always reflects a dated
            catalog snapshot.
          </li>
        </ul>
      </section>
    </article>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-ledger-border bg-ledger-charcoal/70 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-ledger-muted">{label}</p>
      <p
        className={`mt-2 font-mono text-xl ${
          accent ? "text-neon-green" : "text-ledger-cream"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
