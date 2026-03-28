// ユーザーの業種内ポジション計算

import { getLatestBenchmark, type BenchmarkMetrics } from "./benchmark-aggregator";

export type BenchmarkPosition = {
  industry: string;
  sampleSize: number;
  percentile: number;
  rankLabel: string;
  vsAverage: number;
  subScores: {
    name: string;
    userScore: number;
    industryAverage: number;
    difference: number;
    percentile: number;
  }[];
  calculatedAt: string | null;
};

// パーセンタイルを計算（正規分布近似）
function calculatePercentile(
  userScore: number,
  mean: number,
  p25: number,
  p75: number
): number {
  // IQRから標準偏差を推定
  const iqr = p75 - p25;
  const stdDev = iqr / 1.35; // 正規分布の場合 IQR ≈ 1.35σ

  if (stdDev === 0) {
    return userScore >= mean ? 50 : 50;
  }

  // Zスコア計算
  const z = (userScore - mean) / stdDev;

  // 正規分布の累積分布関数（近似）
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

  const percentile = z > 0 ? (1 - p) * 100 : p * 100;

  return Math.round(Math.min(99, Math.max(1, percentile)));
}

// ランクラベルを生成
function generateRankLabel(percentile: number): string {
  if (percentile >= 90) return "上位10%";
  if (percentile >= 80) return "上位20%";
  if (percentile >= 70) return "上位30%";
  if (percentile >= 60) return "上位40%";
  if (percentile >= 50) return "上位50%";
  if (percentile >= 40) return "下位40%";
  if (percentile >= 30) return "下位30%";
  if (percentile >= 20) return "下位20%";
  return "下位10%";
}

// ユーザーのベンチマークポジションを計算
export async function getUserBenchmarkPosition(
  totalScore: number,
  scores: Record<string, number>,
  technicalScore: number,
  industry: string
): Promise<BenchmarkPosition> {
  const benchmark = await getLatestBenchmark(industry);

  // ベンチマークがない場合のフォールバック
  if (!benchmark) {
    return {
      industry,
      sampleSize: 0,
      percentile: 50,
      rankLabel: "データなし",
      vsAverage: 0,
      subScores: [],
      calculatedAt: null,
    };
  }

  const metrics = benchmark.metrics;

  // 総合スコアのパーセンタイル計算
  const percentile = calculatePercentile(
    totalScore,
    metrics.total.mean,
    metrics.total.p25,
    metrics.total.p75
  );

  const rankLabel = generateRankLabel(percentile);
  const vsAverage = totalScore - metrics.total.mean;

  // サブスコア別の比較
  const subScoreMapping: { key: keyof BenchmarkMetrics; name: string; getUserScore: () => number }[] = [
    { key: "structuredData", name: "構造化データ", getUserScore: () => scores.structuredData ?? 0 },
    { key: "answerCapsule", name: "回答カプセル", getUserScore: () => scores.answerCapsule ?? 0 },
    { key: "infoDensity", name: "情報密度", getUserScore: () => scores.infoDensity ?? 0 },
    { key: "contentLength", name: "コンテンツ長", getUserScore: () => scores.contentLength ?? 0 },
    { key: "metaInfo", name: "メタ情報", getUserScore: () => scores.metaInfo ?? 0 },
    { key: "aiCitation", name: "AI引用", getUserScore: () => scores.aiCitation ?? 0 },
    { key: "technical", name: "技術スコア", getUserScore: () => technicalScore },
  ];

  const subScores = subScoreMapping.map(({ key, name, getUserScore }) => {
    const metricStats = metrics[key];
    const userScore = getUserScore();
    const industryAverage = metricStats.mean;
    const difference = userScore - industryAverage;
    const subPercentile = calculatePercentile(
      userScore,
      metricStats.mean,
      metricStats.p25,
      metricStats.p75
    );

    return {
      name,
      userScore,
      industryAverage,
      difference,
      percentile: subPercentile,
    };
  });

  return {
    industry,
    sampleSize: benchmark.sample_size,
    percentile,
    rankLabel,
    vsAverage,
    subScores,
    calculatedAt: benchmark.calculated_at,
  };
}

// シンプルなポジション取得（Free用）
export async function getSimpleBenchmarkPosition(
  totalScore: number,
  industry: string
): Promise<{
  industry: string;
  industryAverage: number;
  vsAverage: number;
  hasData: boolean;
}> {
  const benchmark = await getLatestBenchmark(industry);

  if (!benchmark) {
    return {
      industry,
      industryAverage: 0,
      vsAverage: 0,
      hasData: false,
    };
  }

  return {
    industry,
    industryAverage: benchmark.metrics.total.mean,
    vsAverage: totalScore - benchmark.metrics.total.mean,
    hasData: true,
  };
}
