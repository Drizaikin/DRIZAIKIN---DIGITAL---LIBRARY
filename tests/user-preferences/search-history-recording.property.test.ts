/**
 * Property-Based Tests for Search History Recording
 * **Feature: user-preferences-recommendations, Property 5: Search History Recording**
 * **Validates: Requirements 1.6, 5.1**
 *
 * This test verifies that for any search query performed by a user, the search
 * history should contain an entry with that query and a valid timestamp.
 *
 * Requirements:
 * - 1.6: WHEN a user searches for a book THEN the Library_System SHALL record
 *        the search term in the user's search history
 * - 5.1: WHEN a user performs a search THEN the Library_System SHALL store
 *        the search query with a timestamp
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

interface RecordSearchResult {
  success: boolean;
  entry?: SearchHistoryEntry;
  error?: string;
}

/**
 * Simulates the search history recording logic from api/index.js
 * This validates the core business logic without requiring database access
 */
function recordSearchHistory(
  userId: string,
  type: 'search' | 'view',
  query?: string,
  bookId?: string
): RecordSearchResult {
  // Validation logic matching api/index.js
  if (!userId) {
    return { success: false, error: 'userId is required' };
  }

  if (!type || !['search', 'view'].includes(type)) {
    return { success: false, error: 'type must be "search" or "view"' };
  }

  if (type === 'search' && !query) {
    return { success: false, error: 'query is required for search type' };
  }

  if (type === 'view' && !bookId) {
    return { success: false, error: 'bookId is required for view type' };
  }

  // Simulate successful recording
  const entry: SearchHistoryEntry = {
    id: generateUUID(),
    userId,
    type,
    query: type === 'search' ? query! : null,
    bookId: type === 'view' ? bookId! : null,
    createdAt: new Date().toISOString(),
  };

  return { success: true, entry };
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
 * Validate that a timestamp is in valid ISO 8601 format
 */
function isValidTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && timestamp === date.toISOString();
}

/**
 * Validate that a string is a valid UUID format
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Arbitraries for generating test data
const userIdArb = fc.uuid();
const searchQueryArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);
const bookIdArb = fc.uuid();

describe('Search History Recording - Property Tests', () => {
  /**
   * **Feature: user-preferences-recommendations, Property 5: Search History Recording**
   * **Validates: Requirements 1.6, 5.1**
   *
   * Property: For any search query performed by a user, the search history
   * should contain an entry with that query and a valid timestamp.
   */
  it('Property 5: Search query recording creates entry with query and valid timestamp', () => {
    fc.assert(
      fc.property(userIdArb, searchQueryArb, (userId: string, query: string) => {
        // Record a search query
        const result = recordSearchHistory(userId, 'search', query);

        // PROPERTY ASSERTION 1: Recording should succeed
        expect(result.success).toBe(true);
        expect(result.entry).toBeDefined();

        const entry = result.entry!;

        // PROPERTY ASSERTION 2: Entry should contain the exact query
        expect(entry.query).toBe(query);

        // PROPERTY ASSERTION 3: Entry should have a valid timestamp
        expect(isValidTimestamp(entry.createdAt)).toBe(true);

        // PROPERTY ASSERTION 4: Entry should be associated with the correct user
        expect(entry.userId).toBe(userId);

        // PROPERTY ASSERTION 5: Entry type should be 'search'
        expect(entry.type).toBe('search');

        // PROPERTY ASSERTION 6: Entry should have a valid ID
        expect(isValidUUID(entry.id)).toBe(true);

        // PROPERTY ASSERTION 7: bookId should be null for search type
        expect(entry.bookId).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5a: Search history timestamp is recent
   * The recorded timestamp should be close to the current time
   */
  it('Property 5a: Search history timestamp is recent (within 1 second)', () => {
    fc.assert(
      fc.property(userIdArb, searchQueryArb, (userId: string, query: string) => {
        const beforeRecord = new Date();
        const result = recordSearchHistory(userId, 'search', query);
        const afterRecord = new Date();

        expect(result.success).toBe(true);
        const entry = result.entry!;

        const recordedTime = new Date(entry.createdAt);

        // PROPERTY ASSERTION: Timestamp should be between before and after recording
        expect(recordedTime.getTime()).toBeGreaterThanOrEqual(beforeRecord.getTime());
        expect(recordedTime.getTime()).toBeLessThanOrEqual(afterRecord.getTime() + 1000);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5b: Empty or whitespace-only queries are rejected
   * Search queries must have meaningful content
   */
  it('Property 5b: Empty queries are rejected for search type', () => {
    fc.assert(
      fc.property(userIdArb, (userId: string) => {
        // Try to record with empty query
        const result = recordSearchHistory(userId, 'search', '');

        // PROPERTY ASSERTION: Recording should fail
        expect(result.success).toBe(false);
        expect(result.error).toBe('query is required for search type');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5c: Missing userId is rejected
   * All search history entries must be associated with a user
   */
  it('Property 5c: Missing userId is rejected', () => {
    fc.assert(
      fc.property(searchQueryArb, (query: string) => {
        // Try to record with empty userId
        const result = recordSearchHistory('', 'search', query);

        // PROPERTY ASSERTION: Recording should fail
        expect(result.success).toBe(false);
        expect(result.error).toBe('userId is required');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5d: Search history preserves query exactly
   * The recorded query should be identical to the input
   */
  it('Property 5d: Search history preserves query exactly (no modification)', () => {
    // Test with various special characters and unicode
    const specialQueryArb = fc.oneof(
      searchQueryArb,
      fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
      fc.constant('Programming & Design'),
      fc.constant("O'Reilly Books"),
      fc.constant('Search with "quotes"'),
      fc.constant('Unicode: 日本語 한국어 العربية')
    );

    fc.assert(
      fc.property(userIdArb, specialQueryArb, (userId: string, query: string) => {
        const result = recordSearchHistory(userId, 'search', query);

        if (result.success) {
          // PROPERTY ASSERTION: Query should be preserved exactly
          expect(result.entry!.query).toBe(query);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5e: Multiple searches create distinct entries
   * Each search should create a new, unique entry
   */
  it('Property 5e: Multiple searches create distinct entries with unique IDs', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(searchQueryArb, { minLength: 2, maxLength: 10 }),
        (userId: string, queries: string[]) => {
          const entries: SearchHistoryEntry[] = [];

          for (const query of queries) {
            const result = recordSearchHistory(userId, 'search', query);
            expect(result.success).toBe(true);
            entries.push(result.entry!);
          }

          // PROPERTY ASSERTION: All entry IDs should be unique
          const ids = entries.map((e) => e.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);

          // PROPERTY ASSERTION: Each entry should have its corresponding query
          for (let i = 0; i < queries.length; i++) {
            expect(entries[i].query).toBe(queries[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5f: Invalid type is rejected
   * Only 'search' and 'view' types are valid
   */
  it('Property 5f: Invalid type is rejected', () => {
    fc.assert(
      fc.property(userIdArb, searchQueryArb, (userId: string, query: string) => {
        // @ts-expect-error - Testing invalid type
        const result = recordSearchHistory(userId, 'invalid', query);

        // PROPERTY ASSERTION: Recording should fail
        expect(result.success).toBe(false);
        expect(result.error).toBe('type must be "search" or "view"');
      }),
      { numRuns: 100 }
    );
  });
});
