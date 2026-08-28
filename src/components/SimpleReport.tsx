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

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function SimpleReport({ benchmark }: SimpleReportProps) {
  const models = ranked(benchmark.aggregates);
  const top = models.slice(0, 3);
  const bottom = models.slice(-3).reverse();
  const leader = top[0];
  const last = bottom[0];
  const completionModels = [...benchmark.aggregates].sort(
    (a, b) => b.passRate - a.passRate,
  );
  const completionLeader = completionModels[0];
  const completionLeaders = completionModels.filter(
    (model) => model.passRate === completionLeader.passRate,
  );
  const completionLeaderNames = completionLeaders
    .map((model) => model.modelName)
    .join(" and ");
  const completionLast = [...benchmark.aggregates].sort(
    (a, b) => a.passRate - b.passRate,
  )[0];
  const priceMultiple =
    leader?.costPerSuccessUsd && last?.costPerSuccessUsd
      ? last.costPerSuccessUsd / leader.costPerSuccessUsd
      : null;
  const openModels = benchmark.aggregates.filter((model) => model.openWeights);
  const proprietaryModels = benchmark.aggregates.filter(
    (model) => !model.openWeights,
  );
  const workloadCostRanking = [...benchmark.aggregates]
    .filter((model) => model.totalCostUsd != null)
    .sort((a, b) => Number(a.totalCostUsd) - Number(b.totalCostUsd));
  const workloadTokenRanking = [...benchmark.aggregates].sort(
    (a, b) => a.totalTokens - b.totalTokens,
  );
  const lowestWorkloadCost = workloadCostRanking[0];
  const lowestTokenWorkload = workloadTokenRanking[0];
  const tokenEfficient = [...benchmark.aggregates].sort(
    (a, b) =>
      Number(a.tokensPerSuccess ?? Infinity) -
      Number(b.tokensPerSuccess ?? Infinity),
  )[0];
  const qwenOutlier = benchmark.aggregates.find(
    (model) => model.modelId === "qwen35-122b-a10b",
  );
  const inputTokenRanking = [...benchmark.aggregates].sort(
    (a, b) => a.inputTokens - b.inputTokens,
  );
  const outputTokenRanking = [...benchmark.aggregates].sort(
    (a, b) => a.outputTokens - b.outputTokens,
  );
  const failedChecks = benchmark.aggregates.reduce<Record<string, number>>(
    (totals, model) => {
      for (const [check, count] of Object.entries(model.failedChecks ?? {})) {
        totals[check] = (totals[check] ?? 0) + count;
      }
      return totals;
    },
    {},
  );
  const topFiveOpenCount = models
    .slice(0, 5)
    .filter((model) => model.openWeights).length;

  return (
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
            Neon AI Gateway publishes{" "}
            <a
              href="https://neon.com/docs/ai-gateway/models#available-models"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-green underline decoration-neon-green/30 underline-offset-4"
            >
              input and output prices
            </a>{" "}
            for each model. A company pays for the tokens its own workload
            consumes, including requests that return an unusable result.
          </p>
          <p>
            We wanted a concrete proxy for that operating cost. We sent the same
            100-ticket support workload to every enabled text model, tested each
            response against the same policy contract, and counted the tokens
            spent. The result measures cost per usable output for one simple,
            repeatable business process.
          </p>
        </div>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        {lowestWorkloadCost && (
          <MetricCard
            label="Lowest workload cost"
            model={lowestWorkloadCost.modelName}
            value={`$${lowestWorkloadCost.totalCostUsd?.toFixed(6)}`}
            detail={`${lowestWorkloadCost.successes}/100 responses passed`}
          />
        )}
        {leader && (
          <MetricCard
            label="Lowest cost per usable response"
            model={leader.modelName}
            value={`$${leader.costPerSuccessUsd?.toFixed(6)}`}
            detail={`${leader.successes}/100 responses passed`}
          />
        )}
        {tokenEfficient && (
          <MetricCard
            label="Fewest tokens per usable response"
            model={tokenEfficient.modelName}
            value={`${Math.round(tokenEfficient.tokensPerSuccess ?? 0).toLocaleString()} tokens`}
            detail={`${tokenEfficient.successes}/100 responses passed`}
          />
        )}
      </section>

      {leader && last && (
        <section className="mt-10 rounded-2xl border border-ledger-border bg-ledger-panel/75 p-6">
          <h3 className="text-xl font-light text-ledger-cream">
            Cost spread
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-ledger-cream/75">
            <span className="font-mono text-neon-green">
              {leader.modelName}
            </span>{" "}
            had the lowest cost per completed ticket at published prices.{" "}
            <span className="font-mono text-red-300">{last.modelName}</span>{" "}
            had the highest among models with published pricing.
            {priceMultiple != null && (
              <> The difference was {priceMultiple.toFixed(1)}×.</>
            )}{" "}
            <span className="font-mono text-ledger-cream">
              {completionLeaderNames}
            </span>{" "}
            {completionLeaders.length > 1 ? "shared" : "had"} the highest
            completion rate at{" "}
            {(completionLeader.passRate * 100).toFixed(0)}%.
          </p>
        </section>
      )}

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <Extremes title="Lowest cost per ticket" models={top} tone="best" />
        <Extremes title="Highest cost per ticket" models={bottom} tone="worst" />
      </section>

      <div className="mt-14 space-y-14">
        <AnalysisSection title="Why token use differs">
          <p>
            Token use has two components: how a model tokenizes the shared input
            and how much output it generates. Input totals ranged from{" "}
            {inputTokenRanking[0].inputTokens.toLocaleString()} to{" "}
            {inputTokenRanking[
              inputTokenRanking.length - 1
            ].inputTokens.toLocaleString()} tokens, a relatively narrow{" "}
            {(
              inputTokenRanking[inputTokenRanking.length - 1].inputTokens /
              inputTokenRanking[0].inputTokens
            ).toFixed(1)}
            × spread.
          </p>
          <p>
            Output totals ranged from{" "}
            {outputTokenRanking[0].outputTokens.toLocaleString()} to{" "}
            {outputTokenRanking[
              outputTokenRanking.length - 1
            ].outputTokens.toLocaleString()} tokens, a{" "}
            {(
              outputTokenRanking[outputTokenRanking.length - 1].outputTokens /
              outputTokenRanking[0].outputTokens
            ).toFixed(1)}
            × spread. Output behavior, not prompt tokenization, created most of
            the token gap in this run.
          </p>
        </AnalysisSection>

        <AnalysisSection title="Efficiency and pass rate">
          <p>
            Workload cost alone can reward short but unusable output.{" "}
            <span className="font-mono text-ledger-cream">
              {lowestWorkloadCost.modelName}
            </span>{" "}
            had the lowest total cost and{" "}
            <span className="font-mono text-ledger-cream">
              {lowestTokenWorkload.modelName}
            </span>{" "}
            used the fewest total tokens, but only{" "}
            {lowestWorkloadCost.successes}/100 responses passed.
          </p>
          <p>
            Cost per completed ticket combines both effects: average token cost
            per attempt and the share of attempts that passed.{" "}
            <span className="font-mono text-neon-green">{leader.modelName}</span>{" "}
            led that metric with {leader.successes}/100 passing, while{" "}
            <span className="font-mono text-neon-green">
              {tokenEfficient.modelName}
            </span>{" "}
            used the fewest tokens per completed ticket with{" "}
            {tokenEfficient.successes}/100 passing.
          </p>
          <p>
            {completionLeaderNames}{" "}
            {completionLeaders.length > 1 ? "shared" : "had"} the highest pass
            rate at {(completionLeader.passRate * 100).toFixed(0)}%.{" "}
            {completionLast.modelName} had the lowest at{" "}
            {(completionLast.passRate * 100).toFixed(0)}%. A production team
            should set a minimum acceptable pass rate first, then compare cost
            among the models that clear it.
          </p>
        </AnalysisSection>

        <AnalysisSection title="Why responses failed">
          <p>
            “Accuracy” here means contract compliance, not general intelligence
            or writing quality. A response had to pass every check. One response
            could fail more than one check, so the counts below overlap.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            <FailureItem
              label="Wrong classification"
              value={failedChecks.classification ?? 0}
            />
            <FailureItem
              label="Wrong escalation decision"
              value={failedChecks.escalation ?? 0}
            />
            <FailureItem
              label="Missing required policy terms"
              value={failedChecks.required_terms ?? 0}
            />
            <FailureItem
              label="Disallowed action"
              value={failedChecks.action ?? 0}
            />
          </ul>
          <p>
            The most common miss was classification, followed by escalation.
            Many failed responses were readable customer replies but made a
            different policy decision than the fixed expected answer. This test
            therefore measures reliable execution of a narrow support contract,
            not whether one model writes more naturally or is broadly
            “smarter.”
          </p>
        </AnalysisSection>

        <AnalysisSection title="Open-weight and proprietary models">
          <p>
            Open-weight models were much cheaper in this workload. Their median
            100-ticket cost was $
            {median(
              openModels.map((model) => Number(model.totalCostUsd)),
            ).toFixed(6)}
            , compared with $
            {median(
              proprietaryModels.map((model) => Number(model.totalCostUsd)),
            ).toFixed(6)}{" "}
            for proprietary models. {topFiveOpenCount} of the five lowest-cost
            models per completed ticket were open weight.
          </p>
          <p>
            The tradeoff was consistency. The median pass rate was{" "}
            {(
              median(openModels.map((model) => model.passRate)) * 100
            ).toFixed(0)}
            % for open-weight models and{" "}
            {(
              median(proprietaryModels.map((model) => model.passRate)) * 100
            ).toFixed(0)}
            % for proprietary models. Open-weight models also used a median of{" "}
            {Math.round(
              median(
                openModels.map((model) =>
                  Number(model.tokensPerSuccess),
                ),
              ),
            ).toLocaleString()}{" "}
            tokens per completed ticket, versus{" "}
            {Math.round(
              median(
                proprietaryModels.map((model) =>
                  Number(model.tokensPerSuccess),
                ),
              ),
            ).toLocaleString()}
            .
          </p>
          <p>
            This does not establish a general open-weight versus proprietary
            rule. It shows that lower published token prices outweighed a lower
            median pass rate for this short, structured workload.
          </p>
        </AnalysisSection>

        {qwenOutlier && (
          <AnalysisSection title="The Qwen3.5 outlier">
            <p>
              Qwen3.5 122B-A10B reported{" "}
              {qwenOutlier.outputTokens.toLocaleString()} output tokens across
              the workload. Its median request used{" "}
              {Math.round(qwenOutlier.medianOutputTokens ?? 0).toLocaleString()}{" "}
              output tokens, close to the 2,048-token request cap, and{" "}
              {qwenOutlier.outputCapHits ?? 0}/100 requests reached that cap.
              The visible answer contained a median of only{" "}
              {Math.round(qwenOutlier.medianVisibleWords ?? 0)} words.
            </p>
            <p>
              The model failed valid JSON on{" "}
              {qwenOutlier.failedChecks?.valid_json ?? 0} responses and passed
              only {qwenOutlier.successes}/100 overall. AI Gateway notes that
              this model can return{" "}
              <a
                href="https://neon.com/docs/ai-gateway/models#content-shape-varies-by-model"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neon-green underline decoration-neon-green/30 underline-offset-4"
              >
                separate reasoning and text blocks
              </a>
              . The provider reported no separate reasoning-token count, so this
              run cannot cleanly divide the output usage between those blocks.
              The evidence shows output accounting near the cap, not a
              2,000-token customer reply.
            </p>
          </AnalysisSection>
        )}

        <AnalysisSection title="What this benchmark shows">
          <ul className="list-disc space-y-3 pl-5">
            <li>
              Published token price is only one part of unit cost. Output length
              and pass rate can change the effective cost per usable result.
            </li>
            <li>
              Total workload cost and cost per completed ticket answer different
              questions. Both need the pass count beside them.
            </li>
            <li>
              Output behavior created far more token variation than input
              tokenization in this run.
            </li>
            <li>
              A cheap model can be the right choice when its pass rate clears the
              product requirement. Below that threshold, human review or retries
              can erase the savings.
            </li>
            <li>
              These findings apply to one run of this support workload. Coding,
              long-context, tool-use, and creative tasks can produce different
              rankings.
            </li>
          </ul>
        </AnalysisSection>
      </div>
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

function MetricCard({
  label,
  model,
  value,
  detail,
}: {
  label: string;
  model: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-ledger-border bg-ledger-panel/70 p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-ledger-muted">
        {label}
      </p>
      <p className="mt-3 font-mono text-sm text-neon-green">{model}</p>
      <p className="mt-2 font-mono text-xl text-ledger-cream">{value}</p>
      <p className="mt-1 text-xs text-ledger-muted">{detail}</p>
    </div>
  );
}

function FailureItem({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-ledger-border bg-ledger-panel/50 px-4 py-3">
      <span className="text-sm text-ledger-cream/75">{label}</span>
      <span className="font-mono text-sm text-ledger-cream">{value}</span>
    </li>
  );
}

function AnalysisSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-2xl font-light text-ledger-cream">{title}</h3>
      <div className="mt-4 space-y-4 leading-relaxed text-ledger-cream/75">
        {children}
      </div>
    </section>
  );
}
