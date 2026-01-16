# Remove Loan/Borrow Features - Requirements

## 1. Overview

Remove all loan and borrow-related UI elements and functionality from the digital library system. The library operates as a digital-only platform where users can read and download books directly, without physical lending. This change simplifies the user experience and removes confusion about borrowing physical copies.

## 2. Background

The current system includes loan/borrow functionality (borrow requests, loan tracking, waitlists, due dates, fines) that was designed for physical book lending. However, the library operates exclusively as a digital platform where all books are available for immediate reading and download. The loan features create unnecessary complexity and user confusion.

## 3. Glossary

- **Loan_System**: The collection of UI components, API endpoints, and database tables related to physical book lending
- **Borrow_Request**: A user request to borrow a physical copy of a book
- **Book_Status**: The availability state of a book (Available, Borrowed, Waitlist)
- **UI_Component**: React/TypeScript components that render user interface elements
- **Backend_Preservation**: Keeping database schema and API endpoints intact but unused

## 4. User Stories

### 4.1 As a library user
I want to see only relevant book information so that I'm not confused about borrowing physical copies that don't exist.

### 4.2 As a library administrator
I want a simpler UI focused on digital access so that users understand the library is digital-only.

### 4.3 As a developer
I want to preserve backend infrastructure so that loan features can be re-enabled in the future if needed.

## 5. Functional Requirements

### 5.1 Remove Borrow Request UI
**Priority**: P0 (Critical)

THE system SHALL remove all borrow request buttons and forms from the user interface.

**Acceptance Criteria**:
1. WHEN a user views a book details modal, THE system SHALL NOT display a "Request to Borrow" button
2. WHEN a user views a book details modal, THE system SHALL NOT display borrow request status
3. THE system SHALL remove borrow request success/error notifications
4. THE system SHALL remove borrow request API calls from frontend code

### 5.2 Remove Loan Status Display
**Priority**: P0 (Critical)

THE system SHALL remove loan status badges and indicators from the user interface.

**Acceptance Criteria**:
1. WHEN a user views a book card, THE system SHALL NOT display "BORROWED" status badge
2. WHEN a user views a book card, THE system SHALL NOT display "WAITLIST" status badge
3. WHEN a user views a book details, THE system SHALL display only "AVAILABLE" status or no status
4. THE system SHALL simplify book status display logic to remove loan-related states

### 5.3 Remove Status Filters
**Priority**: P0 (Critical)

THE system SHALL remove loan-related filter options from the browse interface.

**Acceptance Criteria**:
1. WHEN a user views the browse page, THE system SHALL NOT display "Borrowed" filter option
2. WHEN a user views the browse page, THE system SHALL NOT display "Waitlist" filter option
3. THE system SHALL keep only "All" and "Available" filter options
4. THE system SHALL remove filter logic for BORROWED and WAITLIST states

### 5.4 Remove My Loans Page
**Priority**: P0 (Critical)

THE system SHALL remove the "My Loans" page and navigation.

**Acceptance Criteria**:
1. WHEN a user views the navigation menu, THE system SHALL NOT display "My Loans" link
2. THE system SHALL remove the MyLoans component from the application
3. THE system SHALL remove loan fetching API calls from user profile
4. THE system SHALL redirect any direct access to /loans route to home page

### 5.5 Simplify Book Availability Display
**Priority**: P1 (High)

THE system SHALL simplify or remove physical copy availability information.

**Acceptance Criteria**:
1. WHEN a user views book details, THE system SHALL NOT display "Physical Copies Available" count
2. WHEN a user views book details, THE system SHALL NOT display "Total Copies" information
3. THE system SHALL focus display on digital access (read online, download PDF)
4. THE system SHALL remove copies_available and total_copies from frontend data models

### 5.6 Preserve Backend Infrastructure
**Priority**: P0 (Critical)

THE system SHALL preserve all database tables and API endpoints for future use.

**Acceptance Criteria**:
1. THE system SHALL NOT drop the borrow_requests table
2. THE system SHALL NOT drop the loans table
3. THE system SHALL NOT drop the waitlist table
4. THE system SHALL NOT delete borrow/loan API endpoints
5. THE system SHALL keep all RLS policies intact
6. THE system SHALL document that features are disabled, not deleted

### 5.7 Update Type Definitions
**Priority**: P1 (High)

THE system SHALL update TypeScript type definitions to reflect UI changes.

**Acceptance Criteria**:
1. THE system SHALL mark loan-related types as deprecated or optional
2. THE system SHALL remove loan-related fields from active UI type definitions
3. THE system SHALL keep BookStatus enum for potential future use
4. THE system SHALL document which types are preserved for backend compatibility

## 6. Non-Functional Requirements

### 6.1 Reversibility
- All changes must be reversible by uncommenting code or re-adding components
- No data loss or schema changes
- Backend endpoints remain functional if called directly

### 6.2 User Experience
- Cleaner, simpler interface focused on digital access
- No confusion about physical book availability
- Faster page load times (fewer API calls)

### 6.3 Maintainability
- Reduced code complexity in UI layer
- Clear documentation of what was removed and why
- Easy to re-enable if requirements change

## 7. Out of Scope

### 7.1 Backend Deletion
This feature does NOT delete database tables, API endpoints, or backend logic. All backend infrastructure is preserved.

### 7.2 Data Migration
This feature does NOT require any database migrations or data cleanup.

### 7.3 Admin Features
This feature does NOT remove admin-facing loan management features (if they exist).

## 8. Success Metrics

### 8.1 UI Simplification
- Removal of 4+ UI components related to loans
- Reduction of 10+ API calls per user session
- Faster page load times

### 8.2 User Clarity
- Reduced user confusion (measured by support requests)
- Clearer focus on digital access features

### 8.3 Code Maintainability
- Reduced frontend code complexity
- Fewer unused props and handlers
- Cleaner component interfaces

## 9. Dependencies

### 9.1 UI Components
- BookDetailsModal.tsx
- BookCard.tsx
- MyLoans.tsx
- App.tsx (main application)
- Navbar.tsx (navigation)

### 9.2 Type Definitions
- types.ts (BookStatus, Loan types)

### 9.3 No Backend Dependencies
- No database changes required
- No API endpoint changes required

## 10. Risks and Mitigations

### 10.1 Accidental Data Loss
**Risk**: Developer might accidentally delete database tables
**Mitigation**: 
- Clear documentation that backend must be preserved
- Code review process
- No database migration scripts

### 10.2 Incomplete Removal
**Risk**: Some loan UI elements might be missed
**Mitigation**:
- Comprehensive search for loan-related code
- Testing on all pages
- User acceptance testing

### 10.3 Future Re-enablement Difficulty
**Risk**: Might be hard to re-enable if needed
**Mitigation**:
- Comment out code rather than delete where possible
- Document all changes
- Keep backend fully functional

## 11. Future Considerations

### 11.1 Re-enabling Loans
If physical lending is added in the future:
- Uncomment UI components
- Re-add navigation links
- Enable API endpoint calls
- Run existing tests to verify functionality

### 11.2 Digital Lending
If digital lending (time-limited access) is needed:
- Current backend can be adapted
- UI can be re-enabled with modifications
- Focus on digital rather than physical copies
