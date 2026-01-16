# Expand Genre Support - Design Document

## 1. Overview

This feature expands the genre classification system from 27 academic-focused genres to 40+ genres covering fiction, modern literature, and popular categories. The design maintains backward compatibility with existing classifications while adding new UI components for genre display and filtering.

**Key Design Decisions:**
- **Preserve existing taxonomy structure**: Keep the flat genre model (primary + optional sub-genre) to avoid database schema changes
- **Centralized taxonomy management**: All genres defined in a single file for easy maintenance
- **Non-breaking expansion**: New genres added alongside existing ones, no migration required
- **Component-based UI**: Create reusable genre display components for consistency

## 2. Architecture

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React/TypeScript)              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ GenreBadge   │  │ GenreList    │  │ GenreFilter  │      │
│  │ Component    │  │ Component    │  │ Component    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                  ┌─────────▼─────────┐                       │
│                  │   BookCard.tsx    │                       │
│                  │BookDetailsModal   │                       │
│                  └─────────┬─────────┘                       │
└────────────────────────────┼─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│              Backend Services (Node.js)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │  genreTaxonomy.js    │  │ genreClassifier.js   │         │
│  │  - PRIMARY_GENRES    │  │ - classifyBook()     │         │
│  │  - SUB_GENRES        │  │ - buildPrompt()      │         │
│  │  - validateGenres()  │  │ - parseResponse()    │         │
│  └──────────────────────┘  └──────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

1. **Genre Classification** (AI Ingestion):
   - AI Classifier reads expanded taxonomy
   - Generates prompt with all available genres
   - Validates AI response against taxonomy
   - Stores 1-3 genres + optional sub-genre

2. **Genre Display** (UI):
   - BookCard/Modal reads book.genres array
   - GenreList component renders genre badges
   - Limits display to 3 genres on cards
   - Shows all genres in details modal

3. **Genre Filtering** (Search):
   - GenreFilter component lists all taxonomy genres
   - User selects genre from dropdown
   - Query filters books by selected genre
   - Displays count of books per genre

## 3. Components and Interfaces

### 3.1 Backend: Genre Taxonomy Module

**File**: `services/ingestion/genreTaxonomy.js`

**Expanded PRIMARY_GENRES Array** (Requirements 5.1):

```javascript
export const PRIMARY_GENRES = [
  // === FICTION GENRES === (New)
  'Fiction',                      // General fiction
  'Mystery & Thriller',           // Detective, crime, suspense
  'Romance',                      // Love stories
  'Science Fiction & Fantasy',    // Sci-fi, fantasy, speculative
  'Horror',                       // Horror, supernatural
  'Adventure',                    // Action, adventure
  'Historical Fiction',           // Fiction set in historical periods
  'Literary Fiction',             // Character-driven, literary merit
  'Humor & Satire',              // Comedy, satire, parody
  
  // === AGE-SPECIFIC GENRES === (New)
  'Young Adult',                  // Teen fiction
  'Children\'s Literature',       // Kids books
  'Middle Grade',                 // Ages 8-12
  
  // === FORMAT GENRES === (New/Expanded)
  'Graphic Novels & Comics',      // Visual storytelling
  'Short Stories',                // Story collections
  'Plays & Drama',                // Theatrical works (expanded from Drama)
  
  // === NON-FICTION GENRES === (New)
  'Self-Help & Personal Development',
  'Travel & Exploration',
  'Cooking & Food',
  'Sports & Recreation',
  'True Crime',
  'Memoir & Autobiography',       // Personal narratives (expanded from Biography)
  
  // === EXISTING ACADEMIC GENRES === (Preserved)
  'Philosophy',
  'Religion',
  'Theology',
  'Sacred Texts',
  'History',
  'Biography',
  'Science',
  'Mathematics',
  'Medicine',
  'Law',
  'Politics',
  'Economics',
  'Literature',
  'Poetry',
  'Drama',
  'Mythology',
  'Military & Strategy',
  'Education',
  'Linguistics',
  'Ethics',
  'Anthropology',
  'Sociology',
  'Psychology',
  'Geography',
  'Astronomy',
  'Alchemy & Esoterica',
  'Art & Architecture'
];
```

**Total**: 46 primary genres (27 existing + 19 new)

**Expanded SUB_GENRES Array** (Requirements 5.2):

