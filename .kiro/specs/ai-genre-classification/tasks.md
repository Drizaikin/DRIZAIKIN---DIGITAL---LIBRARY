# Implementation Plan: AI Genre Classification

## Overview

This implementation plan adds AI-powered genre classification to the existing book ingestion system. The classifier uses OpenRouter API to analyze book metadata and assign genres from a strict controlled taxonomy. The system is designed to be non-blocking, cost-effective, and testable.

## Tasks

- [x] 1. Create genre taxonomy module
  - [x] 1.1 Create genreTaxonomy.js with PRIMARY_GENRES and SUB_GENRES arrays
    - Define all 27 primary genres
    - Define all 9 sub-genres
    - Export validateGenres() and validateSubgenre() functions
    - Implement case-insensitive matching
    - _Requirements: 2.1, 2.2, 2.5, 8.1_
  - [x] 1.2 Write property test for taxonomy validation

    - **Property 1: Taxonomy Enforcement**
    - **Validates: Requirements 2.1, 2.2, 2.5**

- [x] 2. Create genre classifier service
  - [x] 2.1 Create genreClassifier.js with AI integration
    - Implement classifyBook() function
    - Implement buildPrompt() with taxonomy
    - Implement parseResponse() with validation
    - Add timeout and retry logic
    - Use OPENROUTER_API_KEY from environment
    - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2_
  - [x] 2.2 Write property test for genre count bounds

    - **Property 2: Genre Count Bounds**
    - **Validates: Requirements 1.4**
  - [x] 2.3 Write property test for response parsing

    - **Property 6: Response Format Validation**
    - **Validates: Requirements 6.2, 6.5**

- [x] 3. Implement invalid genre filtering
  - [x] 3.1 Add filtering logic to parseResponse()
    - Filter out genres not in PRIMARY_GENRES
    - Filter out sub-genres not in SUB_GENRES
    - Return null if all genres are invalid
    - _Requirements: 1.6, 2.3, 2.4_
  - [x] 3.2 Write property test for invalid genre filtering

    - **Property 3: Invalid Genre Filtering**
    - **Validates: Requirements 1.6, 2.3**

- [x] 4. Checkpoint - Verify classifier module
  - Ensure classifier compiles without errors
  - Test with mock responses locally
  - Ask the user if questions arise

- [x] 5. Integrate classifier into orchestrator
  - [x] 5.1 Update orchestrator to call classifier
    - Add classification step after PDF upload
    - Pass title, author, year, description to classifier
    - Store genres and subgenre in book record
    - Handle classification failures gracefully
    - _Requirements: 1.1, 1.2, 4.1, 4.2_
  - [x] 5.2 Write property test for non-blocking ingestion

    - **Property 4: Non-blocking Ingestion**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 6. Implement idempotency for classification
  - [x] 6.1 Add check for existing genres before classification
    - Skip classification if book already has genres
    - Check database for existing source_identifier with genres
    - _Requirements: 5.2, 5.3_
  - [x] 6.2 Write property test for classification idempotency

    - **Property 5: Classification Idempotency**
    - **Validates: Requirements 5.2, 5.3**

- [x] 7. Add testing utilities
  - [x] 7.1 Implement mock classifier for testing
    - Add MOCK_GENRE_CLASSIFIER environment variable
    - Create mock responses based on title keywords
    - _Requirements: 7.1_
  - [x] 7.2 Implement classification disable toggle
    - Add ENABLE_GENRE_CLASSIFICATION environment variable
    - Return null when disabled
    - _Requirements: 7.2, 7.4_

- [x] 8. Checkpoint - Integration testing
  - Test full ingestion flow with classification
  - Verify non-blocking behavior on failures
  - Test mock mode and disable toggle
  - Ask the user if questions arise

- [x] 9. Update local test script
  - [x] 9.1 Add classification options to test-ingestion-local.js
    - Add --classify flag to enable classification
    - Add --mock-classify flag for mock mode
    - Display classification results in output
    - _Requirements: 7.1, 7.2_

- [x] 10. Final checkpoint - Complete verification
  - Run all tests to ensure everything passes
  - Verify classification works with real API
  - Test error handling and resilience
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property tests
- Classification is non-blocking - failures never stop ingestion
- Uses free/low-cost OpenRouter model by default
- Taxonomy is defined in a single file for easy modification
- Mock mode available for testing without API costs
