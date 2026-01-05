-- =============================================
-- Drizaikn Digital Library System - AI Book Extraction Feature
-- Automated PDF Book Extraction from External Websites
-- Run this SQL in your Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS and DROP IF EXISTS)
-- =============================================

-- =============================================
-- 1. EXTRACTION_JOBS TABLE
-- Requirements: 1.5, 2.1, 2.2, 4.5, 6.1
-- Stores extraction job metadata and configuration
-- =============================================
CREATE TABLE IF NOT EXISTS extraction_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  max_time_minutes INTEGER DEFAULT 60,
  max_books INTEGER DEFAULT 100,
  books_extracted INTEGER DEFAULT 0,
  books_queued INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_extraction_status CHECK (
    status IN ('pending', 'running', 'paused', 'completed', 'failed', 'stopped')
  )
);

-- =============================================
-- 2. EXTRACTED_BOOKS TABLE
-- Requirements: 1.5, 2.1, 2.2, 4.5, 6.1
-- Staging table for books before publishing to main catalog
-- =============================================
CREATE TABLE IF NOT EXISTS extracted_books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES extraction_jobs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  description TEXT,
  synopsis TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  cover_url TEXT,
  pdf_url TEXT NOT NULL,
  source_pdf_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'processing',
  error_message TEXT,
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_extracted_book_status CHECK (
    status IN ('processing', 'completed', 'failed', 'published')
  )
);

-- =============================================
-- 3. EXTRACTION_LOGS TABLE
-- Requirements: 4.5, 6.1
-- Stores detailed logs for each extraction job
-- =============================================
CREATE TABLE IF NOT EXISTS extraction_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES extraction_jobs(id) ON DELETE CASCADE,
  level VARCHAR(10) NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_log_level CHECK (level IN ('info', 'warning', 'error'))
);

-- =============================================
-- 4. INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_created_by ON extraction_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_created_at ON extraction_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extracted_books_job_id ON extracted_books(job_id);
CREATE INDEX IF NOT EXISTS idx_extracted_books_status ON extracted_books(status);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_job_id ON extraction_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_created_at ON extraction_logs(created_at DESC);

-- =============================================
-- 5. ROW LEVEL SECURITY
-- =============================================
ALTER TABLE extraction_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (makes script re-runnable)
DROP POLICY IF EXISTS "Anyone can read extraction_jobs" ON extraction_jobs;
DROP POLICY IF EXISTS "Anyone can insert extraction_jobs" ON extraction_jobs;
DROP POLICY IF EXISTS "Anyone can update extraction_jobs" ON extraction_jobs;
DROP POLICY IF EXISTS "Anyone can delete extraction_jobs" ON extraction_jobs;

DROP POLICY IF EXISTS "Anyone can read extracted_books" ON extracted_books;
DROP POLICY IF EXISTS "Anyone can insert extracted_books" ON extracted_books;
DROP POLICY IF EXISTS "Anyone can update extracted_books" ON extracted_books;
DROP POLICY IF EXISTS "Anyone can delete extracted_books" ON extracted_books;

DROP POLICY IF EXISTS "Anyone can read extraction_logs" ON extraction_logs;
DROP POLICY IF EXISTS "Anyone can insert extraction_logs" ON extraction_logs;
DROP POLICY IF EXISTS "Anyone can delete extraction_logs" ON extraction_logs;

-- Policies for extraction_jobs (admin-only operations via service role)
CREATE POLICY "Anyone can read extraction_jobs" ON extraction_jobs 
  FOR SELECT USING (true);
CREATE POLICY "Anyone can insert extraction_jobs" ON extraction_jobs 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update extraction_jobs" ON extraction_jobs 
  FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete extraction_jobs" ON extraction_jobs 
  FOR DELETE USING (true);

-- Policies for extracted_books
CREATE POLICY "Anyone can read extracted_books" ON extracted_books 
  FOR SELECT USING (true);
CREATE POLICY "Anyone can insert extracted_books" ON extracted_books 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update extracted_books" ON extracted_books 
  FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete extracted_books" ON extracted_books 
  FOR DELETE USING (true);

-- Policies for extraction_logs
CREATE POLICY "Anyone can read extraction_logs" ON extraction_logs 
  FOR SELECT USING (true);
CREATE POLICY "Anyone can insert extraction_logs" ON extraction_logs 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete extraction_logs" ON extraction_logs 
  FOR DELETE USING (true);


-- =============================================
-- 6. EXTRACTION JOB VIEWS
-- Requirements: 6.1, 6.2
-- =============================================

