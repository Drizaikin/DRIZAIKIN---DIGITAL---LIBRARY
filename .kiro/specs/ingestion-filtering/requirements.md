# Ingestion Filtering - Requirements

## 1. Overview

Add configurable filtering to the book ingestion pipeline to control which books are ingested based on genre and author criteria. Unify the "category" and "genre" concepts so they represent the same classification, with AI automatically determining the genre/category during ingestion based on book metadata.

## 2. Background

Currently, the ingestion system fetches all public domain books from Internet Archive without filtering. This results in ingesting books that may not be relevant to the library's collection focus. Additionally, the system has both "category" and "genres" fields which create confusion - they should be unified into a single classification system where AI determines the appropriate genre/category during ingestion.

## 3. Glossary

- **Ingestion_Filter**: Configuration that determines which books to ingest
- **Genre_Filter**: Filter that accepts/rejects books based on genre classification
- **Author_Filter**: Filter that accepts/rejects books based on author name
- **Category**: Legacy field that will be unified with genre (deprecated)
- **Genre**: The classification assigned by AI during ingestion
- **Filter_Configuration**: Admin-configurable settings for ingestion filters
- **AI_Classifier**: Service that determines book genre from metadata

## 4. User Stories

### 4.1 As a library administrator
I want to configure which genres to ingest so that only relevant books (e.g., fiction only) are added to the collection.

### 4.2 As a library administrator
I want to configure which authors to ingest so that I can build focused collections (e.g., specific authors like Robin Sharma).

### 4.3 As a library administrator
I want the system to automatically determine book genres during ingestion so that I don't have to manually categorize books.

### 4.4 As a developer
I want "category" and "genre" to be the same thing so that there's no confusion in the data model.

### 4.5 As a library administrator
I want to update existing books' categories to match their AI-determined genres so that the collection is consistently classified.

## 5. Functional Requirements

### 5.1 Genre Filter Configuration
**Priority**: P0 (Critical)

THE system SHALL allow administrators to configure which genres to ingest.

**Acceptance Criteria**:
1. THE Filter_Configuration SHALL include a list of allowed genres
2. WHEN an allowed genres list is configured, THE system SHALL ingest only books matching those genres
3. WHEN the allowed genres list is empty, THE system SHALL ingest all genres
4. THE Filter_Configuration SHALL support multiple genre selection
5. THE system SHALL validate genre names against the genre taxonomy
6. THE Filter_Configuration SHALL be stored in environment variables or configuration file
7. THE system SHALL log filtered-out books for audit purposes

### 5.2 Author Filter Configuration
**Priority**: P0 (Critical)

THE system SHALL allow administrators to configure which authors to ingest.

**Acceptance Criteria**:
1. THE Filter_Configuration SHALL include a list of allowed authors
2. WHEN an allowed authors list is configured, THE system SHALL ingest only books by those authors
3. WHEN the allowed authors list is empty, THE system SHALL ingest all authors
4. THE Filter_Configuration SHALL support multiple author selection
5. THE system SHALL perform case-insensitive author name matching
6. THE system SHALL support partial author name matching (e.g., "Sharma" matches "Robin Sharma")
7. THE system SHALL log filtered-out books for audit purposes

### 5.3 AI Genre Classification During Ingestion
**Priority**: P0 (Critical)

THE system SHALL automatically determine book genre during ingestion using AI.

**Acceptance Criteria**:
1. WHEN a book is ingested, THE AI_Classifier SHALL analyze the book's title, author, description, and year
2. THE AI_Classifier SHALL assign 1-3 genres from the genre taxonomy
3. THE AI_Classifier SHALL optionally assign 1 sub-genre
4. THE system SHALL store the AI-determined genres in the book record
5. WHEN AI classification fails, THE system SHALL log a warning and continue ingestion
6. THE system SHALL NOT block ingestion if genre classification fails

### 5.4 Category and Genre Unification
**Priority**: P0 (Critical)

THE system SHALL unify "category" and "genre" into a single classification concept.

**Acceptance Criteria**:
1. THE system SHALL use the first genre from the genres array as the primary category
2. WHEN displaying a book's category, THE system SHALL show the first genre
3. WHEN filtering by category, THE system SHALL filter by genres
4. THE database SHALL maintain both category and genres fields for backward compatibility
5. THE system SHALL automatically sync category field with the first genre
6. THE system SHALL deprecate direct category assignment in favor of genre classification

### 5.5 Bulk Category Update
**Priority**: P1 (High)

THE system SHALL update existing books' categories to match their AI-determined genres.

