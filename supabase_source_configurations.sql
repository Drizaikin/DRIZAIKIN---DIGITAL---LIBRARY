-- Multi-Source Ingestion: Source Configurations
-- This migration creates the infrastructure for managing multiple book sources
-- Requirements: 2.1, 2.2, 2.3, 2.4, 2.5

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Source Configurations Table
-- Stores configuration for each book source (Internet Archive, Project Gutenberg, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS source_configurations (
  source_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  website TEXT,
  enabled BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 100,
  rate_limit_ms INTEGER DEFAULT 1500,
  batch_size INTEGER DEFAULT 30,
  supported_formats TEXT[] DEFAULT ARRAY['pdf'],
  source_specific_config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient queries on enabled sources by priority
CREATE INDEX IF NOT EXISTS idx_source_configs_enabled_priority 
  ON source_configurations(enabled, priority) 
  WHERE enabled = true;

-- =============================================================================
-- Source Statistics Table
-- Tracks per-source ingestion metrics
-- Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
-- =============================================================================
CREATE TABLE IF NOT EXISTS source_statistics (
  source_id TEXT PRIMARY KEY REFERENCES source_configurations(source_id) ON DELETE CASCADE,
  total_ingested INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  last_run_status TEXT CHECK (last_run_status IN ('completed', 'partial', 'failed', NULL)),
  average_processing_time_ms INTEGER DEFAULT 0,
  error_count_24h INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- Source Daily Statistics Table
-- Tracks daily aggregated statistics for trend analysis
-- Requirements: 5.4
-- =============================================================================
CREATE TABLE IF NOT EXISTS source_daily_statistics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id TEXT REFERENCES source_configurations(source_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  ingested INTEGER DEFAULT 0,
  succeeded INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  processing_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source_id, date)
);

-- Index for efficient trend queries
CREATE INDEX IF NOT EXISTS idx_source_daily_stats_source_date 
  ON source_daily_statistics(source_id, date DESC);

-- =============================================================================
-- Update Trigger for updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_source_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_source_config_updated_at
  BEFORE UPDATE ON source_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_source_config_updated_at();

CREATE OR REPLACE FUNCTION update_source_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_source_stats_updated_at
  BEFORE UPDATE ON source_statistics
  FOR EACH ROW
  EXECUTE FUNCTION update_source_stats_updated_at();

-- =============================================================================
-- Seed Default Source: Internet Archive
-- Requirements: 7.1, 7.2
-- =============================================================================
INSERT INTO source_configurations (
  source_id,
  display_name,
  description,
  website,
  enabled,
  priority,
  rate_limit_ms,
  batch_size,
  supported_formats,
  source_specific_config
) VALUES (
  'internet_archive',
  'Internet Archive',
  'The Internet Archive is a non-profit digital library offering free access to millions of books, movies, software, music, and more.',
  'https://archive.org',
  true,  -- Enabled by default for backward compatibility
  1,     -- Highest priority
  1500,  -- 1.5 second delay between requests
  30,    -- 30 books per batch
  ARRAY['pdf', 'epub', 'txt'],
  '{
    "collection": "opensource",
    "mediatype": "texts",
    "language": "eng"
  }'::jsonb
) ON CONFLICT (source_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  website = EXCLUDED.website,
  updated_at = NOW();

-- Create statistics entry for Internet Archive
INSERT INTO source_statistics (source_id)
VALUES ('internet_archive')
ON CONFLICT (source_id) DO NOTHING;

-- =============================================================================
-- Seed Additional Sources (disabled by default)
-- =============================================================================

-- Project Gutenberg
INSERT INTO source_configurations (
  source_id,
  display_name,
  description,
  website,
  enabled,
  priority,
  rate_limit_ms,
  batch_size,
  supported_formats,
  source_specific_config
) VALUES (
  'project_gutenberg',
  'Project Gutenberg',
  'Project Gutenberg is a volunteer effort to digitize and archive cultural works, offering over 70,000 free eBooks.',
  'https://www.gutenberg.org',
  false,  -- Disabled by default
  2,
  2000,   -- 2 second delay (be respectful)
  20,
  ARRAY['epub', 'txt', 'html'],
  '{
    "language": "en",
    "format_preference": ["epub", "txt", "html"]
  }'::jsonb
) ON CONFLICT (source_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  website = EXCLUDED.website,
  updated_at = NOW();

INSERT INTO source_statistics (source_id)
VALUES ('project_gutenberg')
ON CONFLICT (source_id) DO NOTHING;

-- Open Library
INSERT INTO source_configurations (
  source_id,
  display_name,
  description,
  website,
  enabled,
  priority,
  rate_limit_ms,
  batch_size,
  supported_formats,
  source_specific_config
) VALUES (
  'open_library',
  'Open Library',
  'Open Library is an open, editable library catalog, building towards a web page for every book ever published.',
  'https://openlibrary.org',
  false,  -- Disabled by default
  3,
  1000,   -- 1 second delay
  25,
  ARRAY['pdf', 'epub'],
  '{
    "has_fulltext": true,
    "language": "eng"
  }'::jsonb
) ON CONFLICT (source_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  website = EXCLUDED.website,
  updated_at = NOW();

INSERT INTO source_statistics (source_id)
VALUES ('open_library')
ON CONFLICT (source_id) DO NOTHING;

-- Standard Ebooks
INSERT INTO source_configurations (
  source_id,
  display_name,
  description,
  website,
  enabled,
  priority,
  rate_limit_ms,
  batch_size,
  supported_formats,
  source_specific_config
) VALUES (
  'standard_ebooks',
  'Standard Ebooks',
  'Standard Ebooks is a volunteer-driven project that produces high-quality, carefully formatted, accessible editions of public domain ebooks.',
  'https://standardebooks.org',
  false,  -- Disabled by default
  4,
  3000,   -- 3 second delay (very respectful)
  10,     -- Smaller batches
  ARRAY['epub', 'kepub', 'azw3'],
  '{
    "opds_feed": "https://standardebooks.org/opds",
    "format_preference": ["epub", "kepub", "azw3"]
  }'::jsonb
) ON CONFLICT (source_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  website = EXCLUDED.website,
  updated_at = NOW();

INSERT INTO source_statistics (source_id)
VALUES ('standard_ebooks')
ON CONFLICT (source_id) DO NOTHING;

-- =============================================================================
-- Row Level Security (RLS) Policies
-- =============================================================================
ALTER TABLE source_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_daily_statistics ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to source_configurations"
  ON source_configurations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to source_statistics"
  ON source_statistics
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to source_daily_statistics"
  ON source_daily_statistics
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated users to read configurations (for admin panel)
CREATE POLICY "Authenticated users can read source_configurations"
  ON source_configurations
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read source_statistics"
  ON source_statistics
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read source_daily_statistics"
  ON source_daily_statistics
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to get enabled sources in priority order
CREATE OR REPLACE FUNCTION get_enabled_sources()
RETURNS TABLE (
  source_id TEXT,
  display_name TEXT,
  priority INTEGER,
  rate_limit_ms INTEGER,
  batch_size INTEGER,
  source_specific_config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.source_id,
    sc.display_name,
    sc.priority,
    sc.rate_limit_ms,
    sc.batch_size,
    sc.source_specific_config
  FROM source_configurations sc
  WHERE sc.enabled = true
  ORDER BY sc.priority ASC, sc.source_id ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update source statistics after a run
CREATE OR REPLACE FUNCTION update_source_statistics(
  p_source_id TEXT,
  p_processed INTEGER,
  p_added INTEGER,
  p_failed INTEGER,
  p_processing_time_ms INTEGER,
  p_status TEXT
)
RETURNS void AS $$
BEGIN
  -- Update main statistics
  UPDATE source_statistics
  SET
    total_ingested = total_ingested + p_added,
    success_count = success_count + p_added,
    failure_count = failure_count + p_failed,
    last_run_at = NOW(),
    last_run_status = p_status,
    last_success_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE last_success_at END,
    average_processing_time_ms = CASE 
      WHEN total_ingested = 0 THEN p_processing_time_ms
      ELSE (average_processing_time_ms + p_processing_time_ms) / 2
    END,
    error_count_24h = CASE 
      WHEN p_failed > 0 THEN error_count_24h + p_failed
      ELSE error_count_24h
    END
  WHERE source_id = p_source_id;
  
  -- Upsert daily statistics
  INSERT INTO source_daily_statistics (source_id, date, ingested, succeeded, failed, processing_time_ms)
  VALUES (p_source_id, CURRENT_DATE, p_added, p_added, p_failed, p_processing_time_ms)
  ON CONFLICT (source_id, date) DO UPDATE SET
    ingested = source_daily_statistics.ingested + EXCLUDED.ingested,
    succeeded = source_daily_statistics.succeeded + EXCLUDED.succeeded,
    failed = source_daily_statistics.failed + EXCLUDED.failed,
    processing_time_ms = source_daily_statistics.processing_time_ms + EXCLUDED.processing_time_ms;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate health status
CREATE OR REPLACE FUNCTION get_source_health_status(p_source_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_stats source_statistics%ROWTYPE;
BEGIN
  SELECT * INTO v_stats FROM source_statistics WHERE source_id = p_source_id;
  
  IF NOT FOUND THEN
    RETURN 'unknown';
  END IF;
  
  -- Check if last run failed
  IF v_stats.last_run_status = 'failed' THEN
    RETURN 'failed';
  END IF;
  
  -- Check if more than 5 errors in 24 hours
  IF v_stats.error_count_24h > 5 THEN
    RETURN 'warning';
  END IF;
  
  -- Check if no success in 48 hours
  IF v_stats.last_success_at IS NOT NULL AND 
     v_stats.last_success_at < NOW() - INTERVAL '48 hours' THEN
    RETURN 'warning';
  END IF;
  
  RETURN 'healthy';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset 24h error count (run daily via cron)
CREATE OR REPLACE FUNCTION reset_24h_error_counts()
RETURNS void AS $$
BEGIN
  UPDATE source_statistics SET error_count_24h = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Comments for documentation
-- =============================================================================
COMMENT ON TABLE source_configurations IS 'Configuration for each book source in the multi-source ingestion system';
COMMENT ON TABLE source_statistics IS 'Per-source ingestion statistics and metrics';
COMMENT ON TABLE source_daily_statistics IS 'Daily aggregated statistics for trend analysis';
COMMENT ON FUNCTION get_enabled_sources() IS 'Returns enabled sources sorted by priority';
COMMENT ON FUNCTION update_source_statistics(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) IS 'Updates statistics after an ingestion run';
COMMENT ON FUNCTION get_source_health_status(TEXT) IS 'Calculates health status (healthy/warning/failed) for a source';
