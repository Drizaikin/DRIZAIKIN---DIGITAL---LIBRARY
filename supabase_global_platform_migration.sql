-- Migration Script: Convert from Institution-Based to Global Platform
-- This script renames admission_no to username and updates role values
-- Run this in Supabase SQL Editor

-- IMPORTANT: Run these commands in order. If any fail, check the error and adjust.

-- Step 1: Drop the existing role check constraint (it only allows old values)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Rename admission_no column to username (if not already done)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'admission_no') THEN
    ALTER TABLE users RENAME COLUMN admission_no TO username;
    RAISE NOTICE 'Column admission_no renamed to username';
  ELSE
    RAISE NOTICE 'Column admission_no does not exist or already renamed';
  END IF;
END $$;

-- Step 3: Update role values from institution-based to global
-- Student -> Reader
-- Lecturer/Faculty -> Premium
-- Admin stays as Admin
UPDATE users SET role = 'Reader' WHERE role = 'Student';
UPDATE users SET role = 'Premium' WHERE role IN ('Lecturer', 'Faculty');

-- Step 4: Add new check constraint with updated role values
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('Reader', 'Premium', 'Admin'));

-- Step 5: Add index on username for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Step 6: Update the active_loans view to use username instead of admission_no
DROP VIEW IF EXISTS active_loans;
CREATE OR REPLACE VIEW active_loans AS
SELECT 
  l.id,
  l.user_id,
  l.book_id,
  l.checkout_date,
  l.due_date,
  l.is_returned,
  l.return_date,
  l.renewed_count,
  CASE WHEN l.due_date < CURRENT_DATE AND NOT l.is_returned THEN true ELSE false END as is_overdue,
  CASE 
    WHEN l.due_date < CURRENT_DATE AND NOT l.is_returned 
    THEN EXTRACT(DAY FROM (CURRENT_DATE - l.due_date))::integer * 50 
    ELSE 0 
  END as fine_amount,
  CASE 
    WHEN NOT l.is_returned 
    THEN EXTRACT(DAY FROM (l.due_date - CURRENT_DATE))::integer
    ELSE NULL 
  END as days_remaining,
  u.name as user_name,
  u.username as username,
  b.title as book_title,
  b.author as book_author,
  b.cover_url as book_cover,
  c.name as book_category
FROM loans l
JOIN users u ON l.user_id = u.id
JOIN books b ON l.book_id = b.id
LEFT JOIN categories c ON b.category_id = c.id
WHERE NOT l.is_returned;

-- Verification queries (run these to verify the migration)
-- SELECT DISTINCT role FROM users;
-- SELECT id, name, username, role FROM users LIMIT 10;

-- Note: The 'course' column is kept for backward compatibility but is no longer used
-- You can optionally drop it later with: ALTER TABLE users DROP COLUMN IF EXISTS course;
