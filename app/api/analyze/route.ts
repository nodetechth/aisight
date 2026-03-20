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
    const scores = {
      structuredData: scoreStructuredData(html),
      answerCapsule: scoreAnswerCapsule(html),
      infoDensity: scoreInfoDensity(html),
      contentLength: scoreContentLength(html),
      metaInfo: scoreMetaInfo(html),
    };

    const total = Object.values(scores).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      url,
      total,
      scores,
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

// ② 回答カプセル：H1〜H3直後200文字以内に定義文があるか
function scoreAnswerCapsule(html: string): number {
  const afterHeading = /<h[1-3][^>]*>.+?<\/h[1-3]>\s*<p[^>]*>(.{20,200}?[。．.!！])/gi;
  const matches = html.match(afterHeading) || [];
  if (matches.length >= 3) return 20;
  if (matches.length >= 1) return 12;
  return 4;
}

// ③ 情報密度：本文テキストのHTML全体に対する割合
function scoreInfoDensity(html: string): number {
  const text = html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const ratio = text.length / html.length;
  const per1000 = ratio * 1000;
  if (per1000 >= 10) return 20;
  if (per1000 >= 5) return 14;
  if (per1000 >= 2) return 8;
  return 3;
}

// ④ コンテンツ長：本文2000文字以上あるか
function scoreContentLength(html: string): number {
  const text = html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (text.length >= 3000) return 20;
  if (text.length >= 2000) return 15;
  if (text.length >= 1000) return 8;
  return 3;
}

// ⑤ メタ情報：title と meta description が両方あるか
function scoreMetaInfo(html: string): number {
  const hasTitle = /<title[^>]*>.+?<\/title>/i.test(html);
  const hasDesc = /meta[^>]+name=["']description["'][^>]+content=["'].{20,}/i.test(html)
    || /meta[^>]+content=["'].{20,}["'][^>]+name=["']description["']/i.test(html);
  if (hasTitle && hasDesc) return 20;
  if (hasTitle || hasDesc) return 10;
  return 0;
}
