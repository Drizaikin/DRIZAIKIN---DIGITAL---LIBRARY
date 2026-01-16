-- =============================================
-- Book Source Tracking Columns Migration
-- Adds access_type column and updates existing books
-- Run this SQL in your Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS and conditional adds)
-- =============================================

-- =============================================
-- 1. ENSURE SOURCE COLUMNS EXIST (idempotent)
-- These may already exist from supabase_public_domain_ingestion.sql
-- =============================================

-- Add source column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'books' AND column_name = 'source'
  ) THEN
    ALTER TABLE books ADD COLUMN source TEXT;
  END IF;
END $$;

-- Add source_identifier column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'books' AND column_name = 'source_identifier'
  ) THEN
    ALTER TABLE books ADD COLUMN source_identifier TEXT;
  END IF;
END $$;

-- =============================================
-- 2. ADD ACCESS_TYPE COLUMN
-- Categorizes books as public_domain, open_access, or preview_only
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'books' AND column_name = 'access_type'
  ) THEN
    ALTER TABLE books ADD COLUMN access_type TEXT 
      CHECK (access_type IN ('public_domain', 'open_access', 'preview_only'));
  END IF;
END $$;

-- =============================================
-- 3. CREATE INDEXES FOR SOURCE TRACKING
-- =============================================

-- Index for querying by source
CREATE INDEX IF NOT EXISTS idx_books_source 
ON books(source);

-- Index for querying by access_type
CREATE INDEX IF NOT EXISTS idx_books_access_type 
ON books(access_type);

-- Composite index for source + access_type queries
CREATE INDEX IF NOT EXISTS idx_books_source_access 
ON books(source, access_type);

-- =============================================
-- 4. UPDATE EXISTING BOOKS WITH DEFAULT VALUES
-- Sets source='internet_archive' and access_type='public_domain'
-- for books that have source_identifier but no source/access_type
-- =============================================

-- Update books that have source_identifier but no source
UPDATE books 
SET source = 'internet_archive' 
WHERE source_identifier IS NOT NULL 
  AND source IS NULL;

-- Update books that have source but no access_type
-- Assume internet_archive books are public_domain
UPDATE books 
SET access_type = 'public_domain' 
WHERE source = 'internet_archive' 
  AND access_type IS NULL;

-- =============================================
-- 5. ADD COMMENT FOR DOCUMENTATION
-- =============================================

COMMENT ON COLUMN books.source IS 'Source of the book: internet_archive, open_library, google_books, manual, extraction';
COMMENT ON COLUMN books.source_identifier IS 'Unique identifier from the source (e.g., Internet Archive identifier)';
COMMENT ON COLUMN books.access_type IS 'Access classification: public_domain, open_access, preview_only';

-- =============================================
-- DONE!
-- =============================================
