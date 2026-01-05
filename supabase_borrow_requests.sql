-- =============================================
-- Drizaikn Digital Library System - Borrow Requests Feature
-- Book Borrowing Approval Workflow
-- Run this SQL in your Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS and DROP IF EXISTS)
-- =============================================

-- =============================================
-- 1. BORROW_REQUESTS TABLE
-- Requirements: 7.1, 7.4
-- =============================================
CREATE TABLE IF NOT EXISTS borrow_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint to prevent duplicate pending requests for same user/book
-- Using a partial unique index since we only want to prevent duplicates for pending status
DROP INDEX IF EXISTS idx_unique_pending_request;
CREATE UNIQUE INDEX idx_unique_pending_request 
  ON borrow_requests (user_id, book_id) 
  WHERE status = 'pending';

-- Indexes for efficient querying (Requirements: 7.4)
CREATE INDEX IF NOT EXISTS idx_borrow_requests_status ON borrow_requests(status);
CREATE INDEX IF NOT EXISTS idx_borrow_requests_user ON borrow_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_borrow_requests_book ON borrow_requests(book_id);
CREATE INDEX IF NOT EXISTS idx_borrow_requests_requested_at ON borrow_requests(requested_at);

-- =============================================
-- 2. PENDING_BORROW_REQUESTS VIEW
-- Requirements: 3.2, 6.1
-- =============================================
CREATE OR REPLACE VIEW pending_borrow_requests AS
SELECT 
  br.id,
  br.user_id,
  u.name AS user_name,
  u.admission_no AS user_admission_no,
  br.book_id,
  b.title AS book_title,
  b.author AS book_author,
  b.cover_url AS book_cover_url,
  b.copies_available,
  br.status,
  br.requested_at
FROM borrow_requests br
JOIN users u ON br.user_id = u.id
JOIN books b ON br.book_id = b.id
WHERE br.status = 'pending'
ORDER BY br.requested_at ASC;


