# Implementation Plan: Remove Loan/Borrow Features

## Overview

This implementation plan removes loan and borrow-related UI elements while preserving all backend infrastructure. The approach is conservative and reversible: remove frontend code, preserve backend, and maintain the ability to re-enable features in the future.

## Tasks

- [ ] 1. Remove borrow request functionality from App.tsx
  - Remove `handleBorrowRequest` function
  - Remove borrow request API calls
  - Remove borrow request success/error notifications
  - Remove `onBorrowRequest` prop passing to BookDetailsModal
  - _Requirements: 5.1_

- [ ] 2. Simplify status filter in App.tsx
  - Remove "Borrowed" option from status filter
  - Remove "Waitlist" option from status filter
  - Keep only "All" and "Available" options
  - Update filter logic to remove BORROWED/WAITLIST handling
  - _Requirements: 5.3_

- [ ] 3. Remove loan UI elements from BookDetailsModal.tsx
  - Remove "Request to Borrow" button
  - Remove BORROWED status badge
  - Remove WAITLIST status badge
  - Remove physical copies availability display
  - Remove `onBorrowRequest` prop from component interface
  - Simplify status display to show only AVAILABLE or no status
  - _Requirements: 5.1, 5.2, 5.5_

- [ ] 4. Remove loan status badges from BookCard.tsx
  - Remove BORROWED status badge rendering
  - Remove WAITLIST status badge rendering
  - Simplify to show only AVAILABLE badge or no badge
  - _Requirements: 5.2_

- [ ] 5. Remove My Loans navigation and component
  - Remove "My Loans" link from Navbar.tsx
  - Delete MyLoans.tsx component file
  - Add redirect from /loans route to home page in App.tsx routing
  - Remove loan fetching API calls from user profile
  - _Requirements: 5.4_

- [ ] 6. Update TypeScript type definitions
  - Mark `Loan` interface as deprecated with JSDoc comment
  - Mark `BorrowRequest` interface as deprecated with JSDoc comment
  - Add comments to BookStatus enum noting BORROWED/WAITLIST are preserved for backend
  - Remove `copiesAvailable` and `totalCopies` from active Book interface (or mark optional)
  - _Requirements: 5.7_

- [ ] 7. Add documentation comments
  - Add comments explaining loan features are disabled
  - Document how to re-enable features
  - Add comments to preserved backend code
  - Update README with feature status
  - _Requirements: 5.6_

- [ ] 8. Visual testing and verification
  - Test browse page (no BORROWED/WAITLIST filters visible)
  - Test book cards (no loan status badges visible)
  - Test book details modal (no borrow button visible)
  - Test book details modal (no physical copies info visible)
  - Test navigation menu (no My Loans link visible)
  - Test /loans route redirect to home page
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 9. Write property tests for UI element absence
  - **Property 1: Borrow Button Absence**
  - **Validates: Requirements 5.1**

- [ ] 10. Write property tests for status badge absence
  - **Property 2: Loan Status Badge Absence**
  - **Validates: Requirements 5.2**

- [ ] 11. Write property tests for filter simplification
  - **Property 3: Status Filter Simplification**
  - **Validates: Requirements 5.3**

- [ ] 12. Write property tests for navigation absence
  - **Property 4: My Loans Navigation Absence**
  - **Validates: Requirements 5.4**

- [ ] 13. Write property tests for backend preservation
  - **Property 6: Backend Table Preservation**
  - **Property 7: API Endpoint Preservation**
  - **Validates: Requirements 5.6**

- [ ] 14. Final verification and cleanup
  - Verify no console errors
  - Verify no broken links
  - Verify all pages load correctly
  - Verify user flows work end-to-end
  - Remove any unused imports
  - _Requirements: All_

## Notes

- All tasks are required for comprehensive testing
- Each task references specific requirements for traceability
- This is primarily a removal/simplification task, not new feature development
- All backend infrastructure is preserved for potential future use
- Changes are reversible by uncommenting code or re-adding components
- No database migrations required
- No API endpoint changes required
