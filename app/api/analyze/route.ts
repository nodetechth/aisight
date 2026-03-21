import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || !url.startsWith("http")) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  try {
    // サイトのHTMLを取得
    const res = await fetch(url, {
      headers: { "User-Agent": "AISight-Bot/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();

    // スコア計算
    const [
      structuredData,
      answerCapsule,
      infoDensity,
      contentLength,
      metaInfo,
      aiCitationReport,
    ] = await Promise.all([
      Promise.resolve(scoreStructuredData(html)),
      Promise.resolve(scoreAnswerCapsule(html)),
      Promise.resolve(scoreInfoDensity(html)),
      Promise.resolve(scoreContentLength(html)),
      Promise.resolve(scoreMetaInfo(html)),
      scoreAICitationWithReport(url),
    ]);

    const scores = {
      structuredData,
      answerCapsule,
      infoDensity,
      contentLength,
      metaInfo,
      aiCitation: aiCitationReport.score,
    };

    const total = Object.values(scores).reduce((a, b) => a + b, 0);

    const actionPlan = await generateActionPlan(scores, url);

    return NextResponse.json({
      url,
      total,
      scores,
      cited: aiCitationReport.cited,
      aiCitationReport: {
        industry: aiCitationReport.industry,
        region: aiCitationReport.region,
        queries: aiCitationReport.queries,
        citedCount: aiCitationReport.queries.filter(q => q.cited).length,
        totalQueries: aiCitationReport.queries.length,
        competitors: aiCitationReport.competitors,
      },
      actionPlan,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
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

  // Step1: 業種・地域を推定
  let industry = "不明";
  let region = "不明";
  try {
    const inferRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{
          role: "user",
          content: `以下のウェブサイトのドメイン「${domain}」について、サイトの業種と所在地域を日本語で簡潔に答えてください。
JSON形式で回答してください：{"industry": "業種", "region": "都道府県または市区町村"}
わからない場合は{"industry": "不明", "region": "不明"}と答えてください。`
        }],
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(10000),
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
          ? answer.slice(0, 150).trim() + "..."
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
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return [];

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

  const prompt = `以下はウェブサイト「${url}」のAIEOスコア診断結果です。
スコアが低い項目について、具体的な改善アクションを提案してください。

${lowScores.map(s => `- ${s.label}：${s.score}/${s.max}点`).join("\n")}

以下のJSON形式で3つの改善アクションを返してください。
優先度は high/medium/low のいずれかで指定してください。
[
  {"priority": "high", "item": "改善項目名", "action": "具体的な改善アクション（1〜2文）"},
  ...
]
JSON以外のテキストは含めないでください。`;

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
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
