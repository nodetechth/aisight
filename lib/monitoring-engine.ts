// モニタリングエンジン - Perplexity APIを使用してキーワードごとの引用チェックを実行

import type {
  MonitoringConfig,
  MonitoringCheckResult,
  CompetitorCitation,
} from "@/types/diagnosis";

// 否定文脈のパターン
const NEGATIVE_PATTERNS = [
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

// ドメイン名を含む文（前後1文を含む）を抽出する
function extractCitationContext(
  answer: string,
  domain: string,
  maxLength = 150
): string {
  if (!answer || !domain) return "";

  const domainLower = domain.toLowerCase();
  const answerLower = answer.toLowerCase();

  if (!answerLower.includes(domainLower)) return "";

  const sentences = answer.split(/(?<=[。．.!！?？\n])\s*/);

  let targetIndex = -1;
  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i].toLowerCase().includes(domainLower)) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    const domainIndex = answerLower.indexOf(domainLower);
    const start = Math.max(0, domainIndex - 30);
    const end = Math.min(answer.length, domainIndex + domain.length + 100);
    const excerpt = answer.slice(start, end).trim();
    return (start > 0 ? "..." : "") + excerpt + (end < answer.length ? "..." : "");
  }

  const startIdx = Math.max(0, targetIndex - 1);
  const endIdx = Math.min(sentences.length, targetIndex + 2);
  let result = sentences.slice(startIdx, endIdx).join("");

  if (result.length > maxLength) {
    const domainPosInResult = result.toLowerCase().indexOf(domainLower);
    const start = Math.max(0, domainPosInResult - 40);
    const end = Math.min(result.length, domainPosInResult + domain.length + 80);
    result =
      (start > 0 ? "..." : "") +
      result.slice(start, end).trim() +
      (end < result.length ? "..." : "");
  }

  return result;
}

// ドメインがポジティブに引用されているかチェック
function checkPositiveCitation(
  answer: string,
  citations: string[],
  domain: string
): boolean {
  const domainLower = domain.toLowerCase();

  // ソースとして引用されているか
  const citedInSources = citations.some((c: string) =>
    c.toLowerCase().includes(domainLower)
  );

  if (citedInSources) return true;

  // 回答内でポジティブに言及されているか
  const answerLower = answer.toLowerCase();
  const domainInAnswer = answerLower.includes(domainLower);

  if (!domainInAnswer) return false;

  // 否定文脈をチェック
  const domainIndex = answerLower.indexOf(domainLower);
  const surroundingText = answerLower.slice(
    Math.max(0, domainIndex - 50),
    domainIndex + 150
  );
  const hasNegativeContext = NEGATIVE_PATTERNS.some((p) =>
    surroundingText.includes(p.toLowerCase())
  );

  return !hasNegativeContext;
}

// Perplexity APIでキーワードチェック
async function checkKeywordCitation(
  keyword: string,
  area: string | null,
  targetDomain: string,
  competitorDomains: string[],
  apiKey: string
): Promise<{
  query: string;
  is_cited: boolean;
  citation_context: string | null;
  competitor_citations: CompetitorCitation[];
}> {
  // クエリを生成（地域が設定されている場合は含める）
  const query = area ? `${area} ${keyword} おすすめ` : `${keyword} おすすめ`;

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: query }],
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content ?? "";
    const citations: string[] = data.citations ?? [];

    // 自社ドメインのチェック
    const is_cited = checkPositiveCitation(answer, citations, targetDomain);
    const citation_context = is_cited
      ? extractCitationContext(answer, targetDomain)
      : null;

    // 競合ドメインのチェック
    const competitor_citations: CompetitorCitation[] = competitorDomains.map(
      (domain) => ({
        domain,
        is_cited: checkPositiveCitation(answer, citations, domain),
        context: checkPositiveCitation(answer, citations, domain)
          ? extractCitationContext(answer, domain)
          : undefined,
      })
    );

    return {
      query,
      is_cited,
      citation_context,
      competitor_citations,
    };
  } catch {
    return {
      query,
      is_cited: false,
      citation_context: null,
      competitor_citations: competitorDomains.map((domain) => ({
        domain,
        is_cited: false,
      })),
    };
  }
}

