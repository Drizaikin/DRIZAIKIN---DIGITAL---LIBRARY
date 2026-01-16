# Ingestion Filtering - Design Document

## 1. Overview

This feature adds configurable genre and author filtering to the book ingestion pipeline, allowing administrators to control which books are ingested. It also unifies the "category" and "genre" concepts so they represent the same classification, with AI automatically determining genres during ingestion.

**Key Design Decisions:**
- **Filter before PDF download**: Apply filters after AI classification but before downloading PDFs to save bandwidth and storage
- **Non-blocking filters**: Filter failures never stop ingestion pipeline
- **Environment-based configuration**: Use environment variables for easy deployment configuration
- **Category auto-sync**: Automatically sync category field with first genre (transparent to users)
- **Backward compatible**: Maintain both category and genres fields in database

## 2. Architecture

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                  Ingestion Pipeline Flow                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Fetch Books from Internet Archive                       │
│     (internetArchiveFetcher.js)                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Filter Duplicates                                        │
│     (deduplicationEngine.js)                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. AI Genre Classification                                  │
│     (genreClassifier.js)                                    │
│     - Analyzes title, author, description                   │
│     - Assigns 1-3 genres + optional sub-genre               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. APPLY FILTERS (NEW)                                      │
│     (ingestionFilter.js)                                    │
│     - Check genre filter                                     │
│     - Check author filter                                    │
│     - Skip book if filters fail                             │
│     - Log filter decisions                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Download & Validate PDF                                  │
│     (pdfValidator.js)                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Upload to Storage                                        │
│     (storageUploader.js)                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Insert to Database with Category Sync (UPDATED)         │
│     (databaseWriter.js)                                     │
│     - Set category = genres[0]                              │
│     - Store genres array                                     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Filter Integration Point

**Critical Design Decision**: Filters are applied AFTER AI classification but BEFORE PDF download. This:
- Ensures we have genre information to filter on
- Saves bandwidth by not downloading filtered books
- Saves storage space
- Reduces processing time

## 3. Components and Interfaces

### 3.1 New Component: Ingestion Filter Module

**File**: `services/ingestion/ingestionFilter.js`

**Purpose**: Centralized filtering logic for genre and author filtering

**Configuration Interface**:
```javascript
interface FilterConfig {
  allowedGenres: string[];      // Empty = allow all
  allowedAuthors: string[];     // Empty = allow all
  enableGenreFilter: boolean;
  enableAuthorFilter: boolean;
}
```

**Core Functions**:

```javascript
/**
 * Loads filter configuration from environment variables
 * @returns {FilterConfig}
 */
export function loadFilterConfig()

/**
 * Checks if a book passes genre filter
 * @param {string[]} bookGenres - Book's genres
 * @param {FilterConfig} config - Filter configuration
 * @returns {{passed: boolean, reason?: string}}
 */
export function checkGenreFilter(bookGenres, config)

/**
 * Checks if a book passes author filter
 * @param {string} bookAuthor - Book's author
 * @param {FilterConfig} config - Filter configuration
 * @returns {{passed: boolean, reason?: string}}
 */
export function checkAuthorFilter(bookAuthor, config)

/**
 * Applies all configured filters to a book
 * @param {Object} book - Book metadata with genres
 * @param {FilterConfig} config - Filter configuration
 * @returns {{passed: boolean, reason?: string, filters: Object}}
 */
export function applyFilters(book, config)

/**
 * Logs filter decision for audit trail
 * @param {Object} book - Book metadata
 * @param {Object} filterResult - Result from applyFilters
 */
export function logFilterDecision(book, filterResult)
```

### 3.2 Updated Component: Database Writer

**File**: `services/ingestion/databaseWriter.js`

**Changes**: Add automatic category synchronization

**New Function**:
```javascript
/**
 * Syncs category field with first genre
 * @param {string[]} genres - Array of genres
 * @returns {string} Category value
 */
function syncCategory(genres) {
  if (!genres || genres.length === 0) {
    return 'Uncategorized';
  }
  return genres[0];
}
```

