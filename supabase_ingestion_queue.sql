-- =============================================
-- Ingestion Queue Table Migration
-- Manages manual book ingestion queue for admin-triggered imports
-- Run this SQL in your Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS)
-- =============================================

-- =============================================
-- 1. CREATE INGESTION_QUEUE TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS ingestion_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier VARCHAR(255) NOT NULL,
  source VARCHAR(100) NOT NULL CHECK (source IN ('internet_archive', 'open_library', 'google_books', 'manual')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,
  metadata JSONB,
  error_message TEXT,
  queued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(identifier, source)
);

-- =============================================
-- 2. CREATE INDEXES FOR EFFICIENT QUERIES
-- =============================================

-- Index for querying by status (to find pending items)
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_status 
ON ingestion_queue(status);

-- Index for querying by queued_at (for processing order)
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_queued_at 
ON ingestion_queue(queued_at);

-- Index for querying by priority (for prioritized processing)
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_priority 
ON ingestion_queue(priority DESC);

-- Index for querying by source
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_source 
ON ingestion_queue(source);

-- Composite index for efficient queue processing (status + priority + queued_at)
CREATE INDEX IF NOT EXISTS idx_ingestion_queue_processing 
ON ingestion_queue(status, priority DESC, queued_at ASC);

-- =============================================
-- 3. ENABLE RLS AND CREATE POLICIES
-- =============================================

ALTER TABLE ingestion_queue ENABLE ROW LEVEL SECURITY;

-- Allow reading ingestion queue (for admin monitoring)
DROP POLICY IF EXISTS "Admins can read ingestion_queue" ON ingestion_queue;
CREATE POLICY "Admins can read ingestion_queue" ON ingestion_queue 
  FOR SELECT USING (true);

-- Allow inserting into ingestion queue (for admin book search)
DROP POLICY IF EXISTS "Admins can insert ingestion_queue" ON ingestion_queue;
CREATE POLICY "Admins can insert ingestion_queue" ON ingestion_queue 
  FOR INSERT WITH CHECK (true);

-- Allow updating ingestion queue (for processing status updates)
DROP POLICY IF EXISTS "Service can update ingestion_queue" ON ingestion_queue;
CREATE POLICY "Service can update ingestion_queue" ON ingestion_queue 
  FOR UPDATE USING (true);

-- Allow deleting from ingestion queue (for cleanup)
DROP POLICY IF EXISTS "Admins can delete ingestion_queue" ON ingestion_queue;
CREATE POLICY "Admins can delete ingestion_queue" ON ingestion_queue 
  FOR DELETE USING (true);

-- =============================================
-- DONE!
-- =============================================
