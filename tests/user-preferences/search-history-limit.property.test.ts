/**
 * Property-Based Tests for Search History Limit
 * **Feature: user-preferences-recommendations, Property 7: Search History Limit**
 * **Validates: Requirements 5.3**
 *
 * This test verifies that for any recommendation generation, only the most
 * recent 50 search history entries should be considered.
 *
 * Requirements:
 * - 5.3: WHEN generating recommendations THEN the Library_System SHALL consider
 *        the most recent 50 search history entries
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

const MAX_SEARCH_HISTORY_ENTRIES = 50;

// Types matching the API implementation
interface SearchHistoryEntry {
  id: string;
  userId: string;
  type: 'search' | 'view';
  query: string | null;
  bookId: string | null;
  createdAt: string;
}

interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  copiesAvailable: number;
  popularity: number;
}

interface RecommendationContext {
  searchTermsUsed: string[];
  entriesConsidered: number;
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

/**
 * Simulates the search history limiting logic from api/index.js
 * The API fetches search history with:
 *   .order('created_at', { ascending: false })
 *   .limit(50)
 *
 * This function simulates that behavior by:
 * 1. Sorting entries by createdAt descending (most recent first)
 * 2. Taking only the first 50 entries
 * 3. Extracting search terms for recommendation generation
 */
function limitSearchHistory(
  allEntries: SearchHistoryEntry[]
): SearchHistoryEntry[] {
  // Sort by createdAt descending (most recent first)
  const sorted = [...allEntries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Limit to 50 most recent entries (Requirement 5.3)
  return sorted.slice(0, MAX_SEARCH_HISTORY_ENTRIES);
}

/**
 * Simulates extracting search terms from limited history for recommendations
 * This matches the logic in api/index.js:
 *   const searchTerms = searchHistory
 *     .filter(h => h.type === 'search' && h.query)
 *     .map(h => h.query.toLowerCase().trim())
 *     .filter((term, index, self) => self.indexOf(term) === index);
 */
function extractSearchTermsFromHistory(
  limitedHistory: SearchHistoryEntry[]
): RecommendationContext {
  const searchTerms = limitedHistory
    .filter((h) => h.type === 'search' && h.query)
    .map((h) => h.query!.toLowerCase().trim())
    .filter((term, index, self) => self.indexOf(term) === index); // Deduplicate

  return {
    searchTermsUsed: searchTerms,
    entriesConsidered: limitedHistory.length,
  };
}

/**
 * Full simulation of the recommendation generation with history limiting
 */
function generateRecommendationsWithHistoryLimit(
  allSearchHistory: SearchHistoryEntry[],
  availableBooks: Book[]
): { books: Book[]; context: RecommendationContext } {
  // Step 1: Limit search history to 50 most recent entries
  const limitedHistory = limitSearchHistory(allSearchHistory);

  // Step 2: Extract search terms from limited history
  const context = extractSearchTermsFromHistory(limitedHistory);

  // Step 3: Generate recommendations based on limited history
  const recommendedBooks: Book[] = [];
  const addedBookIds = new Set<string>();

  for (const term of context.searchTermsUsed.slice(0, 5)) {
    const matchingBooks = availableBooks.filter((book) => {
      if (addedBookIds.has(book.id)) return false;
      if (book.copiesAvailable <= 0) return false;

      const titleMatch = book.title.toLowerCase().includes(term);
      const authorMatch = book.author.toLowerCase().includes(term);
      const descriptionMatch = book.description.toLowerCase().includes(term);

      return titleMatch || authorMatch || descriptionMatch;
    });

    matchingBooks.sort((a, b) => b.popularity - a.popularity);

    for (const book of matchingBooks.slice(0, 5)) {
      if (!addedBookIds.has(book.id)) {
        addedBookIds.add(book.id);
        recommendedBooks.push(book);
      }
      if (recommendedBooks.length >= 10) break;
    }

    if (recommendedBooks.length >= 10) break;
  }

  return {
    books: recommendedBooks.slice(0, 10),
    context,
  };
}

// Arbitraries for generating test data
const searchTermArb = fc
  .string({ minLength: 2, maxLength: 15 })
  .filter((s) => s.trim().length >= 2 && /^[a-zA-Z0-9\s]+$/.test(s));

/**
 * Generate a timestamp string with controllable ordering
 * @param baseTime - Base timestamp in milliseconds
 * @param offsetMs - Offset from base time in milliseconds
 */
function generateTimestamp(baseTime: number, offsetMs: number): string {
  return new Date(baseTime + offsetMs).toISOString();
}

const bookArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 3, maxLength: 50 }).filter((s) => s.trim().length > 0),
  author: fc.string({ minLength: 3, maxLength: 30 }).filter((s) => s.trim().length > 0),
  category: fc.constantFrom('Fiction', 'Science', 'History', 'Technology', 'Art'),
  description: fc.string({ minLength: 10, maxLength: 100 }).filter((s) => s.trim().length > 0),
  copiesAvailable: fc.integer({ min: 1, max: 10 }),
  popularity: fc.integer({ min: 1, max: 100 }),
});

