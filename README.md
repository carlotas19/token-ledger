# Token Ledger

Public benchmark app for Neon AI Gateway token economics.

Token Ledger runs one repeatable business task across the AI Gateway catalog, measures provider-reported token usage, grades successful outcomes with deterministic checks, and ranks models by estimated cost per 1,000 successful resolutions.

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

5. Run a sample benchmark:

```bash
npm run benchmark:sample
```

6. Start the app:

```bash
npm run dev
```

## Benchmark task

v1 uses synthetic support-ticket resolution. Each model receives the same customer message, account context, and policy notes, then must return JSON with classification, action, escalation, and a customer reply.

Primary metric:

`estimated cost per 1,000 successful resolutions`

## App sections

- **Ledger**: efficiency frontier, token anatomy, leaderboard
- **Report**: thesis, business calculator, analysis notes
- **Methodology**: workload, scoring, infrastructure, limits, reproducibility

## Neon project

- Organization: Neon DevRel
- Project: `token-ledger`
- Region: `aws-us-east-2`

## Notes

- AI Gateway inference is free during beta. Dollar figures in the app are estimates from catalog per-token rates at snapshot time.
- The UI falls back to demo data until the first benchmark run is stored in Postgres.