**Updated insertBook() Function**:
```javascript
export async function insertBook(book) {
  // ... existing validation ...
  
  // NEW: Auto-sync category with first genre
  const category = syncCategory(book.genres);
  
  const bookRecord = {
    // ... existing fields ...
    category: category,           // Auto-synced from genres[0]
    genres: book.genres || null,
    subgenre: book.subgenre || null
  };
  
  // ... rest of function ...
}
```

### 3.3 Updated Component: Orchestrator

**File**: `services/ingestion/orchestrator.js`

**Changes**: Integrate filter checks after AI classification

**Updated processBook() Function**:
```javascript
async function processBook(book, dryRun = false, filterConfig) {
  // ... existing steps 1-5 (fetch, classify with AI) ...
  
  // NEW STEP 6: Apply Filters
  const filterResult = applyFilters({
    identifier: book.identifier,
    title: book.title,
    author: book.creator,
    genres: genres  // From AI classification
  }, filterConfig);
  
  if (!filterResult.passed) {
    console.log(`[Orchestrator] Book filtered: ${book.title} - ${filterResult.reason}`);
    logFilterDecision(book, filterResult);
    return { status: 'filtered', reason: filterResult.reason };
  }
  
  // ... continue with PDF download, upload, database insert ...
}
```

### 3.4 New Component: Bulk Category Update Script

**File**: `services/ingestion/bulkCategoryUpdate.js`

**Purpose**: One-time script to update all existing books' categories

**Core Function**:
```javascript
/**
 * Updates all books' categories to match their first genre
 * @returns {Promise<{updated: number, errors: number}>}
 */
export async function updateAllCategories()
```

**Implementation**:
```javascript
export async function updateAllCategories() {
  const client = getSupabase();
  let updated = 0;
  let errors = 0;
  
  // Fetch all books with genres
  const { data: books, error } = await client
    .from('books')
    .select('id, genres')
    .not('genres', 'is', null);
  
  if (error) {
    console.error('Failed to fetch books:', error);
    return { updated: 0, errors: 1 };
  }
  
  console.log(`Updating categories for ${books.length} books...`);
  
  // Update each book
  for (const book of books) {
    const category = book.genres && book.genres.length > 0 
      ? book.genres[0] 
      : 'Uncategorized';
    
    const { error: updateError } = await client
      .from('books')
      .update({ category })
      .eq('id', book.id);
    
    if (updateError) {
      console.error(`Failed to update book ${book.id}:`, updateError);
      errors++;
    } else {
      updated++;
    }
    
    // Progress feedback every 100 books
    if ((updated + errors) % 100 === 0) {
      console.log(`Progress: ${updated + errors}/${books.length}`);
    }
  }
  
  console.log(`Update complete: ${updated} updated, ${errors} errors`);
  return { updated, errors };
}
```

### 3.5 New Component: Filter Configuration UI

**File**: `components/IngestionFiltersPanel.tsx`

**Purpose**: Admin UI for configuring ingestion filters

**Props**: None (reads/writes to API)

**Features**:
- Multi-select dropdown for genres (populated from taxonomy)
- Text input for authors (comma-separated)
- Enable/disable toggles
- Save/Clear buttons
- Filter statistics display

**Component Structure**:
```typescript
interface FilterStats {
  totalEvaluated: number;
  passed: number;
  filteredByGenre: number;
  filteredByAuthor: number;
  topFilteredGenres: Array<{genre: string, count: number}>;
  topFilteredAuthors: Array<{author: string, count: number}>;
}

const IngestionFiltersPanel: React.FC = () => {
  const [config, setConfig] = useState<FilterConfig | null>(null);
  const [stats, setStats] = useState<FilterStats | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Load current configuration
  // Display configuration form
  // Save configuration
  // Display statistics
}
```

## 4. Data Models

### 4.1 Database Schema

**No changes required**. Existing schema supports this feature:

```sql
CREATE TABLE books (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  category TEXT,        -- Auto-synced with genres[0]
  genres TEXT[],        -- AI-determined genres
  subgenre TEXT,        -- AI-determined sub-genre
  -- ... other fields
);
```

### 4.2 Filter Configuration Storage

