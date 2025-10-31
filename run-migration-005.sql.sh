#!/bin/bash

# ========================================
# Migration 005を適用するスクリプト
# ========================================

echo "📋 Migration 005: 優先度カラムを unreplied_mentions テーブルに追加"
echo ""
echo "以下のSQLをSupabaseのSQL Editorで実行してください:"
echo "https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new"
echo ""
echo "================================================"
cat migrations/005_add_priority_to_unreplied_mentions.sql
echo "================================================"
echo ""
echo "または、psql経由で実行する場合:"
echo "psql <YOUR_DATABASE_CONNECTION_STRING> -f migrations/005_add_priority_to_unreplied_mentions.sql"
