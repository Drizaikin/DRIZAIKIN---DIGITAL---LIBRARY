-- Add security questions columns to users table
-- Run this in your Supabase SQL Editor

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS security_question_1 TEXT,
ADD COLUMN IF NOT EXISTS security_answer_1 TEXT,
ADD COLUMN IF NOT EXISTS security_question_2 TEXT,
ADD COLUMN IF NOT EXISTS security_answer_2 TEXT;

-- Comment for documentation
COMMENT ON COLUMN users.security_question_1 IS 'First security question for password recovery';
COMMENT ON COLUMN users.security_answer_1 IS 'Hashed answer to first security question';
COMMENT ON COLUMN users.security_question_2 IS 'Second security question for password recovery';
COMMENT ON COLUMN users.security_answer_2 IS 'Hashed answer to second security question';
