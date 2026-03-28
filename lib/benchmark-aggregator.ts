// 業種別ベンチマーク集計エンジン

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type BenchmarkMetrics = {
  total: MetricStats;
  structuredData: MetricStats;
  answerCapsule: MetricStats;
  infoDensity: MetricStats;
  contentLength: MetricStats;
  metaInfo: MetricStats;
  aiCitation: MetricStats;
  technical: MetricStats;
};

export type MetricStats = {
  mean: number;
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
};

// 統計値を計算するヘルパー
export function calculateMetrics(scores: number[]): MetricStats {
  if (scores.length === 0) {
    return { mean: 0, median: 0, p25: 0, p75: 0, min: 0, max: 0 };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const n = sorted.length;

  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = Math.round(sum / n);

  const median = n % 2 === 0
    ? Math.round((sorted[n / 2 - 1] + sorted[n / 2]) / 2)
    : sorted[Math.floor(n / 2)];

  const p25Index = Math.floor(n * 0.25);
  const p75Index = Math.floor(n * 0.75);

  return {
    mean,
    median,
    p25: sorted[p25Index],
    p75: sorted[p75Index],
    min: sorted[0],
    max: sorted[n - 1],
  };
}

// 業種別ベンチマークを集計してDBに保存
export async function aggregateBenchmarks(): Promise<{
  success: boolean;
  industriesProcessed: number;
  errors: string[];
}> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const errors: string[] = [];
  let industriesProcessed = 0;

  try {
    // 直近90日間の診断データを取得
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: diagnoses, error: fetchError } = await supabase
      .from("diagnosis_results")
      .select("detected_industry, total_score, scores, technical_score")
      .gte("created_at", ninetyDaysAgo.toISOString())
      .not("detected_industry", "is", null);

    if (fetchError) {
      throw new Error(`Failed to fetch diagnoses: ${fetchError.message}`);
    }

    if (!diagnoses || diagnoses.length === 0) {
      return { success: true, industriesProcessed: 0, errors: [] };
    }

    // 業種別にグループ化
    const byIndustry: Record<string, typeof diagnoses> = {};
    for (const d of diagnoses) {
      const industry = d.detected_industry || "その他";
      if (!byIndustry[industry]) {
        byIndustry[industry] = [];
      }
      byIndustry[industry].push(d);
    }

    // 各業種のベンチマークを計算
    for (const [industry, data] of Object.entries(byIndustry)) {
      // サンプル数10件未満はスキップ
      if (data.length < 10) {
        continue;
      }

      try {
        const metrics: BenchmarkMetrics = {
          total: calculateMetrics(data.map((d) => d.total_score)),
          structuredData: calculateMetrics(
            data.map((d) => (d.scores as Record<string, number>)?.structuredData ?? 0)
          ),
          answerCapsule: calculateMetrics(
            data.map((d) => (d.scores as Record<string, number>)?.answerCapsule ?? 0)
          ),
          infoDensity: calculateMetrics(
            data.map((d) => (d.scores as Record<string, number>)?.infoDensity ?? 0)
          ),
          contentLength: calculateMetrics(
            data.map((d) => (d.scores as Record<string, number>)?.contentLength ?? 0)
          ),
          metaInfo: calculateMetrics(
            data.map((d) => (d.scores as Record<string, number>)?.metaInfo ?? 0)
          ),
          aiCitation: calculateMetrics(
            data.map((d) => (d.scores as Record<string, number>)?.aiCitation ?? 0)
          ),
          technical: calculateMetrics(data.map((d) => d.technical_score ?? 0)),
        };

        // upsert（同日のデータがあれば更新、なければ挿入）
        const today = new Date().toISOString().split("T")[0];

        // 既存のレコードを削除してから挿入（UNIQUE制約対応）
        await supabase
          .from("industry_benchmarks")
          .delete()
          .eq("industry", industry)
          .eq("calculated_date", today);

        const { error: insertError } = await supabase
          .from("industry_benchmarks")
          .insert({
            industry,
            sample_size: data.length,
            metrics,
            calculated_at: new Date().toISOString(),
            calculated_date: today,
          });

        if (insertError) {
          errors.push(`${industry}: ${insertError.message}`);
        } else {
          industriesProcessed++;
        }
      } catch (e) {
        errors.push(`${industry}: ${e instanceof Error ? e.message : "Unknown error"}`);
      }
    }

    return { success: true, industriesProcessed, errors };
  } catch (e) {
    return {
      success: false,
      industriesProcessed,
      errors: [e instanceof Error ? e.message : "Unknown error"],
    };
  }
}

// 特定業種の最新ベンチマークを取得
export async function getLatestBenchmark(
  industry: string
): Promise<{
  industry: string;
  sample_size: number;
  metrics: BenchmarkMetrics;
  calculated_at: string;
} | null> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("industry_benchmarks")
    .select("*")
    .eq("industry", industry)
    .order("calculated_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    industry: data.industry,
    sample_size: data.sample_size,
    metrics: data.metrics as BenchmarkMetrics,
    calculated_at: data.calculated_at,
  };
}
