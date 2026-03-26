import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { MonitoringConfig } from "@/types/diagnosis";

// バリデーション定数
const MAX_KEYWORDS = 5;
const MAX_COMPETITORS = 3;

// 都道府県リスト
const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

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

// GET: ユーザーのモニタリング設定を取得
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("monitoring_configs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ configs: data as MonitoringConfig[] });
}

// POST: 新規モニタリング設定を作成
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { domain, keywords, area, competitor_domains } = body;

  // バリデーション
  if (!domain || typeof domain !== "string") {
    return NextResponse.json(
      { error: "domain is required" },
      { status: 400 }
    );
  }

  if (!Array.isArray(keywords) || keywords.length === 0) {
    return NextResponse.json(
      { error: "at least one keyword is required" },
      { status: 400 }
    );
  }

  if (keywords.length > MAX_KEYWORDS) {
    return NextResponse.json(
      { error: `keywords cannot exceed ${MAX_KEYWORDS}` },
      { status: 400 }
    );
  }

  const validKeywords = keywords.filter(
    (k): k is string => typeof k === "string" && k.trim().length > 0
  );
  if (validKeywords.length === 0) {
    return NextResponse.json(
      { error: "at least one valid keyword is required" },
      { status: 400 }
    );
  }

  if (area && !PREFECTURES.includes(area)) {
    return NextResponse.json(
      { error: "invalid area" },
      { status: 400 }
    );
  }

  const competitorArray: unknown[] = competitor_domains ?? [];
  const validCompetitors = competitorArray.filter(
    (d): d is string => typeof d === "string" && d.trim().length > 0
  );
  if (validCompetitors.length > MAX_COMPETITORS) {
    return NextResponse.json(
      { error: `competitor_domains cannot exceed ${MAX_COMPETITORS}` },
      { status: 400 }
    );
  }

  // ドメインの正規化
  const normalizedDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/.*$/, "");

  const supabase = getSupabaseClient();

  // 既存設定の確認
  const { data: existing } = await supabase
    .from("monitoring_configs")
    .select("id")
    .eq("user_id", user.id)
    .eq("domain", normalizedDomain)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "config_exists", message: "このドメインの設定は既に存在します" },
      { status: 409 }
    );
  }

  // 新規作成
  const { data, error } = await supabase
    .from("monitoring_configs")
    .insert({
      user_id: user.id,
      domain: normalizedDomain,
      keywords: validKeywords.map((k) => k.trim()),
      area: area || null,
      competitor_domains: validCompetitors.map((d) =>
        d.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/.*$/, "")
      ),
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data as MonitoringConfig }, { status: 201 });
}

// PUT: モニタリング設定を更新
export async function PUT(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, keywords, area, competitor_domains, is_active } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // 設定の所有者確認
  const { data: existing } = await supabase
    .from("monitoring_configs")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // 更新データの構築
  const updateData: Record<string, unknown> = {};

  if (keywords !== undefined) {
    if (!Array.isArray(keywords)) {
      return NextResponse.json(
        { error: "keywords must be an array" },
        { status: 400 }
      );
    }
    if (keywords.length > MAX_KEYWORDS) {
      return NextResponse.json(
        { error: `keywords cannot exceed ${MAX_KEYWORDS}` },
        { status: 400 }
      );
    }
    const validKeywords = keywords.filter(
      (k): k is string => typeof k === "string" && k.trim().length > 0
    );
    if (validKeywords.length === 0) {
      return NextResponse.json(
        { error: "at least one valid keyword is required" },
        { status: 400 }
      );
    }
    updateData.keywords = validKeywords.map((k) => k.trim());
  }

  if (area !== undefined) {
    if (area !== null && !PREFECTURES.includes(area)) {
      return NextResponse.json({ error: "invalid area" }, { status: 400 });
    }
    updateData.area = area;
  }

  if (competitor_domains !== undefined) {
    if (!Array.isArray(competitor_domains)) {
      return NextResponse.json(
        { error: "competitor_domains must be an array" },
        { status: 400 }
      );
    }
    const validCompetitors = competitor_domains.filter(
      (d): d is string => typeof d === "string" && d.trim().length > 0
    );
    if (validCompetitors.length > MAX_COMPETITORS) {
      return NextResponse.json(
        { error: `competitor_domains cannot exceed ${MAX_COMPETITORS}` },
        { status: 400 }
      );
    }
    updateData.competitor_domains = validCompetitors.map((d) =>
      d.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/.*$/, "")
    );
  }

  if (is_active !== undefined) {
    updateData.is_active = Boolean(is_active);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "no fields to update" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("monitoring_configs")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data as MonitoringConfig });
}
