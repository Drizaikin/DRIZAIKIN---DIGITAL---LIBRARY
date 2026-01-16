# Implementation Plan: Expand Genre Support

## Overview

This implementation plan breaks down the genre expansion feature into discrete, incremental tasks. Each task builds on previous work and includes testing to validate correctness. The plan follows a phased approach: taxonomy expansion → UI components → filtering → integration.

## Tasks

- [ ] 1. Expand Genre Taxonomy
  - Update `services/ingestion/genreTaxonomy.js` with new genres
  - Add 19 new primary genres (Fiction, Mystery & Thriller, Romance, etc.)
  - Add 12 new sub-genres (Detective, Spy & Espionage, Dystopian, etc.)
  - Organize genres with comments by category (Fiction, Non-Fiction, Academic)
  - Ensure total of 40+ primary genres and 20+ sub-genres
  - _Requirements: 5.1.1-5.1.12, 5.2.1-5.2.10, 5.7.1-5.7.4_

- [ ] 1.1 Write unit tests for taxonomy completeness
  - Test that all required new genres are present
  - Test that all existing genres are preserved
  - Test that helper functions are exported
  - _Requirements: 5.1.11, 5.2.9, 5.7.4_

- [ ] 1.2 Write property test for taxonomy size
  - **Property 1: Taxonomy Minimum Size**
  - **Validates: Requirements 5.1.12, 5.2.10**

- [ ] 1.3 Write property test for taxonomy completeness
  - **Property 2: Taxonomy Completeness**
  - **Property 3: Sub-Genre Taxonomy Completeness**
  - **Validates: Requirements 5.1.1-5.1.11, 5.2.1-5.2.9**

- [ ] 2. Create GenreBadge Component
  - Create `components/GenreBadge.tsx` component
  - Implement props: genre, variant (primary/secondary), size (small/medium), onClick
  - Add color coding by genre category (fiction=blue, non-fiction=green, academic=purple)
  - Implement responsive sizing
  - Add hover effects and transitions
  - _Requirements: 5.3.3_

- [ ] 2.1 Write unit tests for GenreBadge
  - Test rendering with different variants
  - Test rendering with different sizes
  - Test onClick handler
  - Test color coding for different genre categories

- [ ] 3. Create GenreList Component
  - Create `components/GenreList.tsx` component
  - Implement props: genres, subgenre, maxDisplay, showAll, onGenreClick
  - Display up to maxDisplay genres (default 3)
  - Show "+N more" indicator when genres exceed limit
  - Display sub-genre with different styling (outlined badge)
  - Implement horizontal flex layout with wrapping
  - _Requirements: 5.3.1, 5.3.2, 5.3.4, 5.3.5_

- [ ] 3.1 Write property test for genre display completeness
  - **Property 4: Genre Display Completeness**
  - **Validates: Requirements 5.3.1, 5.3.4**

- [ ] 3.2 Write property test for sub-genre display
  - **Property 5: Sub-Genre Display**
  - **Validates: Requirements 5.3.5**

- [ ] 3.3 Write property test for modal genre display
  - **Property 6: Modal Genre Display**
  - **Validates: Requirements 5.3.2**

- [ ] 4. Update BookCard Component
  - Update `components/BookCard.tsx` to use GenreList component
  - Replace single category display with GenreList
  - Pass maxDisplay={3} to limit genres on card
  - Pass genres and subgenre from book data
  - Adjust layout to accommodate genre badges
  - Test responsive behavior on mobile
  - _Requirements: 5.3.1, 5.3.4, 5.3.6_

- [ ] 4.1 Write integration tests for BookCard genre display
  - Test BookCard renders GenreList correctly
  - Test with books having 1, 2, 3, and 4+ genres
  - Test with books having sub-genres
  - Test responsive layout

- [ ] 5. Update BookDetailsModal Component
  - Update `components/BookDetailsModal.tsx` to use GenreList component
  - Add new "Genres" section in details grid
  - Pass showAll={true} to display all genres without truncation
  - Display sub-genre alongside primary genres
  - Ensure consistent styling with other detail sections
  - _Requirements: 5.3.2, 5.3.5, 5.3.6_

- [ ] 5.1 Write integration tests for BookDetailsModal genre display
  - Test modal displays all genres without truncation
  - Test sub-genre display
  - Test with books having many genres (5+)

- [ ] 6. Checkpoint - Verify Genre Display
  - Ensure all tests pass
  - Manually test BookCard and BookDetailsModal with sample books
  - Verify genre badges render correctly
  - Verify responsive behavior on mobile and desktop
  - Ask the user if questions arise

- [ ] 7. Create GenreFilter Component
  - Create `components/GenreFilter.tsx` component
  - Implement props: genres (with counts), selectedGenre, onGenreChange
  - Create dropdown with search/filter capability
  - Display genre name + book count for each genre
  - Add "All Genres" option to clear filter
  - Implement alphabetical sorting of genres
  - Group genres by category (Fiction, Non-Fiction, Academic)
  - Add search input at top of dropdown
  - Make list scrollable for large taxonomies
  - Highlight selected genre
  - _Requirements: 5.4.1, 5.4.2, 5.4.4, 5.4.6_

