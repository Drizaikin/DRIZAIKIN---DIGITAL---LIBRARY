# Requirements Document

## Introduction

This feature extends the digital library's ingestion system to support multiple book sources beyond the current Internet Archive integration. The system will provide a pluggable fetcher architecture allowing administrators to configure, enable/disable, and monitor multiple public domain book sources through the admin panel. This enables broader content acquisition while maintaining backward compatibility with existing functionality.

## Glossary

- **Source**: A public domain book provider (e.g., Internet Archive, Project Gutenberg, Open Library)
- **Fetcher**: A service module that retrieves book metadata and content from a specific Source
- **Source_Registry**: The central registry that manages all available Fetchers and their configurations
- **Source_Configuration**: Database-stored settings for a Source including enabled status, priority, and source-specific parameters
- **Metadata_Mapper**: A component that normalizes source-specific metadata formats to the unified book schema
- **Orchestrator**: The existing ingestion coordinator that processes books through the pipeline
- **Health_Dashboard**: The admin panel component displaying system status and metrics
- **Source_Statistics**: Per-source metrics including books ingested, success rates, and error counts

## Requirements

### Requirement 1: Pluggable Fetcher Architecture

**User Story:** As a developer, I want a pluggable fetcher architecture, so that new book sources can be added without modifying core ingestion logic.

#### Acceptance Criteria

1. THE Source_Registry SHALL maintain a registry of all available Fetcher implementations
2. WHEN a new Fetcher is registered, THE Source_Registry SHALL validate that it implements the required interface (fetchBooks, parseBookDocument, getPdfUrl)
3. THE Fetcher interface SHALL define standard methods: fetchBooks(options), parseBookDocument(doc), getPdfUrl(identifier), and getSourceMetadata()
4. WHEN the Orchestrator requests books, THE Source_Registry SHALL return the appropriate Fetcher based on source configuration
5. IF a Fetcher fails to load, THEN THE Source_Registry SHALL log the error and exclude it from available sources without affecting other Fetchers

### Requirement 2: Source Configuration Storage

**User Story:** As an administrator, I want source configurations stored in the database, so that I can modify settings without code deployments.

#### Acceptance Criteria

1. THE Source_Configuration table SHALL store: source_id, display_name, enabled, priority, rate_limit_ms, batch_size, and source_specific_config (JSONB)
2. WHEN a source is enabled or disabled, THE System SHALL persist the change immediately to the database
3. THE System SHALL load Source_Configuration from the database on each ingestion run
4. IF no Source_Configuration exists for a registered Fetcher, THEN THE System SHALL create a default configuration with enabled=false
5. WHEN source_specific_config is updated, THE System SHALL validate the JSON structure before saving

### Requirement 3: Admin Panel Source Selection

**User Story:** As an administrator, I want to select and configure active sources from the admin panel, so that I can control which sources are used for ingestion.

#### Acceptance Criteria

1. WHEN an administrator views the source configuration panel, THE System SHALL display all registered sources with their current status
2. THE Admin_Panel SHALL provide toggle controls to enable/disable each source
3. WHEN an administrator enables a source, THE System SHALL validate that required configuration is present before activation
4. THE Admin_Panel SHALL display source-specific configuration fields based on the source type
5. WHEN configuration changes are saved, THE System SHALL apply them to the next ingestion run without requiring restart

### Requirement 4: Metadata Normalization

**User Story:** As a system, I want to normalize metadata from different sources, so that all books have consistent data regardless of origin.

#### Acceptance Criteria

1. WHEN a Fetcher returns book metadata, THE Metadata_Mapper SHALL transform it to the unified book schema (title, author, year, language, description, source_identifier)
2. THE Metadata_Mapper SHALL handle missing fields by applying source-specific defaults or null values
3. WHEN author data is an array, THE Metadata_Mapper SHALL join authors with comma separation
4. WHEN date formats vary, THE Metadata_Mapper SHALL extract the four-digit year using pattern matching
5. THE Metadata_Mapper SHALL preserve the original source identifier format for each source type

### Requirement 5: Per-Source Statistics Tracking

**User Story:** As an administrator, I want to see statistics for each source, so that I can monitor performance and identify issues.

#### Acceptance Criteria

1. THE System SHALL track per-source metrics: total_ingested, success_count, failure_count, last_run_at, average_processing_time_ms
2. WHEN an ingestion job completes, THE System SHALL update Source_Statistics for each source that was processed
3. THE Health_Dashboard SHALL display a breakdown of statistics by source
4. WHEN viewing source statistics, THE Admin_Panel SHALL show trend data for the last 7 days
5. THE System SHALL calculate and display success_rate as (success_count / total_processed * 100)

### Requirement 6: Source Priority and Selection

**User Story:** As an administrator, I want to set source priorities, so that preferred sources are processed first during ingestion.

#### Acceptance Criteria

