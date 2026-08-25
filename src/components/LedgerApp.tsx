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
  const [activeTab, setActiveTab] = useState<Tab>("ledger");
  const isDemo = benchmark.id === "demo";

  const headline = useMemo(() => {
    const sorted = [...benchmark.aggregates].sort(
      (a, b) =>
        (a.costPerThousandSuccessesUsd ?? Number.POSITIVE_INFINITY) -
        (b.costPerThousandSuccessesUsd ?? Number.POSITIVE_INFINITY),
    );
    return sorted[0];
  }, [benchmark.aggregates]);

  return (
    <div className="grain dot-grid min-h-screen">
      <header className="border-b border-ledger-border px-6 py-10 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <p className="animate-fade-in text-sm uppercase tracking-[0.35em] text-ledger-muted">
            Token economics for production AI
          </p>
          <h1 className="mt-4 animate-fade-in text-5xl font-light tracking-tight text-ledger-cream lg:text-7xl">
            Token Ledger
          </h1>
          <p className="mt-4 max-w-3xl animate-fade-in text-lg leading-relaxed text-ledger-cream/75">
            Every business now manages revenue flows and token flows. There is
            significant room for cost savings when picking efficient models. This
            benchmark simulates one representative task and ranks models by how much
            it costs to complete.
          </p>
          <p className="mt-5 max-w-3xl text-sm text-ledger-muted">
            The task we simulate: using an LLM to reply to 100 support tickets.
          </p>
          {headline && (
            <p className="mt-3 max-w-3xl text-sm text-ledger-muted">
              Current run leader on unit economics:{" "}
              <span className="font-mono text-neon-green">{headline.modelId}</span>{" "}
              at{" "}
              <span className="font-mono text-ledger-cream">
                ${headline.costPerThousandSuccessesUsd?.toFixed(2) ?? "—"}
              </span>{" "}
              per 1,000 successful tickets (estimated).
            </p>
          )}
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
        {activeTab === "ledger" && <SimpleLedger benchmark={benchmark} />}
        {activeTab === "report" && <SimpleReport benchmark={benchmark} />}
        {activeTab === "methodology" && (
          <DetailedMethodology benchmark={benchmark} />
        )}
      </main>

      <footer className="border-t border-ledger-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
          <p className="text-sm tracking-wide text-ledger-muted">
            Token Ledger · Neon AI Gateway benchmark · Verified{" "}
            {new Date(benchmark.catalogSnapshotAt).toLocaleDateString()}
          </p>
          <a
            href="https://github.com/carlotas19/token-ledger"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm tracking-wide text-ledger-muted transition-colors hover:text-ledger-cream"
          >
            Source
          </a>
        </div>
      </footer>

      <NeonBadge />
    </div>
  );
}
