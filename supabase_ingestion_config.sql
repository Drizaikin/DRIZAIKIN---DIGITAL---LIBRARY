-- Ingestion Configuration Table
-- Stores filter configuration and other ingestion settings
-- This allows runtime configuration changes without redeploying

-- Create the ingestion_config table
CREATE TABLE IF NOT EXISTS ingestion_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ingestion_config_key ON ingestion_config(config_key);

-- Insert default filter settings if not exists
INSERT INTO ingestion_config (config_key, config_value)
VALUES (
  'filter_settings',
  '{
    "allowedGenres": [],
    "allowedAuthors": [],
    "enableGenreFilter": false,
    "enableAuthorFilter": false
  }'::jsonb
)
ON CONFLICT (config_key) DO NOTHING;

-- Enable RLS
ALTER TABLE ingestion_config ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role can manage ingestion_config"
  ON ingestion_config
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON ingestion_config TO service_role;
GRANT SELECT ON ingestion_config TO authenticated;

-- Add comment
COMMENT ON TABLE ingestion_config IS 'Stores ingestion configuration including filter settings';
COMMENT ON COLUMN ingestion_config.config_key IS 'Unique key for the configuration (e.g., filter_settings)';
COMMENT ON COLUMN ingestion_config.config_value IS 'JSON configuration value';
