"use client";
import { useState } from "react";

type ScoreResult = {
  url: string;
  total: number;
  scores: {
    structuredData: number;
    answerCapsule: number;
    infoDensity: number;
    contentLength: number;
    metaInfo: number;
    aiCitation: number;
  };
  cited: boolean;
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

  const handleAnalyze = async () => {
    if (!url) return;
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError("診断に失敗しました。URLを確認してください。");
    } finally {
      setLoading(false);
    }
  };

  const grade = result ? getGrade(result.total) : null;

  return (
    <main className="min-h-screen bg-[#080C14] text-white px-6 py-16">
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-[#080C14]/90 backdrop-blur border-b border-white/5">
        <a href="/" className="text-xl font-bold tracking-tight">AI<span className="text-blue-500">Sight</span></a>
      </nav>

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

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-6">
            {error}
          </div>
        )}

        {/* ローディング */}
        {loading && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-4 animate-pulse">🤖</div>
            <p>AIがサイトを解析中です...</p>
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
              <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-white/10 text-gray-500 w-fit">
                <span>🔒</span>
                <span>AI引用状況は有料プランで確認</span>
              </div>
            </div>

            {/* 各指標 */}
            <div className="bg-white/3 border border-white/10 rounded-2xl p-6 space-y-5">
              <h2 className="font-bold text-lg">指標の内訳</h2>
              {Object.entries(result.scores).map(([key, score]) => {
                const isLocked = LOCKED_SCORES.includes(key);
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
                        <button className="text-xs text-blue-400 hover:text-blue-300 font-medium transition">
                          有料プランで確認する →
                        </button>
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

            {/* シェアボタン */}
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${result.url} のAIEOスコアは${result.total}点でした！ #AIEO #AISight\nhttps://aisight.nodetech.jp/analyze`)}`}
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
