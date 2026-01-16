# Expand Genre Support - Requirements

## 1. Overview

Expand the genre classification system to support a broader range of book categories beyond the current academic focus. Add modern genres (Fiction, Mystery, Romance, Science Fiction, etc.), improve the taxonomy structure, and enhance the UI to display multiple genres per book effectively.

## 2. Background

The current genre taxonomy focuses primarily on academic and classical texts (Philosophy, History, Science, etc.) with 27 primary genres and 9 sub-genres. This works well for public domain academic books but limits the system's ability to classify fiction, modern literature, and popular genres. Users need better genre coverage and the UI needs to display multiple genres clearly.

## 3. Glossary

- **Genre_Taxonomy**: The controlled vocabulary of allowed genres and sub-genres
- **Primary_Genre**: Main category assigned to a book (1-3 per book)
- **Sub_Genre**: Optional secondary classification (0-1 per book)
- **Genre_Display**: UI component showing book genres
- **Genre_Filter**: UI component for filtering books by genre
- **AI_Classifier**: Service that assigns genres using AI

## 4. User Stories

### 4.1 As a library user
I want to see fiction genres (Mystery, Romance, Sci-Fi) so that I can find entertaining books, not just academic texts.

### 4.2 As a library administrator
I want an expanded genre taxonomy so that all types of books can be properly classified.

### 4.3 As a library user
I want to filter books by genre so that I can browse specific categories I'm interested in.

### 4.4 As a library user
I want to see all genres assigned to a book so that I understand its full classification.

### 4.5 As a developer
I want a well-organized genre taxonomy so that it's easy to maintain and extend.

## 5. Functional Requirements

### 5.1 Expand Primary Genres
**Priority**: P0 (Critical)

THE system SHALL expand the primary genres list to include fiction and modern categories.

**Acceptance Criteria**:
1. THE Genre_Taxonomy SHALL include Fiction as a primary genre
2. THE Genre_Taxonomy SHALL include Mystery & Thriller as a primary genre
3. THE Genre_Taxonomy SHALL include Romance as a primary genre
4. THE Genre_Taxonomy SHALL include Science Fiction & Fantasy as a primary genre
5. THE Genre_Taxonomy SHALL include Horror as a primary genre
6. THE Genre_Taxonomy SHALL include Adventure as a primary genre
7. THE Genre_Taxonomy SHALL include Young Adult as a primary genre
8. THE Genre_Taxonomy SHALL include Children's Literature as a primary genre
9. THE Genre_Taxonomy SHALL include Graphic Novels & Comics as a primary genre
10. THE Genre_Taxonomy SHALL include Humor & Satire as a primary genre
11. THE Genre_Taxonomy SHALL preserve all existing academic genres
12. THE Genre_Taxonomy SHALL support at least 40 total primary genres

### 5.2 Expand Sub-Genres
**Priority**: P1 (High)

THE system SHALL expand the sub-genres list to provide finer classification.

**Acceptance Criteria**:
1. THE Genre_Taxonomy SHALL include Detective as a sub-genre
2. THE Genre_Taxonomy SHALL include Spy & Espionage as a sub-genre
3. THE Genre_Taxonomy SHALL include Historical Fiction as a sub-genre
4. THE Genre_Taxonomy SHALL include Contemporary as a sub-genre
5. THE Genre_Taxonomy SHALL include Dystopian as a sub-genre
6. THE Genre_Taxonomy SHALL include Space Opera as a sub-genre
7. THE Genre_Taxonomy SHALL include Urban Fantasy as a sub-genre
8. THE Genre_Taxonomy SHALL include Gothic as a sub-genre
9. THE Genre_Taxonomy SHALL preserve all existing sub-genres
10. THE Genre_Taxonomy SHALL support at least 20 total sub-genres

### 5.3 Genre Display in UI
**Priority**: P0 (Critical)

THE system SHALL display multiple genres clearly in the user interface.

