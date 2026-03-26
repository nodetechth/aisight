import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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

export type ScoreHistoryEntry = {
  month: string;
  total_score: number;
  scores: {
    structuredData: number;
    answerCapsule: number;
    infoDensity: number;
    contentLength: number;
    metaInfo: number;
    aiCitation: number;
  };
  technical_score: number;
  cited: boolean;
  last_checked_at: string;
  check_count: number;
};

// GET: ドメイン指定で月次スコア履歴を返す
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");
  const months = parseInt(searchParams.get("months") ?? "12", 10);

  if (!domain) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // 月次履歴ビューから取得
  const { data, error } = await supabase
    .from("monthly_score_history")
    .select("*")
    .eq("user_id", user.id)
    .eq("domain", domain)
    .order("month", { ascending: false })
    .limit(months);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // データを整形
  const history: ScoreHistoryEntry[] = (data || []).map((row) => ({
    month: row.month,
    total_score: row.total_score,
    scores: row.scores,
    technical_score: row.technical_score,
    cited: row.cited,
    last_checked_at: row.last_checked_at,
    check_count: row.check_count,
  }));

  // 統計情報を計算
  const stats = history.length > 0 ? {
    latestScore: history[0].total_score,
    averageScore: Math.round(
      history.reduce((sum, h) => sum + h.total_score, 0) / history.length
    ),
    highestScore: Math.max(...history.map((h) => h.total_score)),
    lowestScore: Math.min(...history.map((h) => h.total_score)),
    totalChecks: history.reduce((sum, h) => sum + h.check_count, 0),
  } : null;

  return NextResponse.json({ history, stats });
}
