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

export type ScoreComparisonResult = {
  current: {
    total_score: number;
    scores: Record<string, number>;
    technical_score: number;
    cited: boolean;
    created_at: string;
  };
  previous: {
    total_score: number;
    scores: Record<string, number>;
    technical_score: number;
    cited: boolean;
    created_at: string;
  } | null;
  changes: {
    total: number;
    structuredData: number;
    answerCapsule: number;
    infoDensity: number;
    contentLength: number;
    metaInfo: number;
    aiCitation: number;
    technical: number;
  } | null;
};

// GET: 最新2回の診断スコアを比較して差分を返す
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");

  if (!domain) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // 最新2回の診断結果を取得
  const { data, error } = await supabase
    .from("diagnosis_results")
    .select("total_score, scores, technical_score, cited, created_at")
    .eq("user_id", user.id)
    .eq("domain", domain)
    .order("created_at", { ascending: false })
    .limit(2);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "no_data" }, { status: 404 });
  }

  const current = data[0];
  const previous = data.length > 1 ? data[1] : null;

  // 変化を計算
  let changes = null;
  if (previous) {
    const currentScores = current.scores as Record<string, number>;
    const previousScores = previous.scores as Record<string, number>;

    changes = {
      total: current.total_score - previous.total_score,
      structuredData: (currentScores.structuredData ?? 0) - (previousScores.structuredData ?? 0),
      answerCapsule: (currentScores.answerCapsule ?? 0) - (previousScores.answerCapsule ?? 0),
      infoDensity: (currentScores.infoDensity ?? 0) - (previousScores.infoDensity ?? 0),
      contentLength: (currentScores.contentLength ?? 0) - (previousScores.contentLength ?? 0),
      metaInfo: (currentScores.metaInfo ?? 0) - (previousScores.metaInfo ?? 0),
      aiCitation: (currentScores.aiCitation ?? 0) - (previousScores.aiCitation ?? 0),
      technical: (current.technical_score ?? 0) - (previous.technical_score ?? 0),
    };
  }

  const result: ScoreComparisonResult = {
    current: {
      total_score: current.total_score,
      scores: current.scores as Record<string, number>,
      technical_score: current.technical_score,
      cited: current.cited,
      created_at: current.created_at,
    },
    previous: previous ? {
      total_score: previous.total_score,
      scores: previous.scores as Record<string, number>,
      technical_score: previous.technical_score,
      cited: previous.cited,
      created_at: previous.created_at,
    } : null,
    changes,
  };

  return NextResponse.json(result);
}
