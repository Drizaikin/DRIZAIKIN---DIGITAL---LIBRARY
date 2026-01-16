# Implementation Plan: Multi-Source Ingestion

## Overview

This implementation plan extends the digital library's ingestion system to support multiple book sources through a pluggable fetcher architecture. The implementation follows an incremental approach, starting with core infrastructure, then adding source implementations, and finally integrating with the admin panel.

## Tasks

- [x] 1. Database schema and migrations
  - [x] 1.1 Create source_configurations table migration
    - Create `supabase_source_configurations.sql` with table definition
    - Include source_id, display_name, enabled, priority, rate_limit_ms, batch_size, source_specific_config (JSONB)
    - Add indexes for efficient queries
  - [x] 1.2 Create source_statistics table migration
    - Add source_statistics table for tracking per-source metrics
    - Include total_ingested, success_count, failure_count, last_run_at, average_processing_time_ms
  - [x] 1.3 Create source_daily_statistics table for trend tracking
    - Add daily aggregation table with date, ingested, succeeded, failed counts
    - Add unique constraint on (source_id, date)
  - [x] 1.4 Seed Internet Archive as default source
    - Insert default configuration for internet_archive with enabled=true

- [x] 2. Core infrastructure - Fetcher interface and base classes
  - [x] 2.1 Create Fetcher interface definition
    - Define interface in `services/ingestion/fetchers/fetcherInterface.js`
    - Include getSourceId(), getSourceMetadata(), fetchBooks(), parseBookDocument(), getDownloadUrl()
  - [x] 2.2 Create BaseFetcher abstract class
    - Implement common functionality (rate limiting, error handling)
    - Provide template methods for subclasses
  - [x] 2.3 Create MetadataMapper service
    - Implement normalize() method for unified book schema
    - Implement extractYear() for date parsing
    - Implement normalizeAuthor() for author array handling

- [-] 3. Source Registry implementation
  - [-] 3.1 Create SourceRegistry class
    - Implement register(), getFetcher(), getAllFetchers(), getEnabledFetchers()
    - Add validateFetcher() for interface compliance checking
  - [x] 3.2 Create SourceConfigurationService
    - Implement getConfiguration(), getAllConfigurations(), getEnabledConfigurations()
    - Implement updateConfiguration(), setEnabled(), createDefaultConfiguration()
  - [-] 3.3 Create SourceStatisticsService
    - Implement getStatistics(), getAllStatistics(), updateStatistics()
    - Implement getTrend() for daily statistics
    - Implement calculateHealthStatus()

- [ ] 4. Refactor existing Internet Archive fetcher
  - [~] 4.1 Migrate internetArchiveFetcher.js to implement Fetcher interface
    - Add getSourceId(), getSourceMetadata() methods
    - Ensure fetchBooks() matches interface signature
    - Maintain backward compatibility with existing code
  - [~] 4.2 Register Internet Archive fetcher with Source Registry
    - Auto-register on module load
    - Use existing configuration as defaults

- [ ] 5. Property-based tests for core infrastructure
  - [~] 5.1 Property test: Registry fetcher retrieval (Property 1)
    - Verify registered fetchers can be retrieved by source ID
  - [~] 5.2 Property test: Fetcher interface validation (Property 2)
    - Verify objects without required methods are rejected
  - [~] 5.3 Property test: Failed fetcher exclusion (Property 3)
    - Verify failed fetchers don't appear in available list
  - [~] 5.4 Property test: Configuration persistence round-trip (Property 4)
    - Verify saved configs can be read back unchanged
  - [~] 5.5 Property test: Default configuration creation (Property 5)
    - Verify new fetchers get default configs with enabled=false
  - [~] 5.6 Property test: Metadata normalization completeness (Property 8)
    - Verify all required fields present after normalization
  - [~] 5.7 Property test: Author array joining (Property 9)
    - Verify author arrays joined with comma-space
  - [~] 5.8 Property test: Year extraction from dates (Property 10)
    - Verify year extraction from various date formats
  - [~] 5.9 Property test: Source ordering by priority (Property 13)
    - Verify sources returned in priority order
  - [~] 5.10 Property test: Disabled source exclusion (Property 14)
    - Verify disabled sources not in enabled list

