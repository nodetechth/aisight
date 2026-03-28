import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  detectIndustry,
  getRecommendedPortals,
  isLocalBusiness,
  determinePriority,
} from "@/lib/industry-mapping";
import { runTechnicalCheck, type TechnicalCheckResult } from "@/lib/technical-checker";
import { calculateTechnicalScore } from "@/lib/score-engine";
import { runMonitoringWithDiagnosis, type PreviousResults } from "@/lib/monitoring-engine";
import type { CitationStrategy, MonitoringConfig, MonitoringCheckResult } from "@/types/diagnosis";

// サイテーション戦略を生成
function generateCitationStrategy(
  queries: string[],
  industry: string,
  region: string,
  citedCount: number,
  totalQueries: number
): CitationStrategy {
  const detectedIndustry = detectIndustry(queries, industry);
  const isLocal = isLocalBusiness(queries, region);
  const priorities = determinePriority(citedCount, totalQueries, isLocal);
  const portals = getRecommendedPortals(detectedIndustry);

  return {
    press_release: {
      priority: priorities.pressRelease,
      recommendation: priorities.pressRelease === "high"
        ? "AIは信頼性の高いニュースソースを優先的に引用します。プレスリリースを配信することで、あなたのサービスが権威あるメディアに掲載され、AI検索での引用確率が大幅に向上します。"
        : priorities.pressRelease === "medium"
        ? "プレスリリースの配信は、AI検索での認知度向上に効果的です。新サービスや実績など、ニュース性のある情報を定期的に発信しましょう。"
        : "現在の引用率は良好ですが、継続的なプレスリリース配信でさらなる認知度向上が期待できます。",
      suggested_platforms: ["PR TIMES", "ValuePress!", "@Press", "共同通信PRワイヤー"],
      checklist: [
        "ニュース性のあるトピックを選定（新サービス、実績、調査結果など）",
        "業界の専門家としてのコメントを含める",
        "具体的な数値・データを盛り込む",
        "自社サイトへのリンクを含める",
        "配信後、自社サイトにも同内容を掲載する",
      ],
    },
    google_business_profile: {
      priority: priorities.gbp,
      is_local_business: isLocal,
      recommendation: isLocal
        ? priorities.gbp === "high"
          ? "ローカルビジネスとして検出されました。Googleビジネスプロフィールの最適化は、地域検索でのAI引用に直結します。早急な対応を推奨します。"
          : "Googleビジネスプロフィールを充実させることで、「〇〇市 △△」のような地域クエリでの引用確率が向上します。"
        : "地域性の低いビジネスですが、実店舗や事務所がある場合はGoogleビジネスプロフィールの登録を検討してください。",
      checklist: [
        "ビジネス情報（住所・電話番号・営業時間）を正確に登録",
        "サービス内容を詳細に記載",
        "定期的に投稿を行う（週1回以上推奨）",
        "写真を10枚以上追加",
        "口コミへの返信を行う",
        "Q&Aセクションを充実させる",
      ],
    },
    portal_sites: {
      priority: priorities.portal,
      detected_industry: detectedIndustry,
      recommendation: `${detectedIndustry}業界向けのポータルサイトへの掲載は、AIが参照する「信頼できる情報源」として認識されます。以下のサイトへの登録・情報更新を推奨します。`,
      suggested_portals: portals,
    },
  };
}

