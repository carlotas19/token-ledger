import type { BenchmarkSummary } from "@/lib/types";

interface DetailedMethodologyProps {
  benchmark: BenchmarkSummary;
}

const SYSTEM_PROMPT = `You are a support agent for a developer platform.
Read the customer message, account context, and policy notes.
Return ONLY valid JSON with this shape:
{
  "classification": "billing|access|feature|security|refund|other",
  "action": "reply_only|reset_password|issue_credit|deny_request|escalate_security",
  "escalate": true|false,
  "customer_reply": "concise customer-facing reply"
}
Rules:
- Never invent account facts not present in the context.
- Escalate only when the policy notes require escalation.
- Follow refund and credit policy strictly.
- Keep customer_reply under 120 words.`;

const SAMPLE_QUERY = `Ticket: Credential leak

Customer message:
Our database password appeared in a public gist. This is blocking our team today.

Account context:
Production branch active. The gist is confirmed public.

Policy notes:
Treat this as a security incident. Recommend rotation and escalate.`;

export function DetailedMethodology({ benchmark }: DetailedMethodologyProps) {
  return (
    <article className="mx-auto max-w-4xl px-6 py-12 lg:px-0">
      <header>
        <p className="text-sm uppercase tracking-[0.3em] text-ledger-muted">
          Reproduce the benchmark
        </p>
        <h2 className="mt-3 text-4xl font-light text-ledger-cream">
          How we ran the test
        </h2>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ledger-cream/75">
          We created one Neon project, one isolated branch per model, and a fixed
          set of 100 synthetic support tickets. Every model receives the same
          workload and task contract. Each ticket is one task. We count all
          tokens spent and estimate the price of each response that passes.
        </p>
      </header>

      <div className="mt-12 space-y-14">
        <Section title="The simulated workload">
          <p>
            The workload contains 20 support scenarios. Each scenario appears in
            five language variants: direct, urgent, frustrated, asks for next
            steps, and written for a nontechnical reader. This produces exactly
            100 tickets while keeping the expected policy decision fixed within
            each scenario.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>30 billing tickets</li>
            <li>25 product and feature tickets</li>
            <li>20 security tickets</li>
            <li>15 account-access tickets</li>
            <li>10 refund tickets</li>
          </ul>
          <p>
            Scenarios cover invoices, password resets, credential leaks,
            phishing, refunds, connection pooling, branch recovery, Data API
            access control, and AI Gateway model availability.
          </p>
          <a
            href="/workload.json"
            className="inline-flex rounded-full border border-neon-green/30 px-4 py-2 text-sm text-neon-green hover:bg-neon-green/5"
            download
          >
            Download all 100 tickets as JSON
          </a>
        </Section>

        <Section title="What we ask each model">
          <p>
            Each request has two messages. The system message defines the output
            contract and policy rules. The user message contains one ticket,
            account context, and the policy note the support agent must follow.
          </p>
          <CodeBlock>{SYSTEM_PROMPT}</CodeBlock>
          <p>One generated user query looks like this:</p>
          <CodeBlock>{SAMPLE_QUERY}</CodeBlock>
          <p>
            The complete generator is published in{" "}
            <a
              href="https://github.com/carlotas19/token-ledger/blob/main/scripts/generate-workload.py"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-green underline decoration-neon-green/30 underline-offset-4"
            >
              scripts/generate-workload.py
            </a>
            . There is no model-generated test data in the scoring path.
          </p>
        </Section>

        <Section title="How a task passes">
          <p>
            Every model receives all 100 tickets. A response counts as a completed
            task only when every deterministic check below passes. A result such
            as 73/100 means the model returned 100 responses and 73 passed all
            checks. There is no model-as-judge score.
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>The response parses as JSON with all four required fields.</li>
            <li>The classification matches the expected ticket category.</li>
            <li>The selected action is permitted by the ticket policy.</li>
            <li>The escalation decision is correct.</li>
            <li>The customer reply contains 1 to 120 words.</li>
            <li>Every required policy term appears.</li>
            <li>No forbidden promise, amount, or claim appears.</li>
          </ol>
          <p>
            Failed responses do not count as completed tasks. Their tokens and
            estimated price still count in the model total. Tokens per completed
            task equals total tokens across all 100 attempts divided by responses
            that passed. Estimated cost per completed task uses the same
            denominator.
          </p>
        </Section>

        <Section title="One Neon branch per model">
          <p>
            The benchmark project is{" "}
            <code className="font-mono text-neon-green">token-ledger</code> in
            AWS US East (Ohio). Before a run, the runner reads the enabled model
            catalog and creates one child branch from{" "}
            <code className="font-mono text-neon-green">main</code> for every
            model. A branch is named after its model, for example{" "}
            <code className="font-mono text-neon-green">model-gpt-5-mini</code>.
          </p>
          <p>
            Neon backend services branch with the database, so each child gets
            its own AI Gateway endpoint (
            <a
              href="https://neon.com/docs/introduction/branching"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-green underline decoration-neon-green/30 underline-offset-4"
            >
              branching reference
            </a>
            ). The credential created on main is valid on descendant branches (
            <a
              href="https://neon.com/docs/ai-gateway/authentication#how-branch-binding-works"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-green underline decoration-neon-green/30 underline-offset-4"
            >
              credential lineage
            </a>
            ). Every model is therefore called through a separate branch endpoint.
          </p>
          <p>
            Raw responses are collected by the runner and the summary is stored
            centrally for the public app. The branches isolate model traffic and
            make each model run inspectable without mixing endpoints.
          </p>
        </Section>

        <Section title="Request settings">
          <ul className="list-disc space-y-2 pl-5">
            <li>One request per task, 100 requests per model</li>
            <li>Maximum output: 2,048 tokens</li>
            <li>No temperature override, because some catalog models do not expose it</li>
            <li>Chat Completions for compatible text models</li>
            <li>OpenAI Responses API for models that require that endpoint</li>
            <li>Provider-reported input, output, total, and reasoning tokens</li>
            <li>Transient 429 and 5xx responses retried with exponential backoff</li>
          </ul>
        </Section>

        <Section title="Pricing">
          <p>
            Each run snapshots the public model catalog and its input/output
            price per million tokens. Proprietary models use their published lab
            rates. Open-weight models use the Databricks Foundation Model API
            pay-per-token rate surfaced by the catalog. The source snapshot is{" "}
            <a
              href="https://neon.com/models.json"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-green underline decoration-neon-green/30 underline-offset-4"
            >
              neon.com/models.json
            </a>
            , with Databricks pay-per-token behavior described in the{" "}
            <a
              href="https://docs.databricks.com/aws/en/machine-learning/foundation-model-apis/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-green underline decoration-neon-green/30 underline-offset-4"
            >
              Foundation Model API reference
            </a>
            .
          </p>
          <p>
            AI Gateway inference is free during beta. Prices shown here are
            estimates from the public rates, not charges observed on a Neon invoice.
          </p>
        </Section>

        <Section title="Reproducibility">
          <dl className="grid gap-3 text-sm sm:grid-cols-[12rem_1fr]">
            <dt className="text-ledger-muted">Current run</dt>
            <dd className="font-mono">{benchmark.name}</dd>
            <dt className="text-ledger-muted">Tickets</dt>
            <dd>{benchmark.ticketCount}</dd>
            <dt className="text-ledger-muted">Models and branches</dt>
            <dd>{benchmark.modelCount}</dd>
            <dt className="text-ledger-muted">Started</dt>
            <dd>{new Date(benchmark.startedAt).toLocaleString()}</dd>
            <dt className="text-ledger-muted">Catalog snapshot</dt>
            <dd>{new Date(benchmark.catalogSnapshotAt).toLocaleString()}</dd>
            {benchmark.gitCommit && (
              <>
                <dt className="text-ledger-muted">Git commit</dt>
                <dd className="font-mono">{benchmark.gitCommit}</dd>
              </>
            )}
          </dl>
        </Section>

        <Section title="Limits">
          <ul className="list-disc space-y-2 pl-5">
            <li>This ranking applies to structured support replies only.</li>
            <li>One run cannot measure output variance across repeated generations.</li>
            <li>Provider tokenizers differ, so a token is not identical across models.</li>
            <li>Strict checks measure policy completion, not writing style.</li>
            <li>Prices and enabled models can change after the snapshot date.</li>
            <li>Models without a public price appear in token results but not price rankings.</li>
          </ul>
        </Section>
      </div>
    </article>
  );
}

function Section({
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

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-ledger-border bg-ledger-charcoal p-5 font-mono text-xs leading-6 text-ledger-cream/80">
      {children}
    </pre>
  );
}
