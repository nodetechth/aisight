"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function UpgradePage() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser({ id: user.id, email: user.email! });
      }
    };
    checkUser();
  }, []);

  const handleUpgrade = async () => {
    if (!user) {
      localStorage.setItem("oauth_redirect", "/upgrade");
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("決済URLの取得に失敗しました。しばらくしてから再度お試しください。");
      }
    } catch (e) {
      alert("エラーが発生しました。しばらくしてから再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#080C14] text-white px-6 py-16">
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-[#080C14]/90 backdrop-blur border-b border-white/5">
        <a href="/" className="text-xl font-bold tracking-tight">
          AI<span className="text-blue-500">Sight</span>
        </a>
        {user ? (
          <span className="text-xs text-gray-500">{user.email}</span>
        ) : (
          <a href="/login" className="text-sm text-blue-400 hover:text-blue-300">
            ログイン
          </a>
        )}
      </nav>

      <div className="max-w-xl mx-auto pt-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs mb-8">
          🔒 Proプラン限定機能
        </div>
        <h1 className="text-4xl font-black tracking-tight mb-4">
          AIに引用されているか、<br />今すぐ確かめる。
        </h1>
        <p className="text-gray-400 mb-12">
          ChatGPT・Perplexityに実際に質問を投げ、<br />
          あなたのサイトが引用されるかをリアルタイムで検証します。
        </p>

        <div className="grid grid-cols-1 gap-4 mb-12 text-left">
          {[
            ["🤖", "リアルタイム検証", "実際のAIエンジンに質問を投げて、あなたのサイトが回答に含まれるかを直接確認します。"],
            ["📈", "改善を数値で確認", "サイトを改善した後に再診断することで、AIへの可視性が上がったかを追跡できます。"],
            ["🏆", "競合との差を把握", "競合サイトのAI引用スコアと比較して、今何が足りないかを明確にします。"],
          ].map(([icon, title, desc]) => (
            <div key={title as string} className="flex gap-4 p-5 rounded-2xl bg-white/3 border border-white/5">
              <div className="text-2xl">{icon}</div>
              <div>
                <div className="font-bold mb-1">{title}</div>
                <div className="text-sm text-gray-400">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-8 rounded-2xl bg-white/3 border border-blue-500/20 mb-8">
          <div className="text-5xl font-black mb-2">
            ¥980<span className="text-xl font-normal text-gray-400">/月</span>
          </div>
          <p className="text-gray-400 text-sm mb-6">いつでもキャンセル可能</p>
          <ul className="text-sm text-left space-y-3 mb-8">
            {[
              "AI引用チェック（Perplexity AIによるリアルタイム検証）",
              "5指標スコア診断（無制限）",
              "月次スコア履歴グラフ",
              "改善アクションプラン",
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span className="text-gray-300">{item}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl font-bold text-lg transition"
          >
            {loading ? "処理中..." : user ? "Proプランを始める →" : "ログインして始める →"}
          </button>
          <p className="text-xs text-gray-600 mt-3">
            決済はStripeで安全に処理されます。
          </p>
        </div>
      </div>
    </main>
  );
}
