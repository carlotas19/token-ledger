import { NextResponse } from "next/server";
import { getLatestBenchmark } from "@/lib/benchmark-store";
import latestBenchmark from "@/data/latest-benchmark.json";
import type { BenchmarkSummary } from "@/lib/types";

const publishedBenchmark =
  latestBenchmark as unknown as BenchmarkSummary;

export async function GET() {
  try {
    const benchmark =
      (await getLatestBenchmark()) ?? publishedBenchmark;
    return NextResponse.json({ benchmark });
  } catch (error) {
    return NextResponse.json({
      benchmark: publishedBenchmark,
      source: "published-snapshot",
      databaseError:
        error instanceof Error ? error.message : "Failed to load benchmark",
    });
  }
}
