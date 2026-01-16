# Ingestion Cover Autofill - Requirements

## 1. Overview

Automatically search and attach book cover images to ingested books during the ingestion process, using the same cover search system as manual uploads. This feature will improve the visual quality of the library catalog by ensuring ingested books have proper cover images.

## 2. Background

Currently, books ingested from Internet Archive do not have cover images attached. Manual uploads use a sophisticated cover search system that queries multiple sources (Open Library, Google Books) to find high-quality cover images. This feature will integrate that same search capability into the automated ingestion pipeline.

## 3. User Stories

### 3.1 As a library admin
I want ingested books to automatically have cover images so that the catalog looks professional and complete without manual intervention.

### 3.2 As a library admin
I want the system to retry cover searches multiple times during ingestion so that temporary network issues don't result in missing covers.

### 3.3 As a library admin
I want to be notified when cover searches fail so that I can manually trigger cover generation for specific books.

### 3.4 As a library admin
I want to click on failed cover notifications to directly edit the book so that I can quickly fix missing covers.

### 3.5 As a library admin
I want to regenerate covers for existing books without covers so that I can improve the catalog retroactively.

## 4. Functional Requirements

### 4.1 Cover Search Integration
**Priority**: P0 (Critical)

The system SHALL integrate the existing cover search functionality (`/api/ai/book-cover` endpoint) into the ingestion pipeline.

**Acceptance Criteria**:
- Cover search is called for each book during ingestion
- Search uses book title, author, and ISBN (if available)
- Search follows the same multi-source strategy as manual uploads:
  1. ISBN-based lookup (Open Library, Google Books)
  2. Title/author search (Open Library)
  3. Title/author search (Google Books)
  4. Placeholder generation as fallback

### 4.2 Retry Logic
**Priority**: P0 (Critical)

The system SHALL retry failed cover searches up to 3 times with 0.5 second intervals during ingestion.

**Acceptance Criteria**:
- Maximum 3 retry attempts per book
- 500ms delay between retry attempts
- Retries only occur for network/timeout errors, not for "no cover found" results
- Successful cover search on any retry stops further attempts
- All retry attempts are logged for debugging

### 4.3 Cover Validation
**Priority**: P1 (High)

The system SHALL validate that found cover images contain the book title using fuzzy matching.

**Acceptance Criteria**:
- Cover URL is validated before saving to database
- Validation checks if cover is not a placeholder
- Title matching uses fuzzy/partial matching (at least 50% of title words present)
- Invalid covers are treated as "not found" and trigger fallback
- Validation failures are logged with reason

### 4.4 Failure Notifications
**Priority**: P1 (High)

The system SHALL create notifications for books where cover search fails after all retries.

**Acceptance Criteria**:
- Notification includes book ID, title, author, and timestamp
- Notifications are stored in a new `cover_search_failures` table
- Notifications are marked as "unresolved" by default
- Admin can mark notifications as "resolved" after manual fix
- Notifications include a direct link to edit the book

### 4.5 Admin Notifications Panel
**Priority**: P1 (High)

The system SHALL provide an admin interface to view and manage cover search failure notifications.

**Acceptance Criteria**:
- New "Notifications" section in admin panel
- Shows list of unresolved cover search failures
- Each notification is clickable to open book edit modal
- Admin can mark notifications as resolved
- Shows count of unresolved notifications
- Notifications are sorted by most recent first

### 4.6 Manual Retry Trigger
**Priority**: P2 (Medium)

The system SHALL allow admins to manually trigger cover search for specific books from the notifications panel.

**Acceptance Criteria**:
- "Retry Cover Search" button on each notification
- Button triggers the same cover search logic with retries
- Success updates the book and marks notification as resolved
- Failure shows error message to admin
- Loading state shown during retry

### 4.7 Bulk Cover Regeneration
**Priority**: P2 (Medium)

The system SHALL provide a way to regenerate covers for all existing books without covers.

**Acceptance Criteria**:
- Admin action button "Regenerate Missing Covers"
- Processes books in batches to avoid timeouts
- Shows progress indicator
- Creates notifications for failures
- Skips books that already have non-placeholder covers

### 4.8 Non-Blocking Ingestion
**Priority**: P0 (Critical)

Cover search failures SHALL NOT block the ingestion of books.

**Acceptance Criteria**:
- Books are inserted into database even if cover search fails
- Cover search errors are caught and logged
- Ingestion continues to next book after cover search failure
- Failed cover searches create notifications but don't fail the job
- Job summary includes cover search success/failure counts