**Acceptance Criteria**:
1. THE system SHALL provide an admin function to update all books' categories
2. WHEN the update function runs, THE system SHALL set each book's category to its first genre
3. WHEN a book has no genres, THE system SHALL set category to "Uncategorized"
4. THE system SHALL log the number of books updated
5. THE system SHALL handle errors gracefully without stopping the update process
6. THE system SHALL provide progress feedback during bulk updates

### 5.6 Filter Application During Ingestion
**Priority**: P0 (Critical)

THE system SHALL apply configured filters during the ingestion process.

**Acceptance Criteria**:
1. WHEN a book is fetched from Internet Archive, THE system SHALL classify its genre using AI
2. WHEN genre filter is configured, THE system SHALL check if the book's genre matches allowed genres
3. WHEN author filter is configured, THE system SHALL check if the book's author matches allowed authors
4. WHEN a book fails any filter, THE system SHALL skip ingestion and log the reason
5. WHEN a book passes all filters, THE system SHALL proceed with normal ingestion
6. THE system SHALL apply filters before downloading PDFs to save bandwidth

### 5.7 Filter Statistics and Reporting
**Priority**: P2 (Medium)

THE system SHALL track and report filtering statistics.

**Acceptance Criteria**:
1. THE system SHALL count books filtered by genre
2. THE system SHALL count books filtered by author
3. THE system SHALL count books that passed all filters
4. THE system SHALL display filter statistics in admin dashboard
5. THE system SHALL log filter decisions for audit trail
6. THE system SHALL provide a summary report after each ingestion run

### 5.8 Filter Configuration UI
**Priority**: P1 (High)

THE system SHALL provide a UI for administrators to configure filters.

**Acceptance Criteria**:
1. THE admin panel SHALL include a "Ingestion Filters" section
2. THE UI SHALL display a multi-select dropdown for genre filtering
3. THE UI SHALL display a text input for author filtering (comma-separated)
4. THE UI SHALL show current filter configuration
5. THE UI SHALL validate filter configuration before saving
6. THE UI SHALL provide a "Clear Filters" option to reset to no filtering
7. THE UI SHALL show filter statistics from recent ingestion runs

## 6. Non-Functional Requirements

### 6.1 Performance
- Genre classification should complete in under 15 seconds per book
- Filter checks should add less than 100ms overhead per book
- Bulk category updates should process at least 100 books per second

### 6.2 Reliability
- Filter failures should not stop ingestion pipeline
- AI classification failures should not block book ingestion
- System should gracefully handle invalid filter configurations

### 6.3 Maintainability
- Filter configuration should be easily editable
- Filter logic should be centralized and testable
- Category/genre sync logic should be automatic and transparent

## 7. Data Model Changes

### 7.1 Database Schema

**No schema changes required**. Existing schema already supports this:

```sql
CREATE TABLE books (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  category TEXT,        -- Will be auto-synced with first genre
  genres TEXT[],        -- AI-determined genres (1-3)
  subgenre TEXT,        -- AI-determined sub-genre (0-1)
  description TEXT,
  -- ... other fields
);
```

### 7.2 Configuration Schema

**New Environment Variables**:

```bash
# Genre filtering (comma-separated list)
INGEST_ALLOWED_GENRES="Fiction,Mystery & Thriller,Science Fiction & Fantasy"

# Author filtering (comma-separated list, case-insensitive)
INGEST_ALLOWED_AUTHORS="Robin Sharma,Paulo Coelho,Dale Carnegie"

# Enable/disable filtering
ENABLE_GENRE_FILTER=true
ENABLE_AUTHOR_FILTER=true
```

### 7.3 Filter Configuration Object

```javascript
interface IngestionFilterConfig {
  allowedGenres: string[];      // Empty = allow all
  allowedAuthors: string[];     // Empty = allow all
  enableGenreFilter: boolean;
  enableAuthorFilter: boolean;
}
```

## 8. Filter Logic

### 8.1 Genre Filter Logic

```
1. Fetch book metadata from Internet Archive
2. Run AI genre classification
3. IF genre filter enabled AND allowed genres list not empty:
   a. Check if ANY of book's genres match allowed genres
   b. IF no match: Skip book, log reason
   c. IF match: Continue to next filter
4. ELSE: Continue to next filter
```

### 8.2 Author Filter Logic

```
1. Get book's author name
2. IF author filter enabled AND allowed authors list not empty:
   a. Normalize author name (lowercase, trim)
   b. Check if ANY allowed author is substring of book's author
   c. IF no match: Skip book, log reason
   d. IF match: Continue to ingestion
3. ELSE: Continue to ingestion
```

