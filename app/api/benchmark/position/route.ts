import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getUserBenchmarkPosition } from "@/lib/benchmark-position";

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

// GET: diagnosisId を受け取り、業種内パーセンタイルを算出
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const diagnosisId = searchParams.get("diagnosisId");
  const domain = searchParams.get("domain");

  if (!diagnosisId && !domain) {
    return NextResponse.json(
      { error: "diagnosisId or domain is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseClient();

  // 診断結果を取得
  let diagnosis;
  if (diagnosisId) {
    const { data } = await supabase
      .from("diagnosis_results")
      .select("*")
      .eq("id", diagnosisId)
      .eq("user_id", user.id)
      .single();
    diagnosis = data;
  } else if (domain) {
    const { data } = await supabase
      .from("diagnosis_results")
      .select("*")
      .eq("domain", domain)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    diagnosis = data;
  }

  if (!diagnosis) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const position = await getUserBenchmarkPosition(
    diagnosis.total_score,
    diagnosis.scores as Record<string, number>,
    diagnosis.technical_score ?? 0,
    diagnosis.detected_industry || diagnosis.industry || "その他"
  );

  return NextResponse.json({
    diagnosisId: diagnosis.id,
    domain: diagnosis.domain,
    industry: diagnosis.detected_industry || diagnosis.industry,
    position,
  });
}
