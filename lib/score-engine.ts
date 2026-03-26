// スコア計算エンジン

import type { TechnicalCheckResult } from "./technical-checker";

export type ScoreBreakdown = {
  structuredData: number;
  answerCapsule: number;
  infoDensity: number;
  contentLength: number;
  metaInfo: number;
  aiCitation: number;
  technical: number;
};

// 技術スコアを計算
export function calculateTechnicalScore(technicalCheck: TechnicalCheckResult): number {
  let score = 0;

  // llms.txt あり → +5点
  if (technicalCheck.llmsTxt.exists) {
    score += 5;
  }

  // AI全ブロック → -10点
  if (technicalCheck.robotsTxt.allBlocked) {
    score -= 10;
  }
  // 一部ブロック → -3点
  else if (technicalCheck.robotsTxt.partiallyBlocked) {
    score -= 3;
  }

  return score;
}

// 総合スコアを計算
export function calculateTotalScore(breakdown: ScoreBreakdown): number {
  const baseScore =
    breakdown.structuredData +
    breakdown.answerCapsule +
    breakdown.infoDensity +
    breakdown.contentLength +
    breakdown.metaInfo +
    breakdown.aiCitation;

  // 技術スコアは加減点として適用
  const total = baseScore + breakdown.technical;

  // 0〜100の範囲に収める
  return Math.max(0, Math.min(100, total));
}

// グレード判定
export function getGrade(total: number): {
  label: string;
  color: string;
  msg: string;
} {
  if (total >= 80) return { label: "S", color: "text-green-400", msg: "AIに引用されやすい優秀なサイトです" };
  if (total >= 60) return { label: "A", color: "text-blue-400", msg: "AIに認識されています。改善でさらに上位を狙えます" };
  if (total >= 40) return { label: "B", color: "text-yellow-400", msg: "基本的な情報は伝わっています。構造化が必要です" };
  if (total >= 20) return { label: "C", color: "text-orange-400", msg: "AIからの認知度が低い状態です" };
  return { label: "D", color: "text-red-400", msg: "AIにほぼ認識されていません。早急な改善が必要です" };
}
