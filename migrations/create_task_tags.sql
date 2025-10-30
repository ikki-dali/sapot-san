-- タスクとタグの多対多関係テーブル
CREATE TABLE IF NOT EXISTS public.task_tags (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL REFERENCES public.tasks(task_id) ON DELETE CASCADE,
  tag VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(task_id, tag)
);

-- インデックスを追加（検索の高速化）
CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON public.task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON public.task_tags(tag);

-- RLSを有効化
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: 全員が読み取り可能
CREATE POLICY "task_tags_select_policy" ON public.task_tags
  FOR SELECT
  USING (true);

-- RLSポリシー: 全員が挿入可能
CREATE POLICY "task_tags_insert_policy" ON public.task_tags
  FOR INSERT
  WITH CHECK (true);

-- RLSポリシー: 全員が更新可能
CREATE POLICY "task_tags_update_policy" ON public.task_tags
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- RLSポリシー: 全員が削除可能
CREATE POLICY "task_tags_delete_policy" ON public.task_tags
  FOR DELETE
  USING (true);
