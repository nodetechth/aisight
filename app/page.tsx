"use client";
import { useState, useEffect } from "react";

const BASE_COUNT = 247;

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [registrantCount, setRegistrantCount] = useState(BASE_COUNT);

  useEffect(() => {
    fetch("/api/waitlist")
      .then(r => r.json())
      .then(data => setRegistrantCount(BASE_COUNT + (data.count ?? 0)))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("正しいメールアドレスを入力してください");
      return;
    }
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setError("");
      } else if (data.error === "already_registered") {
        setError("すでに登録済みです");
      } else {
        setError("エラーが発生しました。もう一度お試しください。");
      }
    } catch {
      setError("エラーが発生しました。もう一度お試しください。");
    }
  };

  return (
    <main className="min-h-screen bg-[#080C14] text-white font-sans">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-[#080C14]/90 backdrop-blur border-b border-white/5">
        <span className="text-xl font-bold tracking-tight">AI<span className="text-blue-500">Sight</span></span>
        <div className="flex items-center gap-4">
          <a
            href="https://www.nodetech.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-white transition"
          >
            運営会社
          </a>
          <button
            onClick={() => document.querySelector("form")?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition"
          >
            先行登録する
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="flex flex-col items-center justify-center min-h-screen text-center px-6 pt-20">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          β版 先行登録受付中
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-tight mb-6">
          あなたのサイトは、<br />
          <span className="text-red-400">AIに存在を<br />知られていない。</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mb-10">
          ChatGPT・Gemini・Perplexityが回答する時代。<br />
          <span className="text-white">AISightは、AIへの「見え方」を数値化するツールです。</span>
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
          {!submitted ? (
            <>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="メールアドレスを入力"
                className="flex-1 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              />
              <button type="submit" className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition whitespace-nowrap">
                先行登録 →
              </button>
            </>
          ) : (
            <div className="w-full px-6 py-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 font-medium">
              ✓ 登録完了！リリース時に最初にご連絡します。
            </div>
          )}
        </form>
        {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}

        <div className="flex gap-12 mt-16">
          {[[String(registrantCount), "先行登録者数"], ["6", "診断指標"], ["10秒", "診断にかかる時間"]].map(([num, label]) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-black text-blue-400">{num}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PROBLEM */}
      <section className="py-24 px-6 max-w-4xl mx-auto">
        <p className="text-xs tracking-widest text-blue-500 uppercase mb-4">Problem</p>
        <h2 className="text-4xl font-black tracking-tight mb-6">SEO対策をしても、<br />AIには届いていない。</h2>
        <p className="text-gray-400 mb-12">Google検索の25%がAI回答に置き換わると予測される2026年。「検索順位1位」が意味をなさなくなった時代が、もう始まっている。</p>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            ["🤖", "AIがあなたのサイトを知らない", "ChatGPTやGeminiに「おすすめのサービスは？」と聞かれた時、あなたのサイトは候補に上がっているか？"],
            ["🔍", "競合はすでにAIに最適化している", "AI時代のSEO対策を始めている競合他社が、あなたの顧客を獲得しているかもしれない。"],
            ["📉", "従来の指標では測れない", "Google AnalyticsやSEOツールは、AIからの流入を正確に追跡できない。新しい指標が必要な時代だ。"],
          ].map(([icon, title, desc]) => (
            <div key={title} className="p-6 rounded-2xl bg-white/3 border border-white/5">
              <div className="text-3xl mb-4">{icon}</div>
              <h3 className="font-bold mb-2">{title}</h3>
              <p className="text-sm text-gray-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 px-6 bg-white/2 border-y border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs tracking-widest text-blue-500 uppercase mb-4">How it works</p>
          <h2 className="text-4xl font-black tracking-tight mb-16">3ステップで、AIへの<br />「見え方」がわかる。</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              ["01", "URLを入力するだけ", "診断したいWebサイトのURLを入力。アカウント登録不要、30秒で完了。"],
              ["02", "AIがリアルタイム検証", "実際のAI検索エンジンに質問を投げて、あなたのサイトが回答に引用されるかをチェック。"],
              ["03", "スコアと改善策を取得", "100点満点のAIEOスコアと、優先度付きの改善アクションリストを即座に受け取る。"],
            ].map(([num, title, desc]) => (
              <div key={num}>
                <div className="text-6xl font-black text-blue-500/15 mb-3">{num}</div>
                <h3 className="font-bold mb-2">{title}</h3>
                <p className="text-sm text-gray-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SCORE PREVIEW */}
      <section className="py-24 px-6 max-w-3xl mx-auto text-center">
        <p className="text-xs tracking-widest text-blue-500 uppercase mb-4">Score Preview</p>
        <h2 className="text-4xl font-black tracking-tight mb-4">こんなスコアが<br />届きます。</h2>
        <p className="text-gray-400 mb-12">URLを入力するだけで、AIへの見え方を即座に数値化します。</p>

        <div className="bg-white/3 border border-white/10 rounded-2xl p-8 text-left">
          {/* スコアヘッダー */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="text-8xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent leading-none">72</div>
              <div className="text-sm text-gray-500 mt-2">AISight スコア / 100点</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs">✓ ChatGPTに引用されました</span>
            </div>
          </div>

          {/* スコアバー */}
          <div className="flex flex-col gap-5">
            {/* 無料で見える項目 */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white">構造化データ</span>
                <span className="text-blue-400 font-bold">18 / 20</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full w-[90%] bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white">回答カプセル</span>
                <span className="text-blue-400 font-bold">14 / 20</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full w-[70%] bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" />
              </div>
            </div>

            {/* 有料で見える項目 */}
            {["AIメンション率", "競合比較スコア", "改善アクションプラン"].map((label) => (
              <div key={label} className="opacity-40">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">🔒 {label}</span>
                  <span className="text-gray-500 text-xs">有料プランで解放</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full" style={{ filter: "blur(2px)" }} />
              </div>
            ))}
          </div>

          {/* ロックメッセージ */}
          <div className="mt-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-sm text-gray-400">
            <span>🔒</span>
            <span>有料プランで全指標・競合比較・改善アクションプランを確認できます</span>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-4xl font-black tracking-tight mb-4">先行者になりましょう</h2>
        <p className="text-gray-400 mb-10">AIに選ばれるサイトになる第一歩。<br />リリース時に真っ先にご案内します。</p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto">
          {!submitted ? (
            <>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="メールアドレスを入力"
                className="flex-1 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              />
              <button type="submit" className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition">無料で登録 →</button>
            </>
          ) : (
            <div className="w-full px-6 py-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 font-medium">
              ✓ 登録完了！リリース時に最初にご連絡します。
            </div>
          )}
        </form>
        <p className="mt-4 text-xs text-gray-600">無料・スパムなし・いつでも解除できます</p>
      </section>

      {/* FOOTER */}
      <footer className="py-6 text-center border-t border-white/5 text-xs text-gray-600">
        © 2026 AISight — AIに見えるWebへ。
      </footer>
    </main>
  );
}
