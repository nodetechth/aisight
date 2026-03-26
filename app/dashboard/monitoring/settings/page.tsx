"use client";
import { useEffect, useState } from "react";
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

const MAX_KEYWORDS = 5;
const MAX_COMPETITORS = 3;

type MonitoringConfig = {
  id: string;
  domain: string;
  keywords: string[];
  area: string | null;
  competitor_domains: string[];
  is_active: boolean;
};

export default function MonitoringSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<MonitoringConfig | null>(null);
  const [domain, setDomain] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [area, setArea] = useState("");
  const [competitorInput, setCompetitorInput] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/monitoring/config", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();

      if (data.configs && data.configs.length > 0) {
        const c = data.configs[0];
        setConfig(c);
        setDomain(c.domain);
        setKeywords(c.keywords);
        setArea(c.area || "");
        setCompetitors(c.competitor_domains);
      }

      setLoading(false);
    };
    init();
  }, []);

  const handleKeywordAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && keywordInput.trim()) {
      e.preventDefault();
      if (keywords.length >= MAX_KEYWORDS) {
        setError(`キーワードは最大${MAX_KEYWORDS}個までです`);
        return;
      }
      if (!keywords.includes(keywordInput.trim())) {
        setKeywords([...keywords, keywordInput.trim()]);
      }
      setKeywordInput("");
      setError("");
    }
  };

  const handleKeywordRemove = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const handleCompetitorAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && competitorInput.trim()) {
      e.preventDefault();
      if (competitors.length >= MAX_COMPETITORS) {
        setError(`競合ドメインは最大${MAX_COMPETITORS}個までです`);
        return;
      }
      const normalized = competitorInput
        .trim()
        .replace(/^(https?:\/\/)?(www\.)?/, "")
        .replace(/\/.*$/, "");
      if (!competitors.includes(normalized)) {
        setCompetitors([...competitors, normalized]);
      }
      setCompetitorInput("");
      setError("");
    }
  };

  const handleCompetitorRemove = (domain: string) => {
    setCompetitors(competitors.filter((d) => d !== domain));
  };

  const handleSave = async () => {
    if (!domain.trim()) {
      setError("ドメインを入力してください");
      return;
    }
    if (keywords.length === 0) {
      setError("キーワードを1つ以上入力してください");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const body = {
      ...(config ? { id: config.id } : {}),
      domain: domain.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/.*$/, ""),
      keywords,
      area: area || null,
      competitor_domains: competitors,
    };

    const res = await fetch("/api/monitoring/config", {
      method: config ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.message || data.error || "保存に失敗しました");
      setSaving(false);
      return;
    }

    setConfig(data.config);
    setSuccess("設定を保存しました");
    setSaving(false);
  };

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
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">モニタリング設定</h1>
          <a
            href="/dashboard/monitoring"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            結果を見る
          </a>
        </div>

        <div className="space-y-6">
          {/* ドメイン */}
          <div className="p-6 rounded-2xl bg-white/3 border border-white/5">
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-3">
              モニタリング対象ドメイン
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              disabled={!!config}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            {config && (
              <p className="text-xs text-gray-500 mt-2">
                ドメインは変更できません。新しいドメインを追加するには新規作成してください。
              </p>
            )}
          </div>

          {/* キーワード */}
          <div className="p-6 rounded-2xl bg-white/3 border border-white/5">
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-3">
              検索キーワード（最大{MAX_KEYWORDS}個）
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-400 text-sm"
                >
                  {keyword}
                  <button
                    onClick={() => handleKeywordRemove(keyword)}
                    className="ml-1 hover:text-blue-200"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={handleKeywordAdd}
              placeholder="キーワードを入力してEnter"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-2">
              例：「ホームページ制作」「Web制作会社」など、AIに検索させたいキーワード
            </p>
          </div>

          {/* エリア */}
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
              ローカルビジネスの場合は地域を選択すると、「東京都 ○○」のようなクエリでチェックします
            </p>
          </div>

          {/* 競合ドメイン */}
          <div className="p-6 rounded-2xl bg-white/3 border border-white/5">
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-3">
              競合ドメイン（最大{MAX_COMPETITORS}個）
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {competitors.map((comp) => (
                <span
                  key={comp}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 text-sm"
                >
                  {comp}
                  <button
                    onClick={() => handleCompetitorRemove(comp)}
                    className="ml-1 hover:text-red-200"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={competitorInput}
              onChange={(e) => setCompetitorInput(e.target.value)}
              onKeyDown={handleCompetitorAdd}
              placeholder="競合ドメインを入力してEnter"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-2">
              競合他社のドメインを入力すると、同じクエリでの引用状況を比較できます
            </p>
          </div>

          {/* エラー・成功メッセージ */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              {success}
            </div>
          )}

          {/* 保存ボタン */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition disabled:opacity-50"
          >
            {saving ? "保存中..." : "設定を保存"}
          </button>

          <p className="text-xs text-gray-500 text-center">
            モニタリングは診断実行時に自動で行われます（月5回の診断制限内）
          </p>
        </div>
      </div>
    </div>
  );
}