```javascript
export const SUB_GENRES = [
  // === FICTION SUB-GENRES === (New)
  'Detective',                    // Detective fiction
  'Spy & Espionage',             // Spy thrillers
  'Psychological Thriller',       // Mind games, suspense
  'Paranormal Romance',           // Romance with supernatural
  'Contemporary Romance',         // Modern romance
  'Dystopian',                   // Dystopian futures
  'Space Opera',                 // Epic space adventures
  'Urban Fantasy',               // Fantasy in modern cities
  'Epic Fantasy',                // High fantasy, world-building
  'Gothic',                      // Gothic horror/romance
  'Steampunk',                   // Victorian sci-fi
  'Cyberpunk',                   // High-tech dystopia
  
  // === EXISTING SUB-GENRES === (Preserved)
  'Ancient',
  'Medieval',
  'Classical',
  'Early Modern',
  'Commentary',
  'Translation',
  'Manuscript',
  'Legal Code',
  'Canonical Text'
];
```

**Total**: 21 sub-genres (9 existing + 12 new)

**No Changes to Validation Functions**:
- `validateGenre()`, `validateGenres()`, `validateSubgenre()` remain unchanged
- They automatically work with expanded arrays
- O(1) lookup performance maintained via Map structures

### 3.2 Backend: Genre Classifier Updates

**File**: `services/ingestion/genreClassifier.js`

**Updated `buildPrompt()` Function**:
- Automatically includes all genres from expanded taxonomy
- No code changes needed (already uses `PRIMARY_GENRES` and `SUB_GENRES` arrays)
- AI will receive updated genre lists in prompt

**Design Rationale**: The classifier is already designed to be taxonomy-agnostic. It reads from the taxonomy arrays, so expanding those arrays automatically updates the AI prompts.

### 3.3 Frontend: Type Definitions

**File**: `types.ts`

**Existing Book Interface** (No changes required):
```typescript
interface Book {
  id: string;
  title: string;
  author: string;
  genres: string[];      // Already supports multiple genres
  subgenre?: string;     // Already supports optional sub-genre
  // ... other fields
}
```

**New Interface for Genre Filtering**:
```typescript
interface GenreFilter {
  name: string;          // Genre name
  count: number;         // Number of books with this genre
}
```

### 3.4 Frontend: New UI Components

#### 3.4.1 GenreBadge Component (Requirements 5.3)

**File**: `components/GenreBadge.tsx`

**Purpose**: Display a single genre as a styled badge

**Props**:
```typescript
interface GenreBadgeProps {
  genre: string;
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium';
  onClick?: () => void;
}
```

**Design**:
- Compact badge with rounded corners
- Color-coded by genre category (fiction = blue, non-fiction = green, etc.)
- Responsive sizing
- Optional click handler for filtering

**Styling**:
- Primary variant: Solid background, white text
- Secondary variant: Outlined, colored text
- Small size: 10px text, 1.5px padding
- Medium size: 12px text, 2px padding

#### 3.4.2 GenreList Component (Requirements 5.3)

**File**: `components/GenreList.tsx`

**Purpose**: Display multiple genres for a book

**Props**:
```typescript
interface GenreListProps {
  genres: string[];
  subgenre?: string;
  maxDisplay?: number;    // Default: 3
  showAll?: boolean;      // Override maxDisplay
  onGenreClick?: (genre: string) => void;
}
```

**Behavior**:
- Displays up to `maxDisplay` genres as badges
- Shows "+N more" indicator if genres exceed limit
- Sub-genre displayed with different styling (outlined)
- Horizontal flex layout with wrapping

**Usage**:
- BookCard: `maxDisplay={3}` (Requirements 5.3.4)
- BookDetailsModal: `showAll={true}` (Requirements 5.3.2)

#### 3.4.3 GenreFilter Component (Requirements 5.4)

**File**: `components/GenreFilter.tsx`

**Purpose**: Dropdown filter for genre selection

**Props**:
```typescript
interface GenreFilterProps {
  genres: GenreFilter[];           // Available genres with counts
  selectedGenre: string | null;    // Currently selected genre
  onGenreChange: (genre: string | null) => void;
}
```

**Features**:
- Dropdown with search/filter capability
- Displays genre name + book count
- "All Genres" option to clear filter
- Alphabetically sorted (Requirements 5.4.6)
- Grouped by category (Fiction, Non-Fiction, Academic)

**Design**:
- Material-UI style dropdown
- Search input at top
- Scrollable list
- Highlight selected genre

### 3.5 Frontend: Updated Components

#### 3.5.1 BookCard Component Updates

