import type { BenchmarkSummary, ModelAggregate } from "@/lib/types";
import { DetailedMethodology } from "@/components/DetailedMethodology";

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
  const completionLeader = [...benchmark.aggregates].sort(
    (a, b) => b.passRate - a.passRate,
  )[0];
  const priceMultiple =
    leader?.costPerSuccessUsd && last?.costPerSuccessUsd
      ? last.costPerSuccessUsd / leader.costPerSuccessUsd
      : null;

  return (
    <div>
      <article className="mx-auto max-w-4xl px-6 py-12 lg:px-0">
        <header>
          <p className="text-sm uppercase tracking-[0.3em] text-ledger-muted">
            Report
          </p>
          <h2 className="mt-3 text-4xl font-light text-ledger-cream">
            What does a real workload cost?
          </h2>
          <div className="mt-5 max-w-3xl space-y-4 text-lg leading-relaxed text-ledger-cream/75">
            <p>
              Model catalogs publish prices per token alongside broad performance
              claims. A company pays for the tokens its own workload consumes,
              including requests that return an unusable result.
            </p>
            <p>
              We wanted a concrete proxy for that operating cost. We sent the
              same 100-ticket support workload to every enabled text model, tested
              each response against the same policy contract, and counted the
              tokens spent. The result measures cost per usable output for one
              simple, repeatable business process.
            </p>
          </div>
        </header>

        {leader && last && (
          <section className="mt-10 rounded-2xl border border-ledger-border bg-ledger-panel/75 p-6">
            <h3 className="text-xl font-light text-ledger-cream">
              Cost spread
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ledger-cream/75">
              <span className="font-mono text-neon-green">
                {leader.modelName}
              </span>{" "}
              had the lowest estimated cost per completed task.{" "}
              <span className="font-mono text-red-300">{last.modelName}</span>{" "}
              had the highest among models with published pricing.
              {priceMultiple != null && (
                <> The difference was {priceMultiple.toFixed(1)}×.</>
              )}{" "}
              <span className="font-mono text-ledger-cream">
                {completionLeader.modelName}
              </span>{" "}
              had the highest completion rate at{" "}
              {(completionLeader.passRate * 100).toFixed(0)}%.
            </p>
          </section>
        )}

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <Extremes title="Lowest cost per task" models={top} tone="best" />
          <Extremes title="Highest cost per task" models={bottom} tone="worst" />
        </section>

        <section className="mt-12 space-y-8">
          <Finding title="Every model processed 100 tickets">
            The completion counts are quality results, not request limits. Each
            model received all 100 tickets. A response passed only if it returned
            valid JSON, chose the correct classification and action, made the
            correct escalation decision, included required policy language, and
            avoided forbidden claims. For example, 73/100 means 100 responses
            were produced and 73 passed every check.
          </Finding>
          <Finding title="Failed output still costs money">
            Invalid JSON, a wrong escalation decision, a disallowed action, or a
            missing required fact makes the response unusable. Its tokens remain
            in the total. Cost per completed task is total spend across all 100
            attempts divided by the number of responses that passed.
          </Finding>
          <Finding title="The ranking is workload-specific">
            This run tests short, structured support replies. It does not test
            coding, image generation, or long-context reasoning. The ranking
            answers which model did more for less on this workload, not which
            model is cheapest for every AI feature.
          </Finding>
          <Finding title="Model choice changes margin">
            A team can multiply cost per completed task by monthly task volume.
            The difference between two models that meet the product requirement
            becomes gross-margin headroom. AI Gateway keeps the request contract
            fixed while the routed model changes.
          </Finding>
        </section>
      </article>

      <div className="border-t border-ledger-border">
        <DetailedMethodology benchmark={benchmark} />
      </div>
    </div>
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
