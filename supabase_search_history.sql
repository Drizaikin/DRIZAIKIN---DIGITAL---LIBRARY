-- =============================================
-- Drizaikn Digital Library System - Search History Feature
-- User Search History for Personalized Recommendations
-- Run this SQL in your Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS and DROP IF EXISTS)
-- =============================================

-- =============================================
-- 1. SEARCH_HISTORY TABLE
-- Requirements: 5.1, 5.5
-- =============================================
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('search', 'view')),
  query TEXT,
  book_id UUID REFERENCES books(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying (Requirements: 5.1, 5.5)
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_user_created ON search_history(user_id, created_at DESC);

-- =============================================
-- 2. ROW LEVEL SECURITY FOR SEARCH_HISTORY
-- =============================================
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (makes script re-runnable)
DROP POLICY IF EXISTS "Anyone can read search_history" ON search_history;
DROP POLICY IF EXISTS "Anyone can insert search_history" ON search_history;
DROP POLICY IF EXISTS "Anyone can delete search_history" ON search_history;

-- Allow anyone to read search_history (since we use service role key)
CREATE POLICY "Anyone can read search_history" ON search_history 
  FOR SELECT USING (true);

-- Allow anyone to insert search_history
CREATE POLICY "Anyone can insert search_history" ON search_history 
  FOR INSERT WITH CHECK (true);

-- Allow anyone to delete search_history
CREATE POLICY "Anyone can delete search_history" ON search_history 
  FOR DELETE USING (true);

-- =============================================
-- DONE!
-- =============================================
