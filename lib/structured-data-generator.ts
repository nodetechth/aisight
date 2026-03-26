// 構造化データ（JSON-LD）生成

import type { OutlineSection, MetaInfo } from "./content-generator";

export type ArticleJsonLd = {
  "@context": "https://schema.org";
  "@type": "Article";
  headline: string;
  description: string;
  author: {
    "@type": "Organization" | "Person";
    name: string;
    url?: string;
  };
  publisher?: {
    "@type": "Organization";
    name: string;
    logo?: {
      "@type": "ImageObject";
      url: string;
    };
  };
  datePublished?: string;
  dateModified?: string;
  mainEntityOfPage?: {
    "@type": "WebPage";
    "@id": string;
  };
};

export type FAQPageJsonLd = {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: {
    "@type": "Question";
    name: string;
    acceptedAnswer: {
      "@type": "Answer";
      text: string;
    };
  }[];
};

export type GeneratedStructuredData = {
  article: ArticleJsonLd;
  faqPage: FAQPageJsonLd | null;
  combined: string; // 整形済みJSON文字列
};

// 記事構成からJSON-LDを生成
export function generateJsonLd(
  metaInfo: MetaInfo,
  outline: OutlineSection[],
  options: {
    authorName: string;
    authorUrl?: string;
    publisherName?: string;
    publisherLogo?: string;
    pageUrl?: string;
  }
): GeneratedStructuredData {
  // Article JSON-LD
  const article: ArticleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: metaInfo.title,
    description: metaInfo.description,
    author: {
      "@type": "Organization",
      name: options.authorName,
      ...(options.authorUrl && { url: options.authorUrl }),
    },
    ...(options.publisherName && {
      publisher: {
        "@type": "Organization",
        name: options.publisherName,
        ...(options.publisherLogo && {
          logo: {
            "@type": "ImageObject",
            url: options.publisherLogo,
          },
        }),
      },
    }),
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    ...(options.pageUrl && {
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": options.pageUrl,
      },
    }),
  };

  // FAQ JSON-LD（Q&A形式のセクションがある場合）
  const faqSections = outline.filter(
    (section) =>
      section.heading.includes("よくある質問") ||
      section.heading.includes("FAQ") ||
      section.heading.includes("Q&A") ||
      section.keyPoints.some((p) => p.includes("？") || p.includes("?"))
  );

  let faqPage: FAQPageJsonLd | null = null;

  if (faqSections.length > 0) {
    const faqItems = faqSections.flatMap((section) =>
      section.keyPoints
        .filter((p) => p.includes("？") || p.includes("?"))
        .map((question) => ({
          "@type": "Question" as const,
          name: question.replace(/？|\?/g, "？"),
          acceptedAnswer: {
            "@type": "Answer" as const,
            text: `${section.description}（詳細は記事本文をご覧ください）`,
          },
        }))
    );

    if (faqItems.length > 0) {
      faqPage = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems,
      };
    }
  }

  // 結合したJSON文字列
  const combined = faqPage
    ? JSON.stringify([article, faqPage], null, 2)
    : JSON.stringify(article, null, 2);

  return { article, faqPage, combined };
}

// JSON-LDのscriptタグ用HTML生成
export function generateJsonLdScript(data: GeneratedStructuredData): string {
  const scripts: string[] = [];

  scripts.push(
    `<script type="application/ld+json">\n${JSON.stringify(data.article, null, 2)}\n</script>`
  );

  if (data.faqPage) {
    scripts.push(
      `<script type="application/ld+json">\n${JSON.stringify(data.faqPage, null, 2)}\n</script>`
    );
  }

  return scripts.join("\n\n");
}

// FAQセクションの雛形を生成
export function generateFAQSuggestions(
  keyword: string,
  outline: OutlineSection[]
): { question: string; answerHint: string }[] {
  const suggestions: { question: string; answerHint: string }[] = [];

  // 基本的なFAQ
  suggestions.push({
    question: `${keyword}とは何ですか？`,
    answerHint: "定義と基本的な説明",
  });

  suggestions.push({
    question: `${keyword}のメリット・デメリットは？`,
    answerHint: "利点と注意点をバランスよく",
  });

  suggestions.push({
    question: `${keyword}の費用・料金はどのくらいですか？`,
    answerHint: "具体的な価格帯や相場",
  });

  suggestions.push({
    question: `${keyword}の選び方のポイントは？`,
    answerHint: "判断基準や比較ポイント",
  });

  // アウトラインからFAQ候補を抽出
  for (const section of outline) {
    if (section.heading.includes("とは") || section.heading.includes("について")) {
      suggestions.push({
        question: `${section.heading.replace("とは", "")}とは何ですか？`,
        answerHint: section.description,
      });
    }
  }

  return suggestions.slice(0, 8); // 最大8つまで
}