**File**: `components/BookCard.tsx`

**Changes**:
1. Replace single category display with GenreList component
2. Show up to 3 genres (Requirements 5.3.4)
3. Remove or relocate "Category" field to avoid confusion

**Before**:
```typescript
<span className="px-2 py-0.5 rounded">
  {book.category}
</span>
```

**After**:
```typescript
<GenreList 
  genres={book.genres} 
  subgenre={book.subgenre}
  maxDisplay={3}
/>
```

#### 3.5.2 BookDetailsModal Component Updates

**File**: `components/BookDetailsModal.tsx`

**Changes**:
1. Add GenreList component showing all genres
2. Display sub-genre if present
3. Add genre section in details grid

**New Section**:
```typescript
<div className="p-4 bg-slate-50 rounded-lg">
  <h3 className="text-sm font-semibold mb-2">Genres</h3>
  <GenreList 
    genres={book.genres}
    subgenre={book.subgenre}
    showAll={true}
  />
</div>
```

#### 3.5.3 Browse Page Updates (Requirements 5.4)

**File**: `App.tsx` or dedicated browse page

**Changes**:
1. Add GenreFilter component above book grid
2. Implement genre filtering logic
3. Fetch genre counts from database

**Implementation**:
```typescript
const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
const [genreCounts, setGenreCounts] = useState<GenreFilter[]>([]);

// Filter books by selected genre
const filteredBooks = selectedGenre
  ? books.filter(book => book.genres.includes(selectedGenre))
  : books;

// Render
<GenreFilter 
  genres={genreCounts}
  selectedGenre={selectedGenre}
  onGenreChange={setSelectedGenre}
/>
```

## 4. Data Models

### 4.1 Database Schema

**No changes required** (Requirements 5.6). The existing schema already supports the expanded taxonomy:

```sql
CREATE TABLE books (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  genres TEXT[],        -- Array of 1-3 genre strings
  subgenre TEXT,        -- Optional sub-genre string
  -- ... other fields
);
```

**Design Rationale**: The schema was designed to be flexible. The `genres` array can hold any strings, and validation happens at the application layer via the taxonomy module.

### 4.2 Genre Statistics

**New Query for Genre Counts** (Requirements 5.8):

```sql
-- Get count of books per genre
SELECT 
  unnest(genres) as genre,
  COUNT(*) as book_count
FROM books
WHERE genres IS NOT NULL
GROUP BY genre
ORDER BY book_count DESC;
```

**Caching Strategy**:
- Cache genre counts in memory (refresh every 5 minutes)
- Update on book ingestion
- Expose via API endpoint: `GET /api/genres/stats`

## 5. Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### 5.1 Acceptance Criteria Testing Prework

Looking at the prework analysis, I can see several patterns:
- Many specific genre inclusion tests (5.1.1-5.1.10, 5.2.1-5.2.8) are examples testing for specific strings
- These can be combined into comprehensive properties about taxonomy completeness
- UI rendering tests (5.3.1, 5.3.2, 5.3.4, 5.3.5) are properties about all books
- Filtering and search tests (5.4.3, 5.4.5, 5.5.1) are properties about all genres
- Backward compatibility tests (5.6.1-5.6.4) are properties about all existing data

### 5.2 Property Reflection

After analyzing the acceptance criteria, I've identified the following consolidations:

**Consolidation 1**: Requirements 5.1.1-5.1.10 (individual genre checks) can be combined with 5.1.11 (preserve existing) into a single comprehensive property about taxonomy completeness.

**Consolidation 2**: Requirements 5.2.1-5.2.8 (individual sub-genre checks) can be combined with 5.2.9 (preserve existing) into a single property about sub-genre taxonomy completeness.

**Consolidation 3**: Requirements 5.3.1 and 5.3.2 (display all genres in card and modal) test the same behavior in different components - can be combined into one property about genre display completeness.

**Consolidation 4**: Requirements 5.6.1, 5.6.2, and 5.6.3 (backward compatibility) all test that existing data remains valid - can be combined into one comprehensive backward compatibility property.

**Consolidation 5**: Requirements 5.5.1 and 5.5.2 (genre search and partial matching) test related search behavior - can be combined into one property about genre search functionality.

This reduces redundancy while maintaining comprehensive coverage of all testable requirements.

### 5.3 Correctness Properties

