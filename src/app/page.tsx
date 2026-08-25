import { LedgerApp } from "@/components/LedgerApp";
import { getLatestBenchmark } from "@/lib/benchmark-store";
import latestBenchmark from "@/data/latest-benchmark.json";
import type { BenchmarkSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
const publishedBenchmark =
  latestBenchmark as unknown as BenchmarkSummary;

export default async function HomePage() {
  let benchmark = null;

  try {
    benchmark = await getLatestBenchmark();
  } catch {
    benchmark = null;
  }

  return (
    <LedgerApp
      benchmark={benchmark ?? publishedBenchmark}
    />
  );
}