**Acceptance Criteria**:
1. WHEN a book has multiple genres, THE system SHALL display all genres in the book card
2. WHEN a book has multiple genres, THE system SHALL display all genres in the book details modal
3. THE system SHALL use genre badges or tags for visual clarity
4. THE system SHALL limit genre display to 3 genres maximum per book card
5. WHEN a book has a sub-genre, THE system SHALL display it alongside primary genres
6. THE system SHALL use consistent styling for genre display across all components

### 5.4 Genre Filtering
**Priority**: P1 (High)

THE system SHALL allow users to filter books by genre.

**Acceptance Criteria**:
1. WHEN a user views the browse page, THE system SHALL display a genre filter dropdown
2. THE genre filter SHALL list all available genres from the taxonomy
3. WHEN a user selects a genre, THE system SHALL show only books with that genre
4. WHEN a user selects "All Genres", THE system SHALL show all books
5. THE system SHALL display the count of books per genre in the filter
6. THE system SHALL sort genres alphabetically in the filter

### 5.5 Genre Search
**Priority**: P2 (Medium)

THE system SHALL allow users to search for books by genre.

**Acceptance Criteria**:
1. WHEN a user searches for a genre name, THE system SHALL return books with that genre
2. THE system SHALL support partial genre name matching
3. THE system SHALL combine genre search with text search (title/author)
4. THE system SHALL highlight matched genres in search results

### 5.6 Backward Compatibility
**Priority**: P0 (Critical)

THE system SHALL maintain compatibility with existing classified books.

**Acceptance Criteria**:
1. WHEN the taxonomy is expanded, THE system SHALL NOT invalidate existing genre assignments
2. THE system SHALL continue to recognize all previously assigned genres
3. THE system SHALL NOT require re-classification of existing books
4. THE AI_Classifier SHALL use the expanded taxonomy for new classifications

### 5.7 Taxonomy Organization
**Priority**: P1 (High)

THE system SHALL organize genres into logical categories for maintainability.

**Acceptance Criteria**:
1. THE Genre_Taxonomy SHALL group related genres (e.g., Fiction genres together)
2. THE Genre_Taxonomy SHALL include comments explaining each genre category
3. THE Genre_Taxonomy SHALL be defined in a single, easily editable file
4. THE Genre_Taxonomy SHALL export helper functions for validation and display

### 5.8 Genre Statistics
**Priority**: P2 (Medium)

THE system SHALL provide statistics about genre distribution.

**Acceptance Criteria**:
1. THE system SHALL track the count of books per genre
2. THE system SHALL display popular genres in the UI
3. THE system SHALL show genre distribution in admin dashboard
4. THE system SHALL update genre counts when books are added or removed

## 6. Non-Functional Requirements

### 6.1 Performance
- Genre filtering should complete in under 200ms
- Genre display should not slow down page rendering
- Genre validation should be O(1) lookup time

### 6.2 Usability
- Genre badges should be visually distinct and readable
- Genre filter should be easy to find and use
- Genre names should be clear and unambiguous

### 6.3 Maintainability
- Adding new genres should require only updating the taxonomy file
- Genre validation logic should be centralized
- Genre display components should be reusable

## 7. Proposed Genre Taxonomy Expansion

### 7.1 New Fiction Genres
- Fiction (General)
- Mystery & Thriller
- Romance
- Science Fiction & Fantasy
- Horror
- Adventure
- Historical Fiction
- Literary Fiction
- Humor & Satire

### 7.2 New Age-Specific Genres
- Young Adult
- Children's Literature
- Middle Grade

### 7.3 New Format Genres
- Graphic Novels & Comics
- Short Stories
- Plays & Drama (expand existing Drama)

### 7.4 New Non-Fiction Genres
- Self-Help & Personal Development
- Travel & Exploration
- Cooking & Food
- Sports & Recreation
- True Crime
- Memoir & Autobiography (expand existing Biography)

