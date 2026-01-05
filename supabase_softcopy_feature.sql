-- =============================================
-- Drizaikn Library - Add Soft Copy (Digital Book) Feature
-- =============================================

-- Add soft copy URL field to books table
ALTER TABLE books ADD COLUMN IF NOT EXISTS soft_copy_url TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS has_soft_copy BOOLEAN DEFAULT FALSE;

-- Create index for soft copy searches
CREATE INDEX IF NOT EXISTS idx_books_has_soft_copy ON books(has_soft_copy);

-- Update the books_with_status view to include soft copy information
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
  b.soft_copy_url,
  b.has_soft_copy,
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

-- Add comment to explain the soft copy feature
COMMENT ON COLUMN books.soft_copy_url IS 'URL to digital/PDF version of the book (if available)';
COMMENT ON COLUMN books.has_soft_copy IS 'Boolean flag indicating if a digital version is available';

-- Done! Books can now have soft copies
