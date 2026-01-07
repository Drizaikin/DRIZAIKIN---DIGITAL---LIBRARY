# Implementation Plan: Global Platform Migration

## Overview

This implementation plan documents the migration from an institution-based library system to a global platform. Most tasks have been completed - this serves as documentation and tracks any remaining work.

## Tasks

- [x] 1. Update TypeScript interfaces and types
  - [x] 1.1 Update User interface in types.ts
    - Changed role type from 'Student' | 'Lecturer' | 'Faculty' | 'Admin' to 'Reader' | 'Premium' | 'Admin'
    - Changed admissionNo to username
    - Removed course field
    - _Requirements: 1.1, 2.1_
  - [x] 1.2 Update AuthUser interface in authService.ts
    - Changed admissionNo to username
    - Updated role types
    - _Requirements: 1.1, 2.1_

- [x] 2. Update authentication service
  - [x] 2.1 Update LoginCredentials interface
    - Changed admissionNo to username
    - Updated loginAs options to 'reader' | 'premium' | 'admin'
    - _Requirements: 1.2, 5.1_
  - [x] 2.2 Update RegisterData interface
    - Changed admissionNo to username
    - Removed course field
    - _Requirements: 1.1, 5.2_

- [x] 3. Update UI components
  - [x] 3.1 Update Login.tsx
    - Changed input label from "Admission Number" to "Username"
    - Updated role selector options to Reader/Premium/Admin
    - _Requirements: 4.1, 4.5_
  - [x] 3.2 Update Register.tsx
    - Changed input field from admissionNo to username
    - Removed course selection
    - _Requirements: 4.2_
  - [x] 3.3 Update UserProfile.tsx
    - Display username instead of admissionNo
    - Hide course field
    - _Requirements: 4.3_
  - [x] 3.4 Update AdminPanel.tsx
    - Display username column in user tables
    - Update role display labels
    - _Requirements: 4.4, 2.6_

- [x] 4. Update API endpoints
  - [x] 4.1 Update api/index.js login route
    - Accept username field in request body
    - Validate against new role values
    - _Requirements: 5.1, 5.4_
  - [x] 4.2 Update api/index.js register route
    - Accept username field in request body
    - Assign Reader role by default
    - _Requirements: 5.2, 2.2_

- [x] 5. Update App.tsx
  - [x] 5.1 Update login handler
    - Use username instead of admissionNo
    - _Requirements: 1.2_
  - [x] 5.2 Update register handler
    - Use username instead of admissionNo
    - _Requirements: 1.1_

- [x] 6. Update constants
  - [x] 6.1 Update constants.ts mock user
    - Changed role from Student to Reader
    - _Requirements: 2.1_

- [x] 7. Database migration
  - [x] 7.1 Create SQL migration script
    - Drop old role check constraint
    - Rename admission_no column to username
    - Update role values (Student→Reader, Lecturer/Faculty→Premium)
    - Add new role check constraint
    - Create username index
    - Update active_loans view
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 7.2 Run migration in Supabase
    - Migration executed successfully
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 8. Optional: Update local development files
  - [ ] 8.1 Update mock-server.js
    - Update mock data to use username instead of admissionNo
    - Update role values in mock responses
    - _Requirements: 5.1, 5.2_
  - [ ] 8.2 Update server.js
    - Update any references to admissionNo
    - _Requirements: 5.1, 5.2_

- [ ] 9. Optional: Update test files
  - [ ] 9.1 Review and update existing tests
    - Update test data to use new field names
    - Update role assertions
    - _Requirements: 1.5, 2.2_

- [ ] 10. Checkpoint - Verify migration
  - Test login with existing users
  - Test new user registration
  - Verify role display in UI
  - Ensure all tests pass

## Notes

- Tasks marked with `[x]` have been completed
- Tasks marked with `[ ]` are optional remaining work
- The core migration is complete - database, API, and frontend all use the new schema
- Local development files (mock-server.js, server.js) may need updates if used for local testing
