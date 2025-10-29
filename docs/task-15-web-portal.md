# タスク15: Webポータルの基盤構築

**フェーズ**: Phase 6 - 将来機能
**難易度**: Complex
**推定時間**: 8時間以上
**依存関係**: タスク5（app.jsのリファクタリング）
**優先度**: 低（将来実装）

## 🎯 目標

React + Next.jsでタスク管理Webアプリの骨組みを作成し、Supabaseと連携してタスク一覧・編集機能を実装する。

## 📋 背景

Slackだけでなく、Webブラウザからもタスクを管理できるようにします。カンバンボード、ダッシュボード、フィルタリング・検索機能を提供します。

## ✅ 実装手順

### チェックリスト
- [ ] Next.jsプロジェクトを作成
- [ ] Supabase認証を設定
- [ ] タスク一覧ページを実装
- [ ] タスク詳細・編集ページを実装
- [ ] カンバンボードを実装
- [ ] ダッシュボード（統計）を実装
- [ ] フィルタリング・検索機能を実装
- [ ] デプロイ（Vercel）

---

### Step 1: Next.jsプロジェクトの作成

```bash
# webディレクトリを作成
mkdir web
cd web

# Next.jsプロジェクトを作成
npx create-next-app@latest sapot-san-web --typescript --tailwind --app

cd sapot-san-web
```

### Step 2: 必要なパッケージのインストール

```bash
# Supabaseクライアント
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs

# UIライブラリ
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install lucide-react # アイコン
npm install date-fns # 日付フォーマット

# カンバンボード
npm install @dnd-kit/core @dnd-kit/sortable

# グラフ（ダッシュボード用）
npm install recharts
```

### Step 3: Supabase設定

`.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

`lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Step 4: タスク一覧ページの実装

