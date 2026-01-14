-- =============================================
-- FIX ADMIN ROLE AND INGESTION STATE
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- PART 1: FIX ADMIN ROLE
-- =============================================

-- First, check what roles exist in your database
SELECT DISTINCT role FROM users;

-- Check your current user (replace 'YOUR_USERNAME' with your actual username)
SELECT id, name, username, email, role FROM users WHERE username = 'YOUR_USERNAME';

-- Option A: Update a specific user to Admin by username
-- UNCOMMENT AND MODIFY THE LINE BELOW:
-- UPDATE users SET role = 'Admin' WHERE username = 'YOUR_USERNAME';

-- Option B: Update a specific user to Admin by name
-- UNCOMMENT AND MODIFY THE LINE BELOW:
-- UPDATE users SET role = 'Admin' WHERE name LIKE '%Drizaikin%';

-- Option C: See all users and their roles
SELECT id, name, username, role FROM users ORDER BY created_at DESC LIMIT 20;

-- After updating, verify the change:
-- SELECT id, name, username, role FROM users WHERE role = 'Admin';

-- =============================================
-- PART 2: FIX INGESTION STATE
-- =============================================

-- Check if ingestion_state table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'ingestion_state'
) as table_exists;

-- If the table doesn't exist, create it:
CREATE TABLE IF NOT EXISTS ingestion_state (
  source TEXT PRIMARY KEY,
  last_page INTEGER DEFAULT 1,
  last_cursor TEXT,
  total_ingested INTEGER DEFAULT 0,
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_run_status TEXT DEFAULT 'idle',
  last_run_added INTEGER DEFAULT 0,
  last_run_skipped INTEGER DEFAULT 0,
  last_run_failed INTEGER DEFAULT 0,
  is_paused BOOLEAN DEFAULT FALSE,
  paused_at TIMESTAMP WITH TIME ZONE,
  paused_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initialize the ingestion state if it doesn't exist
INSERT INTO ingestion_state (source, last_page, total_ingested, last_run_status, is_paused)
VALUES ('internet_archive', 1, 0, 'idle', false)
ON CONFLICT (source) DO NOTHING;

-- Check current ingestion state
SELECT * FROM ingestion_state WHERE source = 'internet_archive';

-- If ingestion is paused, resume it:
UPDATE ingestion_state 
SET is_paused = false, paused_at = NULL, paused_by = NULL
WHERE source = 'internet_archive' AND is_paused = true;

-- =============================================
-- PART 3: CHECK INGESTION JOBS LOG
-- =============================================

-- Check if ingestion_jobs table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'ingestion_jobs'
) as jobs_table_exists;

-- If it exists, check recent jobs
-- SELECT * FROM ingestion_jobs ORDER BY started_at DESC LIMIT 5;

-- =============================================
-- PART 4: VERIFY BOOKS TABLE HAS REQUIRED COLUMNS
-- =============================================

-- Check if books table has source_identifier column (for ingested books)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'books' 
AND column_name IN ('source_identifier', 'pdf_url', 'genres', 'subgenre');

-- Add missing columns if needed:
ALTER TABLE books ADD COLUMN IF NOT EXISTS source_identifier TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS genres TEXT[];
ALTER TABLE books ADD COLUMN IF NOT EXISTS subgenre TEXT;

-- =============================================
-- SUMMARY: After running this script
-- =============================================
-- 1. Uncomment and run the UPDATE statement in PART 1 to make yourself Admin
-- 2. Log out and log back in to refresh your session
-- 3. The Health button should now appear
-- 4. The ingestion state is now initialized and unpaused
-- 5. Push the GitHub Actions workflow to enable daily cron
