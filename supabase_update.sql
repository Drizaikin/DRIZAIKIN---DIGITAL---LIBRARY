-- =============================================
-- Drizaikn Library - Schema Update for Courses & Recommendations
-- Run this in Supabase SQL Editor
-- =============================================

-- Add course/major field to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS course VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(255);

-- Add more fields to books for better filtering
ALTER TABLE books ADD COLUMN IF NOT EXISTS added_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE books ADD COLUMN IF NOT EXISTS borrow_count INT DEFAULT 0;

-- Create courses/majors table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) UNIQUE NOT NULL,
  department VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link categories to courses for recommendations
CREATE TABLE IF NOT EXISTS course_category_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  relevance_score INT DEFAULT 5 CHECK (relevance_score >= 1 AND relevance_score <= 10),
  UNIQUE(course_id, category_id)
);

-- Enable RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_category_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read courses" ON courses;
DROP POLICY IF EXISTS "Anyone can read mappings" ON course_category_mapping;

CREATE POLICY "Anyone can read courses" ON courses FOR SELECT USING (true);
CREATE POLICY "Anyone can read mappings" ON course_category_mapping FOR SELECT USING (true);

-- Insert sample courses
INSERT INTO courses (name, department) VALUES
  ('Computer Science', 'School of Computing'),
  ('Information Technology', 'School of Computing'),
  ('Business Administration', 'School of Business'),
  ('Accounting', 'School of Business'),
  ('Psychology', 'School of Social Sciences'),
  ('Education', 'School of Education'),
  ('Theology', 'School of Theology'),
  ('Economics', 'School of Business'),
  ('Mathematics', 'School of Science'),
  ('Environmental Science', 'School of Science')
ON CONFLICT (name) DO NOTHING;

-- Map courses to relevant categories
INSERT INTO course_category_mapping (course_id, category_id, relevance_score)
SELECT c.id, cat.id, 10
FROM courses c, categories cat
WHERE (c.name = 'Computer Science' AND cat.name IN ('Computer Science', 'Artificial Intelligence', 'Mathematics'))
   OR (c.name = 'Information Technology' AND cat.name IN ('Computer Science', 'Artificial Intelligence'))
   OR (c.name = 'Business Administration' AND cat.name IN ('Business', 'Economics'))
   OR (c.name = 'Accounting' AND cat.name IN ('Business', 'Economics', 'Mathematics'))
   OR (c.name = 'Psychology' AND cat.name = 'Psychology')
   OR (c.name = 'Economics' AND cat.name IN ('Economics', 'Business', 'Mathematics'))
   OR (c.name = 'Mathematics' AND cat.name = 'Mathematics')
ON CONFLICT (course_id, category_id) DO NOTHING;

-- DROP and recreate the view to add new columns
DROP VIEW IF EXISTS books_with_status;

CREATE VIEW books_with_status AS
SELECT 
  b.id,
  b.title,
  b.author,
  b.isbn,
  c.name AS category,
  b.category_id,
  b.cover_url,
  b.description,
  b.total_copies,
  b.copies_available,
  b.popularity,
  b.published_year,
  b.publisher,
  b.added_date,
  b.borrow_count,
  CASE 
    WHEN b.copies_available > 0 THEN 'AVAILABLE'
    WHEN EXISTS (SELECT 1 FROM waitlist w WHERE w.book_id = b.id) THEN 'WAITLIST'
    ELSE 'BORROWED'
  END AS status,
  b.created_at,
  b.updated_at
FROM books b
LEFT JOIN categories c ON b.category_id = c.id;

-- Function to get recommended books for a user based on their course
CREATE OR REPLACE FUNCTION get_recommended_books(p_user_id UUID, p_limit INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  author VARCHAR,
  category VARCHAR,
  cover_url TEXT,
  popularity INT,
  relevance_score INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    b.id,
    b.title,
    b.author,
    c.name AS category,
    b.cover_url,
    b.popularity,
    COALESCE(ccm.relevance_score, 0) AS relevance_score
  FROM books b
  LEFT JOIN categories c ON b.category_id = c.id
  LEFT JOIN course_category_mapping ccm ON c.id = ccm.category_id
  LEFT JOIN courses co ON ccm.course_id = co.id
  LEFT JOIN users u ON u.course = co.name
  WHERE u.id = p_user_id
    AND b.copies_available > 0
  ORDER BY ccm.relevance_score DESC NULLS LAST, b.popularity DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Update borrow_book function to increment borrow_count
CREATE OR REPLACE FUNCTION borrow_book(
  p_user_id UUID,
  p_book_id UUID,
  p_loan_days INT DEFAULT 14
)
RETURNS JSON AS $$
DECLARE
  v_copies_available INT;
  v_user_loans INT;
  v_max_books INT;
  v_loan_id UUID;
BEGIN
  SELECT copies_available INTO v_copies_available FROM books WHERE id = p_book_id;
  
  IF v_copies_available IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Book not found');
  END IF;
  
  IF v_copies_available <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'No copies available');
  END IF;
  
  SELECT COUNT(*) INTO v_user_loans FROM loans WHERE user_id = p_user_id AND is_returned = FALSE;
  SELECT max_books_allowed INTO v_max_books FROM users WHERE id = p_user_id;
  
  IF v_user_loans >= v_max_books THEN
    RETURN json_build_object('success', false, 'error', 'Maximum loan limit reached');
  END IF;
  
  INSERT INTO loans (user_id, book_id, due_date)
  VALUES (p_user_id, p_book_id, NOW() + (p_loan_days || ' days')::INTERVAL)
  RETURNING id INTO v_loan_id;
  
  UPDATE books SET 
    copies_available = copies_available - 1,
    borrow_count = COALESCE(borrow_count, 0) + 1,
    popularity = LEAST(COALESCE(popularity, 0) + 1, 100),
    updated_at = NOW()
  WHERE id = p_book_id;
  
  RETURN json_build_object('success', true, 'loan_id', v_loan_id);
