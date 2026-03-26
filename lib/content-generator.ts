// コンテンツ生成エンジン - Perplexity APIで検索意図分析、構成生成

export type TitleCandidate = {
  title: string;
  type: "how-to" | "listicle" | "comparison" | "guide" | "qa";
  reason: string;
};

export type OutlineSection = {
  heading: string;
  level: 2 | 3;
  description: string;
  keyPoints: string[];
  suggestedLength: number; // 推奨文字数
};

export type MetaInfo = {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
};

export type LLMOTip = {
  category: "structure" | "content" | "citation" | "technical";
  tip: string;
  priority: "high" | "medium" | "low";
};

export type ContentGenerationResult = {
  keyword: string;
  searchIntent: string;
  titleCandidates: TitleCandidate[];
  outline: OutlineSection[];
  metaInfo: MetaInfo;
  llmoTips: LLMOTip[];
};

// メイン生成関数
export async function generateArticleStructure(
  keyword: string,
  domain?: string,
  area?: string
): Promise<ContentGenerationResult> {
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!perplexityKey || !openaiKey) {
    throw new Error("API keys are not configured");
  }

  // Step 1: Perplexityで検索意図と競合を分析
  const searchAnalysis = await analyzeSearchIntent(keyword, area, perplexityKey);

  // Step 2: GPT-4oで記事構成を生成
  const structure = await generateStructure(
    keyword,
    searchAnalysis,
    domain,
    area,
    openaiKey
  );

  return {
    keyword,
    ...searchAnalysis,
    ...structure,
  };
}

// Perplexityで検索意図を分析
async function analyzeSearchIntent(
  keyword: string,
  area: string | undefined,
  apiKey: string
): Promise<{ searchIntent: string }> {
  const query = area ? `${area} ${keyword}` : keyword;

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "user",
            content: `「${query}」で検索するユーザーの検索意図を分析してください。

1. このキーワードで検索する人は何を知りたいのか
2. 情報収集/比較検討/購入検討のどの段階か
3. 上位表示されているコンテンツの共通点

簡潔に2〜3文で要約してください。`,
          },
        ],
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    const intent = data.choices?.[0]?.message?.content ?? "";

    return { searchIntent: intent };
  } catch {
    return { searchIntent: "検索意図の分析に失敗しました" };
  }
}

// GPT-4oで記事構成を生成
async function generateStructure(
  keyword: string,
  analysis: { searchIntent: string },
  domain: string | undefined,
  area: string | undefined,
  apiKey: string
): Promise<{
  titleCandidates: TitleCandidate[];
  outline: OutlineSection[];
  metaInfo: MetaInfo;
  llmoTips: LLMOTip[];
}> {
  const contextInfo = [
    domain ? `対象ドメイン: ${domain}` : null,
    area ? `対象エリア: ${area}` : null,
    `検索意図分析: ${analysis.searchIntent}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `あなたはSEOとAIEO（AI Engine Optimization）の専門家です。
以下のキーワードに対して、AIに引用されやすい記事の構成を提案してください。

【キーワード】
${keyword}

【背景情報】
${contextInfo}

【要件】
- AIが回答生成時に引用しやすい構造
- 各セクション冒頭に「〇〇とは△△です」形式の定義文を配置
- 具体的な数値・事例を含む

以下のJSON形式で回答してください。JSON以外は出力しないでください。

{
  "titleCandidates": [
    {"title": "タイトル案1", "type": "how-to|listicle|comparison|guide|qa", "reason": "選定理由"},
    {"title": "タイトル案2", "type": "...", "reason": "..."},
    {"title": "タイトル案3", "type": "...", "reason": "..."}
  ],
  "outline": [
    {
      "heading": "見出し（H2）",
      "level": 2,
      "description": "このセクションで書くべき内容の説明",
      "keyPoints": ["ポイント1", "ポイント2", "ポイント3"],
      "suggestedLength": 400
    },
    {
      "heading": "見出し（H3）",
      "level": 3,
      "description": "...",
      "keyPoints": ["..."],
      "suggestedLength": 300
    }
  ],
  "metaInfo": {
    "title": "SEOタイトル（30〜60文字）",
    "description": "メタディスクリプション（100〜160文字）",
    "ogTitle": "OGPタイトル",
    "ogDescription": "OGPディスクリプション"
  },
  "llmoTips": [
    {"category": "structure|content|citation|technical", "tip": "LLMO最適化のためのアドバイス", "priority": "high|medium|low"}
  ]
}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        titleCandidates: parsed.titleCandidates || [],
        outline: parsed.outline || [],
        metaInfo: parsed.metaInfo || {
          title: "",
          description: "",
          ogTitle: "",
          ogDescription: "",
        },
        llmoTips: parsed.llmoTips || [],
      };
    }
  } catch (e) {
    console.error("Structure generation failed:", e);
  }

  // フォールバック
  return {
    titleCandidates: [
      {
        title: `${keyword}の完全ガイド`,
        type: "guide",
        reason: "汎用的なガイド形式",
      },
    ],
    outline: [
      {
        heading: `${keyword}とは`,
        level: 2,
        description: "基本的な定義と概要を説明",
        keyPoints: ["定義", "背景", "重要性"],
        suggestedLength: 400,
      },
    ],
    metaInfo: {
      title: `${keyword}とは？初心者向け完全ガイド`,
      description: `${keyword}について詳しく解説。基本から応用まで、この記事を読めば全てがわかります。`,
      ogTitle: `${keyword}の完全ガイド`,
      ogDescription: `${keyword}について詳しく解説します。`,
    },
    llmoTips: [
      {
        category: "structure",
        tip: "各セクションの冒頭に「〇〇とは△△です」形式の定義文を入れましょう",
        priority: "high",
      },
    ],
  };
}
