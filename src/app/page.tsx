import { LedgerApp } from "@/components/LedgerApp";
import { getLatestBenchmark } from "@/lib/benchmark-store";
import { demoBenchmark } from "@/data/demo-benchmark";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let benchmark = null;

  try {
    benchmark = await getLatestBenchmark();
  } catch {
    benchmark = null;
  }

  return <LedgerApp benchmark={benchmark ?? demoBenchmark} />;
}