describe('Search History Limit - Property Tests', () => {
  /**
   * **Feature: user-preferences-recommendations, Property 7: Search History Limit**
   * **Validates: Requirements 5.3**
   *
   * Property: For any recommendation generation, only the most recent 50
   * search history entries should be considered.
   */
  it('Property 7: Only the most recent 50 search history entries are considered', () => {
    fc.assert(
      fc.property(
        // Generate number of entries (more than 50 to test limiting)
        fc.integer({ min: 51, max: 100 }),
        // Generate a unique search term for old entries
        searchTermArb,
        // Generate a unique search term for recent entries
        searchTermArb,
        (totalEntries: number, oldSearchTerm: string, recentSearchTerm: string) => {
          // Ensure the search terms are different
          if (oldSearchTerm.toLowerCase().trim() === recentSearchTerm.toLowerCase().trim()) {
            return; // Skip this test case
          }

          const userId = generateUUID();
          const baseTime = Date.now();

          // Create old entries (beyond the 50 limit) with the old search term
          const oldEntries: SearchHistoryEntry[] = Array.from(
            { length: totalEntries - 50 },
            (_, i) => ({
              id: generateUUID(),
              userId,
              type: 'search' as const,
              query: oldSearchTerm,
              bookId: null,
              // Old entries have earlier timestamps
              createdAt: generateTimestamp(baseTime, -((totalEntries - i) * 60000)),
            })
          );

          // Create recent entries (within the 50 limit) with the recent search term
          const recentEntries: SearchHistoryEntry[] = Array.from({ length: 50 }, (_, i) => ({
            id: generateUUID(),
            userId,
            type: 'search' as const,
            query: recentSearchTerm,
            bookId: null,
            // Recent entries have later timestamps
            createdAt: generateTimestamp(baseTime, -(i * 60000)),
          }));

          // Combine all entries (in random order to simulate real data)
          const allEntries = [...oldEntries, ...recentEntries];

          // Apply the limiting logic
          const limitedHistory = limitSearchHistory(allEntries);

          // PROPERTY ASSERTION 1: Limited history should have at most 50 entries
          expect(limitedHistory.length).toBeLessThanOrEqual(MAX_SEARCH_HISTORY_ENTRIES);

          // PROPERTY ASSERTION 2: Limited history should contain only recent entries
          const limitedQueries = limitedHistory
            .filter((h) => h.type === 'search' && h.query)
            .map((h) => h.query!.toLowerCase().trim());

          // All queries in limited history should be the recent search term
          for (const query of limitedQueries) {
            expect(query).toBe(recentSearchTerm.toLowerCase().trim());
          }

          // PROPERTY ASSERTION 3: Old search term should NOT be in limited history
          expect(limitedQueries).not.toContain(oldSearchTerm.toLowerCase().trim());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7a: Exactly 50 entries when more than 50 exist
   * When there are more than 50 entries, exactly 50 should be considered
   */
  it('Property 7a: Exactly 50 entries considered when more than 50 exist', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 51, max: 150 }),
        searchTermArb,
        (totalEntries: number, searchTerm: string) => {
          const userId = generateUUID();
          const baseTime = Date.now();

          // Create more than 50 entries
          const allEntries: SearchHistoryEntry[] = Array.from(
            { length: totalEntries },
            (_, i) => ({
              id: generateUUID(),
              userId,
              type: 'search' as const,
              query: `${searchTerm} ${i}`,
              bookId: null,
              createdAt: generateTimestamp(baseTime, -(i * 60000)),
            })
          );

          const limitedHistory = limitSearchHistory(allEntries);

          // PROPERTY ASSERTION: Exactly 50 entries when more than 50 exist
          expect(limitedHistory.length).toBe(MAX_SEARCH_HISTORY_ENTRIES);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7b: All entries considered when fewer than 50 exist
   * When there are fewer than 50 entries, all should be considered
   */
  it('Property 7b: All entries considered when fewer than 50 exist', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 49 }),
        searchTermArb,
        (totalEntries: number, searchTerm: string) => {
          const userId = generateUUID();
          const baseTime = Date.now();

          // Create fewer than 50 entries
          const allEntries: SearchHistoryEntry[] = Array.from(
            { length: totalEntries },
            (_, i) => ({
              id: generateUUID(),
              userId,
              type: 'search' as const,
              query: `${searchTerm} ${i}`,
              bookId: null,
              createdAt: generateTimestamp(baseTime, -(i * 60000)),
            })
          );

          const limitedHistory = limitSearchHistory(allEntries);

          // PROPERTY ASSERTION: All entries considered when fewer than 50
          expect(limitedHistory.length).toBe(totalEntries);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7c: Most recent entries are prioritized
   * The 50 most recent entries should be selected, not arbitrary ones
   */
  it('Property 7c: Most recent entries are prioritized over older ones', () => {
    fc.assert(
      fc.property(fc.integer({ min: 60, max: 100 }), (totalEntries: number) => {
        const userId = generateUUID();
        const baseTime = Date.now();

        // Create entries with sequential timestamps
        const allEntries: SearchHistoryEntry[] = Array.from(
          { length: totalEntries },
          (_, i) => ({
            id: generateUUID(),
            userId,
            type: 'search' as const,
            query: `search_${i}`,
            bookId: null,
            // Entry 0 is most recent, entry N is oldest
            createdAt: generateTimestamp(baseTime, -(i * 60000)),
          })
        );

        const limitedHistory = limitSearchHistory(allEntries);

        // PROPERTY ASSERTION: All limited entries should be from the 50 most recent
        for (const entry of limitedHistory) {
          const entryIndex = parseInt(entry.query!.split('_')[1]);
          expect(entryIndex).toBeLessThan(MAX_SEARCH_HISTORY_ENTRIES);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7d: Recommendations only use terms from limited history
   * Search terms from entries beyond the 50 limit should not affect recommendations
   */
  it('Property 7d: Recommendations only use search terms from the 50 most recent entries', () => {
    fc.assert(
      fc.property(searchTermArb, searchTermArb, (oldTerm: string, recentTerm: string) => {
        const oldNorm = oldTerm.toLowerCase().trim();
        const recentNorm = recentTerm.toLowerCase().trim();
        
        // Ensure terms are different and don't overlap as substrings
        // This prevents false positives where a book title containing one term
        // accidentally matches the other term
        if (oldNorm === recentNorm || 
            oldNorm.includes(recentNorm) || 
            recentNorm.includes(oldNorm)) {
          return;
        }

        const userId = generateUUID();
        const baseTime = Date.now();

        // Create 30 old entries with old term (will be excluded)
        const oldEntries: SearchHistoryEntry[] = Array.from({ length: 30 }, (_, i) => ({
          id: generateUUID(),
          userId,
          type: 'search' as const,
          query: oldTerm,
          bookId: null,
          createdAt: generateTimestamp(baseTime, -((80 - i) * 60000)), // Older timestamps
        }));

        // Create 50 recent entries with recent term (will be included)
        const recentEntries: SearchHistoryEntry[] = Array.from({ length: 50 }, (_, i) => ({
          id: generateUUID(),
          userId,
          type: 'search' as const,
          query: recentTerm,
          bookId: null,
          createdAt: generateTimestamp(baseTime, -(i * 60000)), // More recent timestamps
        }));

        // Create books matching both terms
        const oldTermBook: Book = {
          id: generateUUID(),
          title: `Book about ${oldTerm}`,
          author: 'Old Author',
          category: 'Technology',
          description: 'An old book',
          copiesAvailable: 5,
          popularity: 90,
        };

        const recentTermBook: Book = {
          id: generateUUID(),
          title: `Book about ${recentTerm}`,
          author: 'Recent Author',
          category: 'Technology',
          description: 'A recent book',
          copiesAvailable: 5,
          popularity: 80,
        };

        const allEntries = [...oldEntries, ...recentEntries];
        const allBooks = [oldTermBook, recentTermBook];

        const result = generateRecommendationsWithHistoryLimit(allEntries, allBooks);

        // PROPERTY ASSERTION 1: Only 50 entries were considered
        expect(result.context.entriesConsidered).toBe(MAX_SEARCH_HISTORY_ENTRIES);

        // PROPERTY ASSERTION 2: Only recent term should be in search terms used
        expect(result.context.searchTermsUsed).toContain(recentTerm.toLowerCase().trim());
        expect(result.context.searchTermsUsed).not.toContain(oldTerm.toLowerCase().trim());

        // PROPERTY ASSERTION 3: Only book matching recent term should be recommended
        const recommendedIds = result.books.map((b) => b.id);
        expect(recommendedIds).toContain(recentTermBook.id);
        expect(recommendedIds).not.toContain(oldTermBook.id);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7e: Empty history results in no search-based recommendations
   * When history is empty, no search terms should be extracted
   */
  it('Property 7e: Empty history results in no search terms', () => {
    fc.assert(
      fc.property(fc.array(bookArb, { minLength: 1, maxLength: 10 }), (books: Book[]) => {
        const emptyHistory: SearchHistoryEntry[] = [];

        const result = generateRecommendationsWithHistoryLimit(emptyHistory, books);

        // PROPERTY ASSERTION: No search terms from empty history
        expect(result.context.searchTermsUsed).toHaveLength(0);
        expect(result.context.entriesConsidered).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7f: View entries don't count toward search terms
   * Only 'search' type entries contribute search terms, not 'view' entries
   */
  it('Property 7f: View entries are included in limit but do not contribute search terms', () => {
    fc.assert(
      fc.property(searchTermArb, (searchTerm: string) => {
        const userId = generateUUID();
        const baseTime = Date.now();

        // Create 50 view entries (most recent)
        const viewEntries: SearchHistoryEntry[] = Array.from({ length: 50 }, (_, i) => ({
          id: generateUUID(),
          userId,
          type: 'view' as const,
          query: null,
          bookId: generateUUID(),
          createdAt: generateTimestamp(baseTime, -(i * 60000)),
        }));

        // Create 10 search entries (older, will be excluded due to limit)
        const searchEntries: SearchHistoryEntry[] = Array.from({ length: 10 }, (_, i) => ({
          id: generateUUID(),
          userId,
          type: 'search' as const,
          query: searchTerm,
          bookId: null,
          createdAt: generateTimestamp(baseTime, -((60 + i) * 60000)),
        }));

        const allEntries = [...viewEntries, ...searchEntries];

        const limitedHistory = limitSearchHistory(allEntries);
        const context = extractSearchTermsFromHistory(limitedHistory);

        // PROPERTY ASSERTION 1: 50 entries considered (all view entries)
        expect(limitedHistory.length).toBe(MAX_SEARCH_HISTORY_ENTRIES);

        // PROPERTY ASSERTION 2: No search terms extracted (view entries don't have queries)
        expect(context.searchTermsUsed).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });
});
