// スコア履歴ユーティリティ

export type ScoreChange = {
  value: number;
  direction: "up" | "down" | "unchanged";
  formatted: string;
};

export function formatScoreChange(change: number | null): ScoreChange | null {
  if (change === null) return null;

  const direction = change > 0 ? "up" : change < 0 ? "down" : "unchanged";
  const sign = change > 0 ? "+" : "";
  const formatted = `${sign}${change}点`;

  return { value: change, direction, formatted };
}

export type ChartDataPoint = {
  month: string;
  monthLabel: string;
  total: number;
  content: number;
  technical: number;
  citation: number;
};

export function transformHistoryToChartData(
  history: {
    month: string;
    total_score: number;
    scores: Record<string, number>;
    technical_score: number;
  }[]
): ChartDataPoint[] {
  return history
    .map((h) => {
      const monthDate = new Date(h.month);
      const monthLabel = `${monthDate.getFullYear()}/${monthDate.getMonth() + 1}`;

      // コンテンツスコア = 構造化データ + 回答カプセル + 情報密度 + コンテンツ長 + メタ情報
      const contentScore =
        (h.scores.structuredData ?? 0) +
        (h.scores.answerCapsule ?? 0) +
        (h.scores.infoDensity ?? 0) +
        (h.scores.contentLength ?? 0) +
        (h.scores.metaInfo ?? 0);

      return {
        month: h.month,
        monthLabel,
        total: h.total_score,
        content: contentScore,
        technical: h.technical_score,
        citation: h.scores.aiCitation ?? 0,
      };
    })
    .reverse(); // 古い順に並び替え
}

export function calculateTrend(
  history: { total_score: number }[]
): "improving" | "declining" | "stable" {
  if (history.length < 2) return "stable";

  const recent = history.slice(0, 3);
  const older = history.slice(3, 6);

  if (older.length === 0) return "stable";

  const recentAvg = recent.reduce((s, h) => s + h.total_score, 0) / recent.length;
  const olderAvg = older.reduce((s, h) => s + h.total_score, 0) / older.length;

  const diff = recentAvg - olderAvg;

  if (diff > 5) return "improving";
  if (diff < -5) return "declining";
  return "stable";
}
