-- =============================================
-- Add New Courses to Drizaikn Library System
-- Run this in Supabase SQL Editor
-- =============================================

-- Add Health Sciences courses
INSERT INTO courses (name, department) VALUES
  ('Nursing', 'School of Health Sciences'),
  ('Occupational Therapy', 'School of Health Sciences')
ON CONFLICT (name) DO NOTHING;

-- Add Mass Communication
INSERT INTO courses (name, department) VALUES
  ('Mass Communication', 'School of Arts and Communication')
ON CONFLICT (name) DO NOTHING;

-- Verify the courses were added
SELECT * FROM courses ORDER BY name;
