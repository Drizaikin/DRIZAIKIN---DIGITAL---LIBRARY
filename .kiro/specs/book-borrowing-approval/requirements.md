# Requirements Document

## Introduction

This feature implements an admin approval workflow for book borrowing in the PUEA Digital Library System. Currently, when a user borrows a book, the loan is immediately created and the book count is decremented. This feature changes the workflow so that borrow requests require admin validation before being finalized. The admin will have a dedicated "Borrow Requests" tab to review, approve, or reject pending requests. Only after admin approval will the physical book count be updated in the database.

## Glossary

- **Borrow_Request**: A pending loan request submitted by a user that awaits admin approval
- **Loan**: A confirmed book borrowing record after admin approval
- **Admin**: Library staff member with authority to approve or reject borrow requests
- **User**: A student, lecturer, or faculty member who can request to borrow books
- **Physical_Count**: The `copies_available` field in the books table representing actual available copies
- **Request_Status**: The state of a borrow request (pending, approved, rejected)

## Requirements

### Requirement 1

**User Story:** As a user, I want to request to borrow a book, so that I can initiate the borrowing process and wait for admin approval.

#### Acceptance Criteria

1. WHEN a user clicks "Borrow This Book" THEN the System SHALL create a borrow request with status "pending" without decrementing the physical book count
2. WHEN a borrow request is created THEN the System SHALL record the user ID, book ID, request timestamp, and initial status as "pending"
3. WHEN a user has a pending request for a book THEN the System SHALL prevent the user from creating duplicate requests for the same book
4. WHEN a user views a book they have requested THEN the System SHALL display "Request Pending" status instead of the borrow button

### Requirement 2

**User Story:** As a user, I want to see the status of my borrow requests, so that I can track which requests are pending, approved, or rejected.

#### Acceptance Criteria

1. WHEN a user views their loans section THEN the System SHALL display both active loans and pending borrow requests in separate sections
2. WHEN a borrow request status changes THEN the System SHALL reflect the updated status in the user's view
3. WHEN a request is rejected THEN the System SHALL display the rejection status and allow the user to request again
4. WHEN a request is approved THEN the System SHALL move the request to the active loans section with proper due date

### Requirement 3

**User Story:** As an admin, I want to view all pending borrow requests, so that I can review and process them efficiently.

#### Acceptance Criteria

1. WHEN an admin accesses the Admin Panel THEN the System SHALL display a "Borrow Requests" tab alongside existing tabs
2. WHEN the admin views the Borrow Requests tab THEN the System SHALL display all pending requests with user details, book details, and request timestamp
3. WHEN there are pending requests THEN the System SHALL show a badge count on the Borrow Requests tab indicating the number of pending requests
4. WHEN the admin searches or filters requests THEN the System SHALL support filtering by user name, book title, or request date

### Requirement 4

**User Story:** As an admin, I want to approve borrow requests, so that I can authorize users to physically collect books from the library.

#### Acceptance Criteria

1. WHEN an admin clicks "Approve" on a request THEN the System SHALL change the request status to "approved" and create an active loan record
2. WHEN a request is approved THEN the System SHALL decrement the book's physical count (copies_available) by one
3. WHEN a request is approved THEN the System SHALL set the loan due date based on the standard loan period (14 days from approval)
4. WHEN approving would result in negative available copies THEN the System SHALL prevent approval and display an error message
5. WHEN a request is approved THEN the System SHALL remove the request from the pending list and add it to active loans

### Requirement 5

**User Story:** As an admin, I want to reject borrow requests, so that I can deny requests that cannot be fulfilled or are invalid.

#### Acceptance Criteria

1. WHEN an admin clicks "Reject" on a request THEN the System SHALL change the request status to "rejected"
2. WHEN rejecting a request THEN the System SHALL optionally allow the admin to provide a rejection reason
3. WHEN a request is rejected THEN the System SHALL NOT modify the book's physical count
4. WHEN a request is rejected THEN the System SHALL remove it from the pending requests view

### Requirement 6

**User Story:** As an admin, I want to process multiple requests efficiently, so that I can handle high volumes of borrow requests.

#### Acceptance Criteria

1. WHEN viewing pending requests THEN the System SHALL display requests in chronological order (oldest first)
2. WHEN multiple requests exist for the same book THEN the System SHALL show the available copies count to help admin make decisions
3. WHEN the admin approves a request THEN the System SHALL update the displayed available count for remaining requests of the same book

### Requirement 7

**User Story:** As a system administrator, I want the borrow request data to be persisted correctly, so that the system maintains data integrity.

#### Acceptance Criteria

1. WHEN storing borrow requests THEN the System SHALL save them in a dedicated database table with proper foreign key relationships
2. WHEN a request transitions between states THEN the System SHALL record the timestamp of each state change
3. WHEN a request is approved THEN the System SHALL use a database transaction to ensure both the loan creation and book count update succeed or fail together
4. WHEN querying requests THEN the System SHALL support efficient retrieval by status, user, and book

