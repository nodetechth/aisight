"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import NavBar from "@/app/components/NavBar";

const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

export default function NewContentPage() {
  const [keyword, setKeyword] = useState("");
  const [domain, setDomain] = useState("");
  const [area, setArea] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleGenerate = async () => {
    if (!keyword.trim()) {
      setError("キーワードを入力してください");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          keyword: keyword.trim(),
          domain: domain.trim() || null,
          area: area || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.error || "生成に失敗しました");
        setGenerating(false);
        return;
      }

      // 結果ページへリダイレクト
      router.push(`/dashboard/content/${data.id}`);
    } catch {
      setError("エラーが発生しました");
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-white">
      <NavBar />
      <div className="max-w-2xl mx-auto px-6 pt-32 pb-20">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">コンテンツ構成を生成</h1>
          <p className="text-gray-500 text-sm">
            キーワードを入力すると、AIに引用されやすい記事構成を自動生成します
          </p>
        </div>

        <div className="space-y-6">
          {/* キーワード入力 */}
          <div className="p-6 rounded-2xl bg-white/3 border border-white/5">
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-3">
              ターゲットキーワード <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="例：ホームページ制作 費用"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-2">
              記事のメインキーワードを入力してください
            </p>
          </div>

          {/* ドメイン入力（任意） */}
          <div className="p-6 rounded-2xl bg-white/3 border border-white/5">
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-3">
              対象ドメイン（任意）
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-2">
              構造化データの著者情報に使用されます
            </p>
          </div>

          {/* エリア選択（任意） */}
          <div className="p-6 rounded-2xl bg-white/3 border border-white/5">
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-3">
              対象エリア（任意）
            </label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">全国</option>
              {PREFECTURES.map((pref) => (
                <option key={pref} value={pref}>
                  {pref}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              ローカルビジネス向けコンテンツの場合は地域を選択
            </p>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 生成ボタン */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>生成中...</span>
              </>
            ) : (
              <span>コンテンツ構成を生成</span>
            )}
          </button>

          {generating && (
            <p className="text-xs text-gray-500 text-center">
              AIが検索意図を分析し、最適な記事構成を生成しています（30秒〜1分程度）
            </p>
          )}

          {/* 履歴リンク */}
          <div className="text-center">
            <a
              href="/dashboard/content"
              className="text-sm text-gray-500 hover:text-gray-300"
            >
              生成履歴を見る
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
