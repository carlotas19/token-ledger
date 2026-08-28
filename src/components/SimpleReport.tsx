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
  const pricedModels = benchmark.aggregates.filter(
    (model) =>
      model.inputPricePerMillionUsd != null &&
      model.outputPricePerMillionUsd != null,
  );
  const lowestInputRate = [...pricedModels].sort(
    (a, b) =>
      Number(a.inputPricePerMillionUsd) -
      Number(b.inputPricePerMillionUsd),
  )[0];
  const lowestOutputRate = [...pricedModels].sort(
    (a, b) =>
      Number(a.outputPricePerMillionUsd) -
      Number(b.outputPricePerMillionUsd),
  )[0];
  const rateLeader = lowestInputRate;
  const rateLeaderAlsoHasLowestOutput =
    rateLeader.modelId === lowestOutputRate.modelId;
  const rateLeaderWorkloadRank =
    workloadCostRanking.findIndex(
      (model) => model.modelId === rateLeader.modelId,
    ) + 1;
  const rateLeaderUsableRank =
    models.findIndex((model) => model.modelId === rateLeader.modelId) + 1;
  const qwenWorkloadRank = qwenOutlier
    ? workloadCostRanking.findIndex(
        (model) => model.modelId === qwenOutlier.modelId,
      ) + 1
    : null;
  const qwenUsableRank = qwenOutlier
    ? models.findIndex((model) => model.modelId === qwenOutlier.modelId) + 1
    : null;

  return (
    <article className="mx-auto max-w-4xl px-6 py-12 lg:px-0">
      <header>
        <p className="text-sm uppercase tracking-[0.3em] text-ledger-muted">
          Report
        </p>
        <h2 className="mt-3 text-4xl font-light text-ledger-cream">
          The price per token is only the starting point
        </h2>
        <div className="mt-5 max-w-3xl space-y-4 text-lg leading-relaxed text-ledger-cream/75">
          <p>
            Model selection often starts with a price table. One model charges
            less for a million input tokens. Another charges less for a million
            output tokens. It is tempting to pick the lowest rate and call it
            the cheapest model for the application.
          </p>
          <p>
            The rate does not tell us how many tokens the model will consume,
            how often its response will satisfy the application, or how much
            paid output will be discarded. Those parts only appear when the
            model runs a real task.
          </p>
          <p>
            This benchmark asks a narrow question: if 28 models receive the same
            100 support tickets, does the model with the lowest token price
            produce the lowest workload cost?
          </p>
        </div>
      </header>

      {rateLeader && (
        <section className="mt-10 rounded-2xl border border-neon-green/30 bg-neon-green/[0.05] p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-neon-green">
            The short answer
          </p>
          <h3 className="mt-3 text-2xl font-light text-ledger-cream">
            Low token rates help, but they do not determine the winner.
          </h3>
          <div className="mt-4 space-y-4 leading-relaxed text-ledger-cream/80">
            <p>
              <span className="font-mono text-ledger-cream">
                {rateLeader.modelName}
              </span>{" "}
              had the lowest published input rate in this catalog at $
              {rateLeader.inputPricePerMillionUsd?.toFixed(2)} per million
              tokens. Its ${rateLeader.outputPricePerMillionUsd?.toFixed(2)}{" "}
              output rate was{" "}
              {rateLeaderAlsoHasLowestOutput
                ? "also the lowest"
                : "not the lowest"}
              . It finished #{rateLeaderWorkloadRank} on total workload cost and
              #{rateLeaderUsableRank} on cost per usable response.
            </p>
            <p>
              <span className="font-mono text-ledger-cream">
                {lowestWorkloadCost.modelName}
              </span>{" "}
              was cheapest for all 100 attempts because it paired low rates
              with the lowest total token use. But only{" "}
              {lowestWorkloadCost.successes}/100 responses passed. Once we
              divide total spend by usable responses,{" "}
              <span className="font-mono text-neon-green">
                {leader.modelName}
              </span>{" "}
              becomes the cheapest model.
            </p>
            <p>
              The broad pattern still holds: low-rate models occupy most of the
              inexpensive end of the ranking. The exact order changes because
              token volume and pass rate matter too. Price per token predicts a
              cost advantage. It does not calculate the application’s unit
              cost by itself.
            </p>
          </div>
        </section>
      )}

      <div className="mt-14 space-y-14">
        <AnalysisSection title="Why we ran this benchmark">
          <p>
            AI costs behave more like a variable infrastructure bill than a
            software license. Every request consumes a different number of
            input and output tokens. The model makes some of that volume
            predictable through its tokenizer and response behavior, while the
            application determines the prompt, output contract, and acceptance
            criteria.
          </p>
          <p>
            A price table holds only one part of that system constant: the rate
            charged for each token. We wanted to measure the other two parts
            with a workload that resembles a small business process:
          </p>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              <span className="text-ledger-cream">Rate:</span> the published
              price for one million input or output tokens.
            </li>
            <li>
              <span className="text-ledger-cream">Volume:</span> the number of
              tokens the model actually consumes to process the workload.
            </li>
            <li>
              <span className="text-ledger-cream">Yield:</span> the share of
              responses the application can use without a retry or correction.
            </li>
          </ol>
          <p>
            Together, these turn a catalog price into an application cost. A
            model can have a low rate and generate a large amount of output. It
            can be concise but fail the required contract. It can also cost more
            per token while completing enough tickets correctly to reduce the
            cost of each usable result.
          </p>
        </AnalysisSection>

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
      </div>

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
        <AnalysisSection title="Three ways to call a model cheap">
          <p>
            The word “cheap” can refer to three different measurements. They
            should not be collapsed into one ranking.
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
          </ol>
          <p>
            Each measure answers a valid question. The first helps screen a
            catalog. The second estimates the model bill for a known traffic
            pattern. The third gets closer to the cost of delivering a product
            feature, because it does not count failed output as completed work.
          </p>
        </AnalysisSection>

        <AnalysisSection title="How the ranking changed">
          <p>
            The lowest token rate did not produce the lowest total workload
            cost. {rateLeader.modelName} had the lowest input{" "}
            {rateLeaderAlsoHasLowestOutput ? "and output rates" : "rate"}, but
            it generated {rateLeader.totalTokens.toLocaleString()} tokens.{" "}
            {lowestWorkloadCost.modelName} generated only{" "}
            {lowestWorkloadCost.totalTokens.toLocaleString()}, so its 100-ticket
            workload cost less even though its rates were slightly higher.
          </p>
          <p>
            The ranking changed again when we asked how much a usable response
            cost. {lowestWorkloadCost.modelName} passed{" "}
            {lowestWorkloadCost.successes} tickets. {leader.modelName} passed{" "}
            {leader.successes}. The second model spent more on the complete
            workload, but it spread that spend across nearly twice as many
            usable responses. That moved {leader.modelName} into first place on
            cost per completed ticket.
          </p>
          <p>
            This is the main result of the experiment. Catalog rates explained
            the broad shape of the cost ranking, while measured token use and
            pass rate decided the order within the low-cost group.
          </p>
        </AnalysisSection>

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
            The prompt text was fixed, but a token is not a universal unit.
            Model families use different tokenizers, and providers can account
            for request framing differently. The benchmark keeps the text
            constant and records the provider’s count. It cannot attribute each
            input-token difference to one of those mechanisms.
          </p>
          <p>
            Priced output totals ranged from{" "}
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
            × spread. Output behavior, not prompt tokenization, created most of
            the token gap in this run.
          </p>
          <p>
            Output volume includes more than the customer-facing sentence. A
            model may generate longer JSON, return separately counted reasoning
            blocks, or reach the output cap before returning the expected
            object. Output rates are also higher than input rates for
            most models in this catalog. Extra generated tokens can therefore
            affect cost more than the same number of extra prompt tokens.
          </p>
          {modelsWithUnsplitOutput.length > 0 && (
            <p>
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
            {lowestWorkloadCost.successes}/100 responses passed.
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

        <AnalysisSection title="A practical model-selection process">
          <p>
            The benchmark suggests a sequence for choosing a model. The order
            matters because each step removes a different source of false
            savings.
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
              reasoning, retries, parse failures, and fallback calls.
            </li>
            <li>
              Calculate the cost of the whole workload and divide it by usable
              results. Compare that number among models that passed the quality
              threshold.
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
        </AnalysisSection>

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
            stable or whether the model moves widely from run to run. Latency,
            rate limits, caching, batch discounts, retry policies, and human
            review costs sit outside this comparison.
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

        <AnalysisSection title="What we learned">
          <p>
            The cheapest rates did not produce the exact cheapest-workload
            ranking. They produced a strong starting advantage. Models with low
            rates filled the low-cost end of the table, but token volume changed
            their order and pass rate changed it again.
          </p>
          <ul className="list-disc space-y-3 pl-5">
            <li>
              {rateLeader.modelName} had the lowest input{" "}
              {rateLeaderAlsoHasLowestOutput ? "and output rates" : "rate"}, yet
              finished #{rateLeaderWorkloadRank} by workload cost and #
              {rateLeaderUsableRank} by cost per usable response.
            </li>
            <li>
              {lowestWorkloadCost.modelName} had the lowest workload bill, but
              its {(lowestWorkloadCost.passRate * 100).toFixed(0)}% pass rate
              made each usable response more expensive than {leader.modelName}.
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
          </ul>
          <p>
            The useful unit is the cost of an accepted outcome. A token rate can
            estimate that unit only after the application measures how many
            tokens the model consumes and how often the result works.
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

function FormulaBlock({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-ledger-border bg-[#090e0b] px-4 py-3 font-mono text-sm text-ledger-cream">
      {children}
    </p>
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
