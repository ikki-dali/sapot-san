-- タスクテーブルの作成
CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  task_id VARCHAR(255) UNIQUE NOT NULL,
  text TEXT NOT NULL,
  channel VARCHAR(255) NOT NULL,
  message_ts VARCHAR(255) NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
  assignee VARCHAR(255),
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by VARCHAR(255),
  priority INTEGER CHECK (priority BETWEEN 1 AND 3),
  tags TEXT[],
  summary TEXT
);

-- インデックスの作成
CREATE INDEX idx_tasks_task_id ON tasks(task_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee);
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_tasks_channel ON tasks(channel);

-- コメント追加（ドキュメント化）
COMMENT ON TABLE tasks IS 'サポットさんのタスク管理テーブル';
COMMENT ON COLUMN tasks.task_id IS 'ユーザー向けのタスクID（task_1234567890形式）';
COMMENT ON COLUMN tasks.message_ts IS 'Slackメッセージのタイムスタンプ（スレッド返信用）';
COMMENT ON COLUMN tasks.status IS 'タスクステータス: open, completed, cancelled';
COMMENT ON COLUMN tasks.priority IS '優先度: 1=低, 2=中, 3=高';
