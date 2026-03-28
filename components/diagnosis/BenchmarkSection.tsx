"use client";

type BenchmarkPosition = {
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

type Props = {
  position: BenchmarkPosition | null;
  plan: "free" | "pro" | "growth";
  loading?: boolean;
};

export default function BenchmarkSection({ position, plan, loading }: Props) {
  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-white/3 border border-white/5">
        <div className="animate-pulse">
          <div className="h-4 w-32 bg-white/10 rounded mb-4" />
          <div className="h-24 bg-white/5 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!position || !position.calculatedAt) {
    return (
      <div className="p-6 rounded-2xl bg-white/3 border border-white/5">
        <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-4">
          業種別ベンチマーク
        </h3>
        <p className="text-sm text-gray-500">
          この業種のベンチマークデータはまだありません
        </p>
      </div>
    );
  }

  // Free プラン: 業種平均のみ + アップセルバナー
  if (plan === "free") {
    return (
      <div className="p-6 rounded-2xl bg-white/3 border border-white/5">
        <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-4">
          業種別ベンチマーク
        </h3>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-400">
              {position.industry}業界平均
            </p>
            <p className="text-2xl font-bold text-white">
              {position.sampleSize > 0
                ? Math.round(position.vsAverage + (position.subScores[0]?.industryAverage || 0))
                : "-"}
              点
            </p>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              position.vsAverage > 0
                ? "bg-green-500/20 text-green-400"
                : position.vsAverage < 0
                ? "bg-red-500/20 text-red-400"
                : "bg-gray-500/20 text-gray-400"
            }`}
          >
            平均{position.vsAverage >= 0 ? "+" : ""}
            {Math.round(position.vsAverage)}点
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          サンプル数: {position.sampleSize}件
        </p>

        {/* アップセルバナー */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
          <p className="text-sm text-white mb-2">
            Proプランで詳細なベンチマーク分析を見る
          </p>
          <p className="text-xs text-gray-400 mb-3">
            業種内パーセンタイル、サブスコア比較など
          </p>
          <a
            href="/pricing"
            className="inline-block px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition"
          >
            Proにアップグレード
          </a>
        </div>
      </div>
    );
  }

  // Pro / Growth プラン: 全指標表示
  return (
    <div className="p-6 rounded-2xl bg-white/3 border border-white/5">
      <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-4">
        業種別ベンチマーク - {position.industry}
      </h3>

      {/* ゲージチャート */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">業種内ポジション</span>
          <span className="text-lg font-bold text-white">
            {position.rankLabel}
          </span>
        </div>

        {/* 分布バー */}
        <div className="relative h-8 bg-white/5 rounded-full overflow-hidden">
          {/* グラデーション背景 */}
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-red-500/20" />
            <div className="flex-1 bg-yellow-500/20" />
            <div className="flex-1 bg-green-500/20" />
          </div>

          {/* ユーザー位置マーカー */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-blue-500 shadow-lg shadow-blue-500/50"
            style={{ left: `${position.percentile}%` }}
          />

          {/* パーセンタイルラベル */}
          <div
            className="absolute -top-6 transform -translate-x-1/2 px-2 py-0.5 rounded bg-blue-600 text-white text-xs"
            style={{ left: `${position.percentile}%` }}
          >
            {position.percentile}%
          </div>
        </div>

        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-3 rounded-xl bg-white/5 text-center">
          <p className="text-xs text-gray-500 mb-1">パーセンタイル</p>
          <p className="text-xl font-bold text-white">{position.percentile}%</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5 text-center">
          <p className="text-xs text-gray-500 mb-1">平均との差</p>
          <p
            className={`text-xl font-bold ${
              position.vsAverage > 0
                ? "text-green-400"
                : position.vsAverage < 0
                ? "text-red-400"
                : "text-white"
            }`}
          >
            {position.vsAverage >= 0 ? "+" : ""}
            {Math.round(position.vsAverage)}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-white/5 text-center">
          <p className="text-xs text-gray-500 mb-1">サンプル数</p>
          <p className="text-xl font-bold text-white">{position.sampleSize}</p>
        </div>
      </div>

      {/* サブスコア比較（Growth+ のみ詳細表示） */}
      {plan === "growth" && (
        <div>
          <h4 className="text-xs text-gray-500 uppercase tracking-widest mb-3">
            サブスコア詳細
          </h4>
          <div className="space-y-3">
            {position.subScores.map((sub) => (
              <div key={sub.name} className="p-3 rounded-xl bg-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white">{sub.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">
                      あなた: {sub.userScore}
                    </span>
                    <span className="text-xs text-gray-500">
                      (平均: {sub.industryAverage})
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        sub.difference > 0
                          ? "bg-green-500/20 text-green-400"
                          : sub.difference < 0
                          ? "bg-red-500/20 text-red-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {sub.difference >= 0 ? "+" : ""}
                      {Math.round(sub.difference)}
                    </span>
                  </div>
                </div>

                {/* プログレスバー */}
                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                  {/* 業界平均ライン */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
                    style={{
                      left: `${Math.min(100, (sub.industryAverage / 20) * 100)}%`,
                    }}
                  />
                  {/* ユーザースコア */}
                  <div
                    className={`h-full rounded-full ${
                      sub.difference > 0 ? "bg-green-500" : sub.difference < 0 ? "bg-red-500" : "bg-blue-500"
                    }`}
                    style={{
                      width: `${Math.min(100, (sub.userScore / 20) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pro プランの場合はサブスコアの簡易表示 */}
      {plan === "pro" && (
        <div>
          <h4 className="text-xs text-gray-500 uppercase tracking-widest mb-3">
            サブスコア比較
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {position.subScores.slice(0, 4).map((sub) => (
              <div
                key={sub.name}
                className="p-2 rounded-lg bg-white/5 flex items-center justify-between"
              >
                <span className="text-xs text-gray-400">{sub.name}</span>
                <span
                  className={`text-xs font-medium ${
                    sub.difference > 0
                      ? "text-green-400"
                      : sub.difference < 0
                      ? "text-red-400"
                      : "text-gray-400"
                  }`}
                >
                  {sub.difference >= 0 ? "+" : ""}
                  {Math.round(sub.difference)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-4">
        最終更新:{" "}
        {new Date(position.calculatedAt).toLocaleDateString("ja-JP")}
      </p>
    </div>
  );
}
