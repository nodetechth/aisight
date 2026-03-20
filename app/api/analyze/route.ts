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
      aiCitation,
    ] = await Promise.all([
      Promise.resolve(scoreStructuredData(html)),
      Promise.resolve(scoreAnswerCapsule(html)),
      Promise.resolve(scoreInfoDensity(html)),
      Promise.resolve(scoreContentLength(html)),
      Promise.resolve(scoreMetaInfo(html)),
      scoreAICitation(url),
    ]);

    const scores = {
      structuredData,
      answerCapsule,
      infoDensity,
      contentLength,
      metaInfo,
      aiCitation,
    };

    const total = Object.values(scores).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      url,
      total,
      scores,
      cited: aiCitation > 0,
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

// ⑥ AI引用チェック：Perplexity APIに実際に質問してドメインが言及されるか確認
async function scoreAICitation(url: string): Promise<number> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return 0;

  // URLからドメインを抽出
  const domain = new URL(url).hostname.replace("www.", "");

  // サイトのタイトルや業種を推測するためのシンプルなプロンプト
  const prompt = `「${domain}」というウェブサイトについて教えてください。
このサイトを知っていますか？どのようなサービスや情報を提供していますか？`;

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content ?? "";

    // 回答にドメインまたはサイト名が含まれているかチェック
    const domainMentioned = answer.toLowerCase().includes(domain.toLowerCase());

    // 引用ソース（citations）にドメインが含まれているかもチェック
    const citations: string[] = data.citations ?? [];
    const citedInSources = citations.some((c: string) =>
      c.toLowerCase().includes(domain.toLowerCase())
    );

    if (citedInSources) return 20;   // ソースとして実際に引用された
    if (domainMentioned) return 12;  // 回答内で言及された
    return 2;                         // 言及なし（存在を知られていない）
  } catch {
    return 0; // APIエラー時はスコアに影響させない
  }
}