**Property 1: Taxonomy Minimum Size**
*For any* deployment of the system, the PRIMARY_GENRES array SHALL contain at least 40 genres and the SUB_GENRES array SHALL contain at least 20 sub-genres.
**Validates: Requirements 5.1.12, 5.2.10**

**Property 2: Taxonomy Completeness**
*For any* deployment of the system, the PRIMARY_GENRES array SHALL contain all required new fiction genres (Fiction, Mystery & Thriller, Romance, Science Fiction & Fantasy, Horror, Adventure, Young Adult, Children's Literature, Graphic Novels & Comics, Humor & Satire) AND all 27 existing academic genres.
**Validates: Requirements 5.1.1-5.1.11**

**Property 3: Sub-Genre Taxonomy Completeness**
*For any* deployment of the system, the SUB_GENRES array SHALL contain all required new sub-genres (Detective, Spy & Espionage, Historical Fiction, Contemporary, Dystopian, Space Opera, Urban Fantasy, Gothic) AND all 9 existing sub-genres.
**Validates: Requirements 5.2.1-5.2.9**

**Property 4: Genre Display Completeness**
*For any* book with N genres (where N ≤ 3), the rendered book card SHALL display all N genres, and for any book with N > 3 genres, the card SHALL display exactly 3 genres plus an indicator of remaining genres.
**Validates: Requirements 5.3.1, 5.3.4**

**Property 5: Sub-Genre Display**
*For any* book with a sub-genre, the rendered output SHALL include the sub-genre alongside the primary genres.
**Validates: Requirements 5.3.5**

**Property 6: Modal Genre Display**
*For any* book with N genres, the book details modal SHALL display all N genres without truncation.
**Validates: Requirements 5.3.2**

**Property 7: Genre Filter Completeness**
*For any* genre in the PRIMARY_GENRES taxonomy, the genre filter dropdown SHALL include that genre as a selectable option.
**Validates: Requirements 5.4.2**

**Property 8: Genre Filtering Correctness**
*For any* selected genre G, the filtered book list SHALL contain only books where G is in the book's genres array.
**Validates: Requirements 5.4.3**

**Property 9: Genre Count Accuracy**
*For any* genre G in the filter, the displayed count SHALL equal the number of books in the database where G appears in the genres array.
**Validates: Requirements 5.4.5**

**Property 10: Genre Alphabetical Sorting**
*For any* list of genres displayed in the filter, the genres SHALL be sorted in alphabetical order.
**Validates: Requirements 5.4.6**

**Property 11: Genre Search Correctness**
*For any* search query Q, the results SHALL include all books where Q is a substring of any genre in the book's genres array (case-insensitive).
**Validates: Requirements 5.5.1, 5.5.2**

**Property 12: Combined Search Results**
*For any* search query Q, the results SHALL include books matching Q in title, author, OR genres.
**Validates: Requirements 5.5.3**

**Property 13: Backward Compatibility**
*For any* book with existing genre assignments, the validateGenres() function SHALL return all existing genres as valid after taxonomy expansion.
**Validates: Requirements 5.6.1, 5.6.2, 5.6.3**

**Property 14: AI Classifier Taxonomy Access**
*For any* new book classification, the AI prompt SHALL include all genres from the expanded PRIMARY_GENRES and SUB_GENRES arrays.
**Validates: Requirements 5.6.4**

**Property 15: Genre Count Updates**
*For any* book addition or removal operation, the genre count for each affected genre SHALL be incremented or decremented by exactly 1.
**Validates: Requirements 5.8.1, 5.8.4**

**Property 16: Popular Genres Ordering**
*For any* list of popular genres, the genres SHALL be ordered by book count in descending order.
**Validates: Requirements 5.8.2**

## 6. Error Handling

### 6.1 Invalid Genre Handling

**Scenario**: AI classifier returns genres not in taxonomy

**Handling**:
- `validateGenres()` filters out invalid genres
- Logs warning with book identifier
- Returns only valid genres
- Never fails ingestion (non-blocking)

**Example**:
```javascript
// AI returns: ["Fiction", "InvalidGenre", "Mystery"]
// validateGenres() returns: ["Fiction", "Mystery"]
// Logs: "Invalid genre 'InvalidGenre' filtered for book XYZ"
```

### 6.2 Empty Genre Array

**Scenario**: Book has no valid genres after validation

**Handling**:
- Store empty array in database
- Display "Uncategorized" badge in UI
- Allow manual genre assignment by admins
- Track uncategorized books for review

### 6.3 Genre Filter with Zero Results

**Scenario**: User selects genre with no books

**Handling**:
- Display "No books found in this genre" message
- Show suggestion to try different genre
- Maintain filter selection (don't auto-clear)
- Display genre count as 0 in filter

### 6.4 Malformed Genre Data

**Scenario**: Database contains malformed genre data (null, non-array, etc.)

**Handling**:
- Frontend treats null/undefined as empty array
- Type guards ensure array type
- Gracefully render empty state
- Log error for data cleanup

## 7. Testing Strategy

### 7.1 Dual Testing Approach

This feature requires both unit tests and property-based tests:

**Unit Tests**: Verify specific examples and edge cases
- Test specific genre inclusions (Fiction, Mystery, etc.)
- Test UI component rendering with sample data
- Test filter dropdown with known genre list
- Test backward compatibility with existing books

**Property-Based Tests**: Verify universal properties across all inputs
- Test taxonomy size requirements across deployments
- Test genre validation with random genre strings
- Test UI rendering with randomly generated books
- Test filtering with random genre selections
- Test search with random query strings

Both approaches are complementary and necessary for comprehensive coverage.

### 7.2 Property-Based Testing Configuration

**Framework**: fast-check (JavaScript/TypeScript property-based testing library)

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: expand-genre-support, Property N: [property text]`

**Example Test Structure**:
```typescript
// Feature: expand-genre-support, Property 4: Genre Display Completeness
test('book cards display correct number of genres', () => {
  fc.assert(
    fc.property(
      fc.record({
        genres: fc.array(fc.constantFrom(...PRIMARY_GENRES), { minLength: 1, maxLength: 10 }),
        // ... other book fields
      }),
      (book) => {
        const rendered = renderBookCard(book);
        const displayedGenres = extractGenres(rendered);
        
        if (book.genres.length <= 3) {
          expect(displayedGenres.length).toBe(book.genres.length);
        } else {
          expect(displayedGenres.length).toBe(3);
          expect(rendered).toContain(`+${book.genres.length - 3} more`);
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

### 7.3 Test Organization

**Directory Structure**:
```
tests/
  expand-genre-support/
    taxonomy.unit.test.ts              # Unit tests for taxonomy arrays
    validation.property.test.ts         # Property tests for validation functions
    ui-display.property.test.ts         # Property tests for genre display
    filtering.property.test.ts          # Property tests for genre filtering
    search.property.test.ts             # Property tests for genre search
    backward-compat.property.test.ts    # Property tests for compatibility
    integration.test.ts                 # End-to-end integration tests
```

### 7.4 Test Coverage Goals

- **Taxonomy Module**: 100% coverage (critical validation logic)
- **UI Components**: 90% coverage (focus on logic, not styling)
- **Integration**: Key user flows (browse → filter → view details)

### 7.5 Testing Priorities

**P0 (Must Have)**:
- Property 2, 3: Taxonomy completeness
- Property 4, 6: Genre display
- Property 8: Genre filtering correctness
- Property 13: Backward compatibility

**P1 (Should Have)**:
- Property 1: Taxonomy size
- Property 9: Genre count accuracy
- Property 11: Genre search

**P2 (Nice to Have)**:
- Property 10: Alphabetical sorting
- Property 15, 16: Genre statistics

## 8. Implementation Notes

### 8.1 Migration Strategy

**Phase 1: Taxonomy Expansion** (No user impact)
- Update `genreTaxonomy.js` with new genres
- Deploy to production
- Existing books unaffected

**Phase 2: UI Components** (Gradual rollout)
- Create GenreBadge, GenreList components
- Update BookCard to use new components
- Update BookDetailsModal
- Deploy and monitor

**Phase 3: Filtering** (Feature flag)
- Add GenreFilter component
- Implement filtering logic
- Enable for subset of users
- Full rollout after validation

**Phase 4: Search Integration** (Optional)
- Add genre search capability
- Combine with existing text search
- Deploy as enhancement

### 8.2 Performance Considerations

**Genre Count Caching**:
- Cache genre counts in Redis (5-minute TTL)
- Invalidate on book ingestion
- Fallback to database query if cache miss

**Frontend Optimization**:
- Lazy load GenreFilter component
- Virtualize genre list for large taxonomies
- Debounce search input (300ms)

**Database Indexing**:
```sql
-- GIN index for array containment queries
CREATE INDEX idx_books_genres ON books USING GIN (genres);
```

### 8.3 Rollback Plan

If issues arise:
1. **Taxonomy rollback**: Revert `genreTaxonomy.js` to previous version
2. **UI rollback**: Feature flag to disable new components
3. **Data integrity**: No database changes, so no data rollback needed

### 8.4 Monitoring

**Metrics to Track**:
- Genre filter usage rate
- Most popular filtered genres
- Books with empty genres array
- AI classification success rate with new genres
- Page load time impact

**Alerts**:
- Alert if >10% of new books have empty genres
- Alert if genre filter causes >500ms page load
- Alert if genre count cache hit rate <80%

## 9. Future Enhancements

### 9.1 Genre Hierarchy (Out of Scope)

Future version could implement multi-level taxonomy:
```
Fiction
  ├── Mystery & Thriller
  │   ├── Detective
  │   └── Spy & Espionage
  └── Science Fiction & Fantasy
      ├── Space Opera
      └── Cyberpunk
```

**Benefits**: More precise classification, better browsing
**Challenges**: Database schema changes, UI complexity

### 9.2 User Genre Preferences

Track user's favorite genres for personalized recommendations:
- Record genre views/clicks
- Weight recommendations by genre preference
- Allow explicit genre preference selection

### 9.3 Genre-Based Collections

Curated collections by genre:
- "Best Mystery Novels"
- "Classic Science Fiction"
- "Award-Winning Literary Fiction"

### 9.4 Genre Trends

Analytics dashboard showing:
- Genre popularity over time
- Emerging genres
- Genre distribution by publication year

## 10. Success Criteria

### 10.1 Functional Success

- ✅ Taxonomy expanded to 40+ primary genres
- ✅ Taxonomy expanded to 20+ sub-genres
- ✅ All existing genres preserved
- ✅ Genre display working in BookCard and Modal
- ✅ Genre filtering functional
- ✅ All property tests passing

### 10.2 User Experience Success

- Genre filter used by >30% of users
- Average session time increases by >10%
- User feedback positive on genre coverage
- No increase in "book not found" complaints

### 10.3 Technical Success

- No performance degradation (page load <2s)
- Genre count cache hit rate >80%
- AI classification success rate >90%
- Zero data integrity issues

## 11. Appendix

### 11.1 Complete Genre Taxonomy

**Fiction Genres** (10):
Fiction, Mystery & Thriller, Romance, Science Fiction & Fantasy, Horror, Adventure, Historical Fiction, Literary Fiction, Humor & Satire, Plays & Drama

**Age-Specific Genres** (3):
Young Adult, Children's Literature, Middle Grade

**Format Genres** (2):
Graphic Novels & Comics, Short Stories

**Non-Fiction Genres** (6):
Self-Help & Personal Development, Travel & Exploration, Cooking & Food, Sports & Recreation, True Crime, Memoir & Autobiography

**Academic Genres** (27):
Philosophy, Religion, Theology, Sacred Texts, History, Biography, Science, Mathematics, Medicine, Law, Politics, Economics, Literature, Poetry, Drama, Mythology, Military & Strategy, Education, Linguistics, Ethics, Anthropology, Sociology, Psychology, Geography, Astronomy, Alchemy & Esoterica, Art & Architecture

**Total**: 48 primary genres

### 11.2 Complete Sub-Genre Taxonomy

**Fiction Sub-Genres** (12):
Detective, Spy & Espionage, Psychological Thriller, Paranormal Romance, Contemporary Romance, Dystopian, Space Opera, Urban Fantasy, Epic Fantasy, Gothic, Steampunk, Cyberpunk

**Academic Sub-Genres** (9):
Ancient, Medieval, Classical, Early Modern, Commentary, Translation, Manuscript, Legal Code, Canonical Text

**Total**: 21 sub-genres

### 11.3 Color Coding Scheme

**Genre Badge Colors** (for UI implementation):
- Fiction genres: Blue (#3B82F6)
- Non-Fiction genres: Green (#10B981)
- Academic genres: Purple (#8B5CF6)
- Age-specific genres: Orange (#F59E0B)
- Format genres: Pink (#EC4899)

### 11.4 API Endpoints

**New Endpoints**:
- `GET /api/genres` - List all genres from taxonomy
- `GET /api/genres/stats` - Genre counts and statistics
- `GET /api/books?genre={genre}` - Filter books by genre

**Updated Endpoints**:
- `GET /api/books/{id}` - Now includes genres array and subgenre
- `POST /api/search` - Now supports genre search parameter