**Environment Variables** (`.env` or deployment config):
```bash
# Genre filtering
INGEST_ALLOWED_GENRES=Fiction,Mystery & Thriller,Science Fiction & Fantasy
ENABLE_GENRE_FILTER=true

# Author filtering
INGEST_ALLOWED_AUTHORS=Robin Sharma,Paulo Coelho,Dale Carnegie
ENABLE_AUTHOR_FILTER=true
```

**Alternative: Database Storage** (for UI-based configuration):
```sql
CREATE TABLE ingestion_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Example row:
INSERT INTO ingestion_config (config_key, config_value) VALUES
('filter_config', '{
  "allowedGenres": ["Fiction", "Mystery & Thriller"],
  "allowedAuthors": ["Robin Sharma"],
  "enableGenreFilter": true,
  "enableAuthorFilter": true
}');
```

### 4.3 Filter Statistics Storage

**New Table** (optional, for tracking):
```sql
CREATE TABLE ingestion_filter_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES ingestion_logs(id),
  book_identifier TEXT NOT NULL,
  book_title TEXT,
  book_author TEXT,
  book_genres TEXT[],
  filter_result TEXT NOT NULL, -- 'passed', 'filtered_genre', 'filtered_author'
  filter_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_filter_stats_job ON ingestion_filter_stats(job_id);
CREATE INDEX idx_filter_stats_result ON ingestion_filter_stats(filter_result);
```

## 5. Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### 5.1 Acceptance Criteria Testing Prework

### 5.2 Property Reflection

After analyzing the acceptance criteria, I've identified the following consolidations:

**Consolidation 1**: Requirements 5.1.7 and 5.2.7 (logging filtered books) test the same behavior - can be combined into one property about audit logging.

**Consolidation 2**: Requirements 5.3.5 and 5.3.6 (AI classification failure handling) test the same non-blocking behavior - can be combined.

**Consolidation 3**: Requirements 5.6.2, 5.6.3, 5.6.4, and 5.6.5 (filter application logic) test related filtering behavior - can be combined into comprehensive filter application properties.

**Consolidation 4**: Requirements 5.7.1, 5.7.2, and 5.7.3 (statistics counting) test related counting behavior - can be combined into one property about statistics accuracy.

This reduces redundancy while maintaining comprehensive coverage.

### 5.3 Correctness Properties

**Property 1: Genre Filter Correctness**
*For any* book with genres G and filter configuration with allowed genres A (where A is non-empty), the book SHALL pass the genre filter if and only if there exists at least one genre g in G such that g is in A.
**Validates: Requirements 5.1.2, 5.6.2**

**Property 2: Empty Genre Filter Allows All**
*For any* book, when the allowed genres list is empty, the genre filter SHALL pass the book.
**Validates: Requirements 5.1.3**

**Property 3: Author Filter Correctness**
*For any* book with author name B and filter configuration with allowed authors A (where A is non-empty), the book SHALL pass the author filter if and only if there exists at least one author a in A such that a is a case-insensitive substring of B.
**Validates: Requirements 5.2.2, 5.2.5, 5.2.6, 5.6.3**

**Property 4: Empty Author Filter Allows All**
*For any* book, when the allowed authors list is empty, the author filter SHALL pass the book.
**Validates: Requirements 5.2.3**

**Property 5: Genre Taxonomy Validation**
*For any* genre name in the filter configuration, the system SHALL validate it against the PRIMARY_GENRES taxonomy and reject invalid genres.
**Validates: Requirements 5.1.5**

**Property 6: Filter Audit Logging**
*For any* book that fails any filter, the system SHALL log the filter decision including book identifier, filter type, and reason.
**Validates: Requirements 5.1.7, 5.2.7, 5.6.4, 5.7.5**

**Property 7: AI Classification Input Completeness**
*For any* book being classified, the AI classifier SHALL receive title, author, description, and year fields.
**Validates: Requirements 5.3.1**

**Property 8: Genre Count Bounds**
*For any* AI classification result, the number of assigned genres SHALL be between 1 and 3 inclusive.
**Validates: Requirements 5.3.2**

**Property 9: Sub-Genre Count Bounds**
*For any* AI classification result, the number of assigned sub-genres SHALL be 0 or 1.
**Validates: Requirements 5.3.3**

