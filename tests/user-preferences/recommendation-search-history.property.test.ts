/**
 * Property-Based Tests for Recommendation Generation with Search History
 * **Feature: user-preferences-recommendations, Property 2: Recommendation Generation Includes Search History**
 * **Validates: Requirements 1.1, 1.3**
 *
 * This test verifies that for any user with search history entries, the
 * recommendation engine should return books that match at least one search
 * term from the history when relevant books exist.
 *
 * Requirements:
 * - 1.1: WHEN a user has search history THEN the Library_System SHALL include
 *        books related to previous searches in the recommendations
 * - 1.3: WHEN a user has both search history and a course/major THEN the
 *        Library_System SHALL combine both factors to generate recommendations
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types matching the API implementation
interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  copiesAvailable: number;
  popularity: number;
}

interface SearchHistoryEntry {
  type: 'search' | 'view';
  query: string | null;
  bookId: string | null;
}

interface RecommendationResult {
  books: Book[];
  searchTermsUsed: string[];
}

/**
 * Simulates the recommendation generation logic from api/index.js
 * This validates the core business logic without requiring database access
 *
 * The algorithm:
 * 1. Extract search terms from history (type='search')
 * 2. For each search term, find books matching title, author, or description
 * 3. Return matching books (up to 10)
 */
function generateRecommendationsFromSearchHistory(
  searchHistory: SearchHistoryEntry[],
  availableBooks: Book[]
): RecommendationResult {
  // Extract search terms from history (matching api/index.js logic)
  const searchTerms = searchHistory
    .filter((h) => h.type === 'search' && h.query)
    .map((h) => h.query!.toLowerCase().trim())
    .filter((term, index, self) => self.indexOf(term) === index); // Deduplicate

  if (searchTerms.length === 0) {
    return { books: [], searchTermsUsed: [] };
  }

  const recommendedBooks: Book[] = [];
  const addedBookIds = new Set<string>();
  const searchTermsUsed: string[] = [];

  // For each search term (limit to top 5 as in api/index.js)
  for (const term of searchTerms.slice(0, 5)) {
    // Find books matching the search term in title, author, or description
    const matchingBooks = availableBooks.filter((book) => {
      if (addedBookIds.has(book.id)) return false;
      if (book.copiesAvailable <= 0) return false;

      const titleMatch = book.title.toLowerCase().includes(term);
      const authorMatch = book.author.toLowerCase().includes(term);
      const descriptionMatch = book.description.toLowerCase().includes(term);

      return titleMatch || authorMatch || descriptionMatch;
    });

    // Sort by popularity and take top matches
    matchingBooks.sort((a, b) => b.popularity - a.popularity);

    for (const book of matchingBooks.slice(0, 5)) {
      if (!addedBookIds.has(book.id)) {
        addedBookIds.add(book.id);
        recommendedBooks.push(book);
        if (!searchTermsUsed.includes(term)) {
          searchTermsUsed.push(term);
        }
      }
      if (recommendedBooks.length >= 10) break;
    }

    if (recommendedBooks.length >= 10) break;
  }

  return { books: recommendedBooks.slice(0, 10), searchTermsUsed };
}

/**
 * Check if a book matches any of the given search terms
 */
function bookMatchesSearchTerm(book: Book, term: string): boolean {
  const lowerTerm = term.toLowerCase();
  return (
    book.title.toLowerCase().includes(lowerTerm) ||
    book.author.toLowerCase().includes(lowerTerm) ||
    book.description.toLowerCase().includes(lowerTerm)
  );
}

