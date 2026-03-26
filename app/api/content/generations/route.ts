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

export type ContentGenerationSummary = {
  id: string;
  keyword: string;
  domain: string | null;
  area: string | null;
  title_preview: string;
  status: string;
  created_at: string;
};

// GET: 生成履歴一覧
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const supabase = getSupabaseClient();

  const { data, error, count } = await supabase
    .from("content_generations")
    .select("id, keyword, domain, area, title_candidates, status, created_at", {
      count: "exact",
    })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // タイトル候補から最初のタイトルをプレビューとして抽出
  const generations: ContentGenerationSummary[] = (data || []).map((row) => {
    const titleCandidates = row.title_candidates as { title: string }[];
    const titlePreview = titleCandidates?.[0]?.title || row.keyword;

    return {
      id: row.id,
      keyword: row.keyword,
      domain: row.domain,
      area: row.area,
      title_preview: titlePreview,
      status: row.status,
      created_at: row.created_at,
    };
  });

  return NextResponse.json({
    generations,
    total: count || 0,
    limit,
    offset,
  });
}
