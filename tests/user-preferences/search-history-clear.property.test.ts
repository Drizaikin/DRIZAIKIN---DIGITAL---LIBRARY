/**
 * Property-Based Tests for Search History Clear
 * **Feature: user-preferences-recommendations, Property 8: Search History Clear**
 * **Validates: Requirements 5.4**
 *
 * This test verifies that for any user who clears their search history,
 * the search history count for that user should be zero.
 *
 * Requirements:
 * - 5.4: WHEN a user requests to clear search history THEN the Library_System
 *        SHALL remove all stored search history for that user
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types matching the API implementation
interface SearchHistoryEntry {
  id: string;
  userId: string;
  type: 'search' | 'view';
  query: string | null;
  bookId: string | null;
  createdAt: string;
}

interface ClearHistoryResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * In-memory search history store for testing
 * Simulates the database behavior
 */
class SearchHistoryStore {
  private entries: SearchHistoryEntry[] = [];

  /**
   * Add a search history entry
   */
  addEntry(entry: SearchHistoryEntry): void {
    this.entries.push(entry);
  }

  /**
   * Get all entries for a user
   */
  getEntriesForUser(userId: string): SearchHistoryEntry[] {
    return this.entries.filter((e) => e.userId === userId);
  }

  /**
   * Clear all entries for a user (simulates DELETE /api/search-history/:userId)
   */
  clearHistoryForUser(userId: string): ClearHistoryResult {
    if (!userId) {
      return { success: false, error: 'userId is required' };
    }

    // Remove all entries for this user
    this.entries = this.entries.filter((e) => e.userId !== userId);

    return { success: true, message: 'Search history cleared successfully' };
  }

  /**
   * Get count of entries for a user
   */
  getCountForUser(userId: string): number {
    return this.entries.filter((e) => e.userId === userId).length;
  }

