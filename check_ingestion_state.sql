-- =============================================
-- Check Ingestion State - Run in Supabase SQL Editor
-- Run each section separately (one at a time)
-- =============================================

-- STEP 1: Check if ingestion_state table exists
SELECT * FROM ingestion_state WHERE source = 'internet_archive';

-- STEP 2: If Step 1 fails with "relation does not exist", run this to create the table:
/*
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

INSERT INTO ingestion_state (source, last_page, total_ingested, last_run_status, is_paused)
VALUES ('internet_archive', 1, 0, 'idle', false)
ON CONFLICT (source) DO NOTHING;
*/

-- STEP 3: Check recently added books (run separately)
SELECT id, title, author, created_at
FROM books
ORDER BY created_at DESC
LIMIT 10;

-- STEP 4: If ingestion is paused, resume it (run separately):
/*
UPDATE ingestion_state 
SET is_paused = false, paused_at = NULL, paused_by = NULL
WHERE source = 'internet_archive';
*/

-- STEP 5: Check your user role (replace YOUR_USERNAME)
SELECT id, name, username, role FROM users WHERE username = 'YOUR_USERNAME';

-- STEP 6: Make yourself Admin (replace YOUR_USERNAME, run separately):
/*
UPDATE users SET role = 'Admin' WHERE username = 'YOUR_USERNAME';
*/
