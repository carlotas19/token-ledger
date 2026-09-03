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

function pricedOutputTokens(model: ModelAggregate) {
  return (
    model.pricedOutputTokens ??
    Math.max(model.outputTokens, model.totalTokens - model.inputTokens)
  );
}

function formatDuration(milliseconds?: number | null) {
  if (milliseconds == null) return "Not recorded";
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} seconds`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${(seconds % 60).toFixed(0)}s`;
}

const CODING_TOKENS_PER_ENGINEER_MONTH = 20_000_000;
const CODING_INPUT_SHARE = 0.8;

function estimatedMonthlyInferenceCost(
  model: ModelAggregate,
  engineerCount: number,
) {
  if (
    model.inputPricePerMillionUsd == null ||
    model.outputPricePerMillionUsd == null
  ) {
    return null;
  }

  const blendedPricePerMillion =
    CODING_INPUT_SHARE * model.inputPricePerMillionUsd +
    (1 - CODING_INPUT_SHARE) * model.outputPricePerMillionUsd;

  return (
    (CODING_TOKENS_PER_ENGINEER_MONTH / 1_000_000) *
    blendedPricePerMillion *
    engineerCount
  );
}

function formatDollars(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
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
  const openMedianWorkloadCost = median(
    openModels.map((model) => Number(model.totalCostUsd)),
  );
  const proprietaryMedianWorkloadCost = median(
    proprietaryModels.map((model) => Number(model.totalCostUsd)),
  );
  const workloadCostRanking = [...benchmark.aggregates]
    .filter((model) => model.totalCostUsd != null)
    .sort((a, b) => Number(a.totalCostUsd) - Number(b.totalCostUsd));
  const workloadTokenRanking = [...benchmark.aggregates].sort(
    (a, b) => a.totalTokens - b.totalTokens,
  );
  const workloadDurationRanking = benchmark.aggregates
    .filter((model) => model.totalWorkloadDurationMs != null)
    .sort(
      (a, b) =>
        Number(a.totalWorkloadDurationMs) -
        Number(b.totalWorkloadDurationMs),
    );
  const fastestWorkload = workloadDurationRanking[0];
  const slowestWorkload =
    workloadDurationRanking[workloadDurationRanking.length - 1];
  const lowestWorkloadCost = workloadCostRanking[0];
  const highestWorkloadCost =
    workloadCostRanking[workloadCostRanking.length - 1];
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
    (a, b) => pricedOutputTokens(a) - pricedOutputTokens(b),
  );
  const modelsWithUnsplitOutput = benchmark.aggregates.filter(
    (model) => model.totalTokens > model.inputTokens + model.outputTokens,
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
  const qwenWorkloadRank = qwenOutlier
    ? workloadCostRanking.findIndex(
        (model) => model.modelId === qwenOutlier.modelId,
      ) + 1
    : null;
  const qwenUsableRank = qwenOutlier
    ? models.findIndex((model) => model.modelId === qwenOutlier.modelId) + 1
    : null;
  const thirdLowestCostModel = models[2];
  const thirdHighestCostModel = models[models.length - 3];
  const gptSol = benchmark.aggregates.find(
    (model) => model.modelId === "gpt-5-6-sol",
  );
  const claudeFable = benchmark.aggregates.find(
    (model) => model.modelId === "claude-fable-5",
  );
  const companyScenarios = [
    { employees: 100, engineers: 50 },
    { employees: 1000, engineers: 500 },
  ];

  return (
    <article className="mx-auto max-w-4xl px-6 py-12 lg:px-0">
      <header>
        <p className="text-sm uppercase tracking-[0.3em] text-ledger-muted">
          Report
        </p>
        <h2 className="mt-3 text-4xl font-light text-ledger-cream">
          The growing weight of token economics
        </h2>
        <p className="mt-4 inline-flex rounded-full border border-neon-green/30 px-4 py-1.5 text-sm text-neon-green">
          We’ll re-run this regularly with the latest models
        </p>
        <div className="mt-5 max-w-3xl space-y-4 text-lg leading-relaxed text-ledger-cream/75">
          <p>
            Headcount is usually one of a company’s largest costs. As agents
            take on more work, model inference becomes a second cost attached
            to that work: tokens. Choosing models that execute reliably for less
            can create meaningful savings across millions of agent actions.
          </p>
          <p>
            But the cheapest listed model is not necessarily the cheapest model
            to operate. A low token rate can be offset by long outputs, rejected
            responses, retries, or slow execution. Those costs only become
            visible when models run the same representative task.
          </p>
          <p>
            That is the case for small, repeatable experiments like this one.
            We ran the same 100-ticket workload through {benchmark.modelCount}{" "}
            models and compared the cost, usable output, and time required to
            finish. The goal is not to crown one universal winner. It is to show
            why companies should test the economics of their own work before
            choosing the model that will execute it.
          </p>
        </div>
      </header>

      <div className="mt-14 space-y-14">
        <AnalysisSection title="What the benchmark measures">
          <p>
            Every model received the same 100 synthetic support tickets. Each
            request included the same system prompt, JSON schema, account
            context, policy notes, and expected decision. Every model was
            allowed up to 2,048 output tokens.
          </p>
          <p>
            The runner counted provider-reported token usage for all 100
            attempts. It then checked each response for valid JSON, the expected
            classification, an allowed action, the correct escalation decision,
            required policy terms, forbidden claims, and the reply length. A
            ticket passed only when every check passed.
          </p>
          <FormulaBlock>
            workload cost = input tokens × input rate + priced output tokens ×
            output rate
          </FormulaBlock>
          <FormulaBlock>
            cost per usable response = workload cost ÷ responses that passed
          </FormulaBlock>
          <p>
            Failed responses stay in the numerator. The tokens were consumed
            even though the application could not use the result. This is the
            step that turns a token bill into a useful unit-economics metric.
          </p>
          <p>
            We routed every model through{" "}
            <a
              href="https://neon.com/docs/ai-gateway/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-green underline decoration-neon-green/30 underline-offset-4"
            >
              Neon AI Gateway
            </a>{" "}
            and applied its{" "}
            <a
              href="https://neon.com/docs/ai-gateway/models#available-models"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-green underline decoration-neon-green/30 underline-offset-4"
            >
              published model rates
            </a>
            . Prices were verified{" "}
            {new Date(
              benchmark.pricingSnapshotAt ?? benchmark.catalogSnapshotAt,
            ).toLocaleDateString()}.
          </p>
        </AnalysisSection>

        <AnalysisSection title="How we decided a response was usable">
          <p>
            Usable did not mean “a good support reply.” It meant the application
            could accept the output without a retry or a human fix. Every
            response had to pass seven deterministic checks. One miss failed the
            ticket. There was no human review and no second model scoring the
            prose.
          </p>
          <p>
            The model had to return JSON with four fields:{" "}
            <span className="font-mono text-ledger-cream">classification</span>,{" "}
            <span className="font-mono text-ledger-cream">action</span>,{" "}
            <span className="font-mono text-ledger-cream">escalate</span>, and{" "}
            <span className="font-mono text-ledger-cream">customer_reply</span>.
            Markdown fences were stripped, then the payload was parsed. If that
            failed, scoring stopped. If it parsed, every remaining check had to
            pass:
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              The response parses as JSON with all four required fields.
            </li>
            <li>
              Classification matches the ticket category exactly (
              <span className="font-mono text-ledger-cream">
                billing, access, feature, security, refund, other
              </span>
              ).
            </li>
            <li>
              Action is one the ticket allowed (
              <span className="font-mono text-ledger-cream">
                reply_only, reset_password, issue_credit, deny_request,
                escalate_security
              </span>
              ).
            </li>
            <li>
              Escalation is the boolean the policy required. A credential leak
              must escalate. A billing explanation must not.
            </li>
            <li>The customer reply is between 1 and 120 words.</li>
            <li>
              Required policy terms appear in the reply, case-insensitive. A
              leak ticket must mention{" "}
              <span className="font-mono text-ledger-cream">rotate</span>; a
              pooling ticket must mention{" "}
              <span className="font-mono text-ledger-cream">pool</span>.
            </li>
            <li>
              Forbidden terms do not appear. A refund ticket fails if the reply
              says{" "}
              <span className="font-mono text-ledger-cream">refund approved</span>{" "}
              or{" "}
              <span className="font-mono text-ledger-cream">full refund</span>.
            </li>
          </ol>
          <p>
            The expected answers are fixed in the 20 scenarios. Each scenario is
            asked five ways—direct, urgent, frustrated, asking for next steps, and
            written for a nontechnical reader—but the policy target stays the
            same. Tone and empathy are not scored. A short, slightly stiff reply
            that hits the contract counts. A fluent reply that promises a refund
            does not.
          </p>
          <p>
            The examples below follow the actual ticket contract. They are
            reconstructed to show the grader, not quoted from a stored model log.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <TicketOutcome
              tone="pass"
              label="This response would pass"
              ticket="Credential leak"
              policy="Treat this as a security incident. Recommend rotation and escalate."
              response={`{
  "classification": "security",
  "action": "escalate_security",
  "escalate": true,
  "customer_reply": "This is a security incident. Rotate the exposed credentials now. We are escalating this to the security team."
}`}
              why="It is valid JSON, classified as security, chose the only allowed action, set escalate to true, mentioned rotate, and stayed under 120 words."
            />
            <TicketOutcome
              tone="fail"
              label="This response would fail"
              ticket="Annual prepay refund"
              policy="Annual refunds require manager review. Never promise an amount."
              response={`{
  "classification": "refund",
  "action": "issue_credit",
  "escalate": false,
  "customer_reply": "Sorry you are shutting down. I have processed a full refund of the unused months."
}`}
              why="The reply is readable, but issue_credit is not allowed for this ticket, and full refund is a forbidden promise. Either miss would fail the ticket."
            />
          </div>
          <p>
            Failed tickets still add their tokens and published cost to the
            model total. Cost per completed ticket is therefore the full
            100-ticket bill divided by the responses that passed.
          </p>
        </AnalysisSection>
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        {fastestWorkload && (
          <MetricCard
            label="Fastest 100-ticket run"
            model={fastestWorkload.modelName}
            value={formatDuration(fastestWorkload.totalWorkloadDurationMs)}
            detail={`${formatDuration(fastestWorkload.medianLatencyMs)} median ticket latency`}
          />
        )}
        {highestWorkloadCost && (
          <MetricCard
            label="Highest workload cost"
            model={highestWorkloadCost.modelName}
            value={`$${highestWorkloadCost.totalCostUsd?.toFixed(6)}`}
            detail={`${highestWorkloadCost.successes}/100 responses passed`}
            tone="worst"
          />
        )}
        {slowestWorkload && (
          <MetricCard
            label="Slowest 100-ticket run"
            model={slowestWorkload.modelName}
            value={formatDuration(slowestWorkload.totalWorkloadDurationMs)}
            detail={`${formatDuration(slowestWorkload.medianLatencyMs)} median ticket latency`}
            tone="worst"
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
            {(completionLeader.passRate * 100).toFixed(0)}%.{" "}
            {fastestWorkload && slowestWorkload && (
              <>
                Observed workload time ranged from{" "}
                {formatDuration(fastestWorkload.totalWorkloadDurationMs)} for{" "}
                <span className="font-mono text-neon-green">
                  {fastestWorkload.modelName}
                </span>{" "}
                to {formatDuration(slowestWorkload.totalWorkloadDurationMs)} for{" "}
                <span className="font-mono text-red-300">
                  {slowestWorkload.modelName}
                </span>
                .
              </>
            )}
          </p>
        </section>
      )}

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <Extremes title="Lowest cost per ticket" models={top} tone="best" />
        <Extremes title="Highest cost per ticket" models={bottom} tone="worst" />
      </section>

      <div className="mt-14 space-y-14">
        {thirdLowestCostModel &&
          thirdHighestCostModel &&
          estimatedMonthlyInferenceCost(thirdLowestCostModel, 1) != null &&
          estimatedMonthlyInferenceCost(thirdHighestCostModel, 1) != null && (
            <FeaturedAnalysisSection
              eyebrow="A scale thought experiment"
              title="What model efficiency could mean for a software company"
            >
              <p>
                How large can the model-choice line item become? This scenario
                uses conservative positions from the benchmark rather than its
                extremes:{" "}
                <span className="font-mono text-neon-green">
                  {thirdLowestCostModel.modelName}
                </span>
                , third lowest by cost per usable support response, and{" "}
                <span className="font-mono text-red-300">
                  {thirdHighestCostModel.modelName}
                </span>
                , third highest.
              </p>
              <p>
                The coding volume is an assumption, not a measurement from
                this benchmark. We model one substantial agent task per engineer
                per workday at 1 million tokens per task, or 20 million tokens
                per engineer per month. A{" "}
                <a
                  href="https://www.microsoft.com/en-us/research/publication/how-do-ai-agents-spend-your-money-analyzing-and-predicting-token-consumption-in-agentic-coding-tasks/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neon-green underline decoration-neon-green/30 underline-offset-4"
                >
                  2026 study of coding agents on SWE-bench Verified
                </a>{" "}
                reported an average of 4.17 million tokens per task and up to
                30× variation between runs of the same task. Our 1 million-token
                assumption is deliberately lower.
              </p>
              <p>
                We assume 80% input and 20% priced output tokens, no prompt-cache
                discount, and published AI Gateway rates from this benchmark.
                We also assume half of each company is made up of engineers and
                every engineer uses a coding agent.
              </p>
              <FormulaBlock>
                monthly tokens = engineers × 20 tasks × 1M tokens
              </FormulaBlock>
              <div className="grid gap-4 md:grid-cols-2">
                {companyScenarios.map(({ employees, engineers }) => {
                  const lowerCost = estimatedMonthlyInferenceCost(
                    thirdLowestCostModel,
                    engineers,
                  );
                  const higherCost = estimatedMonthlyInferenceCost(
                    thirdHighestCostModel,
                    engineers,
                  );
                  if (lowerCost == null || higherCost == null) return null;
                  const savings = higherCost - lowerCost;

                  return (
                    <ScaleScenario
                      key={employees}
                      employees={employees}
                      engineers={engineers}
                      monthlyTokens={
                        engineers * CODING_TOKENS_PER_ENGINEER_MONTH
                      }
                      lowerModel={thirdLowestCostModel.modelName}
                      lowerCost={lowerCost}
                      higherModel={thirdHighestCostModel.modelName}
                      higherCost={higherCost}
                      savings={savings}
                    />
                  );
                })}
              </div>
              <p>
                Under those assumptions, the model choice changes estimated
                inference spend by{" "}
                {(
                  Number(
                    estimatedMonthlyInferenceCost(thirdHighestCostModel, 1),
                  ) /
                  Number(
                    estimatedMonthlyInferenceCost(thirdLowestCostModel, 1),
                  )
                ).toFixed(1)}
                ×. Anthropic reports that Claude Code averages{" "}
                <a
                  href="https://code.claude.com/docs/en/costs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neon-green underline decoration-neon-green/30 underline-offset-4"
                >
                  $150 to $250 per enterprise developer per month
                </a>
                , which is a useful external check on the order of magnitude.
              </p>
            </FeaturedAnalysisSection>
          )}

        <AnalysisSection title="Open-weight and proprietary models">
          <p>
            Open-weight models had the lower median cost in this run. Their
            median 100-ticket workload cost was $
            {openMedianWorkloadCost.toFixed(6)}, compared with $
            {proprietaryMedianWorkloadCost.toFixed(6)} for proprietary models,
            a{" "}
            {(
              proprietaryMedianWorkloadCost / openMedianWorkloadCost
            ).toFixed(1)}
            × difference. {topFiveOpenCount} of the five lowest-cost models per
            completed ticket were open weight.
          </p>
          <p>
            Published rates explain much of that gap. The five models with the
            lowest input rates and the five models with the lowest output rates
            were all open weight. A lower rate creates room for more tokens
            before the workload reaches the same dollar cost as a higher-rate
            model.
          </p>
          <p>
            The group result was not a clean win. The median pass rate was{" "}
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
            Qwen3.5 shows why the group median cannot choose a model for an
            application. It is open weight and has relatively low published
            rates, yet its output volume and 35% pass rate moved it to #
            {qwenWorkloadRank} for workload cost and #{qwenUsableRank} for cost
            per usable response.
          </p>
          <p>
            This single run does not establish a general rule for open-weight
            and proprietary models. It shows a tradeoff in this workload: lower
            published rates outweighed lower median contract compliance for the
            open-weight group, while individual models still moved far from the
            group pattern.
          </p>
        </AnalysisSection>

        {gptSol && claudeFable && (
          <AnalysisSection title="Flagship comparison: GPT-5.6 Sol and Claude Fable 5">
            <p>
              OpenAI describes{" "}
              <a
                href="https://developers.openai.com/api/docs/models/gpt-5.6-sol"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neon-green underline decoration-neon-green/30 underline-offset-4"
              >
                GPT-5.6 Sol
              </a>{" "}
              as its flagship model for complex professional work. Anthropic
              describes{" "}
              <a
                href="https://www.anthropic.com/claude/fable"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neon-green underline decoration-neon-green/30 underline-offset-4"
              >
                Claude Fable 5
              </a>{" "}
              as its highest-capability generally available model. Both were in
              the 42-model run, so we can compare how they handled this narrow
              support contract.
            </p>
            <div className="overflow-x-auto rounded-xl border border-ledger-border bg-ledger-panel/60">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-ledger-border text-ledger-muted">
                  <tr>
                    <th className="px-4 py-3 font-normal">Metric</th>
                    <th className="px-4 py-3 font-normal text-neon-green">
                      GPT-5.6 Sol
                    </th>
                    <th className="px-4 py-3 font-normal text-yellow-300">
                      Claude Fable 5
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ledger-border font-mono text-ledger-cream">
                  <FlagshipRow
                    label="Responses passed"
                    sol={`${gptSol.successes}/100`}
                    fable={`${claudeFable.successes}/100`}
                  />
                  <FlagshipRow
                    label="Total tokens"
                    sol={gptSol.totalTokens.toLocaleString()}
                    fable={claudeFable.totalTokens.toLocaleString()}
                  />
                  <FlagshipRow
                    label="100-ticket cost"
                    sol={`$${gptSol.totalCostUsd?.toFixed(6)}`}
                    fable={`$${claudeFable.totalCostUsd?.toFixed(6)}`}
                  />
                  <FlagshipRow
                    label="Cost per usable response"
                    sol={`$${gptSol.costPerSuccessUsd?.toFixed(6)}`}
                    fable={`$${claudeFable.costPerSuccessUsd?.toFixed(6)}`}
                  />
                  <FlagshipRow
                    label="100-ticket time"
                    sol={formatDuration(gptSol.totalWorkloadDurationMs)}
                    fable={formatDuration(claudeFable.totalWorkloadDurationMs)}
                  />
                </tbody>
              </table>
            </div>
            <p>
              Pass rate was nearly tied: 69/100 for Sol and 68/100 for Fable.
              Sol used {gptSol.totalTokens.toLocaleString()} tokens, compared
              with {claudeFable.totalTokens.toLocaleString()} for Fable. At the
              AI Gateway prices captured for this run, Fable cost{" "}
              {(
                Number(claudeFable.costPerSuccessUsd) /
                Number(gptSol.costPerSuccessUsd)
              ).toFixed(1)}
              × more per usable response and took{" "}
              {(
                Number(claudeFable.totalWorkloadDurationMs) /
                Number(gptSol.totalWorkloadDurationMs)
              ).toFixed(1)}
              × as long to finish the workload.
            </p>
            <p>
              Sol was the stronger economic result for this contract. That does
              not establish that it is the better flagship model overall. The
              grader tested JSON, policy decisions, and short support replies.
              Long-horizon coding, research, tool use, or a model-specific
              prompt could produce a different result.
            </p>
          </AnalysisSection>
        )}

        <AnalysisSection title="Four questions behind “cheap”">
          <p>
            A useful model decision needs four measurements. They should not be
            collapsed into one ranking.
          </p>
          <ol className="list-decimal space-y-4 pl-5">
            <li>
              <span className="text-ledger-cream">Price per token</span> comes
              from the catalog. It is useful before any workload has run, but
              there are separate input and output rates.
            </li>
            <li>
              <span className="text-ledger-cream">Cost per workload</span> asks
              how much all 100 attempts cost. This combines the rates with the
              token volume each model produced.
            </li>
            <li>
              <span className="text-ledger-cream">
                Cost per usable response
              </span>{" "}
              divides that workload cost by the responses that passed. This
              adds application reliability to the calculation.
            </li>
            <li>
              <span className="text-ledger-cream">Time to completion</span>{" "}
              asks how long users and downstream agents wait. A cheap response
              that arrives too slowly can reduce throughput and create a poor
              product experience.
            </li>
          </ol>
          <p>
            Each measure answers a valid question. The first helps screen a
            catalog. The second estimates the model bill for a known traffic
            pattern. The third gets closer to the cost of delivering a product
            feature, because it does not count failed output as completed work.
            The fourth tests whether those savings arrive at an acceptable
            speed. In this run, the fastest and slowest 100-ticket workloads
            differed by{" "}
            {fastestWorkload && slowestWorkload
              ? (
                  Number(slowestWorkload.totalWorkloadDurationMs) /
                  Number(fastestWorkload.totalWorkloadDurationMs)
                ).toFixed(1)
              : "many"}
            ×.
          </p>
        </AnalysisSection>

        <AnalysisSection title="Why token use differs">
          <ul className="space-y-4">
            <li>
              <span className="font-medium text-ledger-cream">
                Input use varied less.
              </span>{" "}
              The fixed prompt produced{" "}
              {inputTokenRanking[0].inputTokens.toLocaleString()} to{" "}
              {inputTokenRanking[
                inputTokenRanking.length - 1
              ].inputTokens.toLocaleString()}{" "}
              input tokens, a{" "}
              {(
                inputTokenRanking[inputTokenRanking.length - 1].inputTokens /
                inputTokenRanking[0].inputTokens
              ).toFixed(1)}
              × spread. Tokenizers and provider accounting differ even when the
              text is identical.
            </li>
            <li>
              <span className="font-medium text-ledger-cream">
                Output behavior created the bigger gap.
              </span>{" "}
              Priced output ranged from{" "}
              {pricedOutputTokens(outputTokenRanking[0]).toLocaleString()} to{" "}
              {pricedOutputTokens(
                outputTokenRanking[outputTokenRanking.length - 1],
              ).toLocaleString()}{" "}
              tokens, a{" "}
              {(
                pricedOutputTokens(
                  outputTokenRanking[outputTokenRanking.length - 1],
                ) / pricedOutputTokens(outputTokenRanking[0])
              ).toFixed(1)}
              × spread.
            </li>
            <li>
              <span className="font-medium text-ledger-cream">
                Visible length is not the full bill.
              </span>{" "}
              Output can include longer JSON, separately counted reasoning, or
              tokens generated before the model reaches its cap. Because output
              rates are often higher, extra generation can move cost quickly.
            </li>
          </ul>
          {modelsWithUnsplitOutput.length > 0 && (
            <p>
              <span className="font-medium text-ledger-cream">
                We priced unexplained generated usage.
              </span>{" "}
              For {modelsWithUnsplitOutput.length} models, the provider-reported
              total exceeded the separate input and output fields. To avoid
              treating generated tokens as free, the cost estimate prices the
              larger of reported output or total minus input as output. This
              preserves the provider total when reasoning usage is not broken
              out separately.
            </p>
          )}
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
            {lowestTokenWorkload.successes}/100 responses passed.
          </p>
          <FormulaBlock>
            cost per usable response = average cost per attempt ÷ pass rate
          </FormulaBlock>
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
            The denominator matters. At a 70% pass rate, $1 spent across 100
            attempts supports 70 usable responses. At a 35% pass rate, the same
            spend supports 35. The second model has twice the effective unit
            cost before any retry, human review, or fallback model is added.
            Those follow-up costs were not measured here, so the benchmark is
            conservative about the cost of failure.
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
          <p>
            That order prevents a common mistake. A model should not win a cost
            comparison by producing answers the application rejects. The pass
            threshold turns reliability into a requirement. Cost then decides
            among the models that satisfy it.
          </p>
        </AnalysisSection>

        {fastestWorkload && slowestWorkload && (
          <AnalysisSection title="Time to completion">
            <p>
              Token cost is not the only operating constraint. A model that
              takes longer to finish a request can make an agent feel slow,
              reduce throughput, and keep a human waiting for work that should
              be automated.
            </p>
            <p>
              Each model processed its 100 tickets sequentially. We sum the
              measured request latency to estimate the time needed to finish
              that model’s complete workload.{" "}
              <span className="font-mono text-neon-green">
                {fastestWorkload.modelName}
              </span>{" "}
              finished fastest in{" "}
              {formatDuration(fastestWorkload.totalWorkloadDurationMs)}.{" "}
              <span className="font-mono text-red-300">
                {slowestWorkload.modelName}
              </span>{" "}
              took {formatDuration(slowestWorkload.totalWorkloadDurationMs)}.
            </p>
            <p>
              Median ticket latency helps separate a consistently slow model
              from a run dominated by a few long requests. The Results model
              card also reports p95 latency, which captures the slower end of
              each model’s 100 responses.
            </p>
            <p>
              These timing rankings are directional. The original 28 models and
              the 14 GPT additions ran in separate batches and on different
              dates. Models also ran concurrently within each batch. Network
              conditions, provider load, and rate-limit waits can therefore
              affect the comparison. A controlled latency benchmark would
              repeat each model under the same concurrency and report the
              distribution across runs.
            </p>
          </AnalysisSection>
        )}

        {qwenOutlier && (
          <AnalysisSection title="The Qwen3.5 outlier">
            <p>
              Qwen3.5 122B-A10B is the clearest case where a low rate did not
              produce a low workload cost. Its published rates were $
              {qwenOutlier.inputPricePerMillionUsd?.toFixed(2)} per million
              input tokens and $
              {qwenOutlier.outputPricePerMillionUsd?.toFixed(2)} per million
              output tokens. Those rates placed it near the inexpensive end of
              the catalog.
            </p>
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
            <p>
              The 50 cap hits and 50 invalid-JSON failures are a strong
              diagnostic signal, but this run did not preserve enough
              provider-level detail to prove that every capped response caused
              one JSON failure. The safe conclusion is narrower: the model
              consumed far more generated tokens than its visible answers
              suggest, and half of its responses did not produce usable JSON.
            </p>
            <p>
              This outlier changes the operational lesson. Teams should log
              total usage, output details, finish reasons, and parse failures,
              rather than checking only the visible reply length. A short
              response can still carry a large generated-token bill when the
              provider counts reasoning or other output separately.
            </p>
          </AnalysisSection>
        )}

        <AnalysisSection title="What we learned">
          <p>
            In this run, GPT-5 Nano had the lowest listed input rate and also
            finished first by workload cost and cost per usable response. That
            alignment is a result of this task, not evidence that the cheapest
            catalog rate will always win. Other models show why the workload
            test still matters.
          </p>
          <ul className="list-disc space-y-3 pl-5">
            <li>
              GPT-5 Nano combined a low rate, low token volume, and enough
              passing responses to lead the measured cost rankings.
            </li>
            <li>
              Pass rates ranged from{" "}
              {(completionLast.passRate * 100).toFixed(0)}% to{" "}
              {(completionLeader.passRate * 100).toFixed(0)}%. A low bill can
              therefore hide extra retries, fallback calls, or human cleanup
              that this benchmark does not add to the dollar total.
            </li>
            <li>
              Output behavior created a {(
                pricedOutputTokens(
                  outputTokenRanking[outputTokenRanking.length - 1],
                ) / pricedOutputTokens(outputTokenRanking[0])
              ).toFixed(1)}
              × token spread, compared with{" "}
              {(
                inputTokenRanking[inputTokenRanking.length - 1].inputTokens /
                inputTokenRanking[0].inputTokens
              ).toFixed(1)}
              × for input tokens.
            </li>
            <li>
              Open-weight models had the lower median dollar cost, but their
              median pass rate was lower and their median token use per usable
              response was higher in this task.
            </li>
            <li>
              Qwen3.5 showed that a low listed rate can be overwhelmed by output
              volume and parse failures.
            </li>
            {fastestWorkload && slowestWorkload && (
              <li>
                Observed workload time ranged from{" "}
                {formatDuration(fastestWorkload.totalWorkloadDurationMs)} for{" "}
                {fastestWorkload.modelName} to{" "}
                {formatDuration(slowestWorkload.totalWorkloadDurationMs)} for{" "}
                {slowestWorkload.modelName}. Cost and quality candidates still
                need a response-time threshold, although this two-batch run
                should not be treated as a controlled latency test.
              </li>
            )}
          </ul>
          <p>
            The useful unit is the cost of an accepted outcome delivered in
            acceptable time. A token rate can estimate that unit only after the
            application measures usage, reliability, and latency on its own
            work.
          </p>
        </AnalysisSection>

        <AnalysisSection title="Why responses failed">
          <p>
            “Accuracy” here means contract compliance, not general intelligence
            or writing quality. A response had to pass every check described
            above. One response could fail more than one check, so the counts
            below overlap.
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
          <p>
            The failure types point to different application risks.
            Classification and action misses mean the model chose a different
            branch of the workflow. Escalation misses can send a routine ticket
            to a human or leave a security case in an automated path. Missing
            required terms means the policy decision may be right while the
            customer-facing response omits a required fact. Invalid JSON means
            the application cannot reliably parse the response at all.
          </p>
          <p>
            Across {benchmark.modelCount * benchmark.ticketCount} responses,
            valid JSON failed {failedChecks.valid_json ?? 0} times. That was
            much less common than classification, which failed{" "}
            {failedChecks.classification ?? 0} checks. Structured output alone
            was therefore not the main separator. The larger difference was
            whether the model mapped the ticket to the benchmark’s exact policy
            decision.
          </p>
          <p>
            A different prompt, clearer labels, tool calling, constrained
            decoding, or a model-specific adapter could change these pass
            rates. We intentionally held the request contract constant to
            compare models through one application interface. The results
            measure that interface as tested, not the highest score each model
            could reach after individual tuning.
          </p>
        </AnalysisSection>

        <FeaturedAnalysisSection
          eyebrow="From token economics to operating practice"
          title="A practical model-selection process"
        >
          <p>
            If token spend becomes a material company cost, model selection
            becomes a recurring operating discipline. The benchmark suggests a
            sequence for choosing a model. The order matters because each step
            removes a different source of false savings.
          </p>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              Define what a usable result means for the application. This can be
              a schema, policy check, tool result, human rating, or another
              observable outcome.
            </li>
            <li>
              Set the minimum quality or pass-rate requirement before comparing
              prices. Models below that line do not meet the product
              requirement.
            </li>
            <li>
              Run representative production prompts and record input, output,
              reasoning, latency, retries, parse failures, and fallback calls.
            </li>
            <li>
              Calculate the cost of the whole workload and divide it by usable
              results. Compare that number among models that passed the quality
              threshold.
            </li>
            <li>
              Set a response-time requirement and compare median, p95, and
              full-workload time. A low-cost model still has to meet the
              application’s latency and throughput needs.
            </li>
            <li>
              Repeat the run. A single deterministic sample cannot show output
              variance or the long tail of failures.
            </li>
          </ol>
          <p>
            Price per token remains useful in this process. It narrows the
            candidate set and explains part of the final bill. The benchmark
            changes its role from final answer to one input in a measured
            decision.
          </p>
          <p>
            At enterprise scale, this process can be applied to each major
            agent workflow. Support triage may favor one model, code review
            another, and document extraction a third. The savings come from
            measuring the cost of an accepted result for each job, then routing
            work to the least expensive model that meets its requirement.
          </p>
        </FeaturedAnalysisSection>

        <AnalysisSection title="What the benchmark does not prove">
          <p>
            This is one run of one structured support task. It does not rank
            general model capability. Coding, long-context analysis, tool use,
            retrieval, and creative writing can produce different token
            patterns and different winners.
          </p>
          <p>
            The pass score is deliberately strict and mechanical. It rewards
            the exact policy contract, not empathy, tone, factual depth, or
            writing quality beyond the required terms and length. A human
            reviewer could prefer an answer that this grader rejects.
          </p>
          <p>
            The run also does not measure variance. Each ticket was sent once
            to each model. Repeated runs would show whether a 70% pass rate is
            stable or whether the model moves widely from run to run. Timing is
            observed, but it was not collected under a controlled latency test.
            Caching, batch discounts, retry policies, and human review costs sit
            outside this comparison.
          </p>
          <p>
            Prices and model behavior can change. The report ties its dollar
            estimates to the published rates verified{" "}
            {new Date(
              benchmark.pricingSnapshotAt ?? benchmark.catalogSnapshotAt,
            ).toLocaleDateString()}
            . A later comparison should reprice the saved token counts or rerun
            the workload.
          </p>
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
  tone = "best",
}: {
  label: string;
  model: string;
  value: string;
  detail: string;
  tone?: "best" | "worst";
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        tone === "worst"
          ? "border-red-400/20 bg-red-400/[0.04]"
          : "border-ledger-border bg-ledger-panel/70"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.16em] text-ledger-muted">
        {label}
      </p>
      <p
        className={`mt-3 font-mono text-sm ${
          tone === "worst" ? "text-red-300" : "text-neon-green"
        }`}
      >
        {model}
      </p>
      <p className="mt-2 font-mono text-xl text-ledger-cream">{value}</p>
      <p className="mt-1 text-xs text-ledger-muted">{detail}</p>
    </div>
  );
}

