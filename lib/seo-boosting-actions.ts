// SEO基礎対策に関連するアクション項目
// タスク2（バッジ追加）とタスク3（カバー率計算）で使用

export const SEO_BOOSTING_ACTIONS = [
  'llms.txt',
  'robots.txt',
  'プレスリリース',
  'Googleビジネスプロフィール',
  'ポータルサイト',
  '構造化データ',
  'JSON-LD',
  'E-E-A-T',
  'EEAT',
] as const;

export type SeoBoostingAction = typeof SEO_BOOSTING_ACTIONS[number];

// アクションプランの項目がSEO関連かどうかを判定
export function isSeoBoostingAction(item: string): boolean {
  const lowerItem = item.toLowerCase();
  return SEO_BOOSTING_ACTIONS.some(action =>
    lowerItem.includes(action.toLowerCase())
  );
}

// SEO基礎対策の完了状態を判定するための型
export type SeoCompletionStatus = {
  llmsTxt: boolean;          // llms.txt が設置されている
  robotsTxt: boolean;        // robots.txt でAIクローラーを許可
  structuredData: boolean;   // 構造化データが実装されている（スコア閾値以上）
  pressRelease: boolean;     // プレスリリース関連（サイテーション戦略で高優先度でない = 対策済み）
  googleBusiness: boolean;   // GBP関連（サイテーション戦略で高優先度でない = 対策済み）
  portalSites: boolean;      // ポータルサイト関連（サイテーション戦略で高優先度でない = 対策済み）
  eeat: boolean;             // E-E-A-T関連（answerCapsuleスコアが高い = 信頼性の表現がある）
};

// SEO基礎対策カバー率を計算
export function calculateSeoCoverageRate(status: SeoCompletionStatus): number {
  const completedCount = Object.values(status).filter(Boolean).length;
  const totalCount = Object.keys(status).length;
  return Math.round((completedCount / totalCount) * 100);
}

// 完了済みのSEO対策項目数を取得
export function getCompletedSeoActionsCount(status: SeoCompletionStatus): number {
  return Object.values(status).filter(Boolean).length;
}

// 全SEO対策項目数を取得
export function getTotalSeoActionsCount(): number {
  return 7; // SeoCompletionStatusのキー数
}