1. THE Source_Configuration SHALL include a priority field (integer, lower = higher priority)
2. WHEN multiple sources are enabled, THE Orchestrator SHALL process sources in priority order
3. WHEN two sources have equal priority, THE Orchestrator SHALL process them in alphabetical order by source_id
4. THE Admin_Panel SHALL provide drag-and-drop or numeric input for adjusting source priorities
5. WHEN a source is disabled, THE System SHALL skip it regardless of priority setting

### Requirement 7: Backward Compatibility

**User Story:** As a system operator, I want the new multi-source system to maintain backward compatibility, so that existing Internet Archive ingestion continues working.

#### Acceptance Criteria

1. THE existing Internet Archive Fetcher SHALL be registered as the default source with enabled=true
2. WHEN no sources are explicitly configured, THE System SHALL fall back to Internet Archive only
3. THE existing ingestion_state table schema SHALL remain unchanged for Internet Archive tracking
4. WHEN upgrading, THE System SHALL migrate existing Internet Archive state to the new source-aware format
5. THE existing cron job configuration SHALL continue to work without modification

### Requirement 8: Source-Specific Rate Limiting

**User Story:** As a system, I want to respect each source's rate limits, so that we maintain good relationships with content providers.

#### Acceptance Criteria

1. THE Source_Configuration SHALL store rate_limit_ms for each source
2. WHEN processing books from a source, THE Fetcher SHALL enforce the configured delay between requests
3. IF a source returns HTTP 429 (rate limited), THEN THE Fetcher SHALL wait for the Retry-After period before continuing
4. THE System SHALL log rate limit events for monitoring purposes
5. WHEN rate_limit_ms is not configured, THE System SHALL use a default of 1500ms

### Requirement 9: Project Gutenberg Fetcher Implementation

**User Story:** As an administrator, I want to ingest books from Project Gutenberg, so that I can expand the library's public domain collection.

#### Acceptance Criteria

1. THE Project_Gutenberg_Fetcher SHALL fetch book metadata from the Project Gutenberg catalog
2. THE Project_Gutenberg_Fetcher SHALL support filtering by language and format (epub, txt, html)
3. WHEN a book has multiple formats, THE Project_Gutenberg_Fetcher SHALL prefer epub over txt over html
4. THE Project_Gutenberg_Fetcher SHALL map Gutenberg metadata fields to the unified book schema
5. THE Project_Gutenberg_Fetcher SHALL construct download URLs using the standard Gutenberg mirror pattern

### Requirement 10: Open Library Fetcher Implementation

**User Story:** As an administrator, I want to ingest book metadata from Open Library, so that I can access their extensive catalog.

#### Acceptance Criteria

1. THE Open_Library_Fetcher SHALL fetch book metadata from the Open Library API
2. THE Open_Library_Fetcher SHALL filter results to only include books with available downloads
3. WHEN Open Library returns cover images, THE Open_Library_Fetcher SHALL include cover_url in the metadata
4. THE Open_Library_Fetcher SHALL handle pagination using Open Library's offset-based API
5. IF a book lacks downloadable content, THEN THE Open_Library_Fetcher SHALL skip it and log the reason

### Requirement 11: Standard Ebooks Fetcher Implementation

**User Story:** As an administrator, I want to ingest high-quality ebooks from Standard Ebooks, so that I can offer professionally formatted public domain books.

#### Acceptance Criteria

1. THE Standard_Ebooks_Fetcher SHALL fetch book metadata from the Standard Ebooks OPDS feed
2. THE Standard_Ebooks_Fetcher SHALL parse the OPDS/Atom XML format to extract book metadata
3. WHEN multiple download formats are available, THE Standard_Ebooks_Fetcher SHALL prefer epub over kepub over azw3
4. THE Standard_Ebooks_Fetcher SHALL extract author, title, and description from OPDS entry elements
5. THE Standard_Ebooks_Fetcher SHALL respect Standard Ebooks' request for reasonable crawling rates

### Requirement 12: Source Health Monitoring

**User Story:** As an administrator, I want to monitor the health of each source, so that I can quickly identify and respond to issues.

#### Acceptance Criteria

1. THE Health_Dashboard SHALL display health status (healthy, warning, failed) for each enabled source
2. WHEN a source has more than 5 failures in 24 hours, THE System SHALL set its status to warning
3. WHEN a source has not been successfully accessed in 48 hours, THE System SHALL set its status to warning
4. WHEN a source's last run failed completely, THE System SHALL set its status to failed
5. THE Health_Dashboard SHALL show the last successful run timestamp for each source

### Requirement 13: Source Enable/Disable Without Code Changes

**User Story:** As an administrator, I want to enable or disable sources without deploying code, so that I can respond quickly to source availability issues.

#### Acceptance Criteria

1. WHEN an administrator disables a source, THE System SHALL immediately stop including it in ingestion runs
2. WHEN an administrator enables a source, THE System SHALL include it in the next scheduled ingestion run
3. THE System SHALL not require application restart to apply source enable/disable changes
4. WHEN a source is disabled mid-run, THE System SHALL complete processing current books but not fetch new ones from that source
5. THE Admin_Panel SHALL show a confirmation dialog before disabling a source with pending books