## 5. Non-Functional Requirements

### 5.1 Performance
- Cover search with retries should complete within 5 seconds per book
- Bulk regeneration should process at least 10 books per minute
- Notifications panel should load in under 2 seconds

### 5.2 Reliability
- Cover search should succeed for at least 70% of public domain books
- Retry logic should improve success rate by at least 10%
- System should gracefully handle API rate limits

### 5.3 Maintainability
- Cover search logic should be reusable between ingestion and manual uploads
- Notification system should be extensible for other failure types
- All cover search attempts should be logged for debugging

## 6. Data Model

### 6.1 Cover Search Failures Table

```sql
CREATE TABLE cover_search_failures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES ingested_books(id) ON DELETE CASCADE,
  book_title TEXT NOT NULL,
  book_author TEXT,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'resolved', 'ignored')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id)
);

CREATE INDEX idx_cover_failures_status ON cover_search_failures(status);
CREATE INDEX idx_cover_failures_book ON cover_search_failures(book_id);
CREATE INDEX idx_cover_failures_created ON cover_search_failures(created_at DESC);
```

### 6.2 Ingested Books Table Updates

The `ingested_books` table already has `cover_url` field. No schema changes needed.

## 7. Integration Points

### 7.1 Existing Cover Search Endpoint
- **Endpoint**: `POST /api/ai/book-cover`
- **Input**: `{ title, author, isbn }`
- **Output**: `{ coverUrl, source }`
- **Integration**: Call from ingestion orchestrator

### 7.2 Ingestion Orchestrator
- **File**: `services/ingestion/orchestrator.js`
- **Integration Point**: After Step 6 (AI Description), before Step 7 (Database Insert)
- **New Step**: Step 6.5 - Cover Search with Retries

### 7.3 Admin Panel
- **File**: `components/AdminPanel.tsx`
- **New Component**: `CoverNotificationsPanel.tsx`
- **Integration**: New tab in admin interface

## 8. Success Metrics

### 8.1 Coverage
- At least 70% of ingested books have non-placeholder covers
- Cover search success rate improves by 10% with retry logic

### 8.2 Admin Efficiency
- Admins can resolve cover issues in under 30 seconds per book
- Bulk regeneration reduces manual work by 80%

### 8.3 User Experience
- Catalog visual quality improves (measured by user feedback)
- Reduced number of placeholder covers visible to users

## 9. Out of Scope

### 9.1 AI Image Generation
This feature does NOT generate new cover images using AI. It only searches for existing covers online.

### 9.2 Cover Quality Assessment
This feature does not assess the artistic quality or relevance of covers beyond basic title validation.

### 9.3 Copyright Verification
This feature assumes covers from Open Library and Google Books are properly licensed. No additional copyright checks are performed.

### 9.4 Cover Editing
This feature does not provide tools to edit or modify cover images. Admins can only search and replace.

## 10. Dependencies

### 10.1 External APIs
- Open Library API (covers.openlibrary.org)
- Google Books API (googleapis.com/books/v1)
- Both APIs must be accessible and responsive

### 10.2 Internal Services
- Existing cover search endpoint (`/api/ai/book-cover`)
- Ingestion orchestrator service
- Supabase database for notifications

### 10.3 Environment Variables
- No new environment variables required
- Uses existing Supabase configuration

## 11. Risks and Mitigations

### 11.1 API Rate Limits
**Risk**: External APIs may rate limit requests during bulk operations
**Mitigation**: 
- Add delays between requests (500ms)
- Implement exponential backoff for rate limit errors
- Process in small batches

### 11.2 Network Failures
**Risk**: Temporary network issues may cause cover searches to fail
**Mitigation**:
- Retry logic with 3 attempts
- Non-blocking design (failures don't stop ingestion)
- Notifications allow manual retry later

### 11.3 Cover Relevance
**Risk**: Found covers may not match the correct book edition
**Mitigation**:
- Title validation with fuzzy matching
- Admin notifications for manual review
- Easy manual override via edit modal

## 12. Future Enhancements

### 12.1 Smart Cover Selection
Use AI to analyze multiple cover options and select the most appropriate one based on publication year, edition, and visual quality.

### 12.2 Cover Caching
Cache cover search results to avoid redundant API calls for the same book across different ingestion runs.

### 12.3 User-Submitted Covers
Allow users to suggest better cover images for books with placeholder or incorrect covers.

### 12.4 Cover Analytics
Track which cover sources have the highest success rates and prioritize them in the search order.
