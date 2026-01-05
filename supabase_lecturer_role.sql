-- Add Lecturer Role Support to Drizaikn Digital Library
-- Run this script in your Supabase SQL Editor

-- Step 1: Drop existing role constraint
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Add new role constraint with Lecturer
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('Student', 'Lecturer', 'Faculty', 'Admin'));

-- Step 3: Create sample lecturer account
-- Password: lecturer123 (hashed with bcrypt)
INSERT INTO users (name, email, admission_no, password_hash, role, avatar_url, course, department)
VALUES (
  'Dr. Jane Doe',
  'jane.doe@drizaikn.edu',
  'LEC-001',
  '$2a$10$YourHashedPasswordHere',  -- Replace with actual bcrypt hash
  'Lecturer',
  'https://ui-avatars.com/api/?name=Dr+Jane+Doe&background=10b981&color=fff',
  NULL,
  NULL
)
ON CONFLICT (admission_no) DO NOTHING;

-- Step 4: Create another sample lecturer
INSERT INTO users (name, email, admission_no, password_hash, role, avatar_url, course, department)
VALUES (
  'Prof. John Smith',
  'john.smith@drizaikn.edu',
  'LEC-002',
  '$2a$10$YourHashedPasswordHere',  -- Replace with actual bcrypt hash
  'Lecturer',
  'https://ui-avatars.com/api/?name=Prof+John+Smith&background=10b981&color=fff',
  NULL,
  NULL
)
ON CONFLICT (admission_no) DO NOTHING;

-- Step 5: Update existing Faculty users to Lecturer if needed (optional)
-- UPDATE users SET role = 'Lecturer' WHERE role = 'Faculty' AND admission_no LIKE 'LEC-%';

-- Step 6: Verify the changes
SELECT id, name, email, admission_no, role, created_at 
FROM users 
WHERE role IN ('Lecturer', 'Faculty')
ORDER BY created_at DESC;

-- Note: To create actual lecturer accounts with proper password hashes,
-- use the setup_lecturer.js script or the admin panel user management feature.