**Property 10: Genre Storage Persistence**
*For any* book successfully ingested, the AI-determined genres SHALL be stored in the database genres field.
**Validates: Requirements 5.3.4**

**Property 11: Non-Blocking Classification**
*For any* book where AI classification fails, the ingestion process SHALL continue without blocking.
**Validates: Requirements 5.3.5, 5.3.6**

**Property 12: Category Sync with First Genre**
*For any* book with genres array G (where G is non-empty), the category field SHALL equal G[0].
**Validates: Requirements 5.4.1, 5.4.2, 5.4.5**

**Property 13: Uncategorized Default**
*For any* book with empty or null genres array, the category field SHALL be set to "Uncategorized".
**Validates: Requirements 5.5.3**

**Property 14: Bulk Update Category Sync**
*For any* book processed by the bulk update function, the category field SHALL be set to the first genre if genres exist, otherwise "Uncategorized".
**Validates: Requirements 5.5.2, 5.5.3**

**Property 15: Bulk Update Error Resilience**
*For any* error encountered during bulk category update, the update process SHALL continue processing remaining books.
**Validates: Requirements 5.5.5**

**Property 16: Filter Application Before PDF Download**
*For any* book in the ingestion pipeline, filters SHALL be applied after AI classification but before PDF download.
**Validates: Requirements 5.6.6**

**Property 17: Combined Filter Logic**
*For any* book, when both genre and author filters are enabled, the book SHALL pass only if it passes BOTH filters.
**Validates: Requirements 5.6.2, 5.6.3, 5.6.5**

**Property 18: Filter Statistics Accuracy**
*For any* ingestion run, the sum of (books passed + books filtered by genre + books filtered by author) SHALL equal the total books evaluated.
**Validates: Requirements 5.7.1, 5.7.2, 5.7.3**

**Property 19: Configuration Validation**
*For any* filter configuration save operation, the system SHALL validate genre names against taxonomy and author names are non-empty strings before saving.
**Validates: Requirements 5.8.5**

## 6. Error Handling

### 6.1 Invalid Filter Configuration

**Scenario**: Admin provides invalid genre names in configuration

**Handling**:
- Validate genre names against taxonomy on save
- Reject configuration with clear error message
- List invalid genre names
- Suggest valid alternatives

**Example**:
```javascript
// Invalid config: ["Fiction", "InvalidGenre", "Mystery"]
// Error: "Invalid genres: InvalidGenre. Valid genres: Fiction, Mystery & Thriller, ..."
```

### 6.2 AI Classification Failure

**Scenario**: AI classifier fails or returns no genres

**Handling**:
- Log warning with book identifier
- Continue ingestion without genres
- Set category to "Uncategorized"
- Do not apply genre filter (treat as no genres)

### 6.3 Filter Check Failure

**Scenario**: Filter logic throws exception

**Handling**:
- Log error with stack trace
- Default to allowing book (fail open)
- Continue ingestion
- Alert admin of filter malfunction

### 6.4 Bulk Update Errors

**Scenario**: Individual book update fails during bulk operation

**Handling**:
- Log error with book ID
- Continue with next book
- Track error count
- Report summary at end

### 6.5 Empty Filter Lists

**Scenario**: Both genre and author filters are empty

**Handling**:
- Treat as "allow all" (no filtering)
- Log that filtering is disabled
- Continue normal ingestion

## 7. Testing Strategy

### 7.1 Dual Testing Approach

**Unit Tests**: Verify specific examples and edge cases
- Test specific genre/author combinations
- Test empty filter lists
- Test invalid configurations
- Test category sync logic

**Property-Based Tests**: Verify universal properties across all inputs
- Test filter logic with random books and configurations
- Test category sync with random genre arrays
- Test bulk update with random book sets
- Test statistics accuracy with random filter results

### 7.2 Property-Based Testing Configuration

**Framework**: fast-check (JavaScript/TypeScript)

**Configuration**:
- Minimum 100 iterations per property test
- Tag format: `Feature: ingestion-filtering, Property N: [property text]`

