"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import NavBar from "@/app/components/NavBar";

type ContentGenerationSummary = {
  id: string;
  keyword: string;
  domain: string | null;
  area: string | null;
  title_preview: string;
  status: string;
  created_at: string;
};

export default function ContentListPage() {
  const [loading, setLoading] = useState(true);
  const [generations, setGenerations] = useState<ContentGenerationSummary[]>([]);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchGenerations = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/content/generations?limit=50", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setGenerations(data.generations || []);
      }

      setLoading(false);
    };

    fetchGenerations();
  }, []);

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
      <div className="max-w-4xl mx-auto px-6 pt-32 pb-20">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">コンテンツ生成履歴</h1>
          <a
            href="/dashboard/content/new"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition"
          >
            + 新規作成
          </a>
        </div>

        {generations.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 mb-4">
              まだコンテンツを生成していません
            </p>
            <a
              href="/dashboard/content/new"
              className="inline-block px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
            >
              最初のコンテンツを生成
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {generations.map((gen) => (
              <a
                key={gen.id}
                href={`/dashboard/content/${gen.id}`}
                className="block p-6 rounded-2xl bg-white/3 border border-white/5 hover:bg-white/5 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white mb-1 truncate">
                      {gen.title_preview}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs">
                        {gen.keyword}
                      </span>
                      {gen.area && <span>{gen.area}</span>}
                      {gen.domain && <span>{gen.domain}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">
                      {new Date(gen.created_at).toLocaleDateString("ja-JP", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
