// 業種キーワードマッピング
export const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  飲食: ["レストラン", "カフェ", "居酒屋", "ラーメン", "寿司", "焼肉", "イタリアン", "フレンチ", "中華", "和食", "バー", "食堂", "弁当", "デリバリー", "テイクアウト", "グルメ", "ランチ", "ディナー"],
  医療: ["病院", "クリニック", "歯科", "内科", "外科", "皮膚科", "整形外科", "眼科", "耳鼻科", "小児科", "産婦人科", "心療内科", "整骨院", "接骨院", "鍼灸", "薬局", "医院", "ドクター", "診療"],
  美容: ["美容室", "ヘアサロン", "エステ", "ネイル", "まつげ", "脱毛", "スパ", "マッサージ", "リラクゼーション", "美容院", "ビューティー", "サロン", "ヘアカット", "カラー", "パーマ"],
  "IT・SaaS": ["システム開発", "アプリ開発", "Web制作", "ホームページ制作", "SEO", "マーケティング", "DX", "クラウド", "SaaS", "ソフトウェア", "IT", "エンジニア", "プログラミング", "AI", "データ分析"],
  不動産: ["不動産", "賃貸", "売買", "マンション", "アパート", "一戸建て", "土地", "仲介", "物件", "住宅", "リフォーム", "リノベーション", "建築", "注文住宅", "分譲"],
  士業: ["弁護士", "税理士", "司法書士", "行政書士", "社労士", "公認会計士", "弁理士", "法律事務所", "会計事務所", "コンサルタント", "相続", "登記", "確定申告"],
  宿泊: ["ホテル", "旅館", "民宿", "ゲストハウス", "宿泊", "宿", "温泉", "リゾート", "ペンション", "ビジネスホテル", "旅行", "観光"],
  教育: ["塾", "予備校", "スクール", "教室", "学習", "習い事", "英会話", "プログラミング教室", "資格", "研修", "セミナー", "講座"],
  小売: ["ショップ", "店舗", "通販", "EC", "オンラインショップ", "販売", "ストア", "専門店", "セレクトショップ"],
};

// 業種別ポータルサイト
export const INDUSTRY_PORTALS: Record<string, string[]> = {
  飲食: ["食べログ", "ぐるなび", "ホットペッパーグルメ", "Retty", "一休.comレストラン"],
  医療: ["EPARK", "Caloo", "病院なび", "ドクターズ・ファイル", "メドレー"],
  美容: ["ホットペッパービューティー", "楽天ビューティ", "minimo", "OZmall"],
  "IT・SaaS": ["ITreview", "BOXIL", "起業LOG", "アイミツ", "比較ビズ"],
  不動産: ["SUUMO", "HOME'S", "アットホーム", "不動産ジャパン", "LIFULL HOME'S"],
  士業: ["弁護士ドットコム", "税理士ドットコム", "相続会議", "マネーフォワード クラウド"],
  宿泊: ["じゃらん", "楽天トラベル", "Booking.com", "一休.com", "Expedia"],
  教育: ["塾ナビ", "コエテコ", "エキテン", "ケイコとマナブ"],
  小売: ["楽天市場", "Amazon", "Yahoo!ショッピング", "メルカリShops"],
  その他: ["Googleマップ", "エキテン", "まいぷれ", "地域情報サイト"],
};

// ローカルビジネス判定キーワード
export const LOCAL_KEYWORDS = [
  "近く", "周辺", "駅", "市", "区", "町", "県", "エリア", "地域",
  "徒歩", "アクセス", "最寄り", "営業時間", "定休日", "駐車場",
];

// 業種を推定する関数
export function detectIndustry(queries: string[], inferredIndustry?: string): string {
  // API推定結果があればそれを優先
  if (inferredIndustry && inferredIndustry !== "不明") {
    // マッピングされた業種名に変換
    for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
      if (keywords.some(kw => inferredIndustry.includes(kw)) || inferredIndustry.includes(industry)) {
        return industry;
      }
    }
  }

  // クエリからキーワードマッチング
  const allText = queries.join(" ").toLowerCase();
  const scores: Record<string, number> = {};

  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    scores[industry] = keywords.filter(kw => allText.includes(kw.toLowerCase())).length;
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore > 0) {
    return Object.entries(scores).find(([, score]) => score === maxScore)?.[0] || "その他";
  }

  return "その他";
}

// 業種に基づくポータルサイト提案
export function getRecommendedPortals(industry: string): string[] {
  return INDUSTRY_PORTALS[industry] || INDUSTRY_PORTALS["その他"];
}

// ローカルビジネス判定
export function isLocalBusiness(queries: string[], region?: string): boolean {
  if (region && region !== "不明") return true;

  const allText = queries.join(" ");
  return LOCAL_KEYWORDS.some(kw => allText.includes(kw));
}

// サイテーション戦略の優先度を決定
export function determinePriority(
  citedCount: number,
  totalQueries: number,
  isLocal: boolean
): { pressRelease: "high" | "medium" | "low"; gbp: "high" | "medium" | "low"; portal: "high" | "medium" | "low" } {
  const citationRate = citedCount / totalQueries;

  // 引用率が低いほどサイテーション施策の優先度が高い
  if (citationRate < 0.3) {
    return {
      pressRelease: "high",
      gbp: isLocal ? "high" : "medium",
      portal: "high",
    };
  } else if (citationRate < 0.7) {
    return {
      pressRelease: "medium",
      gbp: isLocal ? "high" : "low",
      portal: "medium",
    };
  } else {
    return {
      pressRelease: "low",
      gbp: isLocal ? "medium" : "low",
      portal: "low",
    };
  }
}
