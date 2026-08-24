"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { BenchmarkSummary } from "@/lib/types";

interface LedgerDashboardProps {
  benchmark: BenchmarkSummary;
}

export function LedgerDashboard({ benchmark }: LedgerDashboardProps) {
  const leaderboard = [...benchmark.aggregates].sort(
    (a, b) =>
      (a.costPerThousandSuccessesUsd ?? Number.POSITIVE_INFINITY) -
      (b.costPerThousandSuccessesUsd ?? Number.POSITIVE_INFINITY),
  );

  const frontier = leaderboard.map((row) => ({
    model: row.modelId,
    passRate: Number((row.passRate * 100).toFixed(1)),
    costPer1k: Number((row.costPerThousandSuccessesUsd ?? 0).toFixed(2)),
    tokens: row.totalTokens,
    provider: row.provider,
  }));

  const tokenAnatomy = leaderboard.slice(0, 8).map((row) => ({
    model: row.modelId,
    input: row.inputTokens,
    output: row.outputTokens,
    reasoning: row.reasoningTokens,
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:px-0">
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Tickets per model" value={String(benchmark.ticketCount)} />
        <StatCard label="Models tested" value={String(benchmark.modelCount)} />
        <StatCard
          label="Best pass rate"
          value={`${Math.max(...benchmark.aggregates.map((m) => m.passRate * 100)).toFixed(1)}%`}
        />
        <StatCard
          label="Catalog snapshot"
          value={new Date(benchmark.catalogSnapshotAt).toLocaleDateString()}
        />
      </section>

      <section className="mt-12 rounded-2xl border border-ledger-border bg-ledger-panel/70 p-6 backdrop-blur">
        <div className="mb-6">
          <h2 className="text-2xl font-light text-ledger-cream">Efficiency frontier</h2>
          <p className="mt-2 max-w-2xl text-sm text-ledger-muted">
            X-axis is estimated cost per 1,000 successful ticket resolutions. Y-axis is pass
            rate on deterministic checks. The useful models sit high and left.
          </p>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid stroke="rgba(127,145,136,0.15)" />
              <XAxis
                type="number"
                dataKey="costPer1k"
                name="Cost per 1k successes"
                stroke="#7f9188"
                tick={{ fill: "#7f9188", fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="passRate"
                name="Pass rate"
                unit="%"
                stroke="#7f9188"
                tick={{ fill: "#7f9188", fontSize: 12 }}
              />
              <ZAxis type="number" dataKey="tokens" range={[80, 260]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{
                  background: "#121a16",
                  border: "1px solid #243028",
                  borderRadius: 12,
                }}
              />
              <Scatter data={frontier} fill="#00E599" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-ledger-border bg-ledger-panel/70 p-6 backdrop-blur">
          <h2 className="text-xl font-light text-ledger-cream">Token anatomy</h2>
          <p className="mt-2 text-sm text-ledger-muted">
            Input, output, and reported reasoning tokens for the lowest-cost models.
          </p>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tokenAnatomy}>
                <CartesianGrid stroke="rgba(127,145,136,0.15)" />
                <XAxis
                  dataKey="model"
                  stroke="#7f9188"
                  tick={{ fill: "#7f9188", fontSize: 10 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={70}
                />
                <YAxis stroke="#7f9188" tick={{ fill: "#7f9188", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "#121a16",
                    border: "1px solid #243028",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="input" stackId="a" fill="#00E599" />
                <Bar dataKey="output" stackId="a" fill="#7f9188" />
                <Bar dataKey="reasoning" stackId="a" fill="#3d5248" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-ledger-border bg-ledger-panel/70 p-6 backdrop-blur">
          <h2 className="text-xl font-light text-ledger-cream">Leaderboard</h2>
          <p className="mt-2 text-sm text-ledger-muted">
            Sorted by estimated cost per 1,000 successful resolutions.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-ledger-muted">
                <tr className="border-b border-ledger-border">
                  <th className="py-2 pr-3">Model</th>
                  <th className="py-2 pr-3">Pass rate</th>
                  <th className="py-2 pr-3">Tokens</th>
                  <th className="py-2">$/1k successes</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr key={row.modelId} className="border-b border-ledger-border/60">
                    <td className="py-3 pr-3 font-mono text-ledger-cream">{row.modelId}</td>
                    <td className="py-3 pr-3">{(row.passRate * 100).toFixed(1)}%</td>
                    <td className="py-3 pr-3">{row.totalTokens.toLocaleString()}</td>
                    <td className="py-3 font-mono text-neon-green">
                      ${row.costPerThousandSuccessesUsd?.toFixed(2) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ledger-border bg-ledger-panel/60 px-4 py-5 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.2em] text-ledger-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl text-ledger-cream">{value}</p>
    </div>
  );
}
