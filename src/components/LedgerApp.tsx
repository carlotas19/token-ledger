"use client";

import { useMemo, useState } from "react";
import type { BenchmarkSummary, Tab } from "@/lib/types";
import { TabNav } from "@/components/TabNav";
import { SimpleLedger } from "@/components/SimpleLedger";
import { SimpleReport } from "@/components/SimpleReport";
import { DetailedMethodology } from "@/components/DetailedMethodology";
import { NeonBadge } from "@/components/NeonBadge";

interface LedgerAppProps {
  benchmark: BenchmarkSummary;
}

export function LedgerApp({ benchmark }: LedgerAppProps) {
  const [activeTab, setActiveTab] = useState<Tab>("results");
  const isDemo = benchmark.id === "demo";

  const leaders = useMemo(() => {
    const priced = benchmark.aggregates
      .filter((model) => model.costPerSuccessUsd != null)
      .sort(
        (a, b) =>
          Number(a.costPerSuccessUsd) - Number(b.costPerSuccessUsd),
      );
    const byTokens = [...benchmark.aggregates].sort(
      (a, b) =>
        (a.tokensPerSuccess ?? a.totalTokens / a.successes) -
        (b.tokensPerSuccess ?? b.totalTokens / b.successes),
    );
    const byPassRate = [...benchmark.aggregates].sort(
      (a, b) => b.passRate - a.passRate,
    );
    const topPassRate = byPassRate[0]?.passRate;
    const completionLeaders = byPassRate.filter(
      (model) => model.passRate === topPassRate,
    );
    return {
      cost: priced[0],
      tokens: byTokens[0],
      completion: completionLeaders[0],
      completionNames: completionLeaders
        .map((model) => model.modelName)
        .join(" + "),
      completionCount: completionLeaders.length,
    };
  }, [benchmark.aggregates]);

  return (
    <div className="grain dot-grid min-h-screen">
      <header className="border-b border-ledger-border px-6 py-10 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-start justify-between gap-6">
            <p className="animate-fade-in text-sm uppercase tracking-[0.35em] text-ledger-muted">
              A small, practical benchmark of AI models
            </p>
            <a
              href="https://github.com/carlotas19/token-ledger"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 text-xs text-ledger-muted transition-colors hover:text-ledger-cream"
              aria-label="Check out the Tokenomics benchmark code on GitHub"
            >
              <GitHubIcon />
              <span className="hidden sm:inline">Check out the code</span>
            </a>
          </div>
          <h1 className="mt-4 animate-fade-in text-5xl font-light tracking-tight text-ledger-cream lg:text-7xl">
            Tokenomics, measured
          </h1>
          <p className="mt-4 max-w-3xl animate-fade-in text-lg leading-relaxed text-ledger-cream/75">
            Some models are cheaper than others. But do they actually save you
            money? We ran a simulated support workload through 28 open-weight
            and frontier models on Neon AI Gateway, then measured how many tokens
            and dollars it took to produce usable answers.
          </p>
          <div className="mt-6 grid max-w-5xl gap-3 sm:grid-cols-3">
            {leaders.cost && (
              <Leader
                label="Lowest cost per completed ticket"
                model={leaders.cost.modelName}
                value={`$${Number(leaders.cost.costPerSuccessUsd).toFixed(6)} at published AI Gateway prices`}
              />
            )}
            {leaders.tokens && (
              <Leader
                label="Fewest tokens per completed ticket"
                model={leaders.tokens.modelName}
                value={`${Math.round(
                  leaders.tokens.tokensPerSuccess ??
                    leaders.tokens.totalTokens / leaders.tokens.successes,
                ).toLocaleString()} tokens`}
              />
            )}
            {leaders.completion && (
              <Leader
                label={
                  leaders.completionCount > 1
                    ? "Joint-highest pass rate"
                    : "Highest pass rate"
                }
                model={leaders.completionNames}
                value={`${(leaders.completion.passRate * 100).toFixed(0)}% of responses passed every check`}
              />
            )}
          </div>
          {isDemo && (
            <p className="mt-3 rounded-md border border-neon-green/20 bg-neon-green/5 px-3 py-2 text-sm text-neon-green">
              Showing demo data until the first benchmark run is stored in Lakebase Postgres.
            </p>
          )}
          <div className="mt-10">
            <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
        </div>
      </header>

      <main>
        {activeTab === "results" && <SimpleLedger benchmark={benchmark} />}
        {activeTab === "report" && <SimpleReport benchmark={benchmark} />}
        {activeTab === "reproduce" && (
          <DetailedMethodology benchmark={benchmark} />
        )}
      </main>

      <footer className="border-t border-ledger-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
          <p className="text-sm tracking-wide text-ledger-muted">
            Tokenomics, measured · Neon AI Gateway benchmark · Prices verified{" "}
            {new Date(
              benchmark.pricingSnapshotAt ?? benchmark.catalogSnapshotAt,
            ).toLocaleDateString()}
          </p>
        </div>
      </footer>

      <NeonBadge />
    </div>
  );
}

function Leader({
  label,
  model,
  value,
}: {
  label: string;
  model: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-neon-green/20 bg-neon-green/[0.04] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-ledger-muted">
        {label}
      </p>
      <p className="mt-2 font-mono text-sm text-neon-green">{model}</p>
      <p className="mt-1 text-xs text-ledger-cream/70">{value}</p>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 fill-current"
    >
      <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.74-1.55-2.57-.29-5.27-1.28-5.27-5.68 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.16 1.18a10.96 10.96 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.82 1.19 3.08 0 4.41-2.71 5.38-5.29 5.67.42.36.79 1.06.79 2.14v3.18c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
    </svg>
  );
}
