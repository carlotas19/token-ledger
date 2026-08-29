# Tokenomics, measured

A small, practical benchmark of AI models, built with
[Neon AI Gateway](https://neon.com/docs/ai-gateway/overview).

The benchmark sends the same synthetic support workload to every enabled text
model. It records provider-reported token usage, tests every response against a
deterministic contract, and applies the
[published AI Gateway prices](https://neon.com/docs/ai-gateway/models#available-models).

Live app: [token-ledger-three.vercel.app](https://token-ledger-three.vercel.app)

## What the benchmark tests

The prompt is: “Use an LLM to reply to 100 support tickets.”

The dataset contains 20 support scenarios, each written in five variants:
direct, urgent, frustrated, asks for next steps, and written for a
nontechnical reader. The 100 tickets cover billing, product questions,
security incidents, account access, and refunds.

Every model receives all 100 tickets. Each request contains:

- The same system prompt and JSON response contract
- A customer message
- Account context
- Policy notes
- Expected classifications, allowed actions, escalation behavior, required
  terms, and forbidden claims

A response counts as a completed ticket only when every deterministic check
passes. The benchmark does not use another model as a judge.

## Metrics

The main chart plots the full 100-ticket workload:

- **Total workload tokens**: all input and output tokens from 100 requests
- **Published workload cost**: those tokens multiplied by the published Neon
  AI Gateway input and output prices
- **Responses passed**: shown as bubble size and in the tooltip
- **100-ticket run time**: sum of measured request latency for one model’s 100
  sequential requests
- **Median and p95 ticket latency**: typical response time and the slower tail

Cost and pass rate answer different questions. Cost measures efficiency. Pass
rate is a separate quality signal that measures how often a model produced a
response the application could use. A production evaluation should set a
minimum acceptable pass rate before comparing cost among the models that meet
it.

The tables below the chart rank token efficiency, cost efficiency, and workload
time. Cost metrics normalize by successful responses:

```text
tokens per completed ticket = total workload tokens / responses passed
cost per completed ticket = published workload cost / responses passed
```

Failed responses remain in the token and cost totals. This reflects the cost
of producing an unusable answer.

## Architecture

```text
100-ticket JSON workload
          |
          v
Python benchmark runner
          |
          +-- model-a branch --> branch AI Gateway endpoint --> model-a
          +-- model-b branch --> branch AI Gateway endpoint --> model-b
          +-- model-n branch --> branch AI Gateway endpoint --> model-n
          |
          v
raw responses + deterministic grades + token usage
          |
          v
published aggregate JSON --> Next.js app --> Vercel
```

The application stack is:

- Next.js 15 and React 19
- Recharts for the benchmark visualization
- Tailwind CSS for styling
- Neon AI Gateway for model inference
- Neon branches for isolated model endpoints
- Lakebase Postgres schema and data-access path for normalized benchmark runs
- Vercel for the public deployment
- GitHub Actions for scheduled and manual benchmark runs

## Neon setup

The benchmark uses one Neon project in AWS US East (Ohio), the region where AI
Gateway is available during beta.

- Project: `token-ledger`
- Parent branch: `main`
- Model branches: one child branch per enabled model
- Branch naming: `model-<model-id>`, for example `model-gemma-3-12b`

Before inference starts, `scripts/run-benchmark.py` reads the enabled model list
from the branch AI Gateway `/v1/models` endpoint and keeps every model that can
return text, including multimodal models. It then creates any missing model
branches with the Neon CLI:

```bash
neon branches create \
  --project-id "$PROJECT_ID" \
  --parent "$PARENT_BRANCH" \
  --name "model-<model-id>" \
  --no-compute
```

The runner does not need a Postgres compute for these branches. Each branch has
its own AI Gateway endpoint. The benchmark sends one model’s 100 requests
through that model’s branch endpoint, which keeps endpoint traffic and branch
identity separate.

The same AI Gateway credential can be used on descendant branches through
[branch-bound credential lineage](https://neon.com/docs/ai-gateway/authentication#how-branch-binding-works).

## Request and grading flow

For each model, the runner:

1. Selects the branch created for that model.
2. Sends 100 sequential ticket requests through its branch AI Gateway endpoint.
3. Uses Chat Completions for compatible text models and the Responses API for
   models that require it.
4. Retries transient `429` and `5xx` responses with exponential backoff.
5. Parses the response into the required JSON shape.
6. Runs seven deterministic checks.
7. Records the raw response, parsed response, checks, latency, and
   provider-reported input, output, total, and reasoning token counts.
8. Aggregates tokens, published cost, pass count, total workload time, median
   latency, and p95 latency.

Models run concurrently, with up to eight model workers. Requests within one
model run sequentially. A checkpoint lets later runs add newly enabled models
without rerunning completed models.

## Pricing

`scripts/run-benchmark.py` reads prices from the machine-readable model catalog
at [`neon.com/models.json`](https://neon.com/models.json). The human-readable
source is the
[AI Gateway available models table](https://neon.com/docs/ai-gateway/models#available-models).

The cost calculation is:

```text
(input tokens × input price per million
 + priced output tokens × output price per million) / 1,000,000

priced output tokens = max(
  reported output tokens,
  reported total tokens - reported input tokens
)
```

The fallback preserves generated usage when a provider includes reasoning tokens
in the total but does not break them out in the output field.

Pricing can change without rerunning inference. The saved token counts can be
repriced against the current catalog:

```bash
npm run pricing:refresh
```

This updates `src/data/latest-benchmark.json` and records the pricing
verification time and source. AI Gateway inference is free during beta, so
these values apply the published prices rather than reporting observed invoice
charges.

## Repository layout

```text
benchmark/workload.json              Generated 100-ticket dataset
benchmark/results/                   Local raw output and checkpoints, gitignored
public/workload.json                 Downloadable public dataset
scripts/generate-workload.py         Deterministic workload generator
scripts/run-benchmark.py             Branch provisioning and inference runner
scripts/refresh-pricing.py           Reprices saved token usage
src/data/latest-benchmark.json       Published aggregate used by the app
src/components/SimpleLedger.tsx      Benchmark chart and rankings
src/components/SimpleReport.tsx      Findings and analysis
src/components/DetailedMethodology.tsx Reproduction details
src/lib/schema.ts                    Normalized Lakebase Postgres schema
src/lib/benchmark-store.ts           Database-backed aggregate reader
```

The public app tries the database-backed reader first and falls back to the
committed aggregate snapshot. Keeping the snapshot in Git makes the published
numbers reviewable and lets Vercel render the benchmark without runtime
database access.

## Run locally

Requirements:

- Node.js 22 or newer
- Python 3.9 or newer
- [Neon CLI](https://neon.com/docs/cli/install)
- A Neon project with AI Gateway access

Install the app and CLI:

```bash
npm install
npm install -g neon@latest
```

Copy `.env.example` to `.env.local` and set:

```text
DATABASE_URL=...
NEON_API_KEY=...
NEON_AI_GATEWAY_BASE_URL=...
NEON_AI_GATEWAY_TOKEN=...
```

- `NEON_API_KEY` lets the CLI create model branches.
- `NEON_AI_GATEWAY_BASE_URL` is the bare AI Gateway host for the parent branch.
- `NEON_AI_GATEWAY_TOKEN` authorizes inference.
- `DATABASE_URL` is only needed for schema migration and the database-backed
  application path.

Generate the workload, run the benchmark, and start the app:

```bash
npm run workload:generate
npm run benchmark
npm run dev
```

The runner checkpoints after each model. Restarting the command resumes from
completed models when the workload size matches.

## Automation

`.github/workflows/benchmark.yml` runs every Monday at 06:00 UTC and can also
be started manually. Configure these repository secrets:

```text
DATABASE_URL
NEON_API_KEY
NEON_AI_GATEWAY_BASE_URL
NEON_AI_GATEWAY_TOKEN
```

The workflow installs the current Neon CLI, applies the schema, runs the full
benchmark, and uploads the aggregate plus raw result JSON as a workflow
artifact. Publishing a new aggregate remains an explicit review and commit
step.

## Limitations

- This is one run of one structured support workload.
- The benchmark does not measure output variance across repeated generations.
- Provider tokenizers differ, so tokens are not identical units across models.
- Deterministic checks measure contract and policy completion, not writing
  quality.
- The cost comparison changes when AI Gateway prices change.
- Model availability can differ by account and can change over time.
