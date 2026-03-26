-- フェーズ 3-B: スコア履歴機能

-- diagnosis_results: 診断結果の保存
CREATE TABLE IF NOT EXISTS diagnosis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  url TEXT NOT NULL,
  total_score INTEGER NOT NULL,
  scores JSONB NOT NULL DEFAULT '{}',
  technical_score INTEGER DEFAULT 0,
  cited BOOLEAN DEFAULT false,
  industry TEXT,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_diagnosis_results_user_id ON diagnosis_results(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_results_domain ON diagnosis_results(domain);
CREATE INDEX IF NOT EXISTS idx_diagnosis_results_created_at ON diagnosis_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnosis_results_user_domain ON diagnosis_results(user_id, domain);

-- RLS有効化
ALTER TABLE diagnosis_results ENABLE ROW LEVEL SECURITY;

-- diagnosis_results RLSポリシー
CREATE POLICY "Users can view own diagnosis results"
  ON diagnosis_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diagnosis results"
  ON diagnosis_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- service_role用ポリシー
CREATE POLICY "Service role can access all diagnosis results"
  ON diagnosis_results FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- monthly_score_history: 月次スコア履歴ビュー
CREATE OR REPLACE VIEW monthly_score_history AS
SELECT
  user_id,
  domain,
  date_trunc('month', created_at) AS month,
  -- 月内の最新スコアを取得
  (array_agg(total_score ORDER BY created_at DESC))[1] AS total_score,
  (array_agg(scores ORDER BY created_at DESC))[1] AS scores,
  (array_agg(technical_score ORDER BY created_at DESC))[1] AS technical_score,
  (array_agg(cited ORDER BY created_at DESC))[1] AS cited,
  MAX(created_at) AS last_checked_at,
  COUNT(*) AS check_count
FROM diagnosis_results
GROUP BY user_id, domain, date_trunc('month', created_at)
ORDER BY month DESC;

-- 最新2回の診断結果を取得する関数
CREATE OR REPLACE FUNCTION get_latest_two_diagnoses(p_user_id UUID, p_domain TEXT)
RETURNS TABLE (
  id UUID,
  total_score INTEGER,
  scores JSONB,
  technical_score INTEGER,
  cited BOOLEAN,
  created_at TIMESTAMPTZ,
  rank INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.total_score,
    d.scores,
    d.technical_score,
    d.cited,
    d.created_at,
    ROW_NUMBER() OVER (ORDER BY d.created_at DESC)::INTEGER AS rank
  FROM diagnosis_results d
  WHERE d.user_id = p_user_id AND d.domain = p_domain
  ORDER BY d.created_at DESC
  LIMIT 2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
