import type { BenchmarkSummary } from "@/lib/types";

interface MethodologyProps {
  benchmark: BenchmarkSummary;
}

export function Methodology({ benchmark }: MethodologyProps) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 lg:px-0">
      <header className="mb-12">
        <p className="text-sm uppercase tracking-[0.3em] text-ledger-muted">Methodology</p>
        <h2 className="mt-3 text-4xl font-light text-ledger-cream">
          How Token Ledger was built
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-ledger-cream/75">
          This page documents the workload, scoring rules, infrastructure, and limits of the
          public benchmark behind the token economics thesis.
        </p>
      </header>

      <div className="space-y-12">
        <Section title="Thesis">
          <p>
            Every production AI feature has a unit economics curve. Revenue per customer has to
            cover token spend per successful outcome, plus the human work created by failed
            attempts. Token Ledger measures that curve across the Neon AI Gateway catalog using
            one repeatable business task.
          </p>
        </Section>

        <Section title="Workload">
          <p>
            The v1 task is synthetic support-ticket resolution. Each case includes a customer
            message, account context, and policy notes. The model must return JSON with
            classification, action, escalation decision, and a customer reply.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-ledger-cream/75">
            <li>{benchmark.ticketCount} tickets in the current run</li>
            <li>Categories: billing, access, feature, security, refund</li>
            <li>Temperature fixed at 0</li>
            <li>Max output tokens fixed at 500</li>
            <li>Same system prompt for every model</li>
          </ul>
        </Section>

        <Section title="Scoring">
          <p>
            We do not rank on academic benchmark scores. A result counts toward economics only if
            it passes deterministic checks:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-ledger-cream/75">
            <li>Valid JSON with required fields</li>
            <li>Correct classification and escalation decision</li>
            <li>Allowed action for the ticket policy</li>
            <li>Required policy language present</li>
            <li>No disallowed promises or invented account facts</li>
            <li>Customer reply length under 120 words</li>
          </ul>
          <p className="mt-4">
            Primary ranking metric: estimated cost per 1,000 successful resolutions.
          </p>
        </Section>

        <Section title="Token and cost accounting">
          <p>
            Token counts come from provider-reported usage on the chat-completions response. We
            store prompt tokens, completion tokens, total tokens, and reasoning tokens when the
            provider reports them.
          </p>
          <p className="mt-4">
            Dollar estimates use the catalog snapshot from{" "}
            <a
              href="https://neon.com/models.json"
              className="text-neon-green underline decoration-neon-green/30 underline-offset-4"
              target="_blank"
              rel="noopener noreferrer"
            >
              neon.com/models.json
            </a>{" "}
            at run time. AI Gateway inference is free during beta, so displayed costs are
            estimates from published per-token rates, not observed Neon invoices.
          </p>
        </Section>

        <Section title="Infrastructure">
          <ul className="list-disc space-y-2 pl-5 text-ledger-cream/75">
            <li>Next.js app on Vercel for the public UI</li>
            <li>Lakebase Postgres on Neon for benchmark runs and per-inference rows</li>
            <li>Neon AI Gateway for model access through one credential</li>
            <li>GitHub Actions for scheduled reruns</li>
            <li>Open repository with dataset, grader, and runner scripts</li>
          </ul>
          <CodeBlock>
            {`POST $NEON_AI_GATEWAY_BASE_URL/v1/chat/completions
Authorization: Bearer $NEON_AI_GATEWAY_TOKEN

{
  "model": "gpt-5-mini",
  "temperature": 0,
  "max_tokens": 500,
  "messages": [
    { "role": "system", "content": "<fixed support-agent prompt>" },
    { "role": "user", "content": "<ticket prompt>" }
  ]
}`}
          </CodeBlock>
        </Section>

        <Section title="Fairness rules">
          <ul className="list-disc space-y-2 pl-5 text-ledger-cream/75">
            <li>Only models with enabled=true in GET /v1/models are executed</li>
            <li>Models that require a provider-specific endpoint are routed through small adapters</li>
            <li>Failed attempts still count toward token spend</li>
            <li>Catalog, prompts, and prices are frozen per benchmark run</li>
            <li>Run metadata stores git commit and catalog snapshot timestamp</li>
          </ul>
        </Section>

        <Section title="Limits">
          <ul className="list-disc space-y-2 pl-5 text-ledger-cream/75">
            <li>One task family in v1. Results may not transfer to coding or vision workloads.</li>
            <li>Deterministic grading is strict by design. It favors policy compliance over prose quality.</li>
            <li>Tokenizer differences across providers mean token counts are comparable within a model series, not as absolute cross-provider physics.</li>
            <li>AI Gateway beta limits apply, including per-minute token caps and account quotas.</li>
          </ul>
        </Section>

        <Section title="Reproducibility">
          <p>
            Current run: <span className="font-mono text-neon-green">{benchmark.name}</span>
          </p>
          <p className="mt-2">
            Started: {new Date(benchmark.startedAt).toLocaleString()}
          </p>
          <p className="mt-2">
            Catalog snapshot: {new Date(benchmark.catalogSnapshotAt).toLocaleString()}
          </p>
          {benchmark.gitCommit && (
            <p className="mt-2">
              Git commit: <span className="font-mono">{benchmark.gitCommit}</span>
            </p>
          )}
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
      <div className="mt-4 space-y-4 leading-relaxed text-ledger-cream/75">{children}</div>
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-xl border border-ledger-border bg-ledger-charcoal p-4 font-mono text-xs leading-6 text-neon-green">
      {children}
    </pre>
  );
}