- [ ] 7.1 Write property test for genre filter completeness
  - **Property 7: Genre Filter Completeness**
  - **Validates: Requirements 5.4.2**

- [ ] 7.2 Write property test for genre alphabetical sorting
  - **Property 10: Genre Alphabetical Sorting**
  - **Validates: Requirements 5.4.6**

- [ ] 8. Implement Genre Filtering Logic
  - Add genre filtering state to browse page (App.tsx or dedicated page)
  - Implement filter function to show only books with selected genre
  - Add GenreFilter component above book grid
  - Connect onGenreChange handler to update filtered books
  - Preserve filter selection in URL query params
  - Handle empty results gracefully
  - _Requirements: 5.4.3, 5.4.4_

- [ ] 8.1 Write property test for genre filtering correctness
  - **Property 8: Genre Filtering Correctness**
  - **Validates: Requirements 5.4.3**

- [ ] 8.2 Write unit tests for edge cases
  - Test filtering with no books in genre
  - Test "All Genres" option
  - Test URL query param persistence

- [ ] 9. Implement Genre Count API
  - Create API endpoint `GET /api/genres/stats`
  - Query database for book count per genre using unnest(genres)
  - Implement caching with 5-minute TTL
  - Return array of {name, count} objects
  - Sort by count descending
  - _Requirements: 5.4.5, 5.8.1, 5.8.2_

- [ ] 9.1 Write property test for genre count accuracy
  - **Property 9: Genre Count Accuracy**
  - **Validates: Requirements 5.4.5**

- [ ] 9.2 Write property test for genre count updates
  - **Property 15: Genre Count Updates**
  - **Validates: Requirements 5.8.1, 5.8.4**

- [ ] 9.3 Write property test for popular genres ordering
  - **Property 16: Popular Genres Ordering**
  - **Validates: Requirements 5.8.2**

- [ ] 10. Connect Genre Counts to Filter
  - Fetch genre stats from API on browse page load
  - Pass genre counts to GenreFilter component
  - Display counts next to genre names in dropdown
  - Update counts when books are added/removed
  - Handle loading and error states
  - _Requirements: 5.4.5_

- [ ] 11. Checkpoint - Verify Genre Filtering
  - Ensure all tests pass
  - Manually test genre filtering with various genres
  - Verify counts are accurate
  - Verify "All Genres" option works
  - Test with empty results
  - Ask the user if questions arise

- [ ] 12. Implement Genre Search
  - Add genre search capability to existing search function
  - Support partial genre name matching (case-insensitive)
  - Combine genre search with title/author search
  - Return books matching any search criteria
  - _Requirements: 5.5.1, 5.5.2, 5.5.3_

- [ ] 12.1 Write property test for genre search correctness
  - **Property 11: Genre Search Correctness**
  - **Validates: Requirements 5.5.1, 5.5.2**

- [ ] 12.2 Write property test for combined search results
  - **Property 12: Combined Search Results**
  - **Validates: Requirements 5.5.3**

- [ ] 13. Test Backward Compatibility
  - Verify existing books with old genres still display correctly
  - Test that validateGenres() accepts all existing genres
  - Ensure no re-classification is triggered for existing books
  - Test AI classifier uses expanded taxonomy for new books
  - _Requirements: 5.6.1, 5.6.2, 5.6.3, 5.6.4_

- [ ] 13.1 Write property test for backward compatibility
  - **Property 13: Backward Compatibility**
  - **Validates: Requirements 5.6.1, 5.6.2, 5.6.3**

- [ ] 13.2 Write property test for AI classifier taxonomy access
  - **Property 14: AI Classifier Taxonomy Access**
  - **Validates: Requirements 5.6.4**

- [ ] 14. Add Database Index for Performance
  - Create GIN index on books.genres column for array containment queries
  - Run: `CREATE INDEX idx_books_genres ON books USING GIN (genres);`
  - Test query performance improvement
  - Monitor index usage
  - _Requirements: Non-functional (Performance)_

- [ ] 15. Add Genre Statistics to Admin Dashboard
  - Add genre distribution chart to admin dashboard
  - Display top 10 most popular genres
  - Show count of books per genre
  - Add filter to view books by genre
  - _Requirements: 5.8.3_

- [ ] 15.1 Write unit test for admin dashboard genre display
  - Test genre statistics component renders correctly
  - Test with various genre distributions
  - _Requirements: 5.8.3_

- [ ] 16. Final Integration Testing
  - Test complete user flow: browse → filter by genre → view details
  - Test genre display across all screen sizes
  - Test with books having various genre combinations
  - Verify performance (page load < 2s)
  - Test error handling (invalid genres, empty results)
  - Verify all property tests pass

- [ ] 17. Final Checkpoint
  - Ensure all tests pass (unit and property-based)
  - Verify all requirements are met
  - Check performance metrics
  - Review error handling
  - Ask the user if ready for deployment

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end flows
- All testing tasks are required for comprehensive coverage
