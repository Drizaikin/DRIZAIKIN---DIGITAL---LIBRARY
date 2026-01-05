-- =============================================
-- Drizaikn Digital Library System - Supabase Schema
-- Run this SQL in your Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS and DROP IF EXISTS)
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_no VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url TEXT DEFAULT 'https://picsum.photos/id/64/200/200',
  role VARCHAR(20) DEFAULT 'Student' CHECK (role IN ('Student', 'Faculty', 'Admin')),
  max_books_allowed INT DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. CATEGORIES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 3. BOOKS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  author VARCHAR(255) NOT NULL,
  isbn VARCHAR(20) UNIQUE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  cover_url TEXT DEFAULT 'https://picsum.photos/seed/book/400/600',
  description TEXT,
  total_copies INT DEFAULT 1,
  copies_available INT DEFAULT 1,
  popularity INT DEFAULT 0 CHECK (popularity >= 0 AND popularity <= 100),
  published_year INT,
  publisher VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 4. LOANS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  checkout_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  return_date TIMESTAMP WITH TIME ZONE,
  is_returned BOOLEAN DEFAULT FALSE,
  fine_amount DECIMAL(10, 2) DEFAULT 0,
  renewed_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 5. WAITLIST TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  position INT NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notified_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, book_id)
);

-- =============================================
-- 6. FAVORITES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- =============================================
-- 7. READING_ACTIVITY TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS reading_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours_read DECIMAL(4, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_book ON loans(book_id);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);
CREATE INDEX IF NOT EXISTS idx_waitlist_book ON waitlist(book_id);
CREATE INDEX IF NOT EXISTS idx_users_admission ON users(admission_no);

-- =============================================
-- VIEWS
-- =============================================
CREATE OR REPLACE VIEW books_with_status AS
SELECT 
  b.id,
  b.title,
  b.author,
  b.isbn,
  c.name AS category,
  b.cover_url,
  b.description,
  b.total_copies,
  b.copies_available,
  b.popularity,
  b.published_year,
  b.publisher,
  CASE 
    WHEN b.copies_available > 0 THEN 'AVAILABLE'
    WHEN EXISTS (SELECT 1 FROM waitlist w WHERE w.book_id = b.id) THEN 'WAITLIST'
    ELSE 'BORROWED'
  END AS status,
  b.created_at,
  b.updated_at
FROM books b
LEFT JOIN categories c ON b.category_id = c.id;

CREATE OR REPLACE VIEW active_loans AS
SELECT 
  l.id,
  l.user_id,
  u.name AS user_name,
  u.admission_no,
  l.book_id,
  b.title AS book_title,
  b.author AS book_author,
  b.cover_url AS book_cover,
  c.name AS book_category,
  l.checkout_date,
  l.due_date,
  l.fine_amount,
  l.renewed_count,
  CASE WHEN l.due_date < NOW() THEN TRUE ELSE FALSE END AS is_overdue,
  EXTRACT(DAY FROM (l.due_date - NOW()))::INT AS days_remaining
FROM loans l
JOIN users u ON l.user_id = u.id
JOIN books b ON l.book_id = b.id
LEFT JOIN categories c ON b.category_id = c.id
WHERE l.is_returned = FALSE;

