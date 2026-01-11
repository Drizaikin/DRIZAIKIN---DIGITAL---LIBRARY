-- Ingestion State Tracking Table
-- This table stores the progress of automated ingestion to enable resumable, stateful continuation
-- Required for Vercel Hobby plan (1 cron job, once daily)

-- Create ingestion_state table for tracking progress
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default state for internet_archive source
INSERT INTO ingestion_state (source, last_page, total_ingested, last_run_status)
VALUES ('internet_archive', 1, 0, 'idle')
ON CONFLICT (source) DO NOTHING;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_ingestion_state_source ON ingestion_state(source);

-- Add genres columns to books table for AI classification
ALTER TABLE books ADD COLUMN IF NOT EXISTS genres TEXT[];
ALTER TABLE books ADD COLUMN IF NOT EXISTS subgenre TEXT;

-- Create index for genre queries
CREATE INDEX IF NOT EXISTS idx_books_genres ON books USING GIN(genres);
CREATE INDEX IF NOT EXISTS idx_books_subgenre ON books(subgenre) WHERE subgenre IS NOT NULL;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_ingestion_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS trigger_update_ingestion_state_timestamp ON ingestion_state;
CREATE TRIGGER trigger_update_ingestion_state_timestamp
  BEFORE UPDATE ON ingestion_state
  FOR EACH ROW
  EXECUTE FUNCTION update_ingestion_state_timestamp();