- [ ] 6. Orchestrator multi-source support
  - [~] 6.1 Extend orchestrator for multi-source ingestion
    - Add runMultiSourceIngestion() method
    - Add runSourceIngestion() for single source
    - Process sources in priority order
  - [~] 6.2 Implement source-specific rate limiting
    - Read rate_limit_ms from configuration
    - Apply delay between requests per source
  - [~] 6.3 Update statistics after each source run
    - Call SourceStatisticsService.updateStatistics()
    - Track daily statistics

- [ ] 7. Project Gutenberg fetcher implementation
  - [~] 7.1 Create ProjectGutenbergFetcher class
    - Implement Fetcher interface
    - Parse Gutenberg catalog format
  - [~] 7.2 Implement metadata mapping for Gutenberg
    - Map Gutenberg fields to unified schema
    - Handle format preferences (epub > txt > html)
  - [~] 7.3 Implement download URL construction
    - Use standard Gutenberg mirror pattern

- [ ] 8. Open Library fetcher implementation
  - [~] 8.1 Create OpenLibraryFetcher class
    - Implement Fetcher interface
    - Use Open Library Search API
  - [~] 8.2 Implement pagination handling
    - Handle offset-based pagination
    - Filter to books with available downloads
  - [~] 8.3 Include cover images in metadata
    - Extract cover_url from API response

- [ ] 9. Standard Ebooks fetcher implementation
  - [~] 9.1 Create StandardEbooksFetcher class
    - Implement Fetcher interface
    - Parse OPDS/Atom XML feed
  - [~] 9.2 Implement OPDS parsing
    - Extract metadata from entry elements
    - Handle multiple download formats
  - [~] 9.3 Respect crawling rate limits
    - Use conservative default rate limit

- [ ] 10. Admin panel source configuration UI
  - [~] 10.1 Create SourceConfigurationPanel component
    - Display all registered sources with status
    - Show enable/disable toggles
  - [~] 10.2 Add source-specific configuration fields
    - Dynamic form based on source type
    - Validate configuration before save
  - [~] 10.3 Add priority management UI
    - Drag-and-drop or numeric input for priority
  - [~] 10.4 Create API endpoint for source configuration
    - GET /api/admin/ingestion/sources - list all sources
    - PUT /api/admin/ingestion/sources/:id - update configuration

- [ ] 11. Health dashboard source statistics
  - [~] 11.1 Add per-source statistics display
    - Show breakdown by source in Health Dashboard
    - Display success rate, last run, health status
  - [~] 11.2 Add trend charts for source statistics
    - Show 7-day trend data per source
  - [~] 11.3 Add health status indicators
    - Show healthy/warning/failed status per source

- [ ] 12. Property-based tests for statistics and health
  - [~] 12.1 Property test: Statistics update after job (Property 11)
    - Verify statistics incremented correctly
  - [~] 12.2 Property test: Success rate calculation (Property 12)
    - Verify success_rate formula
  - [~] 12.3 Property test: Health status calculation (Property 17)
    - Verify health status rules
  - [~] 12.4 Property test: Enabled state affects inclusion (Property 18)
    - Verify enabled/disabled affects getEnabledFetchers()

- [ ] 13. Integration and backward compatibility
  - [~] 13.1 Verify existing Internet Archive ingestion works unchanged
    - Run existing cron job, verify no regressions
  - [~] 13.2 Test multi-source ingestion end-to-end
    - Enable multiple sources, run ingestion
  - [~] 13.3 Test source disable mid-run behavior
    - Disable source during ingestion, verify graceful handling
  - [~] 13.4 Update documentation
    - Document new source configuration options
    - Update README with multi-source information

## Notes

- Tasks are ordered by dependency - complete earlier tasks before later ones
- Property tests validate correctness properties from the design document
- Internet Archive remains the default and only initially enabled source
- New sources (Gutenberg, Open Library, Standard Ebooks) start disabled
- The existing cron job continues to work without modification