async function checkAndIncrementAnalysisCount(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  isPro: boolean;
}> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from("user_plans")
    .select("plan, monthly_analysis_count, analysis_count_reset_at")
    .eq("id", userId)
    .single();

  if (!data || data.plan !== "pro") {
    return { allowed: true, remaining: 999, isPro: false };
  }

  const MONTHLY_LIMIT = 5;
  const now = new Date();
  const resetAt = new Date(data.analysis_count_reset_at);

  const shouldReset =
    now.getFullYear() !== resetAt.getFullYear() ||
    now.getMonth() !== resetAt.getMonth();

  const currentCount = shouldReset ? 0 : (data.monthly_analysis_count ?? 0);

  if (currentCount >= MONTHLY_LIMIT) {
    return { allowed: false, remaining: 0, isPro: true };
  }

  await supabase
    .from("user_plans")
    .update({
      monthly_analysis_count: currentCount + 1,
      analysis_count_reset_at: shouldReset ? now.toISOString() : data.analysis_count_reset_at,
      updated_at: now.toISOString(),
    })
    .eq("id", userId);

  return { allowed: true, remaining: MONTHLY_LIMIT - (currentCount + 1), isPro: true };
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || !url.startsWith("http")) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  // Authorizationヘッダーからユーザーを取得
  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  let analysisLimit = { allowed: true, remaining: 999, isPro: false };
  let userId: string | null = null;

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (accessToken) {
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (user) {
      userId = user.id;
      analysisLimit = await checkAndIncrementAnalysisCount(user.id);
    }
  }

  if (!analysisLimit.allowed) {
    return NextResponse.json(
      { error: "LIMIT_EXCEEDED", message: "今月の診断回数（5回）の上限に達しました。来月1日にリセットされます。" },
      { status: 429 }
    );
  }

  try {
    // サイトのHTMLを取得
    const res = await fetch(url, {
      headers: { "User-Agent": "AISight-Bot/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();

    // スコア計算（技術チェックも並行実行）
    const [
      structuredData,
      answerCapsule,
      infoDensity,
      contentLength,
      metaInfo,
      aiCitationReport,
      technicalCheck,
    ] = await Promise.all([
      Promise.resolve(scoreStructuredData(html)),
      Promise.resolve(scoreAnswerCapsule(html)),
      Promise.resolve(scoreInfoDensity(html)),
      Promise.resolve(scoreContentLength(html)),
      Promise.resolve(scoreMetaInfo(html)),
      scoreAICitationWithReport(url),
      runTechnicalCheck(url),
    ]);

    // ページ構造解析・メタ情報抽出
    const pageStructure = analyzePageStructure(html);
    const metaDetails = extractMetaDetails(html);

    // 技術スコアを計算
    const technicalScore = calculateTechnicalScore(technicalCheck);

    const scores = {
      structuredData,
      answerCapsule,
      infoDensity,
      contentLength,
      metaInfo,
      aiCitation: aiCitationReport.score,
    };

    // 技術スコアは加減点として適用（基本スコア100点満点 + 技術加減点）
    const baseTotal = Object.values(scores).reduce((a, b) => a + b, 0);
    const total = Math.max(0, Math.min(100, baseTotal + technicalScore));

    const actionPlan = await generateActionPlan(scores, url);

    // サイテーション戦略を生成
    const citationStrategy = generateCitationStrategy(
      aiCitationReport.queries.map(q => q.query),
      aiCitationReport.industry,
      aiCitationReport.region,
      aiCitationReport.queries.filter(q => q.cited).length,
      aiCitationReport.queries.length
    );

    // 診断結果をDBに保存（ログインユーザーのみ）
    const domain = new URL(url).hostname.replace("www.", "");
    let scoreComparison: { previous: number | null; change: number | null } | null = null;
    if (userId) {
      scoreComparison = await saveDiagnosisResult(
        userId,
        domain,
        url,
        total,
        scores,
        technicalScore,
        aiCitationReport.cited,
        aiCitationReport.industry,
        aiCitationReport.region
      );
    }

    // モニタリング処理（ユーザーがログイン済みでProプランの場合のみ）
    let monitoringResults: MonitoringCheckResult[] | null = null;
    if (userId && analysisLimit.isPro) {
      monitoringResults = await runMonitoringForUser(
        userId,
        url,
        aiCitationReport.queries
      );
    }

    return NextResponse.json({
      url,
      total,
      scores,
      scoreBreakdown: {
        ...scores,
        technical: technicalScore,
      },
      cited: aiCitationReport.cited,
      aiCitationReport: {
        industry: aiCitationReport.industry,
        region: aiCitationReport.region,
        queries: aiCitationReport.queries,
        citedCount: aiCitationReport.queries.filter(q => q.cited).length,
        totalQueries: aiCitationReport.queries.length,
        competitors: aiCitationReport.competitors,
      },
      pageStructure,
      metaDetails,
      technicalCheck,
      citationStrategy,
      actionPlan,
      monitoringResults,
      scoreComparison,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

// モニタリング処理を実行
async function runMonitoringForUser(
  userId: string,
  url: string,
  existingQueries: { query: string; cited: boolean; context: string }[]
): Promise<MonitoringCheckResult[] | null> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    const domain = new URL(url).hostname.replace("www.", "");

    // ユーザーのモニタリング設定を取得
    const { data: configs } = await supabase
      .from("monitoring_configs")
      .select("*")
      .eq("user_id", userId)
      .eq("domain", domain)
      .eq("is_active", true)
      .single();

    if (!configs) return null;

    const config = configs as MonitoringConfig;

    // 前回の結果を取得
    const { data: prevResults } = await supabase
      .from("monitoring_results")
      .select("keyword, is_cited")
      .eq("config_id", config.id)
      .order("checked_at", { ascending: false })
      .limit(config.keywords.length);

    const previousResults: PreviousResults = new Map();
    if (prevResults) {
      for (const r of prevResults) {
        if (!previousResults.has(r.keyword)) {
          previousResults.set(r.keyword, { is_cited: r.is_cited });
        }
      }
    }

    // モニタリングを実行
    const results = await runMonitoringWithDiagnosis(
      config,
      existingQueries,
      previousResults
    );

    // 結果をDBに保存
    const now = new Date().toISOString();
    const insertData = results.map((r) => ({
      config_id: config.id,
      user_id: userId,
      keyword: r.keyword,
      query: r.query,
      is_cited: r.is_cited,
      citation_context: r.citation_context,
      competitor_citations: r.competitor_citations,
      change_from_previous: r.change_from_previous,
      checked_at: now,
    }));

    await supabase.from("monitoring_results").insert(insertData);

    return results;
  } catch {
    // モニタリングエラーは診断結果に影響させない
    return null;
  }
}

// 診断結果を保存し、前回との比較を返す
async function saveDiagnosisResult(
  userId: string,
  domain: string,
  url: string,
  totalScore: number,
  scores: Record<string, number>,
  technicalScore: number,
  cited: boolean,
  industry: string,
  region: string
): Promise<{ previous: number | null; change: number | null }> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 前回の結果を取得
    const { data: prevResult } = await supabase
      .from("diagnosis_results")
      .select("total_score")
      .eq("user_id", userId)
      .eq("domain", domain)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const previous = prevResult?.total_score ?? null;
    const change = previous !== null ? totalScore - previous : null;

    // 新しい結果を保存
    await supabase.from("diagnosis_results").insert({
      user_id: userId,
      domain,
      url,
      total_score: totalScore,
      scores,
      technical_score: technicalScore,
      cited,
      industry,
      region,
      detected_industry: industry,
    });

    return { previous, change };
  } catch {
    return { previous: null, change: null };
  }
}

// ① 構造化データ（Schema.org）が含まれているか
function scoreStructuredData(html: string): number {
  const hasLdJson = html.includes('application/ld+json');
  const hasItemtype = html.includes('itemtype');
  if (hasLdJson) return 20;
  if (hasItemtype) return 12;
  return 0;
}

// ② 回答カプセルの修正版
// HTMLタグを除去してからチェックする
function scoreAnswerCapsule(html: string): number {
  // まずHTMLタグを除去
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, "")
                    .replace(/<style[\s\S]*?<\/style>/gi, "");

  // H1〜H3の見出し直後に本文の定義文があるか確認
  // 見出しタグ → テキスト抽出 → 直後のpタグのテキストをチェック
  const headingWithNext = /<h[1-3][^>]*>[^<]+<\/h[1-3]>\s*(?:<[^>]+>\s*)*<p[^>]*>([^<]{20,150}[。．.!！])/gi;
  const matches: string[] = [];
  let m;
  while ((m = headingWithNext.exec(clean)) !== null) {
    // 抽出したpタグの中身がHTMLタグを含まない純テキストかチェック
    if (!m[1].includes("<")) {
      matches.push(m[1]);
    }
  }

  if (matches.length >= 3) return 20;
  if (matches.length >= 1) return 12;
  return 4;
}

// ③ 情報密度：数字の出現密度で測定
function scoreInfoDensity(html: string): number {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "");

  const text = cleaned.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  // 本文が短すぎる場合は低スコア
  if (text.length < 300) return 3;

  // 数字の出現回数（連続する数字を1カウント）
  const numbers = (text.match(/[0-9０-９]{1,10}/g) || []).length;
  const per1000 = (numbers / text.length) * 1000;

  if (per1000 >= 8) return 20;
  if (per1000 >= 4) return 14;
  if (per1000 >= 1.5) return 8;
  return 3;
}

