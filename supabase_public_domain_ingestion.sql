-- =============================================
-- Public Domain Book Ingestion - Schema Migration
-- Run this SQL in your Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS and conditional adds)
-- =============================================

-- =============================================
-- 1. ADD INGESTION TRACKING COLUMNS TO BOOKS TABLE
-- These columns are nullable to preserve existing manual upload functionality
-- =============================================

-- Add source column (e.g., 'internet_archive', null for manual uploads)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'books' AND column_name = 'source'
  ) THEN
    ALTER TABLE books ADD COLUMN source TEXT;
  END IF;
END $$;

-- Add source_identifier column (unique identifier from source, e.g., Internet Archive identifier)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'books' AND column_name = 'source_identifier'
  ) THEN
    ALTER TABLE books ADD COLUMN source_identifier TEXT;
  END IF;
END $$;

-- Add pdf_url column (public URL to the PDF in Supabase Storage)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'books' AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE books ADD COLUMN pdf_url TEXT;
  END IF;
END $$;

-- Add language column (e.g., 'en', 'es', 'fr')
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'books' AND column_name = 'language'
  ) THEN
    ALTER TABLE books ADD COLUMN language TEXT;
  END IF;
END $$;

-- =============================================
-- 2. CREATE UNIQUE INDEX FOR DEDUPLICATION
-- Only applies to non-null source_identifier values
-- This ensures no duplicate books from the same source
-- =============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_books_source_identifier 
ON books(source_identifier) 
WHERE source_identifier IS NOT NULL;

-- =============================================
-- 3. CREATE INGESTION LOGS TABLE FOR JOB TRACKING
-- =============================================

CREATE TABLE IF NOT EXISTS ingestion_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type TEXT NOT NULL DEFAULT 'scheduled',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  books_processed INT DEFAULT 0,
  books_added INT DEFAULT 0,
  books_skipped INT DEFAULT 0,
  books_failed INT DEFAULT 0,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying recent jobs
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_started 
ON ingestion_logs(started_at DESC);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_status 
ON ingestion_logs(status);

-- =============================================
-- 4. ENABLE RLS AND CREATE POLICIES FOR INGESTION_LOGS
-- =============================================

ALTER TABLE ingestion_logs ENABLE ROW LEVEL SECURITY;

-- Allow reading ingestion logs (for admin monitoring)
DROP POLICY IF EXISTS "Anyone can read ingestion_logs" ON ingestion_logs;
CREATE POLICY "Anyone can read ingestion_logs" ON ingestion_logs FOR SELECT USING (true);

-- Allow inserting ingestion logs (for the ingestion service)
DROP POLICY IF EXISTS "Anyone can insert ingestion_logs" ON ingestion_logs;
CREATE POLICY "Anyone can insert ingestion_logs" ON ingestion_logs FOR INSERT WITH CHECK (true);

-- Allow updating ingestion logs (for the ingestion service to update status)
DROP POLICY IF EXISTS "Anyone can update ingestion_logs" ON ingestion_logs;
CREATE POLICY "Anyone can update ingestion_logs" ON ingestion_logs FOR UPDATE USING (true);

-- =============================================
-- 5. UPDATE BOOKS TABLE POLICIES
-- Ensure books can be inserted by the ingestion service
-- =============================================

-- Allow inserting books (for the ingestion service)
DROP POLICY IF EXISTS "Anyone can insert books" ON books;
CREATE POLICY "Anyone can insert books" ON books FOR INSERT WITH CHECK (true);

-- Allow updating books (for the ingestion service)
DROP POLICY IF EXISTS "Anyone can update books" ON books;
CREATE POLICY "Anyone can update books" ON books FOR UPDATE USING (true);

-- =============================================
-- DONE!
-- =============================================
