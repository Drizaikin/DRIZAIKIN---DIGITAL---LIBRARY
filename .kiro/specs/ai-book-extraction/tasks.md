# Implementation Plan

- [x] 1. Set up database schema for extraction feature






  - [x] 1.1 Create SQL migration file for extraction_jobs, extracted_books, and extraction_logs tables

    - Define all columns, constraints, and indexes as specified in design
    - Add foreign key relationships to existing users and categories tables
    - _Requirements: 1.5, 2.1, 2.2, 4.5, 6.1_
  - [x] 1.2 Write property test for job state transitions






    - **Property 5: Job State Transitions**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 2. Implement PDF Crawler service












  - [x] 2.1 Create pdfCrawlerService.ts with crawl function




    - Implement async generator that yields PDF links from a given URL
    - Parse HTML to find anchor tags with .pdf extensions or PDF content-type
    - Handle relative URLs and convert to absolute
    - Support AbortSignal for cancellation
    - _Requirements: 1.1, 1.2_
  - [x] 2.2 Write property test for PDF validation






    - **Property 2: PDF Validation**
    - **Validates: Requirements 1.2**

- [x] 3. Implement Metadata Extractor service





  - [x] 3.1 Create metadataExtractorService.ts using Gemini AI


    - Implement PDF text extraction from first pages
    - Create Gemini prompt for metadata extraction
    - Parse Gemini response into BookMetadata structure
    - Integrate with existing geminiService.ts
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 3.2 Implement cover image fetching


    - Query Google Books API with title/author
    - Generate placeholder cover if no match found
    - Upload cover to Supabase storage
    - _Requirements: 3.6, 3.7_
  - [x] 3.3 Write property test for metadata completeness






    - **Property 3: Metadata Completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 4. Implement Extraction Job Manager





  - [x] 4.1 Create extractionService.ts with job lifecycle methods



    - Implement createJob, startJob, pauseJob, resumeJob, stopJob
    - Handle job state transitions with validation
    - Implement time and book count limit enforcement
    - Apply default limits when not specified
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2, 5.3, 5.4_
  - [x] 4.2 Write property test for job limit enforcement






    - **Property 1: Job Limit Enforcement**
    - **Validates: Requirements 2.3, 2.4, 2.5**
  - [x] 4.3 Write property test for default limits





    - **Property 8: Default Limits Application**
    - **Validates: Requirements 2.6**

- [x] 5. Implement Backend API endpoints









  - [x] 5.1 Add extraction routes to api/index.js



    - POST /api/admin/extractions - Create new extraction job
    - GET /api/admin/extractions - List extraction jobs
    - GET /api/admin/extractions/:id - Get job details
    - POST /api/admin/extractions/:id/start - Start job
    - POST /api/admin/extractions/:id/pause - Pause job
    - POST /api/admin/extractions/:id/resume - Resume job
    - POST /api/admin/extractions/:id/stop - Stop job
    - GET /api/admin/extractions/:id/progress - Get real-time progress
    - GET /api/admin/extractions/:id/books - Get extracted books
    - DELETE /api/admin/extractions/:id - Delete job
    - _Requirements: 1.1, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.5, 6.2, 6.3, 6.4_
  - [x] 5.2 Write property test for progress counter accuracy






    - **Property 6: Progress Counter Accuracy**
    - **Validates: Requirements 4.1, 4.3**

- [x] 6. Implement user visibility isolation






  - [x] 6.1 Modify book queries to exclude unpublished extracted books

    - Update /api/books endpoint to filter out non-published extracted books
    - Update search functionality to exclude in-progress extractions
    - _Requirements: 7.2, 7.3, 7.4_
  - [x] 6.2 Write property test for user visibility isolation






    - **Property 4: User Visibility Isolation**
    - **Validates: Requirements 7.2, 7.3, 7.4**

- [x] 7. Checkpoint - Ensure all backend tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create ExtractionPanel component














  - [x] 8.1 Create components/ExtractionPanel.tsx

    - Implement job creation form with URL input and limit options
    - Display job list with status indicators
    - Show real-time progress for running jobs
    - Implement action buttons (start, pause, resume, stop)
    - Display extraction logs
    - _Requirements: 1.1, 2.1, 2.2, 4.1, 4.2, 4.3, 4.4, 4.5, 5.5_

  - [x] 8.2 Implement extraction history view

    - Display list of past jobs sorted by date
    - Show job details on click
    - Add delete option for failed/incomplete jobs
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 9. Add mobile-responsive design to ExtractionPanel






  - [x] 9.1 Implement responsive layout for extraction panel


    - Use card-based layout for mobile
    - Ensure touch-friendly button sizes (min 44x44px)
    - Add collapsible sections for job details
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 9.2 Write property test for mobile touch targets





    - **Property 7: Mobile Touch Target Size**
    - **Validates: Requirements 8.3**

- [x] 10. Update AdminPanel with mobile navigation and Extractions tab






  - [x] 10.1 Add Extractions tab to AdminPanel

    - Import and integrate ExtractionPanel component
    - Add tab button with appropriate icon
    - Ensure tab only visible to admin users
    - _Requirements: 7.1_

  - [x] 10.2 Implement mobile-friendly tab navigation

    - Add horizontal scrollable tabs or dropdown for mobile
    - Ensure all tabs accessible on screens below 768px
    - Add clear active tab indicator
    - Fix navigation position for easy access while scrolling
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 11. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