// ④ コンテンツ長：文字数だけでなく「情報として読める本文」の密度を見る
function scoreContentLength(html: string): number {
  // __NEXT_DATA__ などのJSONデータブロックを除去
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // タグを除去してテキストのみ取得
  const text = cleaned
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")   // HTMLエンティティを除去
    .replace(/\s+/g, " ")
    .trim();

  // 20文字以上の連続テキスト（意味のある文章）を抽出
  const sentences = text.match(/[^\s。．]{10,}/g) || [];
  const meaningfulLength = sentences.join("").length;

  if (meaningfulLength >= 3000) return 20;
  if (meaningfulLength >= 1500) return 15;
  if (meaningfulLength >= 800)  return 8;
  if (meaningfulLength >= 300)  return 4;
  return 0;
}

// ⑤ メタ情報：存在するだけでなく「質」も見る
function scoreMetaInfo(html: string): number {
  // titleの取得と質チェック
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // デフォルトタイトルや短すぎるタイトルは減点
  const defaultTitles = ["create next app", "next.js app", "my app", "untitled"];
  const titleIsDefault = defaultTitles.some(d => title.toLowerCase().includes(d));
  const titleScore = !title ? 0
    : titleIsDefault ? 2          // デフォルトのまま
    : title.length < 10 ? 4       // 短すぎる
    : title.length <= 60 ? 10     // 適切な長さ
    : 6;                           // 長すぎる

  // descriptionの取得と質チェック
  const descMatch = html.match(/meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)
    || html.match(/meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const desc = descMatch ? descMatch[1].trim() : "";

  const descScore = !desc ? 0
    : desc.length < 50 ? 3        // 短すぎる
    : desc.length <= 160 ? 10     // 適切な長さ
    : 6;                           // 長すぎる

  return Math.min(titleScore + descScore, 20);
}

// ページ構造解析（見出しツリー・FAQ検出）
type HeadingNode = {
  level: number;
  text: string;
  hasDefinition: boolean;
  children: HeadingNode[];
};

function analyzePageStructure(html: string): {
  headings: HeadingNode[];
  h1Count: number;
  hasFaq: boolean;
  issues: string[];
} {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // 全見出しを抽出（level, text, 位置）
  const headingRegex = /<h([1-3])[^>]*>([^<]*(?:<[^/][^>]*>[^<]*)*)<\/h\1>/gi;
  const rawHeadings: { level: number; text: string; index: number }[] = [];
  let match;
  while ((match = headingRegex.exec(clean)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (text) {
      rawHeadings.push({ level: parseInt(match[1]), text, index: match.index });
    }
  }

  // 各見出しの直後にpタグの定義文があるかチェック
  const checkDefinition = (index: number): boolean => {
    const afterHeading = clean.slice(index, index + 500);
    const defMatch = afterHeading.match(/<\/h[1-3]>\s*(?:<[^>]+>\s*)*<p[^>]*>([^<]{20,150}[。．.!！])/i);
    return !!defMatch;
  };

  // FAQ検出
  const faqPatterns = ["よくある質問", "FAQ", "Q&A", "お問い合わせ"];
  const hasFaq = rawHeadings.some(h =>
    faqPatterns.some(p => h.text.toLowerCase().includes(p.toLowerCase()))
  );

  // H1カウント
  const h1Count = rawHeadings.filter(h => h.level === 1).length;

  // ツリー構造に変換
  const buildTree = (headings: typeof rawHeadings): HeadingNode[] => {
    const result: HeadingNode[] = [];
    const stack: HeadingNode[] = [];

    for (const h of headings) {
      const node: HeadingNode = {
        level: h.level,
        text: h.text.length > 40 ? h.text.slice(0, 40) + "..." : h.text,
        hasDefinition: checkDefinition(h.index),
        children: [],
      };

      while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        result.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }
      stack.push(node);
    }
    return result;
  };

  const headings = buildTree(rawHeadings);

  // 問題点検出
  const issues: string[] = [];
  if (h1Count === 0) issues.push("H1タグがありません");
  if (h1Count > 1) issues.push(`H1タグが${h1Count}個あります（推奨: 1個）`);
  if (!hasFaq) issues.push("FAQセクションがありません");

  const noDefCount = rawHeadings.filter((h, i) => !checkDefinition(h.index)).length;
  if (noDefCount > 0) {
    issues.push(`${noDefCount}個の見出しに説明文がありません`);
  }

  return { headings, h1Count, hasFaq, issues };
}

// メタ情報詳細抽出
type MetaDetails = {
  title: { value: string; length: number; status: "good" | "warning" | "error"; suggestion?: string };
  description: { value: string; length: number; status: "good" | "warning" | "error"; suggestion?: string };
  ogp: { title: string | null; description: string | null; image: string | null; hasOgp: boolean };
  canonical: string | null;
};

function extractMetaDetails(html: string): MetaDetails {
  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const titleValue = titleMatch ? titleMatch[1].trim() : "";
  const titleLength = titleValue.length;
  let titleStatus: "good" | "warning" | "error" = "good";
  let titleSuggestion: string | undefined;

  if (!titleValue) {
    titleStatus = "error";
    titleSuggestion = "titleタグを設定してください";
  } else if (titleLength < 10) {
    titleStatus = "warning";
    titleSuggestion = "10文字以上に拡張してください";
  } else if (titleLength > 60) {
    titleStatus = "warning";
    titleSuggestion = "60文字以内に短縮してください。AIは冒頭を重視します";
  }

  // Description
  const descMatch = html.match(/meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)
    || html.match(/meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const descValue = descMatch ? descMatch[1].trim() : "";
  const descLength = descValue.length;
  let descStatus: "good" | "warning" | "error" = "good";
  let descSuggestion: string | undefined;

  if (!descValue) {
    descStatus = "error";
    descSuggestion = "120文字程度でサービス内容を記述してください";
  } else if (descLength < 50) {
    descStatus = "warning";
    descSuggestion = "50文字以上に拡張してください";
  } else if (descLength > 160) {
    descStatus = "warning";
    descSuggestion = "160文字以内に短縮してください";
  }

  // OGP
  const ogTitle = html.match(/property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
    || html.match(/content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1] || null;
  const ogDesc = html.match(/property=["']og:description["'][^>]+content=["']([^"']+)/i)?.[1]
    || html.match(/content=["']([^"']+)["'][^>]+property=["']og:description["']/i)?.[1] || null;
  const ogImage = html.match(/property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1]
    || html.match(/content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] || null;

  // Canonical
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] || null;

  return {
    title: { value: titleValue, length: titleLength, status: titleStatus, suggestion: titleSuggestion },
    description: { value: descValue, length: descLength, status: descStatus, suggestion: descSuggestion },
    ogp: { title: ogTitle, description: ogDesc, image: ogImage, hasOgp: !!(ogTitle || ogDesc || ogImage) },
    canonical,
  };
}

// ドメイン名を含む文（前後1文を含む）を抽出する
function extractCitationContext(answer: string, domain: string, maxLength = 150): string {
  if (!answer || !domain) return "";

  const domainLower = domain.toLowerCase();
  const answerLower = answer.toLowerCase();

  if (!answerLower.includes(domainLower)) return "";

  // 文単位で分割（日本語・英語両対応）
  const sentences = answer.split(/(?<=[。．.!！?？\n])\s*/);

  // ドメインを含む文のインデックスを見つける
  let targetIndex = -1;
  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i].toLowerCase().includes(domainLower)) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    // 文分割で見つからない場合、元のロジックにフォールバック
    const domainIndex = answerLower.indexOf(domainLower);
    const start = Math.max(0, domainIndex - 30);
    const end = Math.min(answer.length, domainIndex + domain.length + 100);
    const excerpt = answer.slice(start, end).trim();
    return (start > 0 ? "..." : "") + excerpt + (end < answer.length ? "..." : "");
  }

  // 前後1文を含めて抽出
  const startIdx = Math.max(0, targetIndex - 1);
  const endIdx = Math.min(sentences.length, targetIndex + 2);
  let result = sentences.slice(startIdx, endIdx).join("");

  // 長すぎる場合は切り詰め
  if (result.length > maxLength) {
    // ドメインが含まれる位置を中心に切り取る
    const domainPosInResult = result.toLowerCase().indexOf(domainLower);
    const start = Math.max(0, domainPosInResult - 40);
    const end = Math.min(result.length, domainPosInResult + domain.length + 80);
    result = (start > 0 ? "..." : "") + result.slice(start, end).trim() + (end < result.length ? "..." : "");
  }

  return result;
}

// ⑥ サイト情報から業種・地域を推定してローカルクエリを生成・検証する
async function scoreAICitationWithReport(url: string): Promise<{
  score: number;
  cited: boolean;
  industry: string;
  region: string;
  queries: { query: string; cited: boolean; context: string }[];
  competitors: { query: string; sites: string[] }[];
}> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return {
    score: 0, cited: false, industry: "不明", region: "不明", queries: [], competitors: []
  };

  const domain = new URL(url).hostname.replace("www.", "");

  // Step1: 業種・地域を推定（GPT-4o mini使用 - コスト効率）
  let industry = "不明";
  let region = "不明";
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const inferRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{
            role: "user",
            content: `ウェブサイトのドメイン「${domain}」から、このサイトの業種と所在地域を推定してください。
JSON形式のみで回答：{"industry": "業種", "region": "都道府県または市区町村"}
推定できない場合：{"industry": "不明", "region": "不明"}`
          }],
          max_tokens: 80,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(8000),
      });
      const inferData = await inferRes.json();
      const inferText = inferData.choices?.[0]?.message?.content ?? "";
      const jsonMatch = inferText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        industry = parsed.industry || "不明";
        region = parsed.region || "不明";
      }
    } catch { /* 推定失敗時はデフォルト値を使う */ }
  }

  // Step2: ローカルクエリを生成
  const localQueries: string[] = [];
  if (industry !== "不明" && region !== "不明") {
    localQueries.push(`${region} ${industry} おすすめ`);
    localQueries.push(`${region} ${industry} 評判の良い会社`);
    localQueries.push(`${industry} ${region} 依頼先`);
  } else {
    localQueries.push(`${domain} サービス内容`);
    localQueries.push(`${domain} 評判`);
    localQueries.push(`${domain} 口コミ`);
  }

  // Step3: 各クエリでPerplexityに投げて引用チェック
  const results: { query: string; cited: boolean; context: string }[] = [];
  for (const query of localQueries) {
    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: query }],
          max_tokens: 400,
        }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await res.json();
      const answer = data.choices?.[0]?.message?.content ?? "";
      const citations: string[] = data.citations ?? [];

      // ソースとして引用されているか（最も確実な判定）
      const citedInSources = citations.some((c: string) =>
        c.toLowerCase().includes(domain.toLowerCase())
      );

      // 回答内でポジティブに言及されているか
      // 「見つかりません」「存在しません」「不明」などの否定文脈を除外する
      const negativePatterns = [
        "見つかりません",
        "存在しません",
        "情報はありません",
        "見当たりません",
        "確認できません",
        "not found",
        "no information",
        "no direct",
        "could not find",
        "cannot find",
        "doesn't appear",
        "does not appear",
        "no results",
      ];

      const answerLower = answer.toLowerCase();
      const domainInAnswer = answerLower.includes(domain.toLowerCase());

      // ドメインが言及されていても、直後に否定表現が続く場合はfalse
      let positiveMention = false;
      if (domainInAnswer) {
        const domainIndex = answerLower.indexOf(domain.toLowerCase());
        const surroundingText = answerLower.slice(
          Math.max(0, domainIndex - 50),
          domainIndex + 150
        );
        const hasNegativeContext = negativePatterns.some(p =>
          surroundingText.includes(p.toLowerCase())
        );
        positiveMention = !hasNegativeContext;
      }

      const isCited = citedInSources || positiveMention;

      results.push({
        query,
        cited: isCited,
        context: isCited
          ? extractCitationContext(answer, domain, 150)
          : "",
      });
    } catch {
      results.push({ query, cited: false, context: "" });
    }
  }

  const citedCount = results.filter(r => r.cited).length;
  const score = citedCount === 3 ? 20 : citedCount === 2 ? 14 : citedCount === 1 ? 8 : 2;

  // Step4: 競合比較（引用されたクエリで競合サイトを抽出）
  const competitors: { query: string; sites: string[] }[] = [];
  for (const result of results) {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: result.query }],
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(12000),
    });
    const data = await res.json();
    const citations: string[] = data.citations ?? [];
    const competitorSites = citations
      .map((c: string) => {
        try { return new URL(c).hostname.replace("www.", ""); } catch { return ""; }
      })
      .filter((h: string) => h && !h.includes(domain))
      .filter((h: string, i: number, arr: string[]) => arr.indexOf(h) === i)
      .slice(0, 3);
    if (competitorSites.length > 0) {
      competitors.push({ query: result.query, sites: competitorSites });
    }
  }

  return {
    score,
    cited: citedCount > 0,
    industry,
    region,
    queries: results,
    competitors,
  };
}

