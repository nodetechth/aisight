import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { MonitoringResult } from "@/types/diagnosis";

function getSupabaseClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getUserFromToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) return null;

  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser(accessToken);
  return user;
}

// GET: モニタリング結果を取得
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const configId = searchParams.get("config_id");
  const limit = parseInt(searchParams.get("limit") ?? "30", 10);
  const days = parseInt(searchParams.get("days") ?? "30", 10);

  const supabase = getSupabaseClient();

  // 過去N日間のデータを取得
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  let query = supabase
    .from("monitoring_results")
    .select("*")
    .eq("user_id", user.id)
    .gte("checked_at", sinceDate.toISOString())
    .order("checked_at", { ascending: false })
    .limit(limit);

  if (configId) {
    query = query.eq("config_id", configId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // キーワード x 日付でグルーピングしたサマリーを生成
  const results = data as MonitoringResult[];
  const summary = generateSummary(results);

  return NextResponse.json({ results, summary });
}

// 結果をキーワード x 日付でグルーピング
function generateSummary(results: MonitoringResult[]) {
  // キーワードごとにグループ化
  const byKeyword: Record<
    string,
    {
      keyword: string;
      dates: {
        date: string;
        is_cited: boolean;
        change: MonitoringResult["change_from_previous"];
        competitor_citations: MonitoringResult["competitor_citations"];
      }[];
    }
  > = {};

  for (const result of results) {
    const dateKey = new Date(result.checked_at).toISOString().split("T")[0];

    if (!byKeyword[result.keyword]) {
      byKeyword[result.keyword] = {
        keyword: result.keyword,
        dates: [],
      };
    }

    // 同じ日付の重複を避ける（最新の結果を使用）
    const existingDate = byKeyword[result.keyword].dates.find(
      (d) => d.date === dateKey
    );
    if (!existingDate) {
      byKeyword[result.keyword].dates.push({
        date: dateKey,
        is_cited: result.is_cited,
        change: result.change_from_previous,
        competitor_citations: result.competitor_citations,
      });
    }
  }

  // 日付でソート
  for (const keyword of Object.keys(byKeyword)) {
    byKeyword[keyword].dates.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  return Object.values(byKeyword);
}
