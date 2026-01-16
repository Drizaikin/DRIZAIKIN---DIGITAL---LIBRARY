# Implementation Plan: Admin Book Management

## Overview

This implementation plan breaks down the Admin Book Management feature into discrete coding tasks. The feature provides administrators with tools to view, edit, search, and manage books in the digital library, including AI-powered search and manual ingestion capabilities.

## Tasks

- [x] 1. Database schema and migrations
  - [x] 1.1 Create book_audit_log table migration
    - Create `supabase_book_audit_log.sql` with table definition
    - Add indexes for book_id and created_at
    - Add RLS policies for admin access
    - _Requirements: 2.7, 6.5_

  - [x] 1.2 Create ingestion_queue table migration
    - Create `supabase_ingestion_queue.sql` with table definition
    - Add unique constraint on (identifier, source)
    - Add indexes for status and queued_at
    - Add RLS policies for admin access
    - _Requirements: 5.2, 5.3_

  - [x] 1.3 Add source tracking columns to books table
    - Create migration to add `source`, `source_identifier`, and `access_type` columns
    - Update existing books to have source='internet_archive' and access_type='public_domain'
    - _Requirements: 1.2, 4.4, 9.5, 10.6_

- [x] 2. Book Management Service Layer
  - [x] 2.1 Create bookManagementService.js
    - Implement `listBooks()` with pagination, filtering, and sorting
    - Implement `getBookById()` for single book retrieval
    - Implement `updateBook()` with validation
    - Implement `deleteBook()` with asset cleanup
    - _Requirements: 1.1, 1.4, 1.5, 2.3, 6.3, 6.4_

  - [x] 2.2 Write property test for pagination consistency

    - **Property 1: Pagination Consistency**
    - **Validates: Requirements 1.1, 1.7**

  - [x] 2.3 Write property test for sort order correctness

    - **Property 2: Sort Order Correctness**
    - **Validates: Requirements 1.4**

  - [x] 2.4 Write property test for filter accuracy

    - **Property 3: Filter Accuracy**
    - **Validates: Requirements 1.5, 1.6**

  - [x] 2.5 Implement audit logging service
    - Create `auditLogService.js` with `logAction()` function
    - Support create, update, delete actions
    - Store changes as JSONB diff
    - _Requirements: 2.7, 6.5_

  - [x] 2.6 Write property test for audit log completeness

    - **Property 6: Audit Log Completeness**
    - **Validates: Requirements 2.7, 6.5**

- [x] 3. Book CRUD API Endpoints
  - [x] 3.1 Create GET /api/admin/books endpoint
    - Implement pagination with page and pageSize params
    - Implement filtering by category, genre, source, date range
    - Implement search by title, author, ISBN
    - Implement sorting by title, author, date, category
    - Add admin authentication check
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 8.3_

  - [x] 3.2 Create PUT /api/admin/books/[id] endpoint
    - Validate input data (genre from taxonomy, required fields)
    - Update book record in database
    - Create audit log entry
    - Return updated book
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 3.3 Write property test for update round-trip
    - **Property 4: Update Round-Trip**
    - **Validates: Requirements 2.3**

  - [ ]* 3.4 Write property test for invalid update rejection
    - **Property 5: Invalid Update Rejection**
    - **Validates: Requirements 2.4, 2.5**

  - [x] 3.5 Create DELETE /api/admin/books/[id] endpoint
    - Display confirmation requirement in response
    - Delete book record from database
    - Delete associated PDF from storage
    - Delete associated cover from storage
    - Create audit log entry
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 3.6 Write property test for deletion completeness
    - **Property 12: Deletion Completeness**
    - **Validates: Requirements 6.3, 6.4, 6.5**

  - [ ]* 3.7 Write property test for deletion failure resilience
    - **Property 13: Deletion Failure Resilience**
    - **Validates: Requirements 6.6**

- [x] 4. Checkpoint - Core CRUD functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Cover Management
  - [x] 5.1 Create cover upload service
    - Implement image format validation (JPEG, PNG, WebP)
    - Implement image resizing to standard dimensions
    - Implement Supabase storage upload
    - _Requirements: 3.2, 3.3_

  - [ ]* 5.2 Write property test for image format validation
    - **Property 7: Image Format Validation**
    - **Validates: Requirements 3.2**

  - [x] 5.3 Create POST /api/admin/books/[id]/cover endpoint
    - Handle multipart file upload
    - Handle URL-based cover update
    - Validate URL accessibility for URL-based updates
    - Update book record with new cover URL
    - _Requirements: 3.1, 3.4, 3.5_

  - [ ]* 5.4 Write property test for cover update persistence
    - **Property 8: Cover Update Persistence**
    - **Validates: Requirements 3.3, 3.5**

  - [ ]* 5.5 Write property test for cover failure resilience
    - **Property 9: Cover Failure Resilience**
    - **Validates: Requirements 3.6**

