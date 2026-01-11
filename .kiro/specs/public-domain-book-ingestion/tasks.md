# Implementation Plan: Public Domain Book Ingestion

## Overview

This implementation plan creates a fully automated background ingestion system for public-domain PDF books from Internet Archive. The system uses Vercel Cron Jobs for scheduling, Supabase Storage for PDFs, and Supabase Postgres for metadata.

## Tasks

- [x] 1. Database schema setup
  - [x] 1.1 Create SQL migration file for schema changes
    - Add nullable columns to books table: source, source_identifier, pdf_url, language
    - Create unique index on source_identifier (WHERE NOT NULL)
    - Create ingestion_logs table for job tracking
    - _Requirements: 6.1, 11.2, 11.3_
  - [x] 1.2 Write property test for schema nullability
    - **Property 8: New Schema Fields Are Nullable**
    - **Validates: Requirements 11.3**

- [x] 2. Implement core ingestion services
  - [x] 2.1 Create Internet Archive Fetcher service
    - Implement fetchBooks() with Advanced Search API query
    - Implement getPdfUrl() for URL construction
    - Add configurable batch size and pagination
    - Include User-Agent header and rate limiting delays
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 8.3_
  - [x] 2.2 Write property test for PDF URL construction
    - **Property 1: PDF URL Construction**
    - **Validates: Requirements 1.4**
  - [x] 2.3 Create Deduplication Engine service
    - Implement bookExists() to check source_identifier
    - Implement filterNewBooks() for batch deduplication
    - _Requirements: 3.1, 3.2_
  - [x] 2.4 Create PDF Validator service
    - Implement downloadAndValidate() with streaming
    - Implement sanitizeFilename() for safe paths
    - Validate PDF header bytes and non-empty content
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 2.5 Write property test for filename sanitization
    - **Property 2: Filename Sanitization Produces Safe Paths**
    - **Validates: Requirements 4.4, 5.2**
  - [x] 2.6 Write property test for PDF validation
    - **Property 7: Empty or Invalid PDFs Are Rejected**
    - **Validates: Requirements 4.2, 4.3**

- [x] 3. Implement storage and database services
  - [x] 3.1 Create Storage Uploader service
    - Implement uploadPdf() to Supabase Storage "books" bucket
    - Implement fileExists() to prevent overwrites
    - Use structured path: internet_archive/{identifier}.pdf
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 3.2 Create Database Writer service
    - Implement insertBook() with all required fields
    - Implement logJobResult() for ingestion tracking
    - Set source to "internet_archive" for all ingested books
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 4. Checkpoint - Verify core services
  - Ensure all services compile without errors
  - Run existing tests to verify no regressions
  - Ask the user if questions arise

- [x] 5. Implement orchestrator and error handling
  - [x] 5.1 Create Ingestion Orchestrator service
    - Implement runIngestionJob() coordinating all services
    - Add dry-run mode support
    - Implement error handling with continue-on-failure
    - Track processed, added, skipped, failed counts
    - _Requirements: 2.3, 7.1, 7.4, 9.3_
  - [x] 5.2 Write property test for job result completeness
    - **Property 5: Job Result Contains All Required Counts**
    - **Validates: Requirements 2.3, 9.4**
  - [x] 5.3 Write property test for resilience
    - **Property 6: Resilience - Single Failure Doesn't Stop Batch**
    - **Validates: Requirements 7.1, 7.4**
  - [x] 5.4 Write property test for dry run
    - **Property 4: Dry Run Has No Side Effects**
    - **Validates: Requirements 9.3**

- [x] 6. Implement API routes
  - [x] 6.1 Create cron endpoint at api/ingest/index.js
    - Handle GET requests from Vercel Cron
    - Call orchestrator with default batch size
    - Return job summary
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 6.2 Create manual trigger endpoint at api/ingest/trigger.js
    - Handle POST requests with optional parameters
    - Support batchSize and dryRun options
    - Return job ID and status
    - _Requirements: 9.1, 9.2, 9.4_

- [x] 7. Checkpoint - Test API routes
  - Test manual trigger endpoint with dry-run mode
  - Verify logging output format
  - Ask the user if questions arise

- [x] 8. Configure Vercel Cron
  - [x] 8.1 Update vercel.json with cron configuration
    - Add cron job for /api/ingest endpoint
    - Set schedule to every 6 hours
    - _Requirements: 2.1_

- [x] 9. Implement idempotency testing
  - [x] 9.1 Write property test for idempotency
    - **Property 3: Idempotency - Re-running Produces No Duplicates**
    - **Validates: Requirements 3.1, 3.2, 3.4**

- [x] 10. Integration testing and verification
  - [x] 10.1 Write integration test for end-to-end flow
    - Mock Internet Archive API responses
    - Verify complete pipeline execution
    - Validate database state after run
    - _Requirements: 1.1-1.5, 5.1-5.4, 6.1-6.3_
  - [x] 10.2 Write integration test for existing functionality preservation
    - Verify admin manual upload still works
    - Verify existing books are unaffected
    - _Requirements: 11.1, 11.2, 11.4_

- [x] 11. Final checkpoint - Complete verification
  - Run all tests to ensure everything passes
  - Verify dry-run mode works correctly
  - Test manual trigger API endpoint
  - Ensure all tests pass, ask the user if questions arise

## Notes

- All tasks are required for comprehensive testing
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The system is designed to be idempotent and resilient to failures
- Existing admin upload functionality is preserved through nullable schema fields