**Example Test**:
```javascript
// Feature: ingestion-filtering, Property 1: Genre Filter Correctness
test('genre filter correctly filters books', () => {
  fc.assert(
    fc.property(
      fc.record({
        genres: fc.array(fc.constantFrom(...PRIMARY_GENRES), { minLength: 1, maxLength: 3 }),
        allowedGenres: fc.array(fc.constantFrom(...PRIMARY_GENRES), { minLength: 1, maxLength: 10 })
      }),
      ({ genres, allowedGenres }) => {
        const result = checkGenreFilter(genres, { allowedGenres, enableGenreFilter: true });
        const hasMatch = genres.some(g => allowedGenres.includes(g));
        expect(result.passed).toBe(hasMatch);
      }
    ),
    { numRuns: 100 }
  );
});
```

### 7.3 Test Organization

```
tests/
  ingestion-filtering/
    genreFilter.property.test.ts
    authorFilter.property.test.ts
    categorySync.property.test.ts
    bulkUpdate.property.test.ts
    filterStatistics.property.test.ts
    integration.test.ts
```

## 8. Implementation Notes

### 8.1 Migration Strategy

**Phase 1: Category Sync (No User Impact)**
- Update databaseWriter.js to auto-sync category
- Deploy to production
- Transparent change

**Phase 2: Bulk Category Update**
- Run bulk update script
- Monitor progress and errors
- Verify all books updated

**Phase 3: Filter Implementation**
- Implement ingestionFilter.js module
- Integrate into orchestrator
- Deploy with filters disabled

**Phase 4: Configuration UI**
- Add IngestionFiltersPanel to admin
- Enable filter configuration
- Test with sample filters

**Phase 5: Production Filtering**
- Enable filters based on admin configuration
- Monitor filter statistics
- Adjust as needed

### 8.2 Performance Considerations

**Filter Performance**:
- Genre filter: O(n*m) where n=book genres, m=allowed genres (typically small)
- Author filter: O(n) where n=allowed authors
- Total overhead: <100ms per book

**Bandwidth Savings**:
- Filtering before PDF download saves significant bandwidth
- Example: If 50% of books filtered, save 50% of PDF download bandwidth

**Database Impact**:
- Category sync adds no overhead (happens during insert)
- Bulk update: Process 100+ books/second

### 8.3 Configuration Management

**Environment Variables** (Recommended for simple deployments):
```bash
INGEST_ALLOWED_GENRES=Fiction,Mystery & Thriller
INGEST_ALLOWED_AUTHORS=Robin Sharma,Paulo Coelho
ENABLE_GENRE_FILTER=true
ENABLE_AUTHOR_FILTER=true
```

**Database Storage** (Recommended for UI-based configuration):
- Store in `ingestion_config` table
- Cache in memory (5-minute TTL)
- Reload on configuration change

### 8.4 Monitoring and Alerts

**Metrics to Track**:
- Filter pass rate (% of books passing filters)
- Most common filtered genres
- Most common filtered authors
- Category sync success rate
- Bulk update progress

**Alerts**:
- Alert if filter pass rate <10% (too restrictive)
- Alert if filter pass rate >95% (filters not working)
- Alert if category sync fails >1% of time

## 9. API Endpoints

### 9.1 Filter Configuration API

**GET /api/admin/ingestion/filters**
- Returns current filter configuration
- Requires admin authentication

**POST /api/admin/ingestion/filters**
- Updates filter configuration
- Validates configuration
- Requires admin authentication

**Request Body**:
```json
{
  "allowedGenres": ["Fiction", "Mystery & Thriller"],
  "allowedAuthors": ["Robin Sharma"],
  "enableGenreFilter": true,
  "enableAuthorFilter": true
}
```

**Response**:
```json
{
  "success": true,
  "config": { /* saved configuration */ }
}
```

### 9.2 Filter Statistics API

**GET /api/admin/ingestion/filter-stats**
- Returns filter statistics from recent runs
- Requires admin authentication

**Response**:
```json
{
  "totalEvaluated": 1000,
  "passed": 450,
  "filteredByGenre": 400,
  "filteredByAuthor": 150,
  "topFilteredGenres": [
    {"genre": "Science", "count": 200},
    {"genre": "History", "count": 150}
  ],
  "topFilteredAuthors": [
    {"author": "Unknown Author", "count": 100}
  ]
}
```

