-- Add password reset columns to users table
-- Run this in your Supabase SQL Editor

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS reset_token TEXT,
ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMPTZ;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN users.reset_token IS 'Token for password reset, expires after 1 hour';
COMMENT ON COLUMN users.reset_token_expiry IS 'Expiry timestamp for the reset token';
