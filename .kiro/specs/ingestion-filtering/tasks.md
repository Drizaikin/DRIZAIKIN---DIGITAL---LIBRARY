# Implementation Plan: Ingestion Filtering

## Overview

This implementation plan adds genre and author filtering to the book ingestion pipeline, and unifies the category/genre concepts. The plan follows a phased approach: category sync → filter implementation → bulk update → admin UI → integration.

## Tasks

- [x] 1. Implement Category Sync in Database Writer
  - Update `services/ingestion/databaseWriter.js`
  - Add `syncCategory()` helper function
  - Update `insertBook()` to auto-sync category with first genre
  - Set category to "Uncategorized" when genres array is empty
  - Ensure backward compatibility (both category and genres fields maintained)
  - _Requirements: 5.4.1, 5.4.2, 5.4.4, 5.4.5_

- [x] 1.1 Write unit tests for category sync
  - Test category sync with 1, 2, 3 genres
  - Test "Uncategorized" default for empty genres
  - Test category sync during book insertion
  - _Requirements: 5.4.1, 5.4.5_

- [x] 1.2 Write property test for category sync
  - **Property 12: Category Sync with First Genre**
  - **Property 13: Uncategorized Default**
  - **Validates: Requirements 5.4.1, 5.4.2, 5.4.5, 5.5.3**

- [x] 2. Create Ingestion Filter Module
  - Create `services/ingestion/ingestionFilter.js`
  - Implement `loadFilterConfig()` to read from environment variables
  - Implement `checkGenreFilter()` for genre filtering logic
  - Implement `checkAuthorFilter()` for author filtering logic
  - Implement `applyFilters()` to combine all filters
  - Implement `logFilterDecision()` for audit logging
  - Support case-insensitive author matching
  - Support partial author name matching
  - _Requirements: 5.1.1-5.1.7, 5.2.1-5.2.7_

- [x] 2.1 Write unit tests for filter module
  - Test genre filter with various configurations
  - Test author filter with case variations
  - Test partial author name matching
  - Test empty filter lists (allow all)
  - Test filter logging

- [x] 2.2 Write property test for genre filter correctness
  - **Property 1: Genre Filter Correctness**
  - **Property 2: Empty Genre Filter Allows All**
  - **Validates: Requirements 5.1.2, 5.1.3, 5.6.2**

- [x] 2.3 Write property test for author filter correctness
  - **Property 3: Author Filter Correctness**
  - **Property 4: Empty Author Filter Allows All**
  - **Validates: Requirements 5.2.2, 5.2.3, 5.2.5, 5.2.6, 5.6.3**

- [x] 2.4 Write property test for genre taxonomy validation
  - **Property 5: Genre Taxonomy Validation**
  - **Validates: Requirements 5.1.5**

- [x] 2.5 Write property test for filter audit logging
  - **Property 6: Filter Audit Logging**
  - **Validates: Requirements 5.1.7, 5.2.7, 5.6.4, 5.7.5**

- [x] 3. Integrate Filters into Orchestrator
  - Update `services/ingestion/orchestrator.js`
  - Import ingestionFilter module
  - Load filter configuration at job start
  - Apply filters after AI classification, before PDF download
  - Handle filter results (skip book if filtered)
  - Track filter statistics (passed, filtered by genre, filtered by author)
  - Update job result to include filter statistics
  - _Requirements: 5.6.1-5.6.6, 5.7.1-5.7.3_

- [x] 3.1 Write integration tests for filter integration
  - Test filter application in orchestrator flow
  - Test filters applied before PDF download
  - Test filter statistics tracking
  - Test dry run mode with filters

- [x] 3.2 Write property test for filter application order
  - **Property 16: Filter Application Before PDF Download**
  - **Validates: Requirements 5.6.6**

- [x] 3.3 Write property test for combined filter logic
  - **Property 17: Combined Filter Logic**
  - **Validates: Requirements 5.6.2, 5.6.3, 5.6.5**

- [x] 3.4 Write property test for filter statistics accuracy
  - **Property 18: Filter Statistics Accuracy**
  - **Validates: Requirements 5.7.1, 5.7.2, 5.7.3**

- [x] 4. Checkpoint - Test Filter Implementation
  - Ensure all tests pass
  - Test ingestion with various filter configurations
  - Verify filters work correctly
  - Verify category sync works
  - Test with empty filter lists (allow all)
  - Ask the user if questions arise

- [x] 5. Create Bulk Category Update Script
  - Create `services/ingestion/bulkCategoryUpdate.js`
  - Implement `updateAllCategories()` function
  - Fetch all books with genres from database
  - Update each book's category to match first genre
  - Set "Uncategorized" for books without genres
  - Handle errors gracefully (continue on error)
  - Provide progress feedback every 100 books
  - Log summary (updated count, error count)
  - _Requirements: 5.5.1-5.5.6_

- [x] 5.1 Write unit tests for bulk update
  - Test update with sample books
  - Test error handling
  - Test progress tracking
  - _Requirements: 5.5.4, 5.5.6_

- [x] 5.2 Write property test for bulk update category sync
  - **Property 14: Bulk Update Category Sync**
  - **Validates: Requirements 5.5.2, 5.5.3**

- [x] 5.3 Write property test for bulk update error resilience
  - **Property 15: Bulk Update Error Resilience**
  - **Validates: Requirements 5.5.5**

- [x] 6. Run Bulk Category Update
  - Create API endpoint or CLI script to trigger bulk update
  - Run bulk update on production database
  - Monitor progress and errors
  - Verify all books updated correctly
  - Check that categories match first genres
  - _Requirements: 5.5.1-5.5.6_

