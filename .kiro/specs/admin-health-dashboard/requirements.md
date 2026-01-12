# Requirements Document

## Introduction

This feature adds a private Admin Health Dashboard to the PUEA Digital Library system. The dashboard provides a real-time overview of system health including ingestion status, maintenance operations, storage health, and AI classification metrics. It enables administrators to monitor automation health, detect failures early, and trigger safe administrative actions without checking logs.

## Glossary

- **Health_Dashboard**: The admin-only interface displaying system health metrics and status
- **System_Status**: The overall health indicator (healthy/warning/failed) derived from component statuses
- **Ingestion_Service**: The automated service that imports books from Internet Archive
- **Maintenance_Service**: The automated service that performs cleanup and optimization tasks
- **AI_Classifier**: The service that assigns genres to books using OpenRouter API
- **Admin_Secret**: Environment-based authentication token for dashboard access
- **Health_API**: The backend API endpoints that provide health metrics data

## Requirements

### Requirement 1: Access Control

**User Story:** As a system administrator, I want the health dashboard to be restricted to authorized admins only, so that sensitive system information is protected.

#### Acceptance Criteria

1. THE Health_Dashboard SHALL be accessible only at the route /admin/health
2. WHEN a request lacks valid authorization, THE Health_API SHALL return a 401 Unauthorized response
3. THE Health_API SHALL validate requests using an ADMIN_HEALTH_SECRET environment variable
4. IF the ADMIN_HEALTH_SECRET is not configured, THEN THE Health_API SHALL reject all requests
5. THE Health_Dashboard SHALL NOT expose any sensitive API keys or credentials in responses

### Requirement 2: System Status Display

**User Story:** As an administrator, I want to see at-a-glance system health status, so that I can quickly identify if any component needs attention.

#### Acceptance Criteria

1. THE Health_Dashboard SHALL display ingestion status as one of: healthy, warning, or failed
2. THE Health_Dashboard SHALL display maintenance status as one of: healthy, warning, or failed
3. THE Health_Dashboard SHALL display AI classification status as one of: healthy, warning, or failed
4. WHEN the last successful run was more than 48 hours ago, THE System_Status SHALL be "warning"
5. WHEN the error count in the last 24 hours exceeds 5, THE System_Status SHALL be "warning"
6. WHEN the last run status is "failed", THE System_Status SHALL be "failed"
7. WHEN the last run was within 48 hours and error count is below 5, THE System_Status SHALL be "healthy"

### Requirement 3: Daily Metrics Display

**User Story:** As an administrator, I want to see daily ingestion and classification metrics, so that I can track system throughput and identify trends.

#### Acceptance Criteria

1. THE Health_Dashboard SHALL display the count of books ingested today
2. THE Health_Dashboard SHALL display the count of books skipped (duplicates) today
3. THE Health_Dashboard SHALL display the count of books that failed ingestion today
4. THE Health_Dashboard SHALL display the count of books classified with genres today
5. THE Health_Dashboard SHALL display the count of AI classification failures today
6. WHEN no data exists for today, THE Health_Dashboard SHALL display zero for all metrics

### Requirement 4: Ingestion Progress Display

**User Story:** As an administrator, I want to see current ingestion progress, so that I can understand where the system is in the catalog.

#### Acceptance Criteria

1. THE Health_Dashboard SHALL display the current ingestion source name
2. THE Health_Dashboard SHALL display the last cursor or page number
3. THE Health_Dashboard SHALL display the total books ingested from the source
4. THE Health_Dashboard SHALL display the timestamp of the last ingestion run
5. THE Health_Dashboard SHALL display the status of the last ingestion run

### Requirement 5: Storage Health Display

**User Story:** As an administrator, I want to see storage health metrics, so that I can monitor resource usage and identify issues.

#### Acceptance Criteria

1. THE Health_Dashboard SHALL display the total count of PDFs stored
2. THE Health_Dashboard SHALL display the estimated storage usage in MB/GB
3. THE Health_Dashboard SHALL display the count of orphaned files (if detectable)
4. THE Health_Dashboard SHALL display the count of corrupt or zero-byte PDFs (if detectable)
5. IF storage metrics are unavailable, THEN THE Health_Dashboard SHALL display "N/A"

### Requirement 6: Error Summary Display

**User Story:** As an administrator, I want to see recent errors, so that I can diagnose issues without checking logs.

#### Acceptance Criteria

1. THE Health_Dashboard SHALL display the last 10 ingestion errors
2. THE Health_Dashboard SHALL display the last 10 maintenance actions
3. THE Health_Dashboard SHALL display the last AI classification error
4. WHEN displaying errors, THE Health_Dashboard SHALL show timestamp, error type, and short message
5. THE Health_Dashboard SHALL NOT display full stack traces or sensitive data in error messages

### Requirement 7: Admin Controls

**User Story:** As an administrator, I want safe action buttons, so that I can manually trigger operations when needed.

#### Acceptance Criteria

1. THE Health_Dashboard SHALL provide a button to trigger ingestion manually
2. THE Health_Dashboard SHALL provide a button to trigger maintenance manually
3. THE Health_Dashboard SHALL provide a button to pause ingestion
4. THE Health_Dashboard SHALL provide a button to resume ingestion
5. WHEN an admin action is triggered, THE Health_API SHALL log the action with timestamp and admin identifier
6. THE Health_API SHALL reuse existing ingestion and maintenance logic for manual triggers
7. THE Health_Dashboard SHALL NOT provide any destructive actions (delete, drop, truncate)

### Requirement 8: Performance and Reliability

**User Story:** As an administrator, I want the dashboard to load quickly, so that I can check system health efficiently.

#### Acceptance Criteria

1. THE Health_API SHALL use optimized queries to avoid heavy joins
2. THE Health_API SHALL respond within 3 seconds under normal conditions
3. THE Health_Dashboard SHALL display a loading state while fetching data
4. IF the Health_API fails, THEN THE Health_Dashboard SHALL display an error message
5. THE Health_Dashboard SHALL support manual refresh of metrics

### Requirement 9: Extensibility

**User Story:** As a developer, I want the dashboard to be easily extensible, so that new metrics can be added later.

#### Acceptance Criteria

1. THE Health_API SHALL return metrics in a structured JSON format
2. THE Health_Dashboard SHALL use a modular component structure
3. THE system SHALL provide documentation on how to add new metrics