- [x] 6. AI Book Search Service
  - [x] 6.1 Create aiBookSearchService.js
    - Implement Internet Archive search query
    - Implement Open Library search query
    - Implement Google Books search query
    - Implement AI-powered relevance ranking using OpenRouter
    - Check for existing books in library (duplicate detection)
    - Apply configured genre/author filters
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 9.1_

  - [x] 6.2 Create multi-source fetcher modules
    - Create `openLibraryFetcher.js` for Open Library API
    - Create `googleBooksFetcher.js` for Google Books API
    - Implement metadata normalization for each source
    - _Requirements: 9.1, 9.3_

  - [ ]* 6.3 Write property test for duplicate detection
    - **Property 10: Duplicate Detection**
    - **Validates: Requirements 4.4**

  - [ ]* 6.4 Write property test for multi-source metadata normalization
    - **Property 16: Multi-Source Metadata Normalization**
    - **Validates: Requirements 9.3, 9.5**

  - [ ]* 6.5 Write property test for source preference
    - **Property 17: Source Preference for Duplicates**
    - **Validates: Requirements 9.4**

  - [x] 6.6 Create POST /api/admin/books/search endpoint
    - Accept search criteria (query, topic, author, year range, genre, sources, accessType)
    - Query multiple sources in parallel
    - Return ranked results with relevance scores and source breakdown
    - Mark books already in library
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 9.1, 9.6, 10.2_

  - [ ]* 6.7 Write property test for year range filter accuracy
    - **Property 19: Year Range Filter Accuracy**
    - **Validates: Requirements 10.2**

- [x] 7. Manual Ingestion
  - [x] 7.1 Create manualIngestionService.js
    - Implement queue management (add, process, status)
    - Integrate with existing Ingestion_Service pipeline
    - Apply AI genre classification to ingested books
    - Determine and set access_type based on publication year and licensing
    - _Requirements: 5.2, 5.3, 5.6, 10.4, 10.5, 10.6_

  - [ ]* 7.2 Write property test for ingestion queue integrity
    - **Property 11: Ingestion Queue Integrity**
    - **Validates: Requirements 5.2, 5.5**

  - [ ]* 7.3 Write property test for access type classification
    - **Property 18: Access Type Classification**
    - **Validates: Requirements 10.4, 10.5, 10.6**

  - [x] 7.4 Create POST /api/admin/books/ingest endpoint
    - Accept array of book identifiers with source
    - Queue books for ingestion
    - Skip duplicates and report status
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [x] 8. Checkpoint - Search and Ingestion
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Bulk Operations
  - [x] 9.1 Create POST /api/admin/books/bulk endpoint
    - Implement bulk category update
    - Implement bulk genre update
    - Implement bulk deletion with confirmation
    - Return detailed results for each book
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 9.2 Write property test for bulk operation atomicity
    - **Property 14: Bulk Operation Atomicity**
    - **Validates: Requirements 7.3, 7.4, 7.5**

- [x] 10. Authorization Middleware
  - [x] 10.1 Create admin authentication middleware
    - Verify admin secret from request headers
    - Validate admin session
    - Return 401 for unauthorized requests
    - _Requirements: 8.3, 8.4, 8.5_

  - [x]* 10.2 Write property test for authorization enforcement
    - **Property 15: Authorization Enforcement**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

- [x] 11. Frontend Components
  - [x] 11.1 Create BookManagementPanel component
    - Main container with state management
    - Tab navigation for list view and search
    - Integration with all child components
    - _Requirements: 1.1_

  - [x] 11.2 Create BookListView component
    - Paginated table with book data
    - Sortable columns (title, author, date, category)
    - Filter controls (category, genre, source, date range)
    - Search input for title/author/ISBN
    - Checkbox selection for bulk operations
    - Display total and filtered counts
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 11.3 Create BookEditModal component
    - Form with all editable fields
    - Genre dropdown from taxonomy
    - Validation with error display
    - Success/error notifications
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6_

  - [x] 11.4 Create CoverUploadModal component
    - File upload with drag-and-drop
    - URL input option
    - Image preview
    - Upload progress indicator
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 11.5 Create AIBookSearch component
    - Search form with criteria inputs (query, topic, author, year range, genre)
    - Source selection checkboxes (Internet Archive, Open Library, Google Books)
    - Access type filter (public domain, open access, preview only)
    - Results display with relevance scores and source indicators
    - Duplicate indicators
    - Multi-select for ingestion
    - Ingestion confirmation dialog
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 9.1, 9.6, 10.2, 10.3_

  - [x] 11.6 Create BulkActionsBar component
    - Appears when books are selected
    - Category update button with dropdown
    - Genre update button with dropdown
    - Delete button with confirmation
    - Progress indicator for operations
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 12. Admin Panel Integration
  - [x] 12.1 Add Book Management route to AdminRoutes
    - Add route for /admin/books
    - Add navigation link in admin panel
    - Ensure AdminGuard protection
    - _Requirements: 8.1, 8.2_

  - [x] 12.2 Update vercel.json for new API routes
    - Add build entries for all new API endpoints
    - Add route entries for API paths
    - _Requirements: 3.1, 3.2, 3.5, 5.3, 6.3, 7.3, 9.1_

- [x] 13. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all API endpoints are accessible
  - Test full workflow: list, edit, delete, search, ingest

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript for frontend and JavaScript for API endpoints (matching existing codebase)
