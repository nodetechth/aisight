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
              <p className="text-gray-300">{grade.msg}</p>
            </div>

            {/* 各指標 */}
            <div className="bg-white/3 border border-white/10 rounded-2xl p-6 space-y-5">
              <h2 className="font-bold text-lg">指標の内訳</h2>
              {Object.entries(result.scores).map(([key, score]) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-2">
                    <span>{SCORE_LABELS[key]}</span>
                    <span className="text-blue-400 font-bold">{score} / 20</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000"
                      style={{ width: `${(score / 20) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
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