### 9.3 Bulk Category Update API

**POST /api/admin/books/bulk-update-categories**
- Triggers bulk category update
- Returns immediately with job ID
- Requires admin authentication

**Response**:
```json
{
  "success": true,
  "jobId": "bulk_update_123",
  "message": "Bulk update started"
}
```

**GET /api/admin/books/bulk-update-categories/:jobId**
- Returns progress of bulk update job

**Response**:
```json
{
  "jobId": "bulk_update_123",
  "status": "running",
  "progress": {
    "total": 1000,
    "processed": 450,
    "updated": 445,
    "errors": 5
  }
}
```

## 10. Success Criteria

### 10.1 Functional Success
- Genre filtering correctly excludes non-matching books
- Author filtering correctly excludes non-matching authors
- Category automatically syncs with first genre
- Bulk update successfully updates all books
- Filter configuration persists and applies correctly

### 10.2 Performance Success
- Filter checks add <100ms overhead per book
- Bulk update processes >100 books/second
- No increase in ingestion failure rate

### 10.3 User Experience Success
- Admins can easily configure filters via UI
- Filter statistics provide clear visibility
- Filtered books are logged for audit
- No manual category assignment needed

## 11. Future Enhancements

### 11.1 Advanced Filter Logic
Implement boolean combinations (AND/OR/NOT) for complex filtering.

### 11.2 Publication Year Filtering
Filter books by publication date range.

### 11.3 Language Filtering
Filter books by language (English only, etc.).

### 11.4 Subject/Topic Filtering
Filter by Internet Archive subject tags.

### 11.5 Filter Presets
Save and load common filter configurations.

### 11.6 Manual Genre Correction
Allow admins to manually correct AI-assigned genres.

### 11.7 Filter Analytics Dashboard
Detailed analytics on filter effectiveness and trends.

## 12. Appendix

### 12.1 Filter Decision Flow

```
Book Fetched
     │
     ▼
AI Classification
     │
     ▼
Genre Filter Enabled? ──No──┐
     │                       │
    Yes                      │
     │                       │
     ▼                       │
Genres Match Allowed? ──No──┼──> Skip Book, Log Reason
     │                       │
    Yes                      │
     │                       │
     ▼                       │
Author Filter Enabled? ──No─┤
     │                       │
    Yes                      │
     │                       │
     ▼                       │
Author Matches Allowed? ─No─┤
     │                       │
    Yes                      │
     │                       │
     ▼                       │
Download PDF <──────────────┘
     │
     ▼
Upload to Storage
     │
     ▼
Insert to Database
(with category = genres[0])
```

### 12.2 Example Filter Configurations

**Fiction Only**:
```json
{
  "allowedGenres": [
    "Fiction",
    "Mystery & Thriller",
    "Romance",
    "Science Fiction & Fantasy",
    "Horror",
    "Adventure"
  ],
  "allowedAuthors": [],
  "enableGenreFilter": true,
  "enableAuthorFilter": false
}
```

**Specific Authors**:
```json
{
  "allowedGenres": [],
  "allowedAuthors": [
    "Robin Sharma",
    "Paulo Coelho",
    "Dale Carnegie",
    "Napoleon Hill"
  ],
  "enableGenreFilter": false,
  "enableAuthorFilter": true
}
```

**Combined Filtering**:
```json
{
  "allowedGenres": ["Self-Help & Personal Development"],
  "allowedAuthors": ["Robin Sharma", "Dale Carnegie"],
  "enableGenreFilter": true,
  "enableAuthorFilter": true
}
```

### 12.3 Category Migration SQL

```sql
-- Update all books' categories to match first genre
UPDATE books
SET category = genres[1]
WHERE genres IS NOT NULL AND array_length(genres, 1) > 0;

-- Set uncategorized for books without genres
UPDATE books
SET category = 'Uncategorized'
WHERE genres IS NULL OR array_length(genres, 1) = 0;

-- Verify migration
SELECT 
  category,
  COUNT(*) as book_count
FROM books
GROUP BY category
ORDER BY book_count DESC;
```
