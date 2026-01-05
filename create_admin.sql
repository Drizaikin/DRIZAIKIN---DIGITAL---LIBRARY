-- =============================================
-- Create Admin User (Library Staff) for Drizaikn Library
-- Run this in Supabase SQL Editor
-- =============================================

-- IMPORTANT: Admins are library staff/employees, NOT students
-- They should NOT have course or department fields
-- They use employee IDs instead of student admission numbers

-- Create a library staff admin user
-- Default password: admin123 (change after first login)

INSERT INTO users (admission_no, name, email, password_hash, role, avatar_url, course, department)
VALUES (
  'LIB-STAFF-001',  -- Employee ID format
  'Library Administrator',
  'librarian@drizaikn.edu',
  '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQHLVXFwJGnKsKsK6.Q6Q6Q6Q6Q6Q6',
  'Admin',
  'https://ui-avatars.com/api/?name=Library+Admin&background=dc2626&color=fff',
  NULL,  -- Admins don't have courses (they're staff, not students)
  NULL   -- Admins don't have departments (they're staff, not students)
)
ON CONFLICT (admission_no) DO UPDATE 
SET role = 'Admin',
    name = 'Library Administrator',
    course = NULL,      -- Clear any student-specific fields
    department = NULL;  -- Clear any student-specific fields

-- Alternative: Promote an existing user to admin (for testing)
-- Note: This will clear their course/department since admins are staff, not students
-- UPDATE users 
-- SET role = 'Admin', 
--     course = NULL, 
--     department = NULL 
-- WHERE admission_no = 'YOUR_ADMISSION_NO';

-- To verify admin was created:
SELECT admission_no, name, email, role, course, department 
FROM users 
WHERE role = 'Admin';

-- Expected result: Admin users should have NULL for course and department
-- because they are library staff, not students