- [x] 7. Create Filter Configuration API
  - Create `api/admin/ingestion/filters.js`
  - Implement GET endpoint to retrieve current configuration
  - Implement POST endpoint to update configuration
  - Validate genre names against taxonomy
  - Validate author names are non-empty strings
  - Store configuration in database or environment
  - Require admin authentication
  - _Requirements: 5.8.5_

- [x] 7.1 Write unit tests for configuration API
  - Test GET endpoint returns configuration
  - Test POST endpoint saves configuration
  - Test validation rejects invalid genres
  - Test authentication requirement

- [x] 7.2 Write property test for configuration validation
  - **Property 19: Configuration Validation**
  - **Validates: Requirements 5.8.5**

- [x] 8. Create Filter Statistics API
  - Create `api/admin/ingestion/filter-stats.js`
  - Implement GET endpoint to retrieve filter statistics
  - Query ingestion_filter_stats table or compute from logs
  - Return total evaluated, passed, filtered counts
  - Return top filtered genres and authors
  - Require admin authentication
  - _Requirements: 5.7.4, 5.7.6_

- [x] 8.1 Write unit tests for statistics API
  - Test statistics calculation
  - Test with various filter results
  - Test authentication requirement
  - _Requirements: 5.7.4, 5.7.6_

- [x] 9. Create Ingestion Filters Panel Component
  - Create `components/IngestionFiltersPanel.tsx`
  - Add multi-select dropdown for genres (populated from taxonomy)
  - Add text input for authors (comma-separated)
  - Add enable/disable toggles for each filter type
  - Add "Save Configuration" button
  - Add "Clear All Filters" button
  - Display current filter configuration
  - Display filter statistics from recent runs
  - Validate configuration before saving
  - Show success/error messages
  - _Requirements: 5.8.1-5.8.7_

- [x] 9.1 Write unit tests for Ingestion Filters Panel
  - Test component renders correctly
  - Test genre dropdown populated from taxonomy
  - Test author input accepts comma-separated values
  - Test save button triggers API call
  - Test clear button resets configuration
  - Test validation errors displayed
  - _Requirements: 5.8.1-5.8.7_

- [x] 10. Integrate Filters Panel into Admin Dashboard
  - Update `components/AdminPanel.tsx` or admin dashboard
  - Add "Ingestion Filters" section
  - Include IngestionFiltersPanel component
  - Add navigation/tab for filters
  - Ensure proper layout and styling
  - _Requirements: 5.8.1_

- [x] 10.1 Write integration tests for admin panel
  - Test filters panel accessible from admin dashboard
  - Test navigation to filters section
  - Test panel displays correctly
  - _Requirements: 5.8.1_

- [x] 11. Checkpoint - Test UI and APIs
  - Ensure all tests pass
  - Manually test filter configuration UI
  - Test saving and loading configurations
  - Test filter statistics display
  - Verify API authentication works
  - Ask the user if questions arise

- [x] 12. Add Environment Variable Support
  - Document environment variables in README
  - Add example .env configuration
  - Test loading configuration from environment
  - Test fallback to database configuration
  - _Requirements: 5.1.6_

- [x] 12.1 Write unit tests for environment variable loading
  - Test loading from environment variables
  - Test fallback behavior
  - Test invalid environment values
  - _Requirements: 5.1.6_

- [x] 13. Create Filter Statistics Database Table (Optional)
  - Create migration for `ingestion_filter_stats` table
  - Add indexes for efficient querying
  - Update filter logging to write to table
  - Update statistics API to query table
  - _Requirements: 5.7.5_

- [x] 14. Test AI Classification Integration
  - Verify AI classification still works with filters
  - Test that classification happens before filtering
  - Test non-blocking behavior (classification failures don't stop ingestion)
  - Test that books without genres are handled correctly
  - _Requirements: 5.3.1-5.3.6, 5.6.1_

- [x] 14.1 Write property tests for AI classification
  - **Property 7: AI Classification Input Completeness**
  - **Property 8: Genre Count Bounds**
  - **Property 9: Sub-Genre Count Bounds**
  - **Property 10: Genre Storage Persistence**
  - **Property 11: Non-Blocking Classification**
  - **Validates: Requirements 5.3.1-5.3.6**

- [x] 15. End-to-End Integration Testing
  - Test complete ingestion flow withc filters enabled
  - Test with genre filter only
  - Test with author filter only
  - Test with both filters enabled
  - Test with no filters (allow all)
  - Verify filtered books are skipped
  - Verify passed books are ingested
  - Verify category sync works
  - Verify filter statistics are accurate
  - Test dry run mode with filters

- [x] 16. Performance Testing
  - Measure filter overhead per book (<100ms target)
  - Measure bulk update performance (>100 books/sec target)
  - Test with large filter configurations
  - Test with many books
  - Verify no performance degradation

- [x] 17. Documentation
  - Update README with filter configuration instructions
  - Document environment variables
  - Document API endpoints
  - Add examples of common filter configurations
  - Document bulk category update process
  - Add troubleshooting guide

- [x] 18. Final Checkpoint
  - Ensure all tests pass (unit and property-based)
  - Verify all requirements are met
  - Check performance metrics
  - Review error handling
  - Test with production-like data
  - Ask the user if ready for deployment

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end flows
- All testing tasks are required for comprehensive coverage
- Implementation uses JavaScript to match existing ingestion system
