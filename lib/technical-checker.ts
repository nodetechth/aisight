// 技術的整備チェック（llms.txt, robots.txt）

export type LlmsTxtResult = {
  exists: boolean;
  location: "/.well-known/llms.txt" | "/llms.txt" | null;
  content: string | null;
  error?: string;
};

export type AiCrawlerStatus = {
  userAgent: string;
  displayName: string;
  allowed: boolean;
  disallowRules: string[];
};

export type RobotsTxtResult = {
  exists: boolean;
  crawlers: AiCrawlerStatus[];
  allBlocked: boolean;
  partiallyBlocked: boolean;
  error?: string;
};

export type TechnicalCheckResult = {
  llmsTxt: LlmsTxtResult;
  robotsTxt: RobotsTxtResult;
  score: number;
  issues: string[];
};

// チェック対象のAIクローラーUA
const AI_CRAWLERS = [
  { userAgent: "GPTBot", displayName: "GPTBot (OpenAI)" },
  { userAgent: "ChatGPT-User", displayName: "ChatGPT-User" },
  { userAgent: "Google-Extended", displayName: "Google-Extended (Gemini)" },
  { userAgent: "CCBot", displayName: "CCBot (Common Crawl)" },
  { userAgent: "PerplexityBot", displayName: "PerplexityBot" },
  { userAgent: "ClaudeBot", displayName: "ClaudeBot (Anthropic)" },
  { userAgent: "Applebot-Extended", displayName: "Applebot-Extended" },
  { userAgent: "cohere-ai", displayName: "Cohere AI" },
];

// llms.txt をチェック
export async function checkLlmsTxt(domain: string): Promise<LlmsTxtResult> {
  const locations = ["/.well-known/llms.txt", "/llms.txt"];
  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;

  for (const location of locations) {
    try {
      const url = new URL(location, baseUrl).toString();
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "AISight-Bot/1.0" },
      });

      if (response.ok) {
        const content = await response.text();
        // 有効なllms.txtかどうか簡易チェック（空でない、テキスト形式）
        if (content.trim().length > 0) {
          return {
            exists: true,
            location: location as "/.well-known/llms.txt" | "/llms.txt",
            content: content.slice(0, 1000), // 最初の1000文字のみ保存
          };
        }
      }
    } catch {
      // 次のロケーションを試す
    }
  }

  return {
    exists: false,
    location: null,
    content: null,
  };
}

// robots.txt をパースしてAIクローラーのブロック状況を確認
export async function checkRobotsTxt(domain: string): Promise<RobotsTxtResult> {
  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;

  try {
    const url = new URL("/robots.txt", baseUrl).toString();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "AISight-Bot/1.0" },
    });

    if (!response.ok) {
      return {
        exists: false,
        crawlers: AI_CRAWLERS.map(c => ({
          ...c,
          allowed: true, // robots.txtがなければ許可とみなす
          disallowRules: [],
        })),
        allBlocked: false,
        partiallyBlocked: false,
      };
    }

    const content = await response.text();
    const crawlerStatuses = parseRobotsTxt(content);

    const blockedCount = crawlerStatuses.filter(c => !c.allowed).length;

    return {
      exists: true,
      crawlers: crawlerStatuses,
      allBlocked: blockedCount === AI_CRAWLERS.length,
      partiallyBlocked: blockedCount > 0 && blockedCount < AI_CRAWLERS.length,
    };
  } catch (error) {
    return {
      exists: false,
      crawlers: AI_CRAWLERS.map(c => ({
        ...c,
        allowed: true,
        disallowRules: [],
      })),
      allBlocked: false,
      partiallyBlocked: false,
      error: "robots.txtの取得に失敗しました",
    };
  }
}

// robots.txt をパース
function parseRobotsTxt(content: string): AiCrawlerStatus[] {
  const lines = content.split("\n").map(l => l.trim());
  const results: AiCrawlerStatus[] = [];

  // 各AIクローラーについてチェック
  for (const crawler of AI_CRAWLERS) {
    const disallowRules: string[] = [];
    let inUserAgentBlock = false;
    let currentUserAgent = "";

    for (const line of lines) {
      // コメント行をスキップ
      if (line.startsWith("#") || line === "") continue;

      const lowerLine = line.toLowerCase();

      // User-agent 行
      if (lowerLine.startsWith("user-agent:")) {
        currentUserAgent = line.substring(11).trim();
        inUserAgentBlock =
          currentUserAgent === "*" ||
          currentUserAgent.toLowerCase() === crawler.userAgent.toLowerCase();
      }
      // Disallow 行
      else if (lowerLine.startsWith("disallow:") && inUserAgentBlock) {
        const rule = line.substring(9).trim();
        if (rule && rule !== "") {
          disallowRules.push(rule);
        }
      }
      // Allow 行（明示的な許可をチェック）
      else if (lowerLine.startsWith("allow:") && inUserAgentBlock) {
        // Allow: / があれば基本的に許可
        const rule = line.substring(6).trim();
        if (rule === "/") {
          // ルート許可されている場合、disallowをクリア
          disallowRules.length = 0;
        }
      }
    }

    // Disallow: / が含まれていればブロック
    const isBlocked = disallowRules.includes("/");

    results.push({
      ...crawler,
      allowed: !isBlocked,
      disallowRules,
    });
  }

  return results;
}

// 技術的整備の総合チェック
export async function runTechnicalCheck(url: string): Promise<TechnicalCheckResult> {
  const domain = new URL(url).hostname;

  const [llmsTxt, robotsTxt] = await Promise.all([
    checkLlmsTxt(domain),
    checkRobotsTxt(domain),
  ]);

  // スコア計算
  let score = 0;
  const issues: string[] = [];

  // llms.txt チェック
  if (llmsTxt.exists) {
    score += 5;
  } else {
    issues.push("llms.txt が設置されていません。AIがサイトの概要を把握しやすくなります。");
  }

  // robots.txt チェック
  if (robotsTxt.allBlocked) {
    score -= 10;
    issues.push("すべてのAIクローラーがブロックされています。AIに引用される可能性が大幅に低下します。");
  } else if (robotsTxt.partiallyBlocked) {
    score -= 3;
    const blockedNames = robotsTxt.crawlers
      .filter(c => !c.allowed)
      .map(c => c.displayName)
      .join(", ");
    issues.push(`一部のAIクローラー（${blockedNames}）がブロックされています。`);
  }

  return {
    llmsTxt,
    robotsTxt,
    score,
    issues,
  };
}
