# Requirements Document

## Introduction

This feature refactors the admin navigation system from state-based navigation (`currentView`) to proper route-based navigation using React Router. This enables deep-linking, browser history support, and proper URL-based access to admin pages including `/admin` and `/admin/health`.

## Glossary

- **Router**: React Router DOM library for client-side routing
- **Admin_Guard**: A component that protects admin routes from unauthorized access
- **Deep_Link**: A URL that directly navigates to a specific page within the application
- **Route_Navigation**: Navigation that changes the browser URL and renders corresponding components

## Requirements

### Requirement 1: Router Integration

**User Story:** As a developer, I want to integrate React Router into the application, so that we can support URL-based navigation.

#### Acceptance Criteria

1. THE Application SHALL use React Router DOM for client-side routing
2. WHEN the application loads, THE Router SHALL initialize with the current URL path
3. THE Router SHALL support browser history navigation (back/forward buttons)
4. WHEN a route is not found, THE Router SHALL display the browse view as fallback

### Requirement 2: Admin Route Structure

**User Story:** As an admin user, I want to access admin pages via direct URLs, so that I can bookmark and share admin page links.

#### Acceptance Criteria

1. THE Application SHALL expose the route `/admin` for the Admin Panel
2. THE Application SHALL expose the route `/admin/health` for the System Health Dashboard
3. WHEN an admin user navigates to `/admin`, THE System SHALL render the AdminPanel component
4. WHEN an admin user navigates to `/admin/health`, THE System SHALL render the AdminHealthDashboard component
5. THE Admin routes SHALL be deep-linkable (direct URL access works)
6. WHEN the page is refreshed on an admin route, THE System SHALL maintain the correct view

### Requirement 3: Admin Route Protection

**User Story:** As a system administrator, I want admin routes protected from unauthorized access, so that only admin users can access admin functionality.

#### Acceptance Criteria

1. IF a non-admin user attempts to access `/admin`, THEN THE System SHALL redirect them to the browse view
2. IF a non-admin user attempts to access `/admin/health`, THEN THE System SHALL redirect them to the browse view
3. WHILE authentication is being verified, THE Admin_Guard SHALL display a loading state
4. THE Admin_Guard SHALL be reusable across all admin routes
5. IF a user logs out while on an admin route, THEN THE System SHALL redirect to the login page

### Requirement 4: Navbar Route Navigation

**User Story:** As an admin user, I want the navbar to use route-based navigation for admin pages, so that the URL reflects my current location.

#### Acceptance Criteria

1. WHEN an admin clicks the Admin button in the desktop navbar, THE System SHALL navigate to `/admin`
2. WHEN an admin clicks the Health button in the desktop navbar, THE System SHALL navigate to `/admin/health`
3. WHEN an admin clicks the Admin button in the mobile navbar, THE System SHALL navigate to `/admin`
4. WHEN an admin clicks the System Health button in the mobile hamburger menu, THE System SHALL navigate to `/admin/health`
5. WHEN an admin clicks the Admin button in the bottom mobile nav, THE System SHALL navigate to `/admin`
6. THE Navbar SHALL visually indicate the active route based on the current URL path
7. THE non-admin navigation (browse, ai) SHALL continue using the existing state-based approach

### Requirement 5: URL State Synchronization

**User Story:** As a user, I want the application state to stay synchronized with the URL, so that navigation is predictable and consistent.

#### Acceptance Criteria

1. WHEN the URL changes to an admin route, THE Navbar SHALL reflect the active admin section
2. WHEN the URL changes away from admin routes, THE Navbar SHALL update accordingly
3. THE System SHALL NOT maintain duplicate state between `currentView` and route for admin pages
4. WHEN navigating between admin sub-routes, THE System SHALL preserve authentication state

### Requirement 6: Admin Navigation Visibility

**User Story:** As an admin user, I want to see both Admin Panel and System Health options in the navigation, so that I can easily access all admin functionality.

#### Acceptance Criteria

1. WHILE user.role equals 'Admin', THE Navbar SHALL display the Admin button
2. WHILE user.role equals 'Admin', THE Navbar SHALL display the Health button
3. IF user.role does not equal 'Admin', THEN THE Navbar SHALL NOT display admin navigation options
4. THE Health button SHALL be visible in desktop navbar, mobile hamburger menu, and optionally in bottom nav
