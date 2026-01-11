# Requirements Document

## Introduction

This feature implements a fully automated background ingestion system that continuously imports public-domain PDF books (ancient, classical, religious, philosophical, historical) from Internet Archive into the Drizaikn Digital Library System. The system runs on Vercel Cron Jobs, stores PDFs in Supabase Storage, and inserts metadata into Supabase Postgres. No frontend changes or manual uploads are required after initial deployment.

## Glossary

- **Ingestion_Service**: The Node.js backend service responsible for fetching, downloading, and storing public-domain books from Internet Archive
- **Internet_Archive_API**: The Internet Archive Advanced Search API used to query public-domain book metadata
- **Book_Record**: A database entry containing book metadata (title, author, year, language, source, source_identifier, pdf_url)
- **Ingestion_Job**: A scheduled Vercel Cron job that executes the ingestion workflow
- **Source_Identifier**: A unique identifier from Internet Archive used for deduplication
- **Supabase_Storage**: The Supabase Storage bucket ("books") where PDF files are uploaded
- **Dry_Run_Mode**: A testing mode that logs actions without performing uploads or database inserts

## Requirements

### Requirement 1: Internet Archive Integration

**User Story:** As a library administrator, I want the system to automatically fetch public-domain books from Internet Archive, so that the library catalog grows with classical, historical, and philosophical works.

#### Acceptance Criteria

1. WHEN the Ingestion_Service queries Internet_Archive_API, THE Ingestion_Service SHALL use the Advanced Search API to find public-domain works
2. WHEN querying for books, THE Ingestion_Service SHALL filter for works published before 1928 to ensure public-domain status
3. WHEN fetching book metadata, THE Ingestion_Service SHALL retrieve title, author (creator), publication year, language, and identifier
4. WHEN a book result is returned, THE Ingestion_Service SHALL construct the PDF download URL from the identifier
5. IF Internet_Archive_API is unavailable, THEN THE Ingestion_Service SHALL log the error and terminate the job gracefully

### Requirement 2: Vercel Cron Scheduling

**User Story:** As a library administrator, I want ingestion to run automatically via Vercel Cron, so that new books are added without manual intervention.

#### Acceptance Criteria

1. THE Ingestion_Service SHALL be triggered by Vercel Cron Jobs at configurable intervals (e.g., every 6 or 12 hours)
2. WHEN a scheduled Ingestion_Job starts, THE Ingestion_Service SHALL log the job start time and batch parameters
3. WHEN a scheduled Ingestion_Job completes, THE Ingestion_Service SHALL log the number of books processed, added, skipped, and failed
4. THE Ingestion_Service SHALL process a configurable batch size per run (default: 20-50 books)

### Requirement 3: Deduplication via Source Identifier

**User Story:** As a library administrator, I want the system to prevent duplicate book entries, so that the catalog remains clean even after thousands of ingestion runs.

#### Acceptance Criteria

1. WHEN processing a book, THE Ingestion_Service SHALL check if a Book_Record with the same source_identifier already exists
2. IF a duplicate source_identifier is detected, THEN THE Ingestion_Service SHALL skip the book and log the skip reason
3. THE source_identifier field SHALL have a unique constraint in the database
4. THE Ingestion_Service SHALL be idempotent - safe to re-run without creating duplicates

### Requirement 4: PDF Download and Validation

**User Story:** As a library administrator, I want only valid PDF files to be stored, so that users can reliably access downloaded books.

#### Acceptance Criteria

1. WHEN downloading a PDF, THE Ingestion_Service SHALL stream the file to avoid memory issues with large files
2. WHEN a PDF is downloaded, THE Ingestion_Service SHALL validate that the file exists and is not empty
3. IF a PDF download fails or returns an empty file, THEN THE Ingestion_Service SHALL skip the book and log the error
4. WHEN constructing filenames, THE Ingestion_Service SHALL sanitize special characters to create safe storage paths

### Requirement 5: Supabase Storage Upload

**User Story:** As a library administrator, I want PDFs stored in Supabase Storage, so that they are accessible via the existing library infrastructure.