### 8.3 Category Sync Logic

```
1. WHEN book is ingested with genres:
   a. Set category = genres[0] (first genre)
2. WHEN book is updated with new genres:
   a. Set category = genres[0]
3. WHEN book has no genres:
   a. Set category = "Uncategorized"
```

## 9. UI Components

### 9.1 Ingestion Filters Panel (New)

Admin panel section for configuring filters.

**Components**:
- Genre multi-select dropdown (populated from genre taxonomy)
- Author text input (comma-separated list)
- Enable/disable toggles for each filter type
- "Save Configuration" button
- "Clear All Filters" button
- Filter statistics display

### 9.2 Filter Statistics Display (New)

Shows filtering results from recent ingestion runs.

**Displays**:
- Total books evaluated
- Books passed all filters
- Books filtered by genre (with breakdown)
- Books filtered by author (with breakdown)
- Most common filtered genres
- Most common filtered authors

## 10. Success Metrics

### 10.1 Functional Success
- Genre filtering correctly excludes non-matching books
- Author filtering correctly excludes non-matching authors
- Category field automatically syncs with first genre
- Bulk category update successfully updates all books
- Filter configuration persists across ingestion runs

### 10.2 Performance Success
- Genre classification completes in <15s per book
- Filter checks add <100ms overhead per book
- Bulk updates process >100 books/second

### 10.3 User Experience Success
- Admins can easily configure filters via UI
- Filter statistics provide clear visibility
- Filtered books are logged for audit

## 11. Out of Scope

### 11.1 Advanced Filter Logic
This feature does NOT support:
- Complex boolean logic (AND/OR/NOT combinations)
- Date range filtering (publication year)
- Language filtering
- Subject/topic filtering beyond genre

### 11.2 Manual Genre Override
This feature does NOT support:
- Manual genre assignment by admins (use AI only)
- User-submitted genre corrections
- Genre voting or crowdsourcing

### 11.3 Dynamic Filter Updates
This feature does NOT support:
- Changing filters mid-ingestion
- Per-book filter overrides
- Scheduled filter changes

## 12. Dependencies

### 12.1 Existing Systems
- Genre taxonomy (`services/ingestion/genreTaxonomy.js`)
- AI genre classifier (`services/ingestion/genreClassifier.js`)
- Ingestion orchestrator (`services/ingestion/orchestrator.js`)
- Database writer (`services/ingestion/databaseWriter.js`)

### 12.2 No New Dependencies
- No new npm packages required
- No new external APIs required
- No database schema changes required

## 13. Risks and Mitigations

### 13.1 AI Classification Accuracy
**Risk**: AI might misclassify genres, causing incorrect filtering
**Mitigation**:
- Log all filter decisions for audit
- Provide admin UI to review filtered books
- Allow manual re-ingestion of specific books
- Improve AI prompts based on feedback

### 13.2 Over-Filtering
**Risk**: Too restrictive filters might exclude desired books
**Mitigation**:
- Default to no filtering (allow all)
- Provide clear filter statistics
- Log filtered books for review
- Support partial author name matching

### 13.3 Performance Impact
**Risk**: AI classification might slow down ingestion
**Mitigation**:
- Classification already implemented (no new overhead)
- Apply filters before PDF download
- Use existing 15s timeout for classification

## 14. Migration Strategy

### 14.1 Phase 1: Category Sync Implementation
- Implement automatic category sync with first genre
- Deploy to production
- No user impact (transparent change)

### 14.2 Phase 2: Bulk Category Update
- Run bulk update script to sync all existing books
- Monitor for errors
- Verify category values match genres

### 14.3 Phase 3: Filter Implementation
- Implement genre and author filtering logic
- Deploy with filters disabled by default
- Test with sample configurations

### 14.4 Phase 4: Admin UI
- Add filter configuration UI to admin panel
- Enable filters for production use
- Monitor filter statistics

## 15. Future Enhancements

### 15.1 Advanced Filter Logic
Implement boolean combinations of filters (AND/OR/NOT).

### 15.2 Publication Year Filtering
Filter books by publication date range.

### 15.3 Language Filtering
Filter books by language (English only, etc.).

### 15.4 Subject/Topic Filtering
Filter by Internet Archive subject tags.

### 15.5 Filter Presets
Save and load common filter configurations.

### 15.6 Manual Genre Correction
Allow admins to manually correct AI-assigned genres.
