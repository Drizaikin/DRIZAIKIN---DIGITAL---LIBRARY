-- =============================================
-- Ingestion Filter Statistics Table
-- Tracks filter decisions for audit trail and statistics
-- Run this SQL in your Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS and conditional adds)
-- Requirements: 5.7.5
-- =============================================

-- =============================================
-- 1. CREATE INGESTION_FILTER_STATS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS ingestion_filter_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES ingestion_logs(id) ON DELETE CASCADE,
  book_identifier TEXT NOT NULL,
  book_title TEXT,
  book_author TEXT,
  book_genres TEXT[],
  filter_result TEXT NOT NULL CHECK (filter_result IN ('passed', 'filtered_genre', 'filtered_author')),
  filter_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE ingestion_filter_stats IS 'Tracks filter decisions during book ingestion for audit and statistics';


-- =============================================
-- 2. CREATE INDEXES FOR EFFICIENT QUERYING
-- =============================================

-- Index for querying by job_id (for job-specific statistics)
CREATE INDEX IF NOT EXISTS idx_filter_stats_job_id 
ON ingestion_filter_stats(job_id);

-- Index for filtering by result type (for aggregate statistics)
CREATE INDEX IF NOT EXISTS idx_filter_stats_result 
ON ingestion_filter_stats(filter_result);

-- Index for time-based queries (for recent statistics)
CREATE INDEX IF NOT EXISTS idx_filter_stats_created_at 
ON ingestion_filter_stats(created_at DESC);

-- Composite index for common query pattern (job + result)
CREATE INDEX IF NOT EXISTS idx_filter_stats_job_result 
ON ingestion_filter_stats(job_id, filter_result);

-- =============================================
-- 3. ENABLE RLS AND CREATE POLICIES
-- =============================================

ALTER TABLE ingestion_filter_stats ENABLE ROW LEVEL SECURITY;

-- Allow reading filter stats (for admin monitoring)
DROP POLICY IF EXISTS "Anyone can read ingestion_filter_stats" ON ingestion_filter_stats;
CREATE POLICY "Anyone can read ingestion_filter_stats" 
ON ingestion_filter_stats FOR SELECT USING (true);

-- Allow inserting filter stats (for the ingestion service)
DROP POLICY IF EXISTS "Anyone can insert ingestion_filter_stats" ON ingestion_filter_stats;
CREATE POLICY "Anyone can insert ingestion_filter_stats" 
ON ingestion_filter_stats FOR INSERT WITH CHECK (true);

-- =============================================
-- 4. CREATE HELPER FUNCTIONS FOR STATISTICS
-- =============================================

-- Function to get filter statistics for a specific job
CREATE OR REPLACE FUNCTION get_job_filter_stats(p_job_id UUID)
RETURNS TABLE (
  total_evaluated BIGINT,
  passed BIGINT,
  filtered_by_genre BIGINT,
  filtered_by_author BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_evaluated,
    COUNT(*) FILTER (WHERE filter_result = 'passed')::BIGINT as passed,
    COUNT(*) FILTER (WHERE filter_result = 'filtered_genre')::BIGINT as filtered_by_genre,
    COUNT(*) FILTER (WHERE filter_result = 'filtered_author')::BIGINT as filtered_by_author
  FROM ingestion_filter_stats
  WHERE job_id = p_job_id;
END;
$$ LANGUAGE plpgsql;


-- Function to get aggregate filter statistics for recent jobs
CREATE OR REPLACE FUNCTION get_recent_filter_stats(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  total_evaluated BIGINT,
  passed BIGINT,
  filtered_by_genre BIGINT,
  filtered_by_author BIGINT,
  jobs_analyzed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_jobs AS (
    SELECT DISTINCT job_id
    FROM ingestion_filter_stats
    WHERE job_id IS NOT NULL
    ORDER BY job_id DESC
    LIMIT p_limit
  )
  SELECT 
    COUNT(*)::BIGINT as total_evaluated,
    COUNT(*) FILTER (WHERE filter_result = 'passed')::BIGINT as passed,
    COUNT(*) FILTER (WHERE filter_result = 'filtered_genre')::BIGINT as filtered_by_genre,
    COUNT(*) FILTER (WHERE filter_result = 'filtered_author')::BIGINT as filtered_by_author,
    (SELECT COUNT(*)::BIGINT FROM recent_jobs) as jobs_analyzed
  FROM ingestion_filter_stats
  WHERE job_id IN (SELECT job_id FROM recent_jobs);
END;
$$ LANGUAGE plpgsql;

-- Function to get top filtered genres
CREATE OR REPLACE FUNCTION get_top_filtered_genres(p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
  genre TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    unnest(book_genres) as genre,
    COUNT(*)::BIGINT as count
  FROM ingestion_filter_stats
  WHERE filter_result = 'filtered_genre'
    AND book_genres IS NOT NULL
  GROUP BY unnest(book_genres)
  ORDER BY count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get top filtered authors
CREATE OR REPLACE FUNCTION get_top_filtered_authors(p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
  author TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    book_author as author,
    COUNT(*)::BIGINT as count
  FROM ingestion_filter_stats
  WHERE filter_result = 'filtered_author'
    AND book_author IS NOT NULL
  GROUP BY book_author
  ORDER BY count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- DONE!
-- =============================================