  /**
   * Reset the store (for test isolation)
   */
  reset(): void {
    this.entries = [];
  }
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
 * Create a search history entry
 */
function createSearchEntry(userId: string, query: string): SearchHistoryEntry {
  return {
    id: generateUUID(),
    userId,
    type: 'search',
    query,
    bookId: null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a view history entry
 */
function createViewEntry(userId: string, bookId: string): SearchHistoryEntry {
  return {
    id: generateUUID(),
    userId,
    type: 'view',
    query: null,
    bookId,
    createdAt: new Date().toISOString(),
  };
}

// Arbitraries for generating test data
const userIdArb = fc.uuid();
const searchQueryArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);
const bookIdArb = fc.uuid();

describe('Search History Clear - Property Tests', () => {
  /**
   * **Feature: user-preferences-recommendations, Property 8: Search History Clear**
   * **Validates: Requirements 5.4**
   *
   * Property: For any user who clears their search history, the search history
   * count for that user should be zero.
   */
  it('Property 8: Clearing search history results in zero entries for user', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(searchQueryArb, { minLength: 1, maxLength: 20 }),
        fc.array(bookIdArb, { minLength: 0, maxLength: 10 }),
        (userId: string, queries: string[], bookIds: string[]) => {
          const store = new SearchHistoryStore();

          // Add search entries
          for (const query of queries) {
            store.addEntry(createSearchEntry(userId, query));
          }

          // Add view entries
          for (const bookId of bookIds) {
            store.addEntry(createViewEntry(userId, bookId));
          }

          // Verify entries were added
          const countBefore = store.getCountForUser(userId);
          expect(countBefore).toBe(queries.length + bookIds.length);

          // Clear history
          const result = store.clearHistoryForUser(userId);

          // PROPERTY ASSERTION 1: Clear operation should succeed
          expect(result.success).toBe(true);

          // PROPERTY ASSERTION 2: Count should be zero after clearing
          const countAfter = store.getCountForUser(userId);
          expect(countAfter).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8a: Clearing history for one user does not affect other users
   * Each user's history is independent
   */
  it('Property 8a: Clearing history for one user does not affect other users', () => {
    fc.assert(
      fc.property(
        userIdArb,
        userIdArb,
        fc.array(searchQueryArb, { minLength: 1, maxLength: 10 }),
        fc.array(searchQueryArb, { minLength: 1, maxLength: 10 }),
        (userId1: string, userId2: string, queries1: string[], queries2: string[]) => {
          // Skip if same user ID generated
          fc.pre(userId1 !== userId2);

          const store = new SearchHistoryStore();

          // Add entries for user 1
          for (const query of queries1) {
            store.addEntry(createSearchEntry(userId1, query));
          }

          // Add entries for user 2
          for (const query of queries2) {
            store.addEntry(createSearchEntry(userId2, query));
          }

          // Verify both users have entries
          expect(store.getCountForUser(userId1)).toBe(queries1.length);
          expect(store.getCountForUser(userId2)).toBe(queries2.length);

          // Clear history for user 1 only
          const result = store.clearHistoryForUser(userId1);
          expect(result.success).toBe(true);

          // PROPERTY ASSERTION 1: User 1 should have zero entries
          expect(store.getCountForUser(userId1)).toBe(0);

          // PROPERTY ASSERTION 2: User 2 should still have all their entries
          expect(store.getCountForUser(userId2)).toBe(queries2.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8b: Clearing empty history succeeds
   * Clearing history when there are no entries should still succeed
   */
  it('Property 8b: Clearing empty history succeeds', () => {
    fc.assert(
      fc.property(userIdArb, (userId: string) => {
        const store = new SearchHistoryStore();

        // Verify no entries exist
        expect(store.getCountForUser(userId)).toBe(0);

        // Clear history (even though empty)
        const result = store.clearHistoryForUser(userId);

        // PROPERTY ASSERTION 1: Clear operation should succeed
        expect(result.success).toBe(true);

        // PROPERTY ASSERTION 2: Count should still be zero
        expect(store.getCountForUser(userId)).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8c: Clearing history removes both search and view entries
   * All types of history entries should be removed
   */
  it('Property 8c: Clearing history removes both search and view entries', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(searchQueryArb, { minLength: 1, maxLength: 10 }),
        fc.array(bookIdArb, { minLength: 1, maxLength: 10 }),
        (userId: string, queries: string[], bookIds: string[]) => {
          const store = new SearchHistoryStore();

          // Add mixed entries
          for (const query of queries) {
            store.addEntry(createSearchEntry(userId, query));
          }
          for (const bookId of bookIds) {
            store.addEntry(createViewEntry(userId, bookId));
          }

          // Verify mixed entries exist
          const entries = store.getEntriesForUser(userId);
          const searchEntries = entries.filter((e) => e.type === 'search');
          const viewEntries = entries.filter((e) => e.type === 'view');
          expect(searchEntries.length).toBe(queries.length);
          expect(viewEntries.length).toBe(bookIds.length);

          // Clear history
          const result = store.clearHistoryForUser(userId);
          expect(result.success).toBe(true);

          // PROPERTY ASSERTION: All entry types should be removed
          const entriesAfter = store.getEntriesForUser(userId);
          expect(entriesAfter.length).toBe(0);
          expect(entriesAfter.filter((e) => e.type === 'search').length).toBe(0);
          expect(entriesAfter.filter((e) => e.type === 'view').length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8d: Missing userId is rejected
   * Clear operation requires a valid user ID
   */
  it('Property 8d: Missing userId is rejected', () => {
    const store = new SearchHistoryStore();

    // Try to clear with empty userId
    const result = store.clearHistoryForUser('');

    // PROPERTY ASSERTION: Clear operation should fail
    expect(result.success).toBe(false);
    expect(result.error).toBe('userId is required');
  });

  /**
   * Property 8e: Clearing history is idempotent
   * Clearing history multiple times should have the same effect as clearing once
   */
  it('Property 8e: Clearing history is idempotent', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(searchQueryArb, { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 2, max: 5 }),
        (userId: string, queries: string[], clearCount: number) => {
          const store = new SearchHistoryStore();

          // Add entries
          for (const query of queries) {
            store.addEntry(createSearchEntry(userId, query));
          }

          // Clear history multiple times
          for (let i = 0; i < clearCount; i++) {
            const result = store.clearHistoryForUser(userId);
            // PROPERTY ASSERTION 1: Each clear should succeed
            expect(result.success).toBe(true);
          }

          // PROPERTY ASSERTION 2: Count should be zero after multiple clears
          expect(store.getCountForUser(userId)).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
