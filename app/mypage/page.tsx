"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import NavBar from "@/app/components/NavBar";

type UserPlan = {
  plan: string;
  stripe_customer_id: string | null;
  monthly_analysis_count: number;
  analysis_count_reset_at: string;
  created_at: string;
};

export default function MyPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setEmail(user.email ?? null);

      const { data } = await supabase
        .from("user_plans")
        .select("plan, stripe_customer_id, monthly_analysis_count, analysis_count_reset_at, created_at")
        .eq("id", user.id)
        .single();

      setUserPlan(data);
      setLoading(false);
    };
    init();
  }, []);

  const handlePortal = async () => {
    setPortalLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
      },
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
    setPortalLoading(false);
  };

  const getRemainingCount = () => {
    if (!userPlan) return 5;
    const LIMIT = 5;
    const resetAt = new Date(userPlan.analysis_count_reset_at);
    const now = new Date();
    const shouldReset =
      now.getFullYear() !== resetAt.getFullYear() ||
      now.getMonth() !== resetAt.getMonth();
    const count = shouldReset ? 0 : (userPlan.monthly_analysis_count ?? 0);
    return LIMIT - count;
  };

  const isPro = userPlan?.plan === "pro";
  const remaining = getRemainingCount();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080C14] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080C14] text-white">
      <NavBar />
      <div className="max-w-2xl mx-auto px-6 pt-32 pb-20">
        <h1 className="text-2xl font-bold mb-8">マイページ</h1>

        {/* アカウント情報 */}
        <div className="p-6 rounded-2xl bg-white/3 border border-white/5 mb-4">
          <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">アカウント</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
              {email?.[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{email}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                登録日：{userPlan?.created_at
                  ? new Date(userPlan.created_at).toLocaleDateString("ja-JP")
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* プラン情報 */}
        <div className="p-6 rounded-2xl bg-white/3 border border-white/5 mb-4">
          <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">プラン</h2>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">現在のプラン</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              isPro
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "bg-white/5 text-gray-400 border border-white/10"
            }`}>
              {isPro ? "Pro" : "Free"}
            </span>
          </div>

          {isPro && (
            <div className="flex items-center justify-between py-3 border-t border-white/5">
              <span className="text-sm text-gray-400">今月の残り診断回数</span>
              <span className={`text-sm font-bold ${remaining <= 1 ? "text-red-400" : "text-blue-400"}`}>
                {remaining} / 5回
              </span>
            </div>
          )}

          {!isPro && (
            <div className="mt-2">
              <a
                href="/upgrade"
                className="block w-full text-center py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition"
              >
                Proプランにアップグレード →
              </a>
            </div>
          )}
        </div>

        {/* 請求情報（Proのみ） */}
        {isPro && (
          <div className="p-6 rounded-2xl bg-white/3 border border-white/5 mb-4">
            <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">請求・サブスクリプション</h2>
            <p className="text-xs text-gray-500 mb-4">
              カード情報の変更・解約・請求履歴の確認はStripeのポータルから行えます。
            </p>
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition disabled:opacity-50"
            >
              {portalLoading ? "読み込み中..." : "請求・解約の管理 →"}
            </button>
          </div>
        )}

        {/* 診断ページへ */}
        <a
          href="/analyze"
          className="block w-full text-center py-3 rounded-xl bg-white/3 hover:bg-white/5 border border-white/5 text-gray-400 hover:text-white text-sm transition"
        >
          診断ページへ戻る
        </a>
      </div>
    </div>
  );
}
