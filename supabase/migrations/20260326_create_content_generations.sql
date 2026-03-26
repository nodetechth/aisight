-- フェーズ 3-C: コンテンツ作成支援

-- content_generations: コンテンツ生成履歴
CREATE TABLE IF NOT EXISTS content_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  domain TEXT,
  area TEXT,
  title_candidates JSONB NOT NULL DEFAULT '[]',
  outline JSONB NOT NULL DEFAULT '[]',
  meta_info JSONB NOT NULL DEFAULT '{}',
  structured_data JSONB NOT NULL DEFAULT '{}',
  llmo_tips JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_content_generations_user_id ON content_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_content_generations_keyword ON content_generations(keyword);
CREATE INDEX IF NOT EXISTS idx_content_generations_created_at ON content_generations(created_at DESC);

-- RLS有効化
ALTER TABLE content_generations ENABLE ROW LEVEL SECURITY;

-- content_generations RLSポリシー
CREATE POLICY "Users can view own content generations"
  ON content_generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content generations"
  ON content_generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own content generations"
  ON content_generations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own content generations"
  ON content_generations FOR DELETE
  USING (auth.uid() = user_id);

-- service_role用ポリシー
CREATE POLICY "Service role can access all content generations"
  ON content_generations FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- updated_atトリガー
CREATE TRIGGER update_content_generations_updated_at
  BEFORE UPDATE ON content_generations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
