"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import NavBar from "@/app/components/NavBar";

type ScoreResult = {
  url: string;
  total: number;
  cited: boolean;
  scores: {
    structuredData: number;
    answerCapsule: number;
    infoDensity: number;
    contentLength: number;
    metaInfo: number;
    aiCitation: number;
  };
  aiCitationReport?: {
    industry: string;
    region: string;
    queries: { query: string; cited: boolean; context: string }[];
    citedCount: number;
    totalQueries: number;
    competitors: { query: string; sites: string[] }[];
  };
  actionPlan?: {
    priority: "high" | "medium" | "low";
    item: string;
    action: string;
  }[];
  checkedAt: string;
};

const SCORE_LABELS: Record<string, string> = {
  structuredData: "構造化データ",
  answerCapsule: "回答カプセル",
  infoDensity: "情報密度",
  contentLength: "コンテンツ長",
  metaInfo: "メタ情報",
  aiCitation: "AI引用チェック",
};

// 有料ロック対象の指標
const LOCKED_SCORES = ["aiCitation"];

const SCORE_DESCRIPTIONS: Record<string, string> = {
  structuredData: "Schema.orgなどの構造化データがサイトに実装されているかを評価します。AIはこのデータを「チートシート」として活用し、サービス内容・価格・組織情報を正確に把握します。未実装の場合、AIがサイトの情報を正しく解釈できず、推薦の優先度が下がります。",
  answerCapsule: "各セクションの冒頭で、AIが直接抜き出せる明確な定義文や回答文があるかを評価します。AIは長い文章全体を読むのではなく、段落の最初の1〜2文を優先的に引用します。「〇〇とは△△です」という形式の宣言的な文章が多いほど高スコアになります。",
  infoDensity: "本文中に具体的な数値・統計データ・定量的な情報がどれだけ含まれているかを評価します。「業界最高レベル」といった抽象表現よりも「導入企業150社・平均コスト削減20%」のような具体的数値の方がAIに信頼されやすく、引用率が約2.5倍高くなります。",
  contentLength: "AIが参照できる本文の情報量を評価します。コンテンツが少なすぎると、AIが回答を生成する際に引用できる情報が不足します。ただし文字数だけでなく、ナビゲーションや広告を除いた「実質的な本文」の量で判定しています。",
  metaInfo: "titleタグとmeta descriptionの内容と品質を評価します。これらはAIがページの主題を最初に判断する手がかりです。適切な長さ（title: 10〜60文字、description: 50〜160文字）で、サービスの内容を具体的に説明しているほど高スコアになります。",
  aiCitation: "Perplexity AIに実際に質問を投げ、あなたのサイトが回答の中で言及・引用されるかをリアルタイムで検証します。ソースとして引用された場合は20点、回答内で言及された場合は12点、認識されなかった場合は2点となります。このスコアが最も直接的なAI可視性の指標です。",
};

function getGrade(total: number) {
  if (total >= 80) return { label: "S", color: "text-green-400", msg: "AIに引用されやすい優秀なサイトです" };
  if (total >= 60) return { label: "A", color: "text-blue-400", msg: "AIに認識されています。改善でさらに上位を狙えます" };
  if (total >= 40) return { label: "B", color: "text-yellow-400", msg: "基本的な情報は伝わっています。構造化が必要です" };
  if (total >= 20) return { label: "C", color: "text-orange-400", msg: "AIからの認知度が低い状態です" };
  return { label: "D", color: "text-red-400", msg: "AIにほぼ認識されていません。早急な改善が必要です" };
}