// 前回結果との比較で変化を判定
function determineChange(
  is_cited: boolean,
  previousResult: { is_cited: boolean } | null
): MonitoringCheckResult["change_from_previous"] {
  if (!previousResult) return "new";
  if (is_cited && !previousResult.is_cited) return "gained";
  if (!is_cited && previousResult.is_cited) return "lost";
  return "unchanged";
}

export type PreviousResults = Map<string, { is_cited: boolean }>;

// メインのモニタリングチェック関数
export async function runMonitoringCheck(
  config: MonitoringConfig,
  previousResults: PreviousResults
): Promise<MonitoringCheckResult[]> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY is not configured");
  }

  const results: MonitoringCheckResult[] = [];

  // 各キーワードについてチェック（順次実行でAPI負荷を抑える）
  for (const keyword of config.keywords) {
    const checkResult = await checkKeywordCitation(
      keyword,
      config.area,
      config.domain,
      config.competitor_domains,
      apiKey
    );

    const previousResult = previousResults.get(keyword) ?? null;
    const change_from_previous = determineChange(
      checkResult.is_cited,
      previousResult
    );

    results.push({
      keyword,
      query: checkResult.query,
      is_cited: checkResult.is_cited,
      citation_context: checkResult.citation_context,
      competitor_citations: checkResult.competitor_citations,
      change_from_previous,
    });
  }

  return results;
}

// 診断時にモニタリングも同時実行する関数
// 既存のクエリ結果を再利用してAPI呼び出しを最小化
export async function runMonitoringWithDiagnosis(
  config: MonitoringConfig,
  existingQueries: { query: string; cited: boolean; context: string }[],
  previousResults: PreviousResults
): Promise<MonitoringCheckResult[]> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY is not configured");
  }

  const results: MonitoringCheckResult[] = [];

  for (const keyword of config.keywords) {
    // 診断クエリに含まれているキーワードがあれば再利用
    const matchingQuery = existingQueries.find(
      (q) =>
        q.query.includes(keyword) ||
        (config.area && q.query.includes(config.area) && q.query.includes(keyword))
    );

    if (matchingQuery) {
      // 既存の結果を再利用（競合チェックのみ追加で実行）
      const competitorResults = await checkCompetitorsOnly(
        matchingQuery.query,
        config.competitor_domains,
        apiKey
      );

      const previousResult = previousResults.get(keyword) ?? null;

      results.push({
        keyword,
        query: matchingQuery.query,
        is_cited: matchingQuery.cited,
        citation_context: matchingQuery.context || null,
        competitor_citations: competitorResults,
        change_from_previous: determineChange(matchingQuery.cited, previousResult),
      });
    } else {
      // 新規でAPIを呼び出し
      const checkResult = await checkKeywordCitation(
        keyword,
        config.area,
        config.domain,
        config.competitor_domains,
        apiKey
      );

      const previousResult = previousResults.get(keyword) ?? null;

      results.push({
        keyword,
        query: checkResult.query,
        is_cited: checkResult.is_cited,
        citation_context: checkResult.citation_context,
        competitor_citations: checkResult.competitor_citations,
        change_from_previous: determineChange(checkResult.is_cited, previousResult),
      });
    }
  }

  return results;
}

// 競合のみチェック（既存クエリの結果を再利用する場合）
async function checkCompetitorsOnly(
  query: string,
  competitorDomains: string[],
  apiKey: string
): Promise<CompetitorCitation[]> {
  if (competitorDomains.length === 0) return [];

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: query }],
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content ?? "";
    const citations: string[] = data.citations ?? [];

    return competitorDomains.map((domain) => ({
      domain,
      is_cited: checkPositiveCitation(answer, citations, domain),
      context: checkPositiveCitation(answer, citations, domain)
        ? extractCitationContext(answer, domain)
        : undefined,
    }));
  } catch {
    return competitorDomains.map((domain) => ({
      domain,
      is_cited: false,
    }));
  }
}
