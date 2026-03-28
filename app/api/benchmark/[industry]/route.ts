import { NextRequest, NextResponse } from "next/server";
import { getLatestBenchmark } from "@/lib/benchmark-aggregator";

// GET: 指定業種の最新ベンチマークデータを返す
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ industry: string }> }
) {
  const { industry } = await params;

  if (!industry) {
    return NextResponse.json({ error: "industry is required" }, { status: 400 });
  }

  const decodedIndustry = decodeURIComponent(industry);
  const benchmark = await getLatestBenchmark(decodedIndustry);

  if (!benchmark) {
    return NextResponse.json(
      { error: "not_found", message: "この業種のベンチマークデータはまだありません" },
      { status: 404 }
    );
  }

  return NextResponse.json(benchmark);
}
