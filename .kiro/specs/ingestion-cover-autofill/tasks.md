# Implementation Plan: Ingestion Cover Autofill

## Overview

This implementation plan breaks down the ingestion cover autofill feature into discrete coding tasks. The approach follows an incremental strategy: build core services first, integrate into the ingestion pipeline, add the notification system, and finally implement the admin UI.

## Tasks

- [ ] 1. Database schema and migration
  - Create `supabase_cover_autofill.sql` migration script
  - Define `cover_search_failures` table with all required columns
  - Create indexes for status, book_id, and created_at
  - Add RLS policies for SELECT, INSERT, and UPDATE
  - _Requirements: 4.4_

- [ ] 2. Implement Cover Search Service
  - [ ] 2.1 Create `services/ingestion/coverSearchService.js`
    - Implement `searchCoverWithRetry` function
    - Add retry logic with configurable max retries and delay
    - Classify errors as retryable (network) vs non-retryable (no cover found)
    - Return structured result with success, coverUrl, source, attempts, and error
    - _Requirements: 4.1, 4.2_

  - [ ]* 2.2 Write property test for retry behavior
    - **Property 2: Retry Behavior**
    - **Validates: Requirements 4.2**

  - [ ]* 2.3 Write property test for retry logging
    - **Property 3: Retry Attempt Logging**
    - **Validates: Requirements 4.2**

  - [ ]* 2.4 Write unit tests for error classification
    - Test network errors trigger retries
    - Test "no cover found" does not trigger retries
    - Test early termination on success
    - _Requirements: 4.2_

- [ ] 3. Implement Notification Service
  - [ ] 3.1 Create `services/ingestion/notificationService.js`
    - Implement `createCoverFailureNotification` function
    - Implement `resolveNotification` function
    - Implement `getUnresolvedNotifications` function
    - Initialize Supabase client for database operations
    - _Requirements: 4.4, 4.5_

  - [ ]* 3.2 Write property test for notification completeness
    - **Property 6: Notification Completeness**
    - **Validates: Requirements 4.4**

  - [ ]* 3.3 Write property test for notification resolution
    - **Property 7: Notification Resolution**
    - **Validates: Requirements 4.4**

  - [ ]* 3.4 Write property test for unresolved query
    - **Property 8: Unresolved Notification Query**
    - **Validates: Requirements 4.5**

  - [ ]* 3.5 Write property test for notification count accuracy
    - **Property 9: Notification Count Accuracy**
    - **Validates: Requirements 4.5**

- [ ] 4. Integrate cover search into ingestion orchestrator
  - [ ] 4.1 Modify `services/ingestion/orchestrator.js`
    - Import coverSearchService and notificationService
    - Add Step 7: Cover search with retry (after AI description, before database insert)
    - Pass cover_url to insertBook if found
    - Create notification if cover search fails after book insert
    - Update job result to track cover search metrics (success/failed/skipped)
    - Ensure cover search errors don't block ingestion
    - _Requirements: 4.1, 4.2, 4.8_

  - [ ]* 4.2 Write property test for cover search invocation
    - **Property 1: Cover Search Invocation**
    - **Validates: Requirements 4.1**

  - [ ]* 4.3 Write property test for non-blocking ingestion
    - **Property 14: Non-Blocking Ingestion**
    - **Validates: Requirements 4.8**

  - [ ]* 4.4 Write property test for error isolation
    - **Property 15: Cover Search Error Isolation**
    - **Validates: Requirements 4.8**

  - [ ]* 4.5 Write property test for job summary accuracy
    - **Property 16: Job Summary Accuracy**
    - **Validates: Requirements 4.8**

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Admin API endpoints
  - [ ] 6.1 Create `api/admin/cover-notifications.js`
    - Implement GET /api/admin/cover-notifications endpoint
    - Implement POST /api/admin/cover-notifications/:id/resolve endpoint
    - Implement POST /api/admin/cover-notifications/:id/retry endpoint
    - Implement POST /api/admin/bulk-regenerate-covers endpoint
    - Add authorization checks (admin only)
    - _Requirements: 4.5, 4.6, 4.7_

  - [ ]* 6.2 Write property test for manual retry consistency
    - **Property 10: Manual Retry Consistency**
    - **Validates: Requirements 4.6**

  - [ ]* 6.3 Write property test for bulk regeneration filtering
    - **Property 11: Bulk Regeneration Filtering**
    - **Validates: Requirements 4.7**

  - [ ]* 6.4 Write property test for bulk regeneration batching
    - **Property 12: Bulk Regeneration Batching**
    - **Validates: Requirements 4.7**

  - [ ]* 6.5 Write property test for bulk regeneration notifications
    - **Property 13: Bulk Regeneration Notifications**
    - **Validates: Requirements 4.7**

  - [ ]* 6.6 Write unit tests for API endpoints
    - Test authorization checks
    - Test error handling
    - Test response formats
    - _Requirements: 4.5, 4.6, 4.7_

- [ ] 7. Implement Admin UI components
  - [ ] 7.1 Create `components/admin/CoverNotificationsPanel.tsx`
    - Display list of unresolved notifications
    - Show book title, author, failure reason, timestamp
    - Add "Retry" button for each notification
    - Add "Resolve" button for each notification
    - Add "Bulk Regenerate" button
    - Show count of unresolved notifications
    - Make notifications clickable to open book edit modal
    - _Requirements: 4.5, 4.6, 4.7_

  - [ ] 7.2 Integrate CoverNotificationsPanel into AdminPanel
    - Add new tab/section for "Cover Notifications"
    - Wire up API calls to backend endpoints
    - Add loading states and error handling
    - _Requirements: 4.5_

  - [ ]* 7.3 Write unit tests for UI components
    - Test notification list rendering
    - Test button click handlers
    - Test loading and error states
    - _Requirements: 4.5, 4.6, 4.7_

- [ ] 8. Add cover validation (optional enhancement)
  - [ ] 8.1 Create `services/ingestion/coverValidator.js`
    - Implement placeholder detection logic
    - Implement title matching algorithm (50% threshold)
    - Return validation result with pass/fail and reason
    - _Requirements: 4.3_

  - [ ] 8.2 Integrate validator into coverSearchService
    - Call validator before returning cover URL
    - Treat validation failures as "no cover found"
    - Log validation failures with reason
    - _Requirements: 4.3_

  - [ ]* 8.3 Write property test for cover validation
    - **Property 4: Cover Validation**
    - **Validates: Requirements 4.3**

  - [ ]* 8.4 Write property test for validation failure handling
    - **Property 5: Validation Failure Handling**
    - **Validates: Requirements 4.3**

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Integration testing and final wiring
  - [ ] 10.1 Run database migration
    - Execute `supabase_cover_autofill.sql` in Supabase SQL Editor
    - Verify table and indexes are created
    - Verify RLS policies are active
    - _Requirements: 4.4_

  - [ ] 10.2 Test end-to-end ingestion flow
    - Run ingestion with cover search enabled
    - Verify covers are found and attached
    - Verify notifications are created for failures
    - Verify job summary includes cover metrics
    - _Requirements: 4.1, 4.2, 4.4, 4.8_

  - [ ]* 10.3 Write integration tests
    - Test complete ingestion flow with cover search
    - Test manual retry flow from admin UI
    - Test bulk regeneration flow
    - _Requirements: 4.1, 4.5, 4.6, 4.7_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Cover validation (Task 8) is marked as optional enhancement but recommended for production quality