async function generateActionPlan(
  scores: Record<string, number>,
  url: string
): Promise<{ priority: "high" | "medium" | "low"; item: string; action: string }[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return [];

  const scoreDescriptions = [
    { key: "structuredData", label: "構造化データ（Schema.org）", score: scores.structuredData, max: 20 },
    { key: "answerCapsule", label: "回答カプセル（H2/H3直後の定義文）", score: scores.answerCapsule, max: 20 },
    { key: "infoDensity", label: "情報密度（数値・実績データの量）", score: scores.infoDensity, max: 20 },
    { key: "contentLength", label: "コンテンツ量", score: scores.contentLength, max: 20 },
    { key: "metaInfo", label: "メタ情報（title・description）", score: scores.metaInfo, max: 20 },
  ];

  const lowScores = scoreDescriptions
    .sort((a, b) => (a.score / a.max) - (b.score / b.max))
    .slice(0, 3);

  const prompt = `あなたはAIEO（AI Engine Optimization）の専門家です。
ウェブサイト「${url}」の診断結果に基づき、AIに引用されやすくするための具体的な改善アクションを提案してください。

【診断結果】
${lowScores.map(s => `- ${s.label}：${s.score}/${s.max}点`).join("\n")}

【回答ルール】
- 「〜してください」ではなく「〜を追加する」「〜に変更する」のような具体的な作業指示
- 実装可能な具体例を含める（例：「導入実績50社」のような数値を追加）
- 一般論ではなく、このサイトに適用できる実践的なアドバイス

以下のJSON形式で3つの改善アクションを返してください：
[
  {"priority": "high", "item": "改善項目名", "action": "具体的な改善アクション（実装例を含む1〜2文）"},
  {"priority": "medium", "item": "改善項目名", "action": "具体的な改善アクション"},
  {"priority": "low", "item": "改善項目名", "action": "具体的な改善アクション"}
]
JSON以外のテキストは出力しないでください。`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}
  return [];
}