-- View for extraction job history with summary info
CREATE OR REPLACE VIEW extraction_job_history AS
SELECT 
  ej.id,
  ej.source_url,
  ej.status,
  ej.max_time_minutes,
  ej.max_books,
  ej.books_extracted,
  ej.books_queued,
  ej.error_count,
  ej.started_at,
  ej.completed_at,
  ej.created_by,
  u.name AS created_by_name,
  ej.created_at,
  CASE 
    WHEN ej.started_at IS NOT NULL AND ej.completed_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (ej.completed_at - ej.started_at))::INTEGER
    WHEN ej.started_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (NOW() - ej.started_at))::INTEGER
    ELSE 0
  END AS duration_seconds
FROM extraction_jobs ej
LEFT JOIN users u ON ej.created_by = u.id
ORDER BY ej.created_at DESC;

-- View for extracted books with job info
CREATE OR REPLACE VIEW extracted_books_with_job AS
SELECT 
  eb.id,
  eb.job_id,
  ej.source_url AS job_source_url,
  eb.title,
  eb.author,
  eb.description,
  eb.synopsis,
  eb.category_id,
  c.name AS category_name,
  eb.cover_url,
  eb.pdf_url,
  eb.source_pdf_url,
  eb.status,
  eb.error_message,
  eb.extracted_at,
  eb.published_at
FROM extracted_books eb
JOIN extraction_jobs ej ON eb.job_id = ej.id
LEFT JOIN categories c ON eb.category_id = c.id;

-- =============================================
-- 7. HELPER FUNCTIONS
-- =============================================

