-- フェーズ 4-B: 業種別スコアベンチマーク

-- diagnosis_results に detected_industry カラム追加
ALTER TABLE diagnosis_results
ADD COLUMN IF NOT EXISTS detected_industry TEXT;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_diagnosis_results_detected_industry
ON diagnosis_results(detected_industry);

CREATE INDEX IF NOT EXISTS idx_diagnosis_results_industry_created
ON diagnosis_results(detected_industry, created_at DESC);

-- industry_benchmarks: 業種別ベンチマークデータ
CREATE TABLE IF NOT EXISTS industry_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry TEXT NOT NULL,
  sample_size INTEGER NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_industry_date UNIQUE (industry, (calculated_at::date))
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_industry
ON industry_benchmarks(industry);

CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_industry_calculated
ON industry_benchmarks(industry, calculated_at DESC);

-- RLS有効化
ALTER TABLE industry_benchmarks ENABLE ROW LEVEL SECURITY;

-- industry_benchmarks RLSポリシー
-- 全ユーザーがSELECT可能
CREATE POLICY "Anyone can view industry benchmarks"
  ON industry_benchmarks FOR SELECT
  USING (true);

-- service_roleのみALL操作可能
CREATE POLICY "Service role can manage industry benchmarks"
  ON industry_benchmarks FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
