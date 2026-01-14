# Implementation Plan: Admin Route Navigation

## Overview

This implementation plan converts admin navigation from state-based to route-based using React Router DOM. Tasks are ordered to build incrementally, with each step building on the previous.

## Tasks

- [x] 1. Install and configure React Router DOM
  - Add react-router-dom dependency to package.json
  - Verify installation works
  - _Requirements: 1.1_

- [x] 2. Create AdminGuard component
  - [x] 2.1 Create components/AdminGuard.tsx
    - Implement guard logic that checks user.role === 'Admin'
    - Show loading spinner while auth is being verified
    - Redirect non-admin users to browse view using Navigate component
    - Accept children prop to wrap protected content
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.2 Write unit tests for AdminGuard
    - Test renders children for admin users
    - Test redirects for non-admin users
    - Test shows loading state during auth check
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Create AdminRoutes component
  - [x] 3.1 Create components/AdminRoutes.tsx
    - Define nested routes for /admin and /admin/health
    - Map /admin to AdminPanel component
    - Map /admin/health to AdminHealthDashboard component
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 4. Update App.tsx with router integration
  - [x] 4.1 Wrap application in BrowserRouter
    - Import BrowserRouter from react-router-dom
    - Wrap the main App content in BrowserRouter
    - _Requirements: 1.1, 1.2_

  - [x] 4.2 Add Routes for admin pages
    - Import Routes, Route from react-router-dom
    - Add route for /admin/* that renders AdminGuard wrapping AdminRoutes
    - Keep existing state-based rendering for non-admin views
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.3 Update View type and remove admin from currentView
    - Change View type to 'browse' | 'ai' only
    - Remove 'admin' and 'health' cases from currentView handling
    - _Requirements: 5.3_

- [x] 5. Checkpoint - Verify router setup
  - Ensure application builds without errors
  - Verify /admin and /admin/health routes work for admin users
  - Verify non-admin users are redirected
  - Ask the user if questions arise

- [x] 6. Update Navbar.tsx with route navigation
  - [x] 6.1 Add router hooks and imports
    - Import useNavigate and useLocation from react-router-dom
    - Create navigate function using useNavigate hook
    - Get current pathname using useLocation hook
    - _Requirements: 4.1, 4.2, 4.6_

  - [x] 6.2 Update desktop navbar admin buttons
    - Replace setCurrentView('admin') with navigate('/admin')
    - Add Health button that navigates to /admin/health
    - Update active state styling to use location.pathname
    - _Requirements: 4.1, 4.2, 4.6_

  - [x] 6.3 Update mobile hamburger menu
    - Replace setCurrentView('admin') with navigate('/admin')
    - Add System Health button that navigates to /admin/health
    - Update active state styling to use location.pathname
    - _Requirements: 4.3, 4.4, 4.6_

  - [x] 6.4 Update bottom mobile nav
    - Replace setCurrentView('admin') with navigate('/admin')
    - Update active state styling to use location.pathname
    - _Requirements: 4.5, 4.6_

  - [x] 6.5 Update NavbarProps interface
    - Remove 'admin' and 'health' from currentView type
    - Update setCurrentView type accordingly
    - _Requirements: 5.3_

- [x] 7. Write property tests for admin navigation
  - [x] 7.1 Write property test for admin route protection
    - **Property 3: Admin Route Protection**
    - Generate random non-admin user roles
    - Verify redirect occurs for all non-admin roles
    - **Validates: Requirements 3.1, 3.2**

  - [x] 7.2 Write property test for navbar visibility
    - **Property 5: Admin Navigation Visibility**
    - Generate users with various roles
    - Verify admin buttons visible only for Admin role
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 8. Handle logout redirect from admin routes
  - [x] 8.1 Update logout handler in App.tsx
    - Check if current route is admin route on logout
    - Navigate to root/browse after logout
    - _Requirements: 3.5_

- [ ] 9. Final checkpoint - Full integration testing
  - Verify all admin navigation works (desktop, mobile, hamburger)
  - Verify deep linking works (direct URL access)
  - Verify browser back/forward works
  - Verify non-admin users cannot access admin routes
  - Verify logout from admin routes redirects correctly
  - Ensure all tests pass, ask the user if questions arise

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- The existing state-based navigation for browse and ai views is preserved