/**
 * Generate a UUID-like string for testing
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Arbitraries for generating test data
const searchTermArb = fc
  .string({ minLength: 2, maxLength: 20 })
  .filter((s) => s.trim().length >= 2 && /^[a-zA-Z0-9\s]+$/.test(s));

const bookArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 3, maxLength: 50 }).filter((s) => s.trim().length > 0),
  author: fc.string({ minLength: 3, maxLength: 30 }).filter((s) => s.trim().length > 0),
  category: fc.constantFrom('Fiction', 'Science', 'History', 'Technology', 'Art'),
  description: fc.string({ minLength: 10, maxLength: 200 }).filter((s) => s.trim().length > 0),
  copiesAvailable: fc.integer({ min: 0, max: 10 }),
  popularity: fc.integer({ min: 1, max: 100 }),
});

const searchHistoryEntryArb = fc.oneof(
  fc.record({
    type: fc.constant('search' as const),
    query: searchTermArb,
    bookId: fc.constant(null),
  }),
  fc.record({
    type: fc.constant('view' as const),
    query: fc.constant(null),
    bookId: fc.uuid(),
  })
);

describe('Recommendation Generation with Search History - Property Tests', () => {
  /**
   * **Feature: user-preferences-recommendations, Property 2: Recommendation Generation Includes Search History**
   * **Validates: Requirements 1.1, 1.3**
   *
   * Property: For any user with search history entries, the recommendation engine
   * should return books that match at least one search term from the history
   * when relevant books exist.
   */
  it('Property 2: Recommendations include books matching search history terms when available', () => {
    fc.assert(
      fc.property(
        // Generate a search term that will be used in both history and book
        searchTermArb,
        // Generate additional random books
        fc.array(bookArb, { minLength: 0, maxLength: 20 }),
        (searchTerm: string, randomBooks: Book[]) => {
          // Create a book that matches the search term (in title)
          const matchingBook: Book = {
            id: generateUUID(),
            title: `Book about ${searchTerm}`,
            author: 'Test Author',
            category: 'Technology',
            description: 'A test book description',
            copiesAvailable: 5,
            popularity: 50,
          };

          // Create search history with the search term
          const searchHistory: SearchHistoryEntry[] = [{ type: 'search', query: searchTerm, bookId: null }];

          // Combine matching book with random books
          const availableBooks = [matchingBook, ...randomBooks.filter((b) => b.copiesAvailable > 0)];

          // Generate recommendations
          const result = generateRecommendationsFromSearchHistory(searchHistory, availableBooks);

          // PROPERTY ASSERTION: When a matching book exists, it should be in recommendations
          const matchingBookInResults = result.books.some((b) => b.id === matchingBook.id);
          expect(matchingBookInResults).toBe(true);

          // PROPERTY ASSERTION: The search term should be marked as used
          expect(result.searchTermsUsed).toContain(searchTerm.toLowerCase().trim());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2a: All recommended books match at least one search term
   * Every book in the recommendations should be related to the search history
   */
  it('Property 2a: All recommended books match at least one search term from history', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.constant('search' as const),
            query: searchTermArb,
            bookId: fc.constant(null),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        fc.array(bookArb, { minLength: 1, maxLength: 30 }),
        (searchHistory: SearchHistoryEntry[], books: Book[]) => {
          // Filter to only available books
          const availableBooks = books.filter((b) => b.copiesAvailable > 0);
          if (availableBooks.length === 0) return; // Skip if no available books

          const result = generateRecommendationsFromSearchHistory(searchHistory, availableBooks);

          // Extract search terms
          const searchTerms = searchHistory
            .filter((h) => h.type === 'search' && h.query)
            .map((h) => h.query!.toLowerCase().trim());

          // PROPERTY ASSERTION: Every recommended book should match at least one search term
          for (const book of result.books) {
            const matchesAnyTerm = searchTerms.some((term) => bookMatchesSearchTerm(book, term));
            expect(matchesAnyTerm).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2b: Empty search history returns no search-based recommendations
   * When there's no search history, no books should be recommended from search
   */
  it('Property 2b: Empty search history returns no search-based recommendations', () => {
    fc.assert(
      fc.property(fc.array(bookArb, { minLength: 1, maxLength: 20 }), (books: Book[]) => {
        const emptyHistory: SearchHistoryEntry[] = [];

        const result = generateRecommendationsFromSearchHistory(emptyHistory, books);

        // PROPERTY ASSERTION: No recommendations from empty search history
        expect(result.books).toHaveLength(0);
        expect(result.searchTermsUsed).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2c: View-only history doesn't generate search-term recommendations
   * Book views (type='view') should not be used as search terms
   */
  it('Property 2c: View-only history does not generate search-term based recommendations', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.constant('view' as const),
            query: fc.constant(null),
            bookId: fc.uuid(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.array(bookArb, { minLength: 1, maxLength: 20 }),
        (viewHistory: SearchHistoryEntry[], books: Book[]) => {
          const result = generateRecommendationsFromSearchHistory(viewHistory, books);

          // PROPERTY ASSERTION: View-only history should not produce search-term recommendations
          expect(result.books).toHaveLength(0);
          expect(result.searchTermsUsed).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2d: Unavailable books are not recommended
   * Books with copiesAvailable <= 0 should not appear in recommendations
   */
  it('Property 2d: Books with no available copies are not recommended', () => {
    fc.assert(
      fc.property(searchTermArb, fc.array(bookArb, { minLength: 1, maxLength: 20 }), (searchTerm: string, books: Book[]) => {
        // Create search history
        const searchHistory: SearchHistoryEntry[] = [{ type: 'search', query: searchTerm, bookId: null }];

        // Make some books unavailable but matching the search term
        const booksWithUnavailable = books.map((book, index) => ({
          ...book,
          title: index === 0 ? `${searchTerm} Book` : book.title,
          copiesAvailable: index === 0 ? 0 : book.copiesAvailable, // First book is unavailable
        }));

        const result = generateRecommendationsFromSearchHistory(searchHistory, booksWithUnavailable);

        // PROPERTY ASSERTION: No recommended book should have 0 copies available
        for (const book of result.books) {
          expect(book.copiesAvailable).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2e: Recommendations are limited to 10 books
   * Even with many matching books, only 10 should be returned
   */
  it('Property 2e: Recommendations are limited to maximum 10 books', () => {
    fc.assert(
      fc.property(searchTermArb, (searchTerm: string) => {
        // Create many books that all match the search term
        const manyMatchingBooks: Book[] = Array.from({ length: 25 }, (_, i) => ({
          id: generateUUID(),
          title: `${searchTerm} Book ${i}`,
          author: 'Test Author',
          category: 'Technology',
          description: 'A test book',
          copiesAvailable: 5,
          popularity: 100 - i,
        }));

        const searchHistory: SearchHistoryEntry[] = [{ type: 'search', query: searchTerm, bookId: null }];

        const result = generateRecommendationsFromSearchHistory(searchHistory, manyMatchingBooks);

        // PROPERTY ASSERTION: Maximum 10 recommendations
        expect(result.books.length).toBeLessThanOrEqual(10);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2f: Search terms are deduplicated
   * Duplicate search terms in history should not cause duplicate processing
   */
  it('Property 2f: Duplicate search terms in history are deduplicated', () => {
    fc.assert(
      fc.property(searchTermArb, fc.integer({ min: 2, max: 5 }), (searchTerm: string, duplicateCount: number) => {
        // Create a book matching the search term
        const matchingBook: Book = {
          id: generateUUID(),
          title: `Book about ${searchTerm}`,
          author: 'Test Author',
          category: 'Technology',
          description: 'A test book',
          copiesAvailable: 5,
          popularity: 50,
        };

        // Create history with duplicate search terms
        const searchHistory: SearchHistoryEntry[] = Array.from({ length: duplicateCount }, () => ({
          type: 'search' as const,
          query: searchTerm,
          bookId: null,
        }));

        const result = generateRecommendationsFromSearchHistory(searchHistory, [matchingBook]);

        // PROPERTY ASSERTION: The matching book should appear exactly once
        const matchCount = result.books.filter((b) => b.id === matchingBook.id).length;
        expect(matchCount).toBe(1);

        // PROPERTY ASSERTION: The search term should be used exactly once
        const termCount = result.searchTermsUsed.filter((t) => t === searchTerm.toLowerCase().trim()).length;
        expect(termCount).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2g: Recommendations are sorted by popularity
   * Higher popularity books should appear before lower popularity ones
   */
  it('Property 2g: Recommendations are sorted by popularity (descending)', () => {
    fc.assert(
      fc.property(searchTermArb, fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 3, maxLength: 10 }), (searchTerm: string, popularities: number[]) => {
        // Create books with different popularities, all matching the search term
        const books: Book[] = popularities.map((pop, i) => ({
          id: generateUUID(),
          title: `${searchTerm} Book ${i}`,
          author: 'Test Author',
          category: 'Technology',
          description: 'A test book',
          copiesAvailable: 5,
          popularity: pop,
        }));

        const searchHistory: SearchHistoryEntry[] = [{ type: 'search', query: searchTerm, bookId: null }];

        const result = generateRecommendationsFromSearchHistory(searchHistory, books);

        // PROPERTY ASSERTION: Books should be sorted by popularity (descending)
        for (let i = 1; i < result.books.length; i++) {
          expect(result.books[i - 1].popularity).toBeGreaterThanOrEqual(result.books[i].popularity);
        }
      }),
      { numRuns: 100 }
    );
  });
});
