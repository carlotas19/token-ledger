import { NextResponse } from "next/server";
import { getLatestBenchmark } from "@/lib/benchmark-store";

export async function GET() {
  try {
    const benchmark = await getLatestBenchmark();
    if (!benchmark) {
      return NextResponse.json({ benchmark: null }, { status: 404 });
    }
    return NextResponse.json({ benchmark });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load benchmark",
      },
      { status: 500 },
    );
  }
}
