-- フェーズ 3-A: モニタリング機能用テーブル

-- monitoring_configs: ユーザーのモニタリング設定
CREATE TABLE IF NOT EXISTS monitoring_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  area TEXT,
  competitor_domains TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT keywords_max_5 CHECK (array_length(keywords, 1) <= 5 OR keywords = '{}'),
  CONSTRAINT competitors_max_3 CHECK (array_length(competitor_domains, 1) <= 3 OR competitor_domains = '{}'),
  UNIQUE(user_id, domain)
);

-- monitoring_results: モニタリング結果履歴
CREATE TABLE IF NOT EXISTS monitoring_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES monitoring_configs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  query TEXT NOT NULL,
  is_cited BOOLEAN NOT NULL DEFAULT false,
  citation_context TEXT,
  competitor_citations JSONB DEFAULT '[]',
  change_from_previous TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_monitoring_configs_user_id ON monitoring_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_configs_domain ON monitoring_configs(domain);
CREATE INDEX IF NOT EXISTS idx_monitoring_results_config_id ON monitoring_results(config_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_results_user_id ON monitoring_results(user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_results_checked_at ON monitoring_results(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_results_keyword ON monitoring_results(keyword);

-- RLS有効化
ALTER TABLE monitoring_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_results ENABLE ROW LEVEL SECURITY;

-- monitoring_configs RLSポリシー
CREATE POLICY "Users can view own monitoring configs"
  ON monitoring_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monitoring configs"
  ON monitoring_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monitoring configs"
  ON monitoring_configs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own monitoring configs"
  ON monitoring_configs FOR DELETE
  USING (auth.uid() = user_id);

-- service_role用ポリシー（APIからのアクセス用）
CREATE POLICY "Service role can access all monitoring configs"
  ON monitoring_configs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- monitoring_results RLSポリシー
CREATE POLICY "Users can view own monitoring results"
  ON monitoring_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monitoring results"
  ON monitoring_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- service_role用ポリシー（APIからのアクセス用）
CREATE POLICY "Service role can access all monitoring results"
  ON monitoring_results FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_monitoring_configs_updated_at
  BEFORE UPDATE ON monitoring_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