function FormulaBlock({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-ledger-border bg-[#090e0b] px-4 py-3 font-mono text-sm text-ledger-cream">
      {children}
    </p>
  );
}

function TicketOutcome({
  tone,
  label,
  ticket,
  policy,
  response,
  why,
}: {
  tone: "pass" | "fail";
  label: string;
  ticket: string;
  policy: string;
  response: string;
  why: string;
}) {
  const pass = tone === "pass";
  return (
    <figure
      className={`rounded-xl border p-4 ${
        pass
          ? "border-neon-green/30 bg-neon-green/[0.04]"
          : "border-red-400/25 bg-red-400/[0.04]"
      }`}
    >
      <figcaption
        className={`text-xs uppercase tracking-[0.16em] ${
          pass ? "text-neon-green" : "text-red-300"
        }`}
      >
        {label}
      </figcaption>
      <p className="mt-3 text-sm text-ledger-cream">
        <span className="font-mono">{ticket}</span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ledger-muted">
        Policy: {policy}
      </p>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg border border-ledger-border bg-[#090e0b] p-3 font-mono text-[11px] leading-5 text-ledger-cream/85">
        {response}
      </pre>
      <p className="mt-3 text-sm leading-relaxed text-ledger-cream/75">{why}</p>
    </figure>
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

function ScaleScenario({
  employees,
  engineers,
  monthlyTokens,
  lowerModel,
  lowerCost,
  higherModel,
  higherCost,
  savings,
}: {
  employees: number;
  engineers: number;
  monthlyTokens: number;
  lowerModel: string;
  lowerCost: number;
  higherModel: string;
  higherCost: number;
  savings: number;
}) {
  return (
    <div className="rounded-xl border border-ledger-border bg-[#090e0b] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-ledger-muted">
        {employees.toLocaleString()}-person software company
      </p>
      <p className="mt-2 font-mono text-sm text-ledger-cream">
        {engineers.toLocaleString()} engineers ·{" "}
        {(monthlyTokens / 1_000_000_000).toLocaleString()}B tokens/month
      </p>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt className="text-ledger-cream/70">{lowerModel}</dt>
          <dd className="font-mono text-neon-green">
            {formatDollars(lowerCost)}/month
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-ledger-cream/70">{higherModel}</dt>
          <dd className="font-mono text-red-300">
            {formatDollars(higherCost)}/month
          </dd>
        </div>
      </dl>
      <div className="mt-5 border-t border-ledger-border pt-4">
        <p className="text-xs uppercase tracking-[0.16em] text-ledger-muted">
          Estimated difference
        </p>
        <p className="mt-2 font-mono text-2xl text-ledger-cream">
          {formatDollars(savings)}/month
        </p>
        <p className="mt-1 font-mono text-sm text-ledger-muted">
          {formatDollars(savings * 12)}/year
        </p>
      </div>
    </div>
  );
}

function FlagshipRow({
  label,
  sol,
  fable,
}: {
  label: string;
  sol: string;
  fable: string;
}) {
  return (
    <tr>
      <th className="px-4 py-3 font-sans font-normal text-ledger-cream/70">
        {label}
      </th>
      <td className="px-4 py-3">{sol}</td>
      <td className="px-4 py-3">{fable}</td>
    </tr>
  );
}

function FeaturedAnalysisSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-neon-green/35 bg-neon-green/[0.06] p-6 shadow-[0_0_60px_rgba(0,229,153,0.06)] md:p-8">
      <div className="absolute inset-y-0 left-0 w-1 bg-neon-green" />
      <p className="text-xs uppercase tracking-[0.2em] text-neon-green">
        {eyebrow}
      </p>
      <h3 className="mt-3 text-3xl font-light text-ledger-cream">{title}</h3>
      <div className="mt-5 space-y-4 leading-relaxed text-ledger-cream/80">
        {children}
      </div>
    </section>
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