-- Function to create a new extraction job
-- Requirements: 1.5, 2.1, 2.2, 2.6
CREATE OR REPLACE FUNCTION create_extraction_job(
  p_source_url TEXT,
  p_created_by UUID,
  p_max_time_minutes INTEGER DEFAULT NULL,
  p_max_books INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_job_id UUID;
  v_max_time INTEGER;
  v_max_books INTEGER;
BEGIN
  -- Apply default limits if not specified (Requirement 2.6)
  v_max_time := COALESCE(p_max_time_minutes, 60);
  v_max_books := COALESCE(p_max_books, 100);

  INSERT INTO extraction_jobs (
    source_url, 
    created_by, 
    max_time_minutes, 
    max_books,
    status
  )
  VALUES (
    p_source_url, 
    p_created_by, 
    v_max_time, 
    v_max_books,
    'pending'
  )
  RETURNING id INTO v_job_id;

  -- Log job creation
  INSERT INTO extraction_logs (job_id, level, message, details)
  VALUES (
    v_job_id, 
    'info', 
    'Extraction job created',
    jsonb_build_object(
      'source_url', p_source_url,
      'max_time_minutes', v_max_time,
      'max_books', v_max_books
    )
  );

  RETURN json_build_object(
    'success', true,
    'job_id', v_job_id,
    'max_time_minutes', v_max_time,
    'max_books', v_max_books
  );
END;
$$ LANGUAGE plpgsql;

-- Function to update job status with validation
-- Requirements: 5.1, 5.2, 5.3
CREATE OR REPLACE FUNCTION update_extraction_job_status(
  p_job_id UUID,
  p_new_status VARCHAR(20)
)
RETURNS JSON AS $$
DECLARE
  v_current_status VARCHAR(20);
  v_valid_transition BOOLEAN := FALSE;
BEGIN
  -- Get current status
  SELECT status INTO v_current_status
  FROM extraction_jobs
  WHERE id = p_job_id;

  IF v_current_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Job not found');
  END IF;

  -- Validate state transitions (Property 5: Job State Transitions)
  -- Valid transitions:
  -- pending → running
  -- running → paused, completed, stopped, failed
  -- paused → running, stopped
  v_valid_transition := CASE
    WHEN v_current_status = 'pending' AND p_new_status = 'running' THEN TRUE
    WHEN v_current_status = 'running' AND p_new_status IN ('paused', 'completed', 'stopped', 'failed') THEN TRUE
    WHEN v_current_status = 'paused' AND p_new_status IN ('running', 'stopped') THEN TRUE
    ELSE FALSE
  END;

  IF NOT v_valid_transition THEN
    RETURN json_build_object(
      'success', false, 
      'error', format('Invalid status transition from %s to %s', v_current_status, p_new_status)
    );
  END IF;

  -- Update status and timestamps
  UPDATE extraction_jobs
  SET 
    status = p_new_status,
    started_at = CASE 
      WHEN p_new_status = 'running' AND started_at IS NULL THEN NOW()
      ELSE started_at
    END,
    completed_at = CASE 
      WHEN p_new_status IN ('completed', 'stopped', 'failed') THEN NOW()
      ELSE completed_at
    END
  WHERE id = p_job_id;

  -- Log status change
  INSERT INTO extraction_logs (job_id, level, message, details)
  VALUES (
    p_job_id, 
    'info', 
    format('Job status changed from %s to %s', v_current_status, p_new_status),
    jsonb_build_object('previous_status', v_current_status, 'new_status', p_new_status)
  );

  RETURN json_build_object('success', true, 'previous_status', v_current_status, 'new_status', p_new_status);
END;
$$ LANGUAGE plpgsql;

-- Function to add an extracted book to a job
CREATE OR REPLACE FUNCTION add_extracted_book(
  p_job_id UUID,
  p_title TEXT,
  p_author TEXT,
  p_description TEXT,
  p_synopsis TEXT,
  p_category_id UUID,
  p_cover_url TEXT,
  p_pdf_url TEXT,
  p_source_pdf_url TEXT
)
RETURNS JSON AS $$
DECLARE
  v_book_id UUID;
BEGIN
  INSERT INTO extracted_books (
    job_id, title, author, description, synopsis,
    category_id, cover_url, pdf_url, source_pdf_url, status
  )
  VALUES (
    p_job_id, p_title, p_author, p_description, p_synopsis,
    p_category_id, p_cover_url, p_pdf_url, p_source_pdf_url, 'completed'
  )
  RETURNING id INTO v_book_id;

  -- Update job counters
  UPDATE extraction_jobs
  SET books_extracted = books_extracted + 1
  WHERE id = p_job_id;

  RETURN json_build_object('success', true, 'book_id', v_book_id);
END;
$$ LANGUAGE plpgsql;

-- Function to log extraction events
CREATE OR REPLACE FUNCTION log_extraction_event(
  p_job_id UUID,
  p_level VARCHAR(10),
  p_message TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO extraction_logs (job_id, level, message, details)
  VALUES (p_job_id, p_level, p_message, p_details)
  RETURNING id INTO v_log_id;

  -- Increment error count if this is an error
  IF p_level = 'error' THEN
    UPDATE extraction_jobs
    SET error_count = error_count + 1
    WHERE id = p_job_id;
  END IF;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to publish extracted books to main catalog
-- Requirements: 7.3
CREATE OR REPLACE FUNCTION publish_extracted_books(p_job_id UUID)
RETURNS JSON AS $$
DECLARE
  v_published_count INTEGER := 0;
  v_book RECORD;
BEGIN
  -- Loop through completed extracted books and add to main books table
  FOR v_book IN 
    SELECT * FROM extracted_books 
    WHERE job_id = p_job_id AND status = 'completed'
  LOOP
    -- Insert into main books table
    INSERT INTO books (
      title, author, category_id, cover_url, description,
      total_copies, copies_available, popularity, published_year
    )
    VALUES (
      v_book.title, v_book.author, v_book.category_id, v_book.cover_url,
      v_book.description, 1, 1, 0, EXTRACT(YEAR FROM NOW())::INTEGER
    );

    -- Update extracted book status to published
    UPDATE extracted_books
    SET status = 'published', published_at = NOW()
    WHERE id = v_book.id;

    v_published_count := v_published_count + 1;
  END LOOP;

  -- Log the publish event
  INSERT INTO extraction_logs (job_id, level, message, details)
  VALUES (
    p_job_id, 
    'info', 
    format('Published %s books to catalog', v_published_count),
    jsonb_build_object('published_count', v_published_count)
  );

  RETURN json_build_object('success', true, 'published_count', v_published_count);
END;
$$ LANGUAGE plpgsql;

-- Function to get job progress
-- Requirements: 4.1, 4.2, 4.3
CREATE OR REPLACE FUNCTION get_extraction_progress(p_job_id UUID)
RETURNS JSON AS $$
DECLARE
  v_job RECORD;
  v_elapsed_seconds INTEGER;
  v_estimated_remaining INTEGER;
BEGIN
  SELECT * INTO v_job FROM extraction_jobs WHERE id = p_job_id;

  IF v_job IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Job not found');
  END IF;

  -- Calculate elapsed time
  IF v_job.started_at IS NOT NULL THEN
    v_elapsed_seconds := EXTRACT(EPOCH FROM (NOW() - v_job.started_at))::INTEGER;
  ELSE
    v_elapsed_seconds := 0;
  END IF;

  -- Estimate remaining time based on progress
  IF v_job.books_extracted > 0 AND v_job.books_queued > v_job.books_extracted THEN
    v_estimated_remaining := (v_elapsed_seconds / v_job.books_extracted) * 
                            (v_job.books_queued - v_job.books_extracted);
  ELSE
    v_estimated_remaining := 0;
  END IF;

  RETURN json_build_object(
    'success', true,
    'job_id', v_job.id,
    'status', v_job.status,
    'books_extracted', v_job.books_extracted,
    'books_queued', v_job.books_queued,
    'error_count', v_job.error_count,
    'elapsed_seconds', v_elapsed_seconds,
    'estimated_remaining_seconds', v_estimated_remaining,
    'max_time_minutes', v_job.max_time_minutes,
    'max_books', v_job.max_books
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- DONE!
-- =============================================