### 7.5 New Sub-Genres
- Detective
- Spy & Espionage
- Psychological Thriller
- Paranormal Romance
- Contemporary Romance
- Dystopian
- Space Opera
- Urban Fantasy
- Epic Fantasy
- Gothic
- Steampunk
- Cyberpunk

## 8. Data Model Changes

### 8.1 Database Schema (No Changes Required)

The existing schema already supports multiple genres:
```sql
-- books table already has:
genres TEXT[]  -- Array of genre strings
subgenre TEXT  -- Single sub-genre string
```

No database migration needed.

### 8.2 Frontend Data Model

```typescript
interface Book {
  // ... existing fields
  genres: string[];      // Array of 1-3 genres
  subgenre?: string;     // Optional sub-genre
}

interface GenreFilter {
  name: string;
  count: number;
}
```

## 9. UI Components

### 9.1 GenreBadge Component (New)

Display a single genre as a styled badge.

**Props:**
- `genre: string` - Genre name
- `variant?: 'primary' | 'secondary'` - Visual style
- `size?: 'small' | 'medium'` - Badge size

### 9.2 GenreList Component (New)

Display multiple genres for a book.

**Props:**
- `genres: string[]` - Array of genres
- `subgenre?: string` - Optional sub-genre
- `maxDisplay?: number` - Maximum genres to show (default 3)

### 9.3 GenreFilter Component (New)

Filter dropdown for genre selection.

**Props:**
- `genres: GenreFilter[]` - Available genres with counts
- `selectedGenre: string` - Currently selected genre
- `onGenreChange: (genre: string) => void` - Selection handler

## 10. Success Metrics

### 10.1 Taxonomy Coverage
- At least 40 primary genres
- At least 20 sub-genres
- Coverage of fiction, non-fiction, and specialized categories

### 10.2 User Engagement
- Increased use of genre filtering
- More diverse book discovery
- Reduced "uncategorized" books

### 10.3 Classification Accuracy
- AI classifier successfully uses expanded taxonomy
- Fewer classification failures
- Better genre assignments for fiction books

## 11. Out of Scope

### 11.1 User-Defined Genres
This feature does NOT allow users to create custom genres. All genres come from the controlled taxonomy.

### 11.2 Multi-Level Genre Hierarchy
This feature does NOT create a hierarchical genre system (e.g., Fiction > Mystery > Detective). Genres remain flat with optional sub-genre.

### 11.3 Genre Recommendations
This feature does NOT implement genre-based book recommendations. That's a separate feature.

## 12. Dependencies

### 12.1 Existing Systems
- Genre taxonomy file (`services/ingestion/genreTaxonomy.js`)
- AI classifier service (`services/ingestion/genreClassifier.js`)
- Book display components (`components/BookCard.tsx`, `components/BookDetailsModal.tsx`)

### 12.2 No New Dependencies
- No new npm packages required
- No new external APIs required
- No database changes required

## 13. Risks and Mitigations

### 13.1 AI Classification Accuracy
**Risk**: AI might struggle with new fiction genres
**Mitigation**:
- Update AI prompt with clear genre definitions
- Test classification with sample fiction books
- Allow manual genre correction by admins

### 13.2 UI Clutter
**Risk**: Too many genres might clutter the UI
**Mitigation**:
- Limit display to 3 genres per book card
- Use compact badge design
- Show full genre list only in details modal

### 13.3 Taxonomy Maintenance
**Risk**: Large taxonomy becomes hard to maintain
**Mitigation**:
- Organize genres into logical groups
- Add comprehensive comments
- Create validation tests

## 14. Future Enhancements

### 14.1 Genre Hierarchy
Implement multi-level genre taxonomy (Fiction > Mystery > Detective).

### 14.2 Genre-Based Recommendations
Recommend books based on user's genre preferences.

### 14.3 Genre Analytics
Track genre popularity, trends, and user preferences.

### 14.4 Custom Genre Collections
Allow admins to create curated collections by genre.
