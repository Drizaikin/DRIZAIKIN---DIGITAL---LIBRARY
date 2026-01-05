# Design Document: Book Borrowing Approval Workflow

## Overview

This feature transforms the book borrowing process from an immediate transaction to an admin-approved workflow. When users request to borrow books, a pending request is created that requires admin validation before the loan is finalized and book inventory is updated. This provides library staff with control over physical book distribution while maintaining a digital record of all requests.

## Architecture

The feature follows the existing application architecture:
- **Frontend**: React components for user request submission and admin approval interface
- **Backend**: Express.js API endpoints (Vercel serverless functions) for request management
- **Database**: Supabase PostgreSQL with a new `borrow_requests` table

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User View     │     │   Admin View    │     │    Database     │
│  (MyLoans.tsx)  │     │ (AdminPanel.tsx)│     │   (Supabase)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  Request Book         │                       │
         ├──────────────────────────────────────────────►│
         │                       │   Create Request      │
         │                       │   (status: pending)   │
         │                       │                       │
         │                       │  View Pending         │
         │                       ├──────────────────────►│
         │                       │                       │
         │                       │  Approve/Reject       │
         │                       ├──────────────────────►│
         │                       │   Update Status       │
         │                       │   Create Loan (if     │
         │                       │   approved)           │
         │                       │   Update Book Count   │
         │  View Updated Status  │                       │
         ├──────────────────────────────────────────────►│
         │                       │                       │
```

## Components and Interfaces

### New Database Table: `borrow_requests`

```sql
CREATE TABLE borrow_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id, status) -- Prevent duplicate pending requests
);
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/borrow-requests` | POST | Create a new borrow request |
| `/api/borrow-requests/:userId` | GET | Get user's borrow requests |
| `/api/admin/borrow-requests` | GET | Get all pending requests (admin) |
| `/api/admin/borrow-requests/:id/approve` | POST | Approve a request |
| `/api/admin/borrow-requests/:id/reject` | POST | Reject a request |

### Frontend Components

1. **BookDetailsModal.tsx** - Modified to show "Request Pending" for books with pending requests
2. **MyLoans.tsx** - Extended to show pending requests section
3. **AdminPanel.tsx** - New "Borrow Requests" tab with approval/rejection interface

### TypeScript Interfaces

```typescript
interface BorrowRequest {
  id: string;
  userId: string;
  bookId: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
  // Joined data
  userName?: string;
  userAdmissionNo?: string;
  bookTitle?: string;
  bookAuthor?: string;
  bookCoverUrl?: string;
}
```

## Data Models

### Request State Machine

```
                    ┌──────────┐
                    │  pending │
                    └────┬─────┘
                         │
           ┌─────────────┴─────────────┐
           │                           │
           ▼                           ▼
    ┌──────────┐                ┌──────────┐
    │ approved │                │ rejected │
    └──────────┘                └──────────┘
```

### Database View: `pending_borrow_requests`

```sql
CREATE VIEW pending_borrow_requests AS
SELECT 
  br.id,
  br.user_id,
  u.name AS user_name,
  u.admission_no AS user_admission_no,
  br.book_id,
  b.title AS book_title,
  b.author AS book_author,
  b.cover_url AS book_cover_url,
  b.copies_available,
  br.status,
  br.requested_at
FROM borrow_requests br
JOIN users u ON br.user_id = u.id
JOIN books b ON br.book_id = b.id
WHERE br.status = 'pending'
ORDER BY br.requested_at ASC;
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following correctness properties have been identified:

### Property 1: Request creation preserves book count
*For any* user and available book, when a borrow request is created, the book's `copies_available` count SHALL remain unchanged.
**Validates: Requirements 1.1**

### Property 2: Request data completeness
*For any* created borrow request, the record SHALL contain a valid user_id, book_id, requested_at timestamp, and status of "pending".
**Validates: Requirements 1.2**

### Property 3: Duplicate request prevention
*For any* user with a pending request for a specific book, attempting to create another request for the same book SHALL be rejected.
**Validates: Requirements 1.3**

### Property 4: Approval creates loan and decrements count
*For any* approved borrow request, the system SHALL create an active loan record AND decrement the book's `copies_available` by exactly one AND remove the request from pending status.
**Validates: Requirements 4.1, 4.2, 4.5**

### Property 5: Approval sets correct due date
*For any* approved borrow request, the resulting loan's due date SHALL be exactly 14 days from the approval timestamp.
**Validates: Requirements 4.3**

### Property 6: Rejection preserves book count
*For any* rejected borrow request, the book's `copies_available` count SHALL remain unchanged AND the request status SHALL change to "rejected".
**Validates: Requirements 5.1, 5.3, 5.4**

### Property 7: Re-request after rejection
*For any* user whose request was rejected, the user SHALL be able to create a new request for the same book.
**Validates: Requirements 2.3**

### Property 8: Chronological ordering
*For any* set of pending requests, when displayed to admin, they SHALL be ordered by requested_at timestamp in ascending order (oldest first).
**Validates: Requirements 6.1**

### Property 9: State transition timestamps
*For any* request that transitions from pending to approved or rejected, the system SHALL record the processed_at timestamp.
**Validates: Requirements 7.2**

### Property 10: Transactional integrity on approval
*For any* approval operation, if either the loan creation OR the book count update fails, THEN both operations SHALL be rolled back.
**Validates: Requirements 7.3**

### Property 11: Badge count accuracy
*For any* number N of pending requests in the database, the admin panel badge SHALL display exactly N.
**Validates: Requirements 3.3**

### Property 12: Filter correctness
*For any* filter criteria (user name, book title, or date), the filtered results SHALL contain only requests matching that criteria.
**Validates: Requirements 3.4**

## Error Handling

| Error Scenario | Response | User Message |
|----------------|----------|--------------|
| Book not found | 404 | "Book not found" |
| User not found | 404 | "User not found" |
| Duplicate pending request | 400 | "You already have a pending request for this book" |
| No copies available (on approve) | 400 | "Cannot approve: No copies available" |
| Request not found | 404 | "Request not found" |
| Request already processed | 400 | "Request has already been processed" |
| Database transaction failure | 500 | "Failed to process request. Please try again." |

## Testing Strategy

### Property-Based Testing

The project will use **fast-check** as the property-based testing library for JavaScript/TypeScript.

Each correctness property will be implemented as a property-based test with a minimum of 100 iterations. Tests will be tagged with the format: `**Feature: book-borrowing-approval, Property {number}: {property_text}**`

Key properties to test:
1. Request creation invariant (book count unchanged)
2. Approval transaction (loan created + count decremented atomically)
3. Rejection invariant (book count unchanged)
4. Duplicate prevention
5. Due date calculation (14 days from approval)

### Unit Tests

Unit tests will cover:
- API endpoint request/response validation
- Status transition logic
- Filter and search functionality
- Badge count calculation
- UI component rendering states

### Integration Tests

- End-to-end request → approval → loan flow
- End-to-end request → rejection flow
- Concurrent request handling
- Admin panel data refresh after actions

