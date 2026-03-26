"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import NavBar from "@/app/components/NavBar";

type TitleCandidate = {
  title: string;
  type: string;
  reason: string;
};

type OutlineSection = {
  heading: string;
  level: number;
  description: string;
  keyPoints: string[];
  suggestedLength: number;
};

type MetaInfo = {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
};

type LLMOTip = {
  category: string;
  tip: string;
  priority: string;
};

type ContentGeneration = {
  id: string;
  keyword: string;
  domain: string | null;
  area: string | null;
  titleCandidates: TitleCandidate[];
  outline: OutlineSection[];
  metaInfo: MetaInfo;
  structuredData: {
    article: Record<string, unknown>;
    faqPage: Record<string, unknown> | null;
    combined: string;
  };
  llmoTips: LLMOTip[];
  createdAt: string;
};

type Tab = "outline" | "meta" | "structured" | "tips";

export default function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<ContentGeneration | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("outline");
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchContent = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const res = await fetch(`/api/content/generations/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        router.push("/dashboard/content");
        return;
      }

      const data = await res.json();
      setContent(data);
      setLoading(false);
    };

    fetchContent();
  }, [id]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "outline", label: "記事構成" },
    { key: "meta", label: "メタ情報" },
    { key: "structured", label: "構造化データ" },
    { key: "tips", label: "LLMOティップス" },
  ];

  const PRIORITY_COLORS: Record<string, string> = {
    high: "bg-red-500/20 text-red-400 border-red-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };

  const CATEGORY_LABELS: Record<string, string> = {
    structure: "構造",
    content: "コンテンツ",
    citation: "引用",
    technical: "技術",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080C14] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!content) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#080C14] text-white">
      <NavBar />
      <div className="max-w-4xl mx-auto px-6 pt-32 pb-20">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <a href="/dashboard/content" className="hover:text-gray-300">
              コンテンツ生成
            </a>
            <span>/</span>
            <span>{content.keyword}</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">{content.keyword}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {content.area && <span>{content.area}</span>}
            {content.domain && <span>{content.domain}</span>}
            <span>
              {new Date(content.createdAt).toLocaleDateString("ja-JP")}
            </span>
          </div>
        </div>

        {/* タイトル候補 */}
        <div className="p-6 rounded-2xl bg-white/3 border border-white/5 mb-6">
          <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">
            タイトル候補
          </h2>
          <div className="space-y-3">
            {content.titleCandidates.map((title, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-white mb-1">{title.title}</p>
                    <p className="text-xs text-gray-500">{title.reason}</p>
                  </div>
                  <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {title.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* タブ */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* タブコンテンツ */}
        <div className="p-6 rounded-2xl bg-white/3 border border-white/5">
          {/* 記事構成 */}
          {activeTab === "outline" && (
            <div className="space-y-4">
              {content.outline.map((section, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl border border-white/10 ${
                    section.level === 2 ? "bg-white/5" : "bg-white/3 ml-4"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">
                      H{section.level}
                    </span>
                    <h3 className="font-medium text-white">{section.heading}</h3>
                    <span className="text-xs text-gray-500 ml-auto">
                      推奨 {section.suggestedLength}文字
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    {section.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {section.keyPoints.map((point, j) => (
                      <span
                        key={j}
                        className="px-2 py-1 rounded text-xs bg-blue-500/10 text-blue-400"
                      >
                        {point}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* メタ情報 */}
          {activeTab === "meta" && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
                  SEOタイトル
                </label>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-white mb-1">{content.metaInfo.title}</p>
                  <p className="text-xs text-gray-500">
                    {content.metaInfo.title.length}文字
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
                  メタディスクリプション
                </label>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-white mb-1">{content.metaInfo.description}</p>
                  <p className="text-xs text-gray-500">
                    {content.metaInfo.description.length}文字
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
                  OGPタイトル
                </label>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-white">{content.metaInfo.ogTitle}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
                  OGPディスクリプション
                </label>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-white">{content.metaInfo.ogDescription}</p>
                </div>
              </div>
            </div>
          )}

          {/* 構造化データ */}
          {activeTab === "structured" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-400">
                  以下のJSON-LDをページのhead内に設置してください
                </p>
                <button
                  onClick={() => handleCopy(content.structuredData.combined)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition"
                >
                  {copied ? "コピーしました!" : "コピー"}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-black/50 border border-white/10 overflow-x-auto text-sm">
                <code className="text-green-400 whitespace-pre">
                  {content.structuredData.combined}
                </code>
              </pre>
            </div>
          )}

          {/* LLMOティップス */}
          {activeTab === "tips" && (
            <div className="space-y-4">
              {content.llmoTips.map((tip, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs border ${
                        PRIORITY_COLORS[tip.priority] || PRIORITY_COLORS.low
                      }`}
                    >
                      {tip.priority === "high"
                        ? "重要"
                        : tip.priority === "medium"
                        ? "推奨"
                        : "任意"}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">
                      {CATEGORY_LABELS[tip.category] || tip.category}
                    </span>
                  </div>
                  <p className="text-white">{tip.tip}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* アクションボタン */}
        <div className="flex gap-4 mt-8">
          <a
            href="/dashboard/content/new"
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-center font-medium transition"
          >
            新しいコンテンツを生成
          </a>
          <a
            href="/dashboard/content"
            className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-center font-medium transition"
          >
            履歴
          </a>
        </div>
      </div>
    </div>
  );
}