-- =============================================
-- FUNCTIONS
-- =============================================
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
  
  UPDATE books SET copies_available = copies_available - 1, updated_at = NOW() WHERE id = p_book_id;
  UPDATE books SET popularity = LEAST(popularity + 1, 100) WHERE id = p_book_id;
  
  RETURN json_build_object('success', true, 'loan_id', v_loan_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION return_book(p_loan_id UUID)
RETURNS JSON AS $$
DECLARE
  v_book_id UUID;
  v_due_date TIMESTAMP;
  v_fine DECIMAL(10, 2);
BEGIN
  SELECT book_id, due_date INTO v_book_id, v_due_date 
  FROM loans WHERE id = p_loan_id AND is_returned = FALSE;
  
  IF v_book_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Loan not found or already returned');
  END IF;
  
  IF v_due_date < NOW() THEN
    v_fine := EXTRACT(DAY FROM (NOW() - v_due_date)) * 50;
  ELSE
    v_fine := 0;
  END IF;
  
  UPDATE loans 
  SET is_returned = TRUE, return_date = NOW(), fine_amount = v_fine, updated_at = NOW()
  WHERE id = p_loan_id;
  
  UPDATE books SET copies_available = copies_available + 1, updated_at = NOW() WHERE id = v_book_id;
  
  UPDATE waitlist 
  SET notified_at = NOW() 
  WHERE book_id = v_book_id AND position = 1 AND notified_at IS NULL;
  
  RETURN json_build_object('success', true, 'fine', v_fine);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION renew_loan(p_loan_id UUID, p_extra_days INT DEFAULT 7)
RETURNS JSON AS $$
DECLARE
  v_renewed_count INT;
  v_is_overdue BOOLEAN;
BEGIN
  SELECT renewed_count, (due_date < NOW()) INTO v_renewed_count, v_is_overdue
  FROM loans WHERE id = p_loan_id AND is_returned = FALSE;
  
  IF v_renewed_count IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Loan not found');
  END IF;
  
  IF v_renewed_count >= 2 THEN
    RETURN json_build_object('success', false, 'error', 'Maximum renewals reached');
  END IF;
  
  IF v_is_overdue THEN
    RETURN json_build_object('success', false, 'error', 'Cannot renew overdue books');
  END IF;
  
  UPDATE loans 
  SET due_date = due_date + (p_extra_days || ' days')::INTERVAL,
      renewed_count = renewed_count + 1,
      updated_at = NOW()
  WHERE id = p_loan_id;
  
  RETURN json_build_object('success', true, 'message', 'Loan renewed successfully');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION join_waitlist(p_user_id UUID, p_book_id UUID)
RETURNS JSON AS $$
DECLARE
  v_position INT;
BEGIN
  IF EXISTS (SELECT 1 FROM waitlist WHERE user_id = p_user_id AND book_id = p_book_id) THEN
    RETURN json_build_object('success', false, 'error', 'Already in waitlist');
  END IF;
  
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position FROM waitlist WHERE book_id = p_book_id;
  
  INSERT INTO waitlist (user_id, book_id, position)
  VALUES (p_user_id, p_book_id, v_position);
  
  RETURN json_build_object('success', true, 'position', v_position);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- DROP EXISTING POLICIES (to avoid conflicts)
-- =============================================
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can view own loans" ON loans;
DROP POLICY IF EXISTS "Users can manage own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can view own activity" ON reading_activity;
DROP POLICY IF EXISTS "Users can view own waitlist" ON waitlist;
DROP POLICY IF EXISTS "Books are viewable by everyone" ON books;
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON categories;
DROP POLICY IF EXISTS "Anyone can read users" ON users;
DROP POLICY IF EXISTS "Anyone can insert users" ON users;
DROP POLICY IF EXISTS "Anyone can read books" ON books;
DROP POLICY IF EXISTS "Anyone can read categories" ON categories;
DROP POLICY IF EXISTS "Anyone can read loans" ON loans;
DROP POLICY IF EXISTS "Anyone can insert loans" ON loans;

-- =============================================
-- ENABLE RLS
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CREATE POLICIES (permissive for this app)
-- Since we're using service role key, we allow all operations
-- =============================================
CREATE POLICY "Anyone can read users" ON users FOR SELECT USING (true);
CREATE POLICY "Anyone can insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read books" ON books FOR SELECT USING (true);
CREATE POLICY "Anyone can read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Anyone can read loans" ON loans FOR SELECT USING (true);
CREATE POLICY "Anyone can insert loans" ON loans FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can manage own favorites" ON favorites FOR ALL USING (true);
CREATE POLICY "Users can view own activity" ON reading_activity FOR ALL USING (true);
CREATE POLICY "Users can view own waitlist" ON waitlist FOR ALL USING (true);

-- =============================================
-- SEED DATA
-- =============================================
INSERT INTO categories (name, description) VALUES
  ('Architecture', 'Books on architectural design and theory'),
  ('Computer Science', 'Programming, algorithms, and computing'),
  ('Artificial Intelligence', 'AI, machine learning, and neural networks'),
  ('Psychology', 'Human behavior and mental processes'),
  ('Economics', 'Economic theory and practice'),
  ('Mathematics', 'Pure and applied mathematics'),
  ('Literature', 'Fiction and literary criticism'),
  ('History', 'World and regional history'),
  ('Science', 'Natural and physical sciences'),
  ('Business', 'Management and entrepreneurship')
ON CONFLICT (name) DO NOTHING;

INSERT INTO books (title, author, category_id, cover_url, description, total_copies, copies_available, popularity, published_year) VALUES
  ('Architectural Abstracts', 'Dr. Evelyn Carter', 
   (SELECT id FROM categories WHERE name = 'Architecture'),
   'https://picsum.photos/seed/arch/400/600',
   'A deep dive into modern brutalism and its impact on East African skylines.',
   5, 3, 85, 2022),
  
  ('Quantum Computing Logic', 'Prof. Alan Turing II',
   (SELECT id FROM categories WHERE name = 'Computer Science'),
   'https://picsum.photos/seed/tech/400/600',
   'Foundational principles of qubits and superposition for undergraduates.',
   2, 0, 98, 2023),
  
  ('The Misty Mountains of AI', 'Sarah Connor',
   (SELECT id FROM categories WHERE name = 'Artificial Intelligence'),
   'https://picsum.photos/seed/ai/400/600',
   'Exploring the ethical landscapes of generative models.',
   10, 8, 45, 2024),
  
  ('Clinical Psychology', 'Sigmund F.',
   (SELECT id FROM categories WHERE name = 'Psychology'),
   'https://picsum.photos/seed/mind/400/600',
   'Modern approaches to cognitive behavioral therapy.',
   4, 2, 72, 2021),
  
  ('Sustainable Economics', 'Wangari Maathai',
   (SELECT id FROM categories WHERE name = 'Economics'),
   'https://picsum.photos/seed/eco/400/600',
   'Green economy strategies for developing nations.',
   6, 0, 90, 2020),
  
  ('Advanced Calculus', 'Newton L.',
   (SELECT id FROM categories WHERE name = 'Mathematics'),
   'https://picsum.photos/seed/math/400/600',
   'Rigorous derivation of multivariable theorems.',
   15, 15, 30, 2019),
  
  ('Data Structures and Algorithms', 'Thomas H. Cormen',
   (SELECT id FROM categories WHERE name = 'Computer Science'),
   'https://picsum.photos/seed/algo/400/600',
   'Introduction to algorithms and computational complexity.',
   8, 5, 88, 2022),
  
  ('African History: A Very Short Introduction', 'John Parker',
   (SELECT id FROM categories WHERE name = 'History'),
   'https://picsum.photos/seed/history/400/600',
   'Comprehensive overview of African historical development.',
   6, 4, 65, 2018)
ON CONFLICT DO NOTHING;

-- =============================================
-- TRIGGERS
-- =============================================
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_books_updated_at ON books;
DROP TRIGGER IF EXISTS update_loans_updated_at ON loans;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- DONE!
-- =============================================
