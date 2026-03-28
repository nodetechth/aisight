import { NextRequest, NextResponse } from "next/server";
import { aggregateBenchmarks } from "@/lib/benchmark-aggregator";

// Vercel Cron で毎日AM3:00に実行
export async function GET(req: NextRequest) {
  // CRON_SECRET による認証チェック
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await aggregateBenchmarks();

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Benchmark aggregation failed",
          errors: result.errors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      industriesProcessed: result.industriesProcessed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