`app/tasks/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

interface Task {
  id: number;
  task_id: string;
  text: string;
  status: 'open' | 'completed';
  priority: number;
  assignee: string;
  due_date: string | null;
  created_at: string;
  summary: string | null;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'completed'>('open');

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  async function fetchTasks() {
    setLoading(true);

    let query = supabase.from('tasks').select('*').order('priority', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('タスク取得エラー:', error);
    } else {
      setTasks(data || []);
    }

    setLoading(false);
  }

  const getPriorityLabel = (priority: number) => {
    return priority === 3 ? '高' : priority === 2 ? '中' : '低';
  };

  const getPriorityColor = (priority: number) => {
    return priority === 3 ? 'text-red-600' : priority === 2 ? 'text-yellow-600' : 'text-green-600';
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">タスク一覧</h1>

      {/* フィルター */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          全て
        </button>
        <button
          onClick={() => setFilter('open')}
          className={`px-4 py-2 rounded ${filter === 'open' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          未完了
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded ${filter === 'completed' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          完了
        </button>
      </div>

      {/* タスクリスト */}
      {loading ? (
        <p>読み込み中...</p>
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <div key={task.id} className="border rounded-lg p-4 shadow hover:shadow-lg transition">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{task.text}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    タスクID: {task.task_id}
                  </p>
                  {task.summary && (
                    <p className="text-sm text-gray-500 mt-2 italic">{task.summary}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`font-bold ${getPriorityColor(task.priority)}`}>
                    優先度: {getPriorityLabel(task.priority)}
                  </span>
                  {task.due_date && (
                    <p className="text-sm text-gray-600 mt-1">
                      期限: {format(new Date(task.due_date), 'yyyy/MM/dd HH:mm')}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <span className={`px-3 py-1 rounded text-sm ${
                  task.status === 'open' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                }`}>
                  {task.status === 'open' ? '未完了' : '完了'}
                </span>
                <span className="text-sm text-gray-500">
                  作成: {format(new Date(task.created_at), 'yyyy/MM/dd')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 5: カンバンボードの実装

`app/board/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DndContext, DragEndEvent } from '@dnd-kit/core';

export default function BoardPage() {
  const [tasks, setTasks] = useState({
    open: [],
    in_progress: [],
    completed: []
  });

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('priority', { ascending: false });

    if (error) {
      console.error('タスク取得エラー:', error);
    } else {
      // ステータスごとに分類
      const grouped = {
        open: data?.filter(t => t.status === 'open') || [],
        in_progress: [], // 将来実装
        completed: data?.filter(t => t.status === 'completed') || []
      };
      setTasks(grouped);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) return;

    const taskId = active.id;
    const newStatus = over.id;

    // データベース更新
    await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('task_id', taskId);

    // 再取得
    fetchTasks();
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">カンバンボード</h1>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-3 gap-4">
          <Column title="未着手" status="open" tasks={tasks.open} />
          <Column title="進行中" status="in_progress" tasks={tasks.in_progress} />
          <Column title="完了" status="completed" tasks={tasks.completed} />
        </div>
      </DndContext>
    </div>
  );
}

function Column({ title, status, tasks }) {
  return (
    <div className="bg-gray-100 rounded-lg p-4">
      <h2 className="font-bold mb-4">{title}</h2>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.task_id} className="bg-white p-3 rounded shadow">
            <p className="font-medium">{task.text}</p>
            <p className="text-sm text-gray-600">優先度: {task.priority}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Step 6: ダッシュボードの実装

`app/dashboard/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    completed: 0,
    highPriority: 0,
    overdue: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    const { data: allTasks } = await supabase.from('tasks').select('*');

    if (allTasks) {
      const now = new Date();

      setStats({
        total: allTasks.length,
        open: allTasks.filter(t => t.status === 'open').length,
        completed: allTasks.filter(t => t.status === 'completed').length,
        highPriority: allTasks.filter(t => t.priority === 3 && t.status === 'open').length,
        overdue: allTasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status === 'open').length
      });
    }
  }

  const chartData = [
    { name: '全タスク', 件数: stats.total },
    { name: '未完了', 件数: stats.open },
    { name: '完了', 件数: stats.completed },
    { name '高優先度', 件数: stats.highPriority },
    { name: '期限切れ', 件数: stats.overdue }
  ];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">ダッシュボード</h1>

      <div className="grid grid-cols-5 gap-4 mb-8">
        <StatCard title="全タスク" value={stats.total} color="bg-blue-500" />
        <StatCard title="未完了" value={stats.open} color="bg-yellow-500" />
        <StatCard title="完了" value={stats.completed} color="bg-green-500" />
        <StatCard title="高優先度" value={stats.highPriority} color="bg-red-500" />
        <StatCard title="期限切れ" value={stats.overdue} color="bg-orange-500" />
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">タスク統計</h2>
        <BarChart width={600} height={300} data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="件数" fill="#3b82f6" />
        </BarChart>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div className={`${color} text-white p-6 rounded-lg shadow`}>
      <h3 className="text-sm font-medium opacity-80">{title}</h3>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}
```

### Step 7: デプロイ（Vercel）

```bash
# Vercelにデプロイ
npm install -g vercel
vercel

# または、GitHubにpushしてVercelと連携
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main

# Vercelダッシュボード（https://vercel.com）でプロジェクトをインポート
```

## 📤 成果物

- ✅ Next.jsプロジェクトが作成されている
- ✅ Supabase認証が設定されている
- ✅ タスク一覧ページが実装されている
- ✅ カンバンボードが実装されている
- ✅ ダッシュボードが実装されている
- ✅ Vercelにデプロイされている

## 🔍 確認方法

```bash
# 開発サーバー起動
cd web/sapot-san-web
npm run dev

# ブラウザで確認
# http://localhost:3000/tasks
# http://localhost:3000/board
# http://localhost:3000/dashboard
```

## ⚠️ 注意点

1. **認証の追加**
   - 将来的にSupabase Authでログイン機能を追加
   - SlackユーザーとWebユーザーを紐付け

2. **リアルタイム更新**
   - Supabaseのリアルタイム機能を使ってタスク更新を反映
   - Slack側の更新もWebに即座に反映

3. **パフォーマンス**
   - タスクが増えたらページネーション追加
   - 仮想スクロールの導入

4. **モバイル対応**
   - レスポンシブデザイン
   - PWA化も検討

5. **SEO**
   - Next.jsのSSRを活用
   - メタタグ最適化

## 🚀 次のステップ

→ [タスク16: Notion連携](./task-16-notion-integration.md)
