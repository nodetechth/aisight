// サイテーション戦略の型定義

export type Priority = "high" | "medium" | "low";

export type PressReleaseStrategy = {
  priority: Priority;
  recommendation: string;
  suggested_platforms: string[];
  checklist: string[];
};

export type GoogleBusinessProfileStrategy = {
  priority: Priority;
  is_local_business: boolean;
  recommendation: string;
  checklist: string[];
};

export type PortalSiteStrategy = {
  priority: Priority;
  detected_industry: string;
  recommendation: string;
  suggested_portals: string[];
};

export type CitationStrategy = {
  press_release: PressReleaseStrategy;
  google_business_profile: GoogleBusinessProfileStrategy;
  portal_sites: PortalSiteStrategy;
};

// 診断結果の拡張型
export type HeadingNode = {
  level: number;
  text: string;
  hasDefinition: boolean;
  children: HeadingNode[];
};

export type PageStructure = {
  headings: HeadingNode[];
  h1Count: number;
  hasFaq: boolean;
  issues: string[];
};

export type MetaDetails = {
  title: {
    value: string;
    length: number;
    status: "good" | "warning" | "error";
    suggestion?: string;
  };
  description: {
    value: string;
    length: number;
    status: "good" | "warning" | "error";
    suggestion?: string;
  };
  ogp: {
    title: string | null;
    description: string | null;
    image: string | null;
    hasOgp: boolean;
  };
  canonical: string | null;
};

export type AICitationReport = {
  industry: string;
  region: string;
  queries: { query: string; cited: boolean; context: string }[];
  citedCount: number;
  totalQueries: number;
  competitors: { query: string; sites: string[] }[];
};

export type ActionPlanItem = {
  priority: Priority;
  item: string;
  action: string;
};

export type DiagnosisResult = {
  url: string;
  total: number;
  cited: boolean;
  scores: {
    structuredData: number;
    answerCapsule: number;
    infoDensity: number;
    contentLength: number;
    metaInfo: number;
    aiCitation: number;
  };
  aiCitationReport?: AICitationReport;
  pageStructure?: PageStructure;
  metaDetails?: MetaDetails;
  citationStrategy?: CitationStrategy;
  actionPlan?: ActionPlanItem[];
  checkedAt: string;
};

// モニタリング関連の型定義

export type MonitoringConfig = {
  id: string;
  user_id: string;
  domain: string;
  keywords: string[];
  area: string | null;
  competitor_domains: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CompetitorCitation = {
  domain: string;
  is_cited: boolean;
  context?: string;
};

export type MonitoringResult = {
  id: string;
  config_id: string;
  user_id: string;
  keyword: string;
  query: string;
  is_cited: boolean;
  citation_context: string | null;
  competitor_citations: CompetitorCitation[];
  change_from_previous: "new" | "gained" | "lost" | "unchanged" | null;
  checked_at: string;
  created_at: string;
};

export type MonitoringCheckResult = {
  keyword: string;
  query: string;
  is_cited: boolean;
  citation_context: string | null;
  competitor_citations: CompetitorCitation[];
  change_from_previous: "new" | "gained" | "lost" | "unchanged" | null;
};