-- =============================================
-- 3. CREATE_BORROW_REQUEST FUNCTION
-- Requirements: 1.1, 1.2, 1.3
-- - Check for existing pending request (prevent duplicates)
-- - Validate user and book exist
-- - Insert new request with status 'pending'
-- - Do NOT decrement book count
-- =============================================
CREATE OR REPLACE FUNCTION create_borrow_request(
  p_user_id UUID,
  p_book_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_user_exists BOOLEAN;
  v_book_exists BOOLEAN;
  v_pending_exists BOOLEAN;
  v_request_id UUID;
BEGIN
  -- Validate user exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = p_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Validate book exists
  SELECT EXISTS(SELECT 1 FROM books WHERE id = p_book_id) INTO v_book_exists;
  IF NOT v_book_exists THEN
    RETURN json_build_object('success', false, 'error', 'Book not found');
  END IF;

  -- Check for existing pending request (prevent duplicates)
  SELECT EXISTS(
    SELECT 1 FROM borrow_requests 
    WHERE user_id = p_user_id 
      AND book_id = p_book_id 
      AND status = 'pending'
  ) INTO v_pending_exists;
  
  IF v_pending_exists THEN
    RETURN json_build_object('success', false, 'error', 'You already have a pending request for this book');
  END IF;

  -- Insert new request with status 'pending'
  -- Note: Book count is NOT decremented here
  INSERT INTO borrow_requests (user_id, book_id, status, requested_at)
  VALUES (p_user_id, p_book_id, 'pending', NOW())
  RETURNING id INTO v_request_id;

  RETURN json_build_object(
    'success', true, 
    'request_id', v_request_id,
    'message', 'Borrow request created successfully'
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 4. APPROVE_BORROW_REQUEST FUNCTION
-- Requirements: 4.1, 4.2, 4.3, 4.5, 7.3
-- - Use transaction to ensure atomicity
-- - Verify copies_available > 0
-- - Update request status to 'approved'
-- - Create loan record with 14-day due date
-- - Decrement book copies_available
-- - Record processed_at and processed_by
-- =============================================
CREATE OR REPLACE FUNCTION approve_borrow_request(
  p_request_id UUID,
  p_admin_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_request RECORD;
  v_copies_available INT;
  v_user_loans INT;
  v_max_books INT;
  v_loan_id UUID;
BEGIN
  -- Get the request details
  SELECT br.*, u.max_books_allowed 
  INTO v_request
  FROM borrow_requests br
  JOIN users u ON br.user_id = u.id
  WHERE br.id = p_request_id;

  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Request has already been processed');
  END IF;

  -- Check copies available
  SELECT copies_available INTO v_copies_available 
  FROM books WHERE id = v_request.book_id;

  IF v_copies_available <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Cannot approve: No copies available');
  END IF;

  -- Check user's current loan count
  SELECT COUNT(*) INTO v_user_loans 
  FROM loans 
  WHERE user_id = v_request.user_id AND is_returned = FALSE;

  IF v_user_loans >= v_request.max_books_allowed THEN
    RETURN json_build_object('success', false, 'error', 'User has reached maximum loan limit');
  END IF;

  -- All validations passed, now perform the atomic operations
  -- 1. Update request status to 'approved'
  UPDATE borrow_requests 
  SET status = 'approved',
      processed_at = NOW(),
      processed_by = p_admin_id
  WHERE id = p_request_id;

  -- 2. Create loan record with 14-day due date
  INSERT INTO loans (user_id, book_id, due_date)
  VALUES (v_request.user_id, v_request.book_id, NOW() + INTERVAL '14 days')
  RETURNING id INTO v_loan_id;

  -- 3. Decrement book copies_available
  UPDATE books 
  SET copies_available = copies_available - 1,
      popularity = LEAST(popularity + 1, 100),
      updated_at = NOW()
  WHERE id = v_request.book_id;

  RETURN json_build_object(
    'success', true,
    'loan_id', v_loan_id,
    'message', 'Request approved successfully'
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 5. REJECT_BORROW_REQUEST FUNCTION
-- Requirements: 5.1, 5.2, 5.3, 5.4
-- - Update request status to 'rejected'
-- - Store optional rejection_reason
-- - Record processed_at and processed_by
-- - Do NOT modify book count
-- =============================================
CREATE OR REPLACE FUNCTION reject_borrow_request(
  p_request_id UUID,
  p_admin_id UUID,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Get the request details
  SELECT * INTO v_request
  FROM borrow_requests
  WHERE id = p_request_id;

  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Request has already been processed');
  END IF;

  -- Update request status to 'rejected'
  -- Note: Book count is NOT modified
  UPDATE borrow_requests 
  SET status = 'rejected',
      rejection_reason = p_rejection_reason,
      processed_at = NOW(),
      processed_by = p_admin_id
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Request rejected successfully'
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 6. ROW LEVEL SECURITY FOR BORROW_REQUESTS
-- =============================================
ALTER TABLE borrow_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (makes script re-runnable)
DROP POLICY IF EXISTS "Anyone can read borrow_requests" ON borrow_requests;
DROP POLICY IF EXISTS "Anyone can insert borrow_requests" ON borrow_requests;
DROP POLICY IF EXISTS "Anyone can update borrow_requests" ON borrow_requests;

-- Allow anyone to read borrow_requests (since we use service role key)
CREATE POLICY "Anyone can read borrow_requests" ON borrow_requests 
  FOR SELECT USING (true);

-- Allow anyone to insert borrow_requests
CREATE POLICY "Anyone can insert borrow_requests" ON borrow_requests 
  FOR INSERT WITH CHECK (true);

-- Allow anyone to update borrow_requests
CREATE POLICY "Anyone can update borrow_requests" ON borrow_requests 
  FOR UPDATE USING (true);

-- =============================================
-- DONE!
-- =============================================
