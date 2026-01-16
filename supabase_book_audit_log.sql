-- =============================================
-- Book Audit Log Table Migration
-- Tracks all book modifications for audit purposes
-- Run this SQL in your Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS)
-- =============================================

-- =============================================
-- 1. CREATE BOOK_AUDIT_LOG TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS book_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES books(id) ON DELETE SET NULL,
  book_identifier VARCHAR(255),
  action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  changes JSONB,
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_username VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. CREATE INDEXES FOR EFFICIENT QUERIES
-- =============================================

-- Index for querying audit logs by book
CREATE INDEX IF NOT EXISTS idx_book_audit_log_book_id 
ON book_audit_log(book_id);

-- Index for querying audit logs by timestamp (most recent first)
CREATE INDEX IF NOT EXISTS idx_book_audit_log_created_at 
ON book_audit_log(created_at DESC);

-- Index for querying by admin user
CREATE INDEX IF NOT EXISTS idx_book_audit_log_admin_user_id 
ON book_audit_log(admin_user_id);

-- Index for querying by action type
CREATE INDEX IF NOT EXISTS idx_book_audit_log_action 
ON book_audit_log(action);

-- =============================================
-- 3. ENABLE RLS AND CREATE POLICIES
-- =============================================

ALTER TABLE book_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow reading audit logs (for admin monitoring)
DROP POLICY IF EXISTS "Admins can read book_audit_log" ON book_audit_log;
CREATE POLICY "Admins can read book_audit_log" ON book_audit_log 
  FOR SELECT USING (true);

-- Allow inserting audit logs (for the book management service)
DROP POLICY IF EXISTS "Service can insert book_audit_log" ON book_audit_log;
CREATE POLICY "Service can insert book_audit_log" ON book_audit_log 
  FOR INSERT WITH CHECK (true);

-- =============================================
-- DONE!
-- =============================================
