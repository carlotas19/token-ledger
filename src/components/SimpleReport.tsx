import type { BenchmarkSummary, ModelAggregate } from "@/lib/types";

interface SimpleReportProps {
  benchmark: BenchmarkSummary;
}

function ranked(models: ModelAggregate[]) {
  return [...models]
    .filter((model) => model.costPerSuccessUsd != null)
    .sort(
      (a, b) =>
        Number(a.costPerSuccessUsd) - Number(b.costPerSuccessUsd),
    );
}

export function SimpleReport({ benchmark }: SimpleReportProps) {
  const models = ranked(benchmark.aggregates);
  const top = models.slice(0, 3);
  const bottom = models.slice(-3).reverse();
  const leader = top[0];
  const last = bottom[0];
  const priceMultiple =
    leader?.costPerSuccessUsd && last?.costPerSuccessUsd
      ? last.costPerSuccessUsd / leader.costPerSuccessUsd
      : null;

  return (
    <article className="mx-auto max-w-4xl px-6 py-12 lg:px-0">
      <header>
        <p className="text-sm uppercase tracking-[0.3em] text-ledger-muted">
          Report
        </p>
        <h2 className="mt-3 text-4xl font-light text-ledger-cream">
          What the run shows
        </h2>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ledger-cream/75">
          The model with the lowest sticker price does not necessarily produce
          the lowest cost per finished job. Output length and failed attempts
          both change the bill. We count all tokens spent, then divide by the
          number of tickets the model completed.
        </p>
      </header>

      {leader && last && (
        <section className="mt-10 rounded-2xl border border-ledger-border bg-ledger-panel/75 p-6">
          <p className="text-sm leading-relaxed text-ledger-cream/75">
            <span className="font-mono text-neon-green">{leader.modelId}</span>{" "}
            had the lowest estimated cost per completed ticket in this run.
            <span className="font-mono text-red-300"> {last.modelId}</span> had
            the highest among models with published pricing.
            {priceMultiple != null && (
              <> The difference was {priceMultiple.toFixed(1)}×.</>
            )}
          </p>
        </section>
      )}

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <Extremes title="Top three" models={top} tone="best" />
        <Extremes title="Bottom three" models={bottom} tone="worst" />
      </section>

      <section className="mt-10 space-y-6">
        <Finding title="Efficiency includes completion rate">
          A short response only counts as efficient if it follows the support
          policy. Invalid JSON, the wrong escalation decision, a disallowed
          action, or a missing required fact means the ticket was not completed.
          The tokens from that attempt remain in the model total.
        </Finding>
        <Finding title="The result is workload-specific">
          This run tests structured support replies, not coding, image generation,
          or long-context reasoning. The ranking answers which model did more for
          less on these 100 tickets. It does not claim one model is cheapest for
          every AI feature.
        </Finding>
        <Finding title="Model choice changes margin">
          A production team can multiply the measured price per completion by its
          monthly task volume. The gap between two suitable models becomes direct
          gross-margin headroom. AI Gateway makes the model switch a routing
          change while the application contract stays fixed.
        </Finding>
      </section>
    </article>
  );
}

function Extremes({
  title,
  models,
  tone,
}: {
  title: string;
  models: ModelAggregate[];
  tone: "best" | "worst";
}) {
  return (
    <div className="rounded-2xl border border-ledger-border bg-ledger-panel/70 p-5">
      <h3 className="text-xl font-light text-ledger-cream">{title}</h3>
      <ol className="mt-4 space-y-3">
        {models.map((model, index) => (
          <li key={model.modelId} className="flex items-center justify-between gap-4">
            <span className="font-mono text-sm text-ledger-cream">
              {index + 1}. {model.modelId}
            </span>
            <span
              className={`font-mono text-sm ${
                tone === "best" ? "text-neon-green" : "text-red-300"
              }`}
            >
              ${model.costPerSuccessUsd?.toFixed(6)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Finding({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-2xl font-light text-ledger-cream">{title}</h3>
      <p className="mt-3 leading-relaxed text-ledger-cream/75">{children}</p>
    </section>
  );
}
