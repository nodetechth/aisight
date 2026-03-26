"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import NavBar from "@/app/components/NavBar";

type CompetitorCitation = {
  domain: string;
  is_cited: boolean;
  context?: string;
};

type MonitoringResult = {
  id: string;
  keyword: string;
  query: string;
  is_cited: boolean;
  citation_context: string | null;
  competitor_citations: CompetitorCitation[];
  change_from_previous: "new" | "gained" | "lost" | "unchanged" | null;
  checked_at: string;
};

type KeywordSummary = {
  keyword: string;
  dates: {
    date: string;
    is_cited: boolean;
    change: "new" | "gained" | "lost" | "unchanged" | null;
    competitor_citations: CompetitorCitation[];
  }[];
};

type MonitoringConfig = {
  id: string;
  domain: string;
  keywords: string[];
  area: string | null;
  competitor_domains: string[];
};

export default function MonitoringResultsPage() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<MonitoringConfig | null>(null);
  const [summary, setSummary] = useState<KeywordSummary[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [results, setResults] = useState<MonitoringResult[]>([]);
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
      if (!session) {
        setLoading(false);
        return;
      }

      // 設定を取得
      const configRes = await fetch("/api/monitoring/config", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const configData = await configRes.json();

      if (configData.configs && configData.configs.length > 0) {
        setConfig(configData.configs[0]);

        // 結果を取得
        const resultsRes = await fetch(
          `/api/monitoring/results?config_id=${configData.configs[0].id}&days=30`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        const resultsData = await resultsRes.json();

        setSummary(resultsData.summary || []);
        setResults(resultsData.results || []);
      }

      setLoading(false);
    };
    init();
  }, []);

  const getChangeIcon = (change: string | null) => {
    switch (change) {
      case "gained":
        return <span className="text-green-400 text-xs ml-1">+</span>;
      case "lost":
        return <span className="text-red-400 text-xs ml-1">-</span>;
      case "new":
        return <span className="text-blue-400 text-xs ml-1">NEW</span>;
      default:
        return null;
    }
  };

  const getCitationIcon = (is_cited: boolean) => {
    return is_cited ? (
      <span className="text-green-400">O</span>
    ) : (
      <span className="text-gray-500">-</span>
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 過去7日間の日付を生成
  const getLast7Days = () => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  };

  const last7Days = getLast7Days();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080C14] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-[#080C14] text-white">
        <NavBar />
        <div className="max-w-4xl mx-auto px-6 pt-32 pb-20 text-center">
          <h1 className="text-2xl font-bold mb-4">モニタリング</h1>
          <p className="text-gray-400 mb-8">
            モニタリングを開始するには、まず設定を行ってください
          </p>
          <a
            href="/dashboard/monitoring/settings"
            className="inline-block px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
          >
            設定を開始
          </a>
        </div>
      </div>
    );
  }

  if (summary.length === 0) {
    return (
      <div className="min-h-screen bg-[#080C14] text-white">
        <NavBar />
        <div className="max-w-4xl mx-auto px-6 pt-32 pb-20 text-center">
          <h1 className="text-2xl font-bold mb-4">モニタリング</h1>
          <p className="text-gray-400 mb-4">
            まだモニタリング結果がありません
          </p>
          <p className="text-sm text-gray-500 mb-8">
            診断を実行すると、設定したキーワードのモニタリングが自動で行われます
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="/analyze"
              className="inline-block px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
            >
              診断を実行
            </a>
            <a
              href="/dashboard/monitoring/settings"
              className="inline-block px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition"
            >
              設定を変更
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080C14] text-white">
      <NavBar />
      <div className="max-w-6xl mx-auto px-6 pt-32 pb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">モニタリング結果</h1>
            <p className="text-sm text-gray-500 mt-1">{config.domain}</p>
          </div>
          <a
            href="/dashboard/monitoring/settings"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            設定を変更
          </a>
        </div>

        {/* キーワード×日付グリッド */}
        <div className="p-6 rounded-2xl bg-white/3 border border-white/5 mb-8 overflow-x-auto">
          <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">
            引用ステータス（過去7日間）
          </h2>
          <table className="w-full min-w-[600px]">
            <thead>
              <tr>
                <th className="text-left text-sm text-gray-400 pb-3 pr-4">キーワード</th>
                {last7Days.map((day) => (
                  <th key={day} className="text-center text-xs text-gray-500 pb-3 px-2">
                    {formatDate(day)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.map((kw) => (
                <tr
                  key={kw.keyword}
                  className={`border-t border-white/5 cursor-pointer hover:bg-white/5 transition ${
                    selectedKeyword === kw.keyword ? "bg-white/5" : ""
                  }`}
                  onClick={() =>
                    setSelectedKeyword(
                      selectedKeyword === kw.keyword ? null : kw.keyword
                    )
                  }
                >
                  <td className="py-3 pr-4">
                    <span className="text-sm text-white">{kw.keyword}</span>
                    {config.area && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({config.area})
                      </span>
                    )}
                  </td>
                  {last7Days.map((day) => {
                    const dateData = kw.dates.find((d) => d.date === day);
                    return (
                      <td key={day} className="text-center py-3 px-2">
                        {dateData ? (
                          <span className="inline-flex items-center">
                            {getCitationIcon(dateData.is_cited)}
                            {getChangeIcon(dateData.change)}
                          </span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-6 mt-4 text-xs text-gray-500">
            <span><span className="text-green-400">O</span> = 引用あり</span>
            <span><span className="text-gray-500">-</span> = 引用なし</span>
            <span><span className="text-green-400">+</span> = 新規引用獲得</span>
            <span><span className="text-red-400">-</span> = 引用消失</span>
          </div>
        </div>

        {/* 競合比較テーブル */}
        {config.competitor_domains.length > 0 && (
          <div className="p-6 rounded-2xl bg-white/3 border border-white/5 mb-8">
            <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">
              競合比較（最新結果）
            </h2>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-sm text-gray-400 pb-3">キーワード</th>
                  <th className="text-center text-sm text-gray-400 pb-3">自社</th>
                  {config.competitor_domains.map((domain) => (
                    <th key={domain} className="text-center text-sm text-gray-400 pb-3">
                      {domain}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.map((kw) => {
                  const latestDate = kw.dates[0];
                  return (
                    <tr key={kw.keyword} className="border-t border-white/5">
                      <td className="py-3 text-sm text-white">{kw.keyword}</td>
                      <td className="text-center py-3">
                        {latestDate ? getCitationIcon(latestDate.is_cited) : "-"}
                      </td>
                      {config.competitor_domains.map((domain) => {
                        const compCitation = latestDate?.competitor_citations.find(
                          (c) => c.domain === domain
                        );
                        return (
                          <td key={domain} className="text-center py-3">
                            {compCitation ? getCitationIcon(compCitation.is_cited) : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 選択したキーワードの詳細 */}
        {selectedKeyword && (
          <div className="p-6 rounded-2xl bg-white/3 border border-white/5">
            <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">
              「{selectedKeyword}」の詳細
            </h2>
            <div className="space-y-4">
              {results
                .filter((r) => r.keyword === selectedKeyword)
                .slice(0, 5)
                .map((result) => (
                  <div
                    key={result.id}
                    className="p-4 rounded-xl bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">
                        {new Date(result.checked_at).toLocaleDateString("ja-JP", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          result.is_cited
                            ? "bg-green-500/20 text-green-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {result.is_cited ? "引用あり" : "引用なし"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">
                      クエリ: {result.query}
                    </p>
                    {result.citation_context && (
                      <p className="text-sm text-white bg-white/5 p-3 rounded-lg">
                        {result.citation_context}
                      </p>
                    )}
                    {result.competitor_citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-xs text-gray-500 mb-2">競合の引用状況:</p>
                        <div className="flex flex-wrap gap-2">
                          {result.competitor_citations.map((comp) => (
                            <span
                              key={comp.domain}
                              className={`px-2 py-1 rounded text-xs ${
                                comp.is_cited
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-gray-500/20 text-gray-500"
                              }`}
                            >
                              {comp.domain}: {comp.is_cited ? "O" : "-"}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 診断への誘導 */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 mb-4">
            モニタリングは診断実行時に自動で更新されます
          </p>
          <a
            href="/analyze"
            className="inline-block px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
          >
            診断を実行してモニタリングを更新
          </a>
        </div>
      </div>
    </div>
  );
}
