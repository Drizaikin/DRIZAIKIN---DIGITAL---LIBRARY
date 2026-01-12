# Implementation Plan: Admin Health Dashboard

## Overview

This implementation plan adds a secure Admin Health Dashboard to monitor system health. The dashboard provides real-time metrics for ingestion, maintenance, storage, and AI classification services, with safe admin controls for manual operations.

## Tasks

- [x] 1. Create health service module
  - [x] 1.1 Create healthService.js with core functions
    - Implement getHealthMetrics() aggregator function
    - Implement calculateStatus() with status rules
    - Implement getDailyMetrics() for today's counts
    - Implement getIngestionProgress() from ingestion_state
    - Implement getStorageHealth() for PDF counts
    - Implement getErrorSummary() for recent errors
    - _Requirements: 2.1-2.7, 3.1-3.6, 4.1-4.5, 5.1-5.5, 6.1-6.5_
  - [x] 1.2 Write property test for status calculation
    - **Property 2: Status Calculation Consistency**
    - **Validates: Requirements 2.4, 2.5, 2.6, 2.7**
  - [x] 1.3 Write property test for metrics non-negativity
    - **Property 3: Metrics Non-Negativity**
    - **Validates: Requirements 3.1-3.6**

- [x] 2. Create health API endpoint
  - [x] 2.1 Create api/admin/health/index.js
    - Implement GET handler for health metrics
    - Add authorization validation using ADMIN_HEALTH_SECRET
    - Return structured HealthMetrics response
    - Handle errors gracefully
    - _Requirements: 1.1-1.5, 8.1-8.2, 9.1_
  - [x] 2.2 Write property test for authorization enforcement
    - **Property 1: Authorization Enforcement**
    - **Validates: Requirements 1.2, 1.3, 1.4**
  - [x] 2.3 Write property test for sensitive data exclusion
    - **Property 5: Error Message Sanitization**
    - **Validates: Requirements 1.5, 6.5**

- [x] 3. Checkpoint - Verify health API
  - Ensure API returns valid metrics with proper auth
  - Test unauthorized access returns 401
  - Ask the user if questions arise

- [x] 4. Create actions API endpoint
  - [x] 4.1 Create api/admin/health/actions.js
    - Implement POST handler for admin actions
    - Add authorization validation
    - Implement trigger_ingestion action (reuse existing)
    - Implement pause_ingestion and resume_ingestion actions
    - Log all actions with timestamp
    - _Requirements: 7.1-7.7_
  - [x] 4.2 Write property test for action logging
    - **Property 4: Action Logging Completeness**
    - **Validates: Requirements 7.5, 7.6**

- [x] 5. Create dashboard UI components
  - [x] 5.1 Create StatusCard component
    - Display status indicator (healthy/warning/failed)
    - Show title, status icon, and last updated time
    - Use theme colors for status indicators
    - _Requirements: 2.1-2.3_
  - [x] 5.2 Create MetricsCard component
    - Display grouped metrics with labels and values
    - Support number and string values
    - _Requirements: 3.1-3.5, 4.1-4.5, 5.1-5.4_
  - [x] 5.3 Create ErrorList component
    - Display scrollable list of errors
    - Show timestamp, type, and message for each
    - Limit to 10 items
    - _Requirements: 6.1-6.4_
  - [x] 5.4 Create ActionButton component
    - Display action button with icon
    - Show confirmation before action
    - Handle loading and error states
    - _Requirements: 7.1-7.4_

- [x] 6. Create main dashboard page
  - [x] 6.1 Create AdminHealthDashboard.tsx
    - Fetch metrics from health API
    - Display loading state while fetching
    - Display error state on failure
    - Render all status cards, metrics, errors, and actions
    - Add manual refresh button
    - _Requirements: 8.3-8.5_
  - [x] 6.2 Add route to App.tsx
    - Add /admin/health route for admin users
    - Restrict access to Admin role
    - _Requirements: 1.1_

- [x] 7. Checkpoint - Integration testing
  - Test full dashboard flow with real API
  - Verify all metrics display correctly
  - Test admin actions work properly
  - Ask the user if questions arise

- [x] 8. Add ingestion state management
  - [x] 8.1 Add pause/resume state to ingestion_state table
    - Add is_paused column to ingestion_state
    - Update stateManager.js with pause/resume functions
    - _Requirements: 7.3, 7.4_
  - [x] 8.2 Update orchestrator to check pause state
    - Skip ingestion if paused
    - Log pause state in job results
    - _Requirements: 7.3, 7.4_

- [x] 9. Final checkpoint - Complete verification
  - Run all property tests
  - Verify dashboard loads within 3 seconds
  - Test all admin actions
  - Ensure all tests pass, ask the user if questions arise

## Notes

- All property tests are required for comprehensive validation
- Dashboard requires ADMIN_HEALTH_SECRET environment variable
- All admin actions are logged for audit trail
- No destructive actions are available through the dashboard
- Reuses existing ingestion trigger logic from api/ingest/trigger.js
