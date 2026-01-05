# Implementation Plan

- [x] 1. Database schema and migrations



  - [x] 1.1 Create SQL migration file for `borrow_requests` table


    - Create table with id, user_id, book_id, status, rejection_reason, requested_at, processed_at, processed_by columns
    - Add foreign key constraints to users and books tables
    - Add unique constraint to prevent duplicate pending requests
    - Add indexes for efficient querying by status, user_id, book_id
    - _Requirements: 7.1, 7.4_

  - [x] 1.2 Create SQL view `pending_borrow_requests` for admin panel
    - Join borrow_requests with users and books tables
    - Include user name, admission number, book title, author, cover URL, copies_available
    - Filter by status = 'pending' and order by requested_at ASC
    - _Requirements: 3.2, 6.1_

  - [x] 1.3 Create database function `create_borrow_request`
    - Check for existing pending request (prevent duplicates)
    - Validate user and book exist
    - Insert new request with status 'pending'
    - Do NOT decrement book count
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.4 Create database function `approve_borrow_request`
    - Use transaction to ensure atomicity
    - Verify copies_available > 0
    - Update request status to 'approved'
    - Create loan record with 14-day due date
    - Decrement book copies_available
    - Record processed_at and processed_by
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 7.3_

  - [x] 1.5 Create database function `reject_borrow_request`

    - Update request status to 'rejected'
    - Store optional rejection_reason
    - Record processed_at and processed_by
    - Do NOT modify book count
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 2. Checkpoint - Verify database migrations





  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Backend API endpoints





  - [x] 3.1 Add POST `/api/borrow-requests` endpoint


    - Accept userId and bookId in request body
    - Call create_borrow_request database function
    - Return created request or error
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 3.2 Write property test for request creation















    - **Property 1: Request creation preserves book count**
    - **Validates: Requirements 1.1**
  - [x] 3.3 Write property test for duplicate prevention






    - **Property 3: Duplicate request prevention**
    - **Validates: Requirements 1.3**
  - [x] 3.4 Add GET `/api/borrow-requests/:userId` endpoint

    - Return all requests for a user (pending, approved, rejected)
    - Include book details in response
    - _Requirements: 2.1, 2.2_
  - [x] 3.5 Add GET `/api/admin/borrow-requests` endpoint

    - Return all pending requests with user and book details
    - Support optional query params for filtering
    - _Requirements: 3.2, 3.4, 6.1_
  - [x] 3.6 Write property test for chronological ordering






    - **Property 8: Chronological ordering**
    - **Validates: Requirements 6.1**
  - [x] 3.7 Add POST `/api/admin/borrow-requests/:id/approve` endpoint

    - Call approve_borrow_request database function
    - Return success with loan details or error
    - _Requirements: 4.1, 4.2, 4.3, 4.5_
  - [x] 3.8 Write property test for approval






    - **Property 4: Approval creates loan and decrements count**
    - **Validates: Requirements 4.1, 4.2, 4.5**
  - [x] 3.9 Write property test for due date calculation






    - **Property 5: Approval sets correct due date**
    - **Validates: Requirements 4.3**
  - [x] 3.10 Add POST `/api/admin/borrow-requests/:id/reject` endpoint

    - Accept optional rejectionReason in body
    - Call reject_borrow_request database function
    - Return success or error
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 3.11 Write property test for rejection






    - **Property 6: Rejection preserves book count**
    - **Validates: Requirements 5.1, 5.3, 5.4**
  - [x] 3.12 Write property test for re-request after rejection






    - **Property 7: Re-request after rejection**
    - **Validates: Requirements 2.3**

- [x] 4. Checkpoint - Verify API endpoints





  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update server.js for local development






  - [x] 5.1 Add all borrow request endpoints to server.js

    - Mirror the endpoints from api/index.js
    - Ensure local development works correctly
    - _Requirements: 1.1, 3.2, 4.1, 5.1_

- [x] 6. Frontend - User request flow





  - [x] 6.1 Update BookDetailsModal.tsx to create borrow requests


    - Change "Borrow This Book" to create a request instead of immediate loan
    - Show "Request Pending" button state when user has pending request
    - Display success message on request creation
    - _Requirements: 1.1, 1.4_
  - [x] 6.2 Add TypeScript interface for BorrowRequest


    - Add to types.ts file
    - Include all fields from design document
    - _Requirements: 1.2_
  - [x] 6.3 Update MyLoans.tsx to show pending requests


    - Add new section for "Pending Requests"
    - Display request status, book details, and requested date
    - Show rejection reason if request was rejected
    - Allow re-requesting after rejection
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 7. Frontend - Admin approval interface






  - [x] 7.1 Add "Borrow Requests" tab to AdminPanel.tsx

    - Add new tab alongside Books and Users tabs
    - Show badge with pending request count
    - _Requirements: 3.1, 3.3_
  - [x] 7.2 Write property test for badge count









    - **Property 11: Badge count accuracy**
    - **Validates: Requirements 3.3**

  - [x] 7.3 Create BorrowRequestsTab component

    - Display table/cards of pending requests
    - Show user name, admission number, book title, author, cover, copies available
    - Show request timestamp
    - Add search/filter functionality
    - _Requirements: 3.2, 3.4, 6.2_
  - [x] 7.4 Write property test for filter correctness






    - **Property 12: Filter correctness**
    - **Validates: Requirements 3.4**

  - [x] 7.5 Add Approve button functionality

    - Call approve endpoint on click
    - Show loading state during API call
    - Refresh list after successful approval
    - Show error message if approval fails (e.g., no copies available)
    - _Requirements: 4.1, 4.4, 6.3_

  - [x] 7.6 Add Reject button functionality

    - Show optional rejection reason input
    - Call reject endpoint on click
    - Refresh list after successful rejection
    - _Requirements: 5.1, 5.2_

- [x] 8. Checkpoint - Verify frontend components





  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Integration and polish






  - [x] 9.1 Update App.tsx to pass borrow request handlers

    - Add handlers for creating borrow requests
    - Update BookDetailsModal props
    - _Requirements: 1.1_

  - [x] 9.2 Add real-time count update in admin panel

    - After approving a request, update displayed copies_available for other requests of same book
    - _Requirements: 6.3_
  - [x] 9.3 Write property test for transactional integrity






    - **Property 10: Transactional integrity on approval**
    - **Validates: Requirements 7.3**
  - [x] 9.4 Write property test for state transition timestamps






    - **Property 9: State transition timestamps**
    - **Validates: Requirements 7.2**

- [x] 10. Final Checkpoint - Make sure all tests are passing





  - Ensure all tests pass, ask the user if questions arise.