#### Acceptance Criteria

1. WHEN uploading a PDF, THE Ingestion_Service SHALL upload to the "books" bucket in Supabase Storage
2. WHEN uploading a PDF, THE Ingestion_Service SHALL use a structured path (e.g., "internet_archive/{identifier}.pdf")
3. THE Ingestion_Service SHALL never overwrite existing storage objects
4. WHEN upload completes, THE Ingestion_Service SHALL store the public URL in the Book_Record

### Requirement 6: Database Integration

**User Story:** As a library administrator, I want ingested books stored in the database, so that they appear in the library catalog immediately.

#### Acceptance Criteria

1. WHEN inserting a Book_Record, THE Ingestion_Service SHALL populate: id, title, author, year, language, source, source_identifier, pdf_url, created_at
2. THE source field SHALL be set to "internet_archive" for all books from this source
3. IF database insertion fails, THEN THE Ingestion_Service SHALL log the error with book details and continue processing remaining books
4. THE Ingestion_Service SHALL use transactions where appropriate to ensure data consistency

### Requirement 7: Error Handling and Resilience

**User Story:** As a library administrator, I want the system to be resilient to failures, so that one bad book doesn't stop the entire ingestion process.

#### Acceptance Criteria

1. IF one book fails during processing, THEN THE Ingestion_Service SHALL continue with the remaining books in the batch
2. WHEN an error occurs, THE Ingestion_Service SHALL log the error with sufficient detail for debugging
3. THE Ingestion_Service SHALL implement retry logic for transient failures (network timeouts, rate limits)
4. THE Ingestion_Service SHALL never crash the entire job due to a single book failure

### Requirement 8: Rate Limiting and Respectful Crawling

**User Story:** As a responsible API consumer, I want the system to respect Internet Archive rate limits, so that we maintain access to the service.

#### Acceptance Criteria

1. THE Ingestion_Service SHALL implement delays between API requests (configurable, default: 1-2 seconds)
2. WHEN a rate limit response is received, THE Ingestion_Service SHALL pause and retry after an appropriate delay
3. THE Ingestion_Service SHALL include a descriptive User-Agent header identifying the library system
4. THE Ingestion_Service SHALL limit concurrent downloads to avoid overwhelming the source

### Requirement 9: Manual Trigger and Dry Run

**User Story:** As a library administrator, I want to manually trigger ingestion and test without side effects, so that I can verify the system works correctly.

#### Acceptance Criteria

1. THE Ingestion_Service SHALL expose an API endpoint for manual ingestion triggers
2. WHEN manual trigger is called, THE Ingestion_Service SHALL accept optional parameters for batch size and dry-run mode
3. WHEN Dry_Run_Mode is enabled, THE Ingestion_Service SHALL log all actions without uploading files or inserting database records
4. THE manual trigger endpoint SHALL return job status including books processed, added, skipped, and failed

### Requirement 10: Logging and Observability

**User Story:** As a library administrator, I want clear logging output, so that I can monitor ingestion via Vercel logs.

#### Acceptance Criteria

1. THE Ingestion_Service SHALL log job start and end times with summary statistics
2. WHEN processing each book, THE Ingestion_Service SHALL log the title and outcome (added, skipped, failed)
3. WHEN errors occur, THE Ingestion_Service SHALL log error messages with stack traces where appropriate
4. THE Ingestion_Service SHALL use structured logging format compatible with Vercel logs

### Requirement 11: Preserve Existing Admin Functionality

**User Story:** As a library administrator, I want to retain my ability to manually upload PDF books, so that I can add books that are not available from automated sources.

#### Acceptance Criteria

1. THE Ingestion_Service SHALL NOT modify or interfere with existing admin manual upload functionality
2. THE Ingestion_Service SHALL NOT alter existing database schema fields used by manual uploads
3. WHEN adding new database fields for ingestion tracking (source, source_identifier), THE Ingestion_Service SHALL make them nullable to support manually uploaded books
4. THE existing AdminPanel and ExtractionPanel components SHALL remain fully functional after deployment
