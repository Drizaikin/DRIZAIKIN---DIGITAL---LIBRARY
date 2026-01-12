-- Migration: Add pause/resume state to ingestion_state table
-- This enables administrators to pause and resume ingestion through the health dashboard
-- Requirements: 7.3, 7.4

-- Add is_paused column to ingestion_state table
ALTER TABLE ingestion_state ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;

-- Add paused_at timestamp to track when ingestion was paused
ALTER TABLE ingestion_state ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE;

-- Add paused_by to track who paused the ingestion (for audit trail)
ALTER TABLE ingestion_state ADD COLUMN IF NOT EXISTS paused_by TEXT;

-- Update existing rows to have is_paused = false
UPDATE ingestion_state SET is_paused = FALSE WHERE is_paused IS NULL;

-- Create index for quick pause state lookups
CREATE INDEX IF NOT EXISTS idx_ingestion_state_paused ON ingestion_state(is_paused) WHERE is_paused = TRUE;
