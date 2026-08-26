# Tokenomics, measured

Public AI model cost benchmark built with Neon AI Gateway.

The benchmark sends the same 100-ticket support workload to every enabled text
model, measures provider-reported token usage, and grades each response with
deterministic checks. Every model attempts all 100 tasks. A completion is a
response that passes every format and policy check.

## Stack

- Next.js on Vercel
- Lakebase Postgres on Neon
- Neon AI Gateway for inference
- GitHub Actions for scheduled reruns

## Local setup

1. Copy `.env.example` to `.env.local`
2. Fill in:
   - `DATABASE_URL`
   - `NEON_AI_GATEWAY_BASE_URL`
   - `NEON_AI_GATEWAY_TOKEN`
3. Install dependencies:

```bash
npm install
```

4. Apply schema:

```bash
npm run db:migrate
```

5. Generate the 100-ticket workload:

```bash
python3 scripts/generate-workload.py
```

6. Run the full benchmark. The runner requires the Neon CLI:

```bash
python3 scripts/run-benchmark.py
```

7. Start the app:

```bash
npm run dev
```

## Benchmark task

The workload contains 20 support scenarios, each expressed in five language
variants. Each model receives the same customer message, account context, and
policy notes, then must return JSON with a classification, action, escalation
decision, and customer reply.

The response passes when it:

- Parses as the required JSON shape
- Matches the expected classification and permitted action
- Makes the correct escalation decision
- Includes required policy terms
- Avoids forbidden claims
- Keeps the customer reply between 1 and 120 words

The primary metrics are total tokens and estimated cost across all 100 attempts
divided by the number of responses that passed. Failed responses remain in the
totals because those tokens were spent.

## App sections

- **Benchmark**: cost-token chart and ordered result tables
- **Report**: thesis, findings, complete methodology, and limits

## Neon project

- Organization: Neon DevRel
- Project: `token-ledger`
- Region: `aws-us-east-2`

## Notes

- Dollar figures are estimates from catalog per-token rates at snapshot time.
- The published aggregate is in `src/data/latest-benchmark.json`.
- Raw responses and checkpoints stay local under `benchmark/results/`.
