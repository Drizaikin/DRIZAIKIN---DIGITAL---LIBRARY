-- =============================================
-- Category Column Migration for Books Table
-- Adds a 'category' TEXT column for direct category storage
-- This supports the ingestion filtering feature which syncs
-- category from the first genre during book ingestion.
-- 
-- Run this SQL in your Supabase SQL Editor
-- Safe to re-run (uses conditional add)
-- Requirements: 5.4.1, 5.4.2, 5.4.4, 5.4.5
-- =============================================

-- =============================================
-- 1. ADD CATEGORY TEXT COLUMN TO BOOKS TABLE
-- This column stores the category name directly (synced from genres[0])
-- Coexists with category_id for backward compatibility
-- =============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'books' AND column_name = 'category'
  ) THEN
    ALTER TABLE books ADD COLUMN category TEXT DEFAULT 'Uncategorized';
    RAISE NOTICE 'Added category column to books table';
  ELSE
    RAISE NOTICE 'category column already exists in books table';
  END IF;
END $$;

-- =============================================
-- 2. ADD GENRES ARRAY COLUMN TO BOOKS TABLE
-- Stores AI-classified genres as a text array
-- =============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'books' AND column_name = 'genres'
  ) THEN
    ALTER TABLE books ADD COLUMN genres TEXT[];
    RAISE NOTICE 'Added genres column to books table';
  ELSE
    RAISE NOTICE 'genres column already exists in books table';
  END IF;
END $$;

-- =============================================
-- 3. ADD SUBGENRE COLUMN TO BOOKS TABLE
-- Stores AI-classified sub-genre
-- =============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'books' AND column_name = 'subgenre'
  ) THEN
    ALTER TABLE books ADD COLUMN subgenre TEXT;
    RAISE NOTICE 'Added subgenre column to books table';
  ELSE
    RAISE NOTICE 'subgenre column already exists in books table';
  END IF;
END $$;

-- =============================================
-- 4. ADD HAS_SOFT_COPY AND SOFT_COPY_URL COLUMNS
-- For tracking PDF availability
-- =============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'books' AND column_name = 'has_soft_copy'
  ) THEN
    ALTER TABLE books ADD COLUMN has_soft_copy BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added has_soft_copy column to books table';
  ELSE
    RAISE NOTICE 'has_soft_copy column already exists in books table';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'books' AND column_name = 'soft_copy_url'
  ) THEN
    ALTER TABLE books ADD COLUMN soft_copy_url TEXT;
    RAISE NOTICE 'Added soft_copy_url column to books table';
  ELSE
    RAISE NOTICE 'soft_copy_url column already exists in books table';
  END IF;
END $$;

-- =============================================
-- 5. CREATE INDEX ON CATEGORY COLUMN
-- For efficient filtering by category
-- =============================================

CREATE INDEX IF NOT EXISTS idx_books_category 
ON books(category);

-- =============================================
-- 6. CREATE INDEX ON GENRES COLUMN
-- For efficient filtering by genres (using GIN for array)
-- =============================================

CREATE INDEX IF NOT EXISTS idx_books_genres 
ON books USING GIN(genres);

-- =============================================
-- 7. UPDATE BOOKS_WITH_STATUS VIEW
-- Drop and recreate to include new columns
-- =============================================

DROP VIEW IF EXISTS books_with_status CASCADE;

CREATE VIEW books_with_status AS
SELECT 
  b.id,
  b.title,
  b.author,
  b.isbn,
  COALESCE(b.category, c.name, 'Uncategorized') AS category,
  b.cover_url,
  b.description,
  b.total_copies,
  b.copies_available,
  b.popularity,
  b.published_year,
  b.publisher,
  b.genres,
  b.subgenre,
  b.has_soft_copy,
  b.soft_copy_url,
  b.pdf_url,
  b.source,
  b.source_identifier,
  CASE 
    WHEN b.copies_available > 0 THEN 'AVAILABLE'
    WHEN EXISTS (SELECT 1 FROM waitlist w WHERE w.book_id = b.id) THEN 'WAITLIST'
    ELSE 'BORROWED'
  END AS status,
  b.created_at,
  b.updated_at
FROM books b
LEFT JOIN categories c ON b.category_id = c.id;

-- =============================================
-- 8. BACKFILL CATEGORY FROM CATEGORY_ID
-- For existing books, set category from the categories table
-- =============================================

UPDATE books b
SET category = c.name
FROM categories c
WHERE b.category_id = c.id
  AND (b.category IS NULL OR b.category = 'Uncategorized');

-- =============================================
-- DONE!
-- Run this migration, then ingestion should work properly.
-- =============================================