export default function AnalyzePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState("");
  const [isPro, setIsPro] = useState(false);
  const [remainingCount, setRemainingCount] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    const checkPlan = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_plans")
        .select("plan, monthly_analysis_count, analysis_count_reset_at")
        .eq("id", user.id)
        .single();
      if (data?.plan === "pro") {
        setIsPro(true);
        const resetAt = new Date(data.analysis_count_reset_at);
        const now = new Date();
        const shouldReset =
          now.getFullYear() !== resetAt.getFullYear() ||
          now.getMonth() !== resetAt.getMonth();
        const count = shouldReset ? 0 : (data.monthly_analysis_count ?? 0);
        setRemainingCount(5 - count);
      }
    };
    checkPlan();
  }, []);

  const handleAnalyze = async () => {
    if (!url) return;
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    setLoading(true);
    setError("");
    setResult(null);
    setProgress(0);

    let interval: ReturnType<typeof setInterval>;
    interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) { clearInterval(interval); return 90; }
        return prev + Math.random() * 8 + 2;
      });
    }, 800);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { "Authorization": `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ url: normalized }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setError(data.message || "今月の診断回数上限に達しました。");
        setLoading(false);
        return;
      }

      if (data.error) throw new Error(data.error);
      setProgress(100);
      setResult(data);
      if (remainingCount !== null) setRemainingCount(prev => prev !== null ? prev - 1 : null);
    } catch (e) {
      setError("診断に失敗しました。URLを確認してください。");
    } finally {
      clearInterval(interval);
      setLoading(false);
      setProgress(0);
    }
  };

  const grade = result ? getGrade(result.total) : null;

  return (
    <main className="min-h-screen bg-[#080C14] text-white px-6 py-16">
      <NavBar />

      <div className="max-w-2xl mx-auto pt-12">
        <h1 className="text-4xl font-black tracking-tight mb-2">AIEOスコア診断</h1>
        <p className="text-gray-400 mb-10">URLを入力するだけで、あなたのサイトのAI可視性を診断します。</p>

        {/* 入力フォーム */}
        <div className="flex gap-3 mb-8">
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAnalyze()}
            placeholder="https://example.com"
            className="flex-1 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl font-bold transition whitespace-nowrap"
          >
            {loading ? "診断中..." : "診断する"}
          </button>
        </div>
        {isPro && remainingCount !== null && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            今月の残り診断回数：<span className={remainingCount <= 1 ? "text-red-400 font-bold" : "text-blue-400 font-bold"}>{remainingCount}回</span> / 5回
          </p>
        )}

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-6">
            {error}
          </div>
        )}

        {/* ローディング */}
        {loading && (
          <div className="py-16 text-center text-gray-400">
            <p className="text-sm font-medium mb-4">サイトを解析中です...</p>
            <div className="max-w-xs mx-auto">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>解析中</span>
                <span>{Math.min(Math.round(progress), 100)}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 結果表示 */}
        {result && grade && (
          <div className="space-y-6">
            {/* 総合スコア */}
            <div className="bg-white/3 border border-white/10 rounded-2xl p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="text-8xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent leading-none">
                    {result.total}
                  </div>
                  <div className="text-sm text-gray-500 mt-2">AIEOスコア / 100点</div>
                </div>
                <div className={`text-6xl font-black ${grade.color}`}>{grade.label}</div>
              </div>
              <p className="text-gray-300 mb-4">{grade.msg}</p>
              {isPro ? (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border w-fit ${
                  result.cited
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}>
                  <span>{result.cited ? "✓" : "✗"}</span>
                  <span>{result.cited ? "AIに認識されています" : "AIに認識されていません"}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-white/10 text-gray-500 w-fit">
                  <span>🔒</span>
                  <span>AI引用状況は有料プランで確認</span>
                </div>
              )}
            </div>

            {/* 各指標 */}
            <div className="bg-white/3 border border-white/10 rounded-2xl p-6 space-y-5">
              <h2 className="font-bold text-lg">指標の内訳</h2>
              {Object.entries(result.scores).map(([key, score]) => {
                const isLocked = LOCKED_SCORES.includes(key) && !isPro;
                return (
                  <div key={key} className="pb-5 border-b border-white/5 last:border-0">
                    <div className="flex justify-between text-sm mb-2">
                      <span className={`font-medium flex items-center gap-2 ${isLocked ? "text-gray-500" : ""}`}>
                        {isLocked && <span className="text-xs">🔒</span>}
                        {SCORE_LABELS[key]}
                      </span>
                      {isLocked ? (
                        <span className="text-xs text-gray-600 border border-white/10 rounded-full px-2 py-0.5">
                          有料プランで解放
                        </span>
                      ) : (
                        <span className="text-blue-400 font-bold">{score} / 20</span>
                      )}
                    </div>

                    {/* スコアバー */}
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
                      {isLocked ? (
                        <div className="h-full w-full bg-white/10 rounded-full" style={{ filter: "blur(3px)" }} />
                      ) : (
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000"
                          style={{ width: `${(score / 20) * 100}%` }}
                        />
                      )}
                    </div>

                    {/* 説明文 */}
                    {isLocked ? (
                      <div className="px-4 py-3 rounded-xl bg-blue-500/5 border border-blue-500/15 text-center">
                        <p className="text-xs text-gray-500 mb-2">
                          Perplexity AIに実際に質問し、あなたのサイトが引用されるか<br />
                          リアルタイムで検証します。最も直接的なAI可視性の指標です。
                        </p>
                        <a href="/upgrade" className="text-xs text-blue-400 hover:text-blue-300 font-medium transition">
                          有料プランで確認する →
                        </a>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {SCORE_DESCRIPTIONS[key]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* AI引用チェック詳細レポート */}
            {isPro && result.aiCitationReport && (
              <div className="mt-6 p-5 rounded-2xl bg-white/3 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white">AI引用チェック詳細</h3>
                  <span className="text-xs text-gray-500">
                    推定業種：{result.aiCitationReport.industry}
                    推定地域：{result.aiCitationReport.region}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-lg font-black ${result.cited ? "text-green-400" : "text-red-400"}`}>
                    {result.aiCitationReport.citedCount}/{result.aiCitationReport.totalQueries}クエリで引用
                  </span>
                  <span className="text-sm text-gray-500">
                    （引用率 {Math.round(result.aiCitationReport.citedCount / result.aiCitationReport.totalQueries * 100)}%）
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {result.aiCitationReport.queries.map((q, i) => (
                    <div key={i} className={`p-3 rounded-xl border text-sm ${
                      q.cited
                        ? "bg-green-500/5 border-green-500/20"
                        : "bg-white/2 border-white/5"
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span>{q.cited ? "✅" : "❌"}</span>
                        <span className="text-gray-300 font-medium">「{q.query}」</span>
                      </div>
                      {q.cited && q.context && (
                        <p className="text-xs text-gray-500 pl-6 leading-relaxed">
                          {q.context}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 競合比較 - Proのみ */}
            {isPro ? (
              result.aiCitationReport?.competitors && result.aiCitationReport.competitors.length > 0 && (
                <div className="mt-4 p-5 rounded-2xl bg-white/3 border border-white/5">
                  <h3 className="text-sm font-bold text-white mb-3">🏆 競合比較</h3>
                  <p className="text-xs text-gray-500 mb-3">同じクエリであなたの代わりに引用されているサイト</p>
                  <div className="flex flex-col gap-2">
                    {result.aiCitationReport.competitors.map((c, i) => (
                      <div key={i} className="p-3 rounded-xl bg-white/2 border border-white/5">
                        <p className="text-xs text-gray-500 mb-1">「{c.query}」で引用されたサイト</p>
                        <div className="flex flex-wrap gap-2">
                          {c.sites.map((site, j) => (
                            <span key={j} className="px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
                              {site}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div className="mt-4 flex items-center justify-between p-4 rounded-2xl bg-white/2 border border-white/5">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <span>🔒</span>
                  <span>競合比較スコア</span>
                </div>
                <a href="/upgrade" className="text-xs text-blue-400 hover:text-blue-300 transition">
                  有料プランで解放 →
                </a>
              </div>
            )}

            {/* 改善アクションプラン - Proのみ */}
            {isPro ? (
              result.actionPlan && result.actionPlan.length > 0 && (
                <div className="mt-4 p-5 rounded-2xl bg-white/3 border border-white/5">
                  <h3 className="text-sm font-bold text-white mb-3">🎯 改善アクションプラン</h3>
                  <div className="flex flex-col gap-3">
                    {result.actionPlan.map((plan, i) => (
                      <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/2 border border-white/5">
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold h-fit ${
                          plan.priority === "high"
                            ? "bg-red-500/20 text-red-400"
                            : plan.priority === "medium"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}>
                          {plan.priority === "high" ? "優先度：高" : plan.priority === "medium" ? "優先度：中" : "優先度：低"}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-white mb-1">{plan.item}</p>
                          <p className="text-xs text-gray-400 leading-relaxed">{plan.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div className="mt-4 flex items-center justify-between p-4 rounded-2xl bg-white/2 border border-white/5">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <span>🔒</span>
                  <span>改善アクションプラン</span>
                </div>
                <a href="/upgrade" className="text-xs text-blue-400 hover:text-blue-300 transition">
                  有料プランで解放 →
                </a>
              </div>
            )}

            {/* シェアボタン */}
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                [
                  `🤖 AIEOスコア診断結果`,
                  `📌 ${result.url}`,
                  ``,
                  `総合スコア：${result.total}点 / グレード：${result.total >= 80 ? "S" : result.total >= 60 ? "A" : result.total >= 40 ? "B" : "C"}`,
                  ``,
                  `📊 各指標スコア`,
                  `構造化データ：${result.scores.structuredData}/20`,
                  `回答カプセル：${result.scores.answerCapsule}/20`,
                  `情報密度：${result.scores.infoDensity}/20`,
                  `コンテンツ量：${result.scores.contentLength}/20`,
                  `メタ情報：${result.scores.metaInfo}/20`,
                  ``,
                  result.cited ? `✅ AIに認識されています` : `❌ AIに認識されていません`,
                  ``,
                  `あなたのサイトも診断してみる👇`,
                  `https://aisight.nodetech.jp`,
                  ``,
                  `#AIEO #AISight`,
                ].join("\n")
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 font-medium text-center hover:bg-sky-500/20 transition"
            >
              X（Twitter）でシェアする
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