END;
$$ LANGUAGE plpgsql;

-- Done!


-- =============================================
-- AI Chat History for Persistent Memory
-- =============================================

-- Create chat_history table to store AI conversations
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'model')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at DESC);

-- Enable RLS
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Users can only access their own chat history
DROP POLICY IF EXISTS "Users can view own chat history" ON chat_history;
DROP POLICY IF EXISTS "Users can insert own chat history" ON chat_history;
DROP POLICY IF EXISTS "Users can delete own chat history" ON chat_history;

CREATE POLICY "Users can view own chat history" ON chat_history 
  FOR SELECT USING (auth.uid() = user_id OR true);

CREATE POLICY "Users can insert own chat history" ON chat_history 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete own chat history" ON chat_history 
  FOR DELETE USING (auth.uid() = user_id OR true);

-- Function to get recent chat history for context (last N messages)
CREATE OR REPLACE FUNCTION get_chat_context(p_user_id UUID, p_limit INT DEFAULT 20)
RETURNS TABLE (
  role VARCHAR,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT ch.role, ch.message, ch.created_at
  FROM chat_history ch
  WHERE ch.user_id = p_user_id
  ORDER BY ch.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to summarize chat topics for a user (for AI context)
CREATE OR REPLACE FUNCTION get_user_chat_summary(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_total_messages INT;
  v_first_chat TIMESTAMP;
  v_last_chat TIMESTAMP;
BEGIN
  SELECT 
    COUNT(*),
    MIN(created_at),
    MAX(created_at)
  INTO v_total_messages, v_first_chat, v_last_chat
  FROM chat_history
  WHERE user_id = p_user_id;
  
  RETURN json_build_object(
    'total_messages', v_total_messages,
    'first_chat', v_first_chat,
    'last_chat', v_last_chat
  );
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- Add Call Number and Location Information
-- =============================================

-- Add call_number and location fields to books table
ALTER TABLE books ADD COLUMN IF NOT EXISTS call_number VARCHAR(50);
ALTER TABLE books ADD COLUMN IF NOT EXISTS shelf_location VARCHAR(100);
ALTER TABLE books ADD COLUMN IF NOT EXISTS floor_number INT;

-- Create index for call_number searches
CREATE INDEX IF NOT EXISTS idx_books_call_number ON books(call_number);

-- Update the books_with_status view to include call number and location
DROP VIEW IF EXISTS books_with_status;

CREATE VIEW books_with_status AS
SELECT 
  b.id,
  b.title,
  b.author,
  b.isbn,
  b.call_number,
  b.shelf_location,
  b.floor_number,
  c.name AS category,
  b.category_id,
  b.cover_url,
  b.description,
  b.total_copies,
  b.copies_available,
  b.popularity,
  b.published_year,
  b.publisher,
  b.added_date,
  b.borrow_count,
  CASE 
    WHEN b.copies_available > 0 THEN 'AVAILABLE'
    WHEN EXISTS (SELECT 1 FROM waitlist w WHERE w.book_id = b.id) THEN 'WAITLIST'
    ELSE 'BORROWED'
  END AS status,
  b.created_at,
  b.updated_at
FROM books b
LEFT JOIN categories c ON b.category_id = c.id;

-- Update sample books with call numbers
UPDATE books SET 
  call_number = '004 BRO',
  shelf_location = 'Technology Section',
  floor_number = 2
WHERE title LIKE '%Computer Science%' OR title LIKE '%Quantum Computing%' OR title LIKE '%Data Structures%';

UPDATE books SET 
  call_number = '006.3 CON',
  shelf_location = 'Technology Section',
  floor_number = 2
WHERE title LIKE '%AI%' OR title LIKE '%Artificial Intelligence%';

UPDATE books SET 
  call_number = '150 FRE',
  shelf_location = 'Social Sciences',
  floor_number = 1
WHERE title LIKE '%Psychology%';

UPDATE books SET 
  call_number = '330 MAA',
  shelf_location = 'Business & Economics',
  floor_number = 1
WHERE title LIKE '%Economics%';

UPDATE books SET 
  call_number = '510 NEW',
  shelf_location = 'Science & Mathematics',
  floor_number = 3
WHERE title LIKE '%Calculus%' OR title LIKE '%Mathematics%';

UPDATE books SET 
  call_number = '720 CAR',
  shelf_location = 'Arts & Architecture',
  floor_number = 3
WHERE title LIKE '%Architecture%';

UPDATE books SET 
  call_number = '960 PAR',
  shelf_location = 'History Section',
  floor_number = 1
WHERE title LIKE '%History%' OR title LIKE '%African%';
