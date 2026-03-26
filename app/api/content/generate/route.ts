import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { generateArticleStructure } from "@/lib/content-generator";
import { generateJsonLd } from "@/lib/structured-data-generator";

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

// POST: キーワードを受けてコンテンツ構成を生成・保存
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { keyword, domain, area } = body;

  if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  }

  try {
    // コンテンツ構成を生成
    const result = await generateArticleStructure(
      keyword.trim(),
      domain?.trim() || undefined,
      area?.trim() || undefined
    );

    // 構造化データを生成
    const structuredData = generateJsonLd(result.metaInfo, result.outline, {
      authorName: domain || "Author",
      authorUrl: domain ? `https://${domain}` : undefined,
      publisherName: domain || undefined,
    });

    const supabase = getSupabaseClient();

    // 結果を保存
    const { data, error } = await supabase
      .from("content_generations")
      .insert({
        user_id: user.id,
        keyword: keyword.trim(),
        domain: domain?.trim() || null,
        area: area?.trim() || null,
        title_candidates: result.titleCandidates,
        outline: result.outline,
        meta_info: result.metaInfo,
        structured_data: {
          article: structuredData.article,
          faqPage: structuredData.faqPage,
          combined: structuredData.combined,
        },
        llmo_tips: result.llmoTips,
        status: "completed",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      keyword: result.keyword,
      searchIntent: result.searchIntent,
      titleCandidates: result.titleCandidates,
      outline: result.outline,
      metaInfo: result.metaInfo,
      structuredData: {
        article: structuredData.article,
        faqPage: structuredData.faqPage,
        combined: structuredData.combined,
      },
      llmoTips: result.llmoTips,
      createdAt: data.created_at,
    });
  } catch (e) {
    console.error("Content generation failed:", e);
    return NextResponse.json(
      { error: "generation_failed", message: "コンテンツ生成に失敗しました" },
      { status: 500 }
    );
  }
}
