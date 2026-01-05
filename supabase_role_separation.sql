-- =============================================
-- Drizaikn Library - Role Separation Update
-- Separate Admin (Library Staff) from Students
-- =============================================

-- Add a constraint to ensure admins don't have student-specific fields
-- Admins are library staff/employees, not students

-- First, clear any course data from existing admin users
UPDATE users 
SET course = NULL, 
    department = NULL
WHERE role = 'Admin';

-- Add a check constraint to prevent admins from having courses
-- This ensures admins (librarians) are separate from students
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS check_admin_no_course;

ALTER TABLE users 
ADD CONSTRAINT check_admin_no_course 
CHECK (
  (role = 'Admin' AND course IS NULL) OR 
  (role != 'Admin')
);

-- Update the comment on the users table to clarify roles
COMMENT ON TABLE users IS 'User accounts: Students (with admission numbers and courses) and Admin (library staff/employees without courses)';

-- Add comments to clarify field usage
COMMENT ON COLUMN users.role IS 'User role: Student, Faculty, or Admin (library staff)';
COMMENT ON COLUMN users.course IS 'Student course/major - NULL for Admin users (library staff)';
COMMENT ON COLUMN users.admission_no IS 'Student admission number or employee ID for Admin';

-- Update the AI chat system prompt to reflect this distinction
-- (This is just documentation - the actual prompt is in server.js)
COMMENT ON TABLE chat_history IS 'AI chat history. Note: Admins are library staff, not students. Tailor responses accordingly based on user role.';

-- Done! Admins are now properly separated from students
