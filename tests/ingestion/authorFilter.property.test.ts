/**
 * Property-Based Tests for Author Filter
 * **Feature: ingestion-filtering, Property 3: Author Filter Correctness**
 * **Feature: ingestion-filtering, Property 4: Empty Author Filter Allows All**
 * **Validates: Requirements 5.2.2, 5.2.3, 5.2.5, 5.2.6, 5.6.3**
 * 
 * This test verifies that:
 * - For any book with author name B and filter configuration with allowed authors A (where A is non-empty),
 *   the book SHALL pass the author filter if and only if there exists at least one author a in A 
 *   such that a is a case-insensitive substring of B
 * - For any book, when the allowed authors list is empty, the author filter SHALL pass the book
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { checkAuthorFilter } from '../../services/ingestion/ingestionFilter.js';

/**
 * Generator for author names (realistic names)
 */
const authorNameArb = fc.oneof(
  fc.constantFrom(
    'Robin Sharma',
    'Paulo Coelho',
    'Dale Carnegie',
    'Napoleon Hill',
    'Stephen King',
    'J.K. Rowling',
    'George Orwell',
    'Jane Austen',
    'Mark Twain',
    'Ernest Hemingway',
    'F. Scott Fitzgerald',
    'Charles Dickens',
    'Leo Tolstoy',
    'Fyodor Dostoevsky',
    'Gabriel García Márquez',
    'Haruki Murakami',
    'Agatha Christie',
    'Arthur Conan Doyle',
    'Isaac Asimov',
    'Ray Bradbury'
  ),
  // Also generate random strings for edge cases
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
);

/**
 * Generator for partial author names (substrings)
 */
const partialAuthorNameArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);

/**
 * Generator for allowed authors configuration (1-10 authors)
 */
const allowedAuthorsArb = fc.array(authorNameArb, { minLength: 1, maxLength: 10 });

/**
 * Generator for filter configuration with non-empty allowed authors
 */
const activeAuthorFilterConfigArb = fc.record({
  allowedGenres: fc.constant([]),
  enableGenreFilter: fc.constant(false),
  allowedAuthors: allowedAuthorsArb,
  enableAuthorFilter: fc.constant(true)
});

/**
 * Generator for filter configuration with empty allowed authors
 */
const emptyAuthorFilterConfigArb = fc.record({
  allowedGenres: fc.constant([]),
  enableGenreFilter: fc.constant(false),
  allowedAuthors: fc.constant([]),
  enableAuthorFilter: fc.constant(true)
});

/**
 * Generator for disabled filter configuration
 */
const disabledAuthorFilterConfigArb = fc.record({
  allowedGenres: fc.constant([]),
  enableGenreFilter: fc.constant(false),
  allowedAuthors: allowedAuthorsArb,
  enableAuthorFilter: fc.constant(false)
});

describe('Author Filter - Property Tests', () => {
  /**
   * **Feature: ingestion-filtering, Property 3: Author Filter Correctness**
   * **Validates: Requirements 5.2.2, 5.2.5, 5.2.6, 5.6.3**
   * 
   * Property: For any book with author name B and filter configuration with allowed authors A (where A is non-empty),
   * the book SHALL pass the author filter if and only if there exists at least one author a in A 
   * such that a is a case-insensitive substring of B
   */
  it('Property 3: Author filter passes if and only if book author contains at least one allowed author (case-insensitive)', () => {
    fc.assert(
      fc.property(
        authorNameArb,
        activeAuthorFilterConfigArb,
        (bookAuthor, config) => {
          // Call checkAuthorFilter
          const result = checkAuthorFilter(bookAuthor, config);
          
          // Calculate expected result: does book author contain ANY allowed author (case-insensitive)?
          const normalizedBookAuthor = bookAuthor.toLowerCase().trim();
          const hasMatch = config.allowedAuthors.some(allowedAuthor => {
            const normalizedAllowed = allowedAuthor.toLowerCase().trim();
            return normalizedBookAuthor.includes(normalizedAllowed);
          });
          
          // PROPERTY ASSERTION: Result must match expected
          expect(result.passed).toBe(hasMatch);
          
          // ADDITIONAL ASSERTION: If failed, reason should be provided
          if (!hasMatch) {
            expect(result.reason).toBeDefined();
            expect(result.reason).toContain('Author not in allowed list');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ingestion-filtering, Property 4: Empty Author Filter Allows All**
   * **Validates: Requirements 5.2.3**
   * 
   * Property: For any book, when the allowed authors list is empty, the author filter SHALL pass the book
   */
  it('Property 4: Empty allowed authors list allows all books', () => {
    fc.assert(
      fc.property(
        authorNameArb,
        emptyAuthorFilterConfigArb,
        (bookAuthor, config) => {
          // Call checkAuthorFilter with empty allowed authors
          const result = checkAuthorFilter(bookAuthor, config);
          
          // PROPERTY ASSERTION: Must always pass
          expect(result.passed).toBe(true);
          
          // PROPERTY ASSERTION: No reason should be provided for passing
          expect(result.reason).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Disabled author filter allows all books regardless of author
   */
  it('Property 3a: Disabled author filter allows all books', () => {
    fc.assert(
      fc.property(
        authorNameArb,
        disabledAuthorFilterConfigArb,
        (bookAuthor, config) => {
          // Call checkAuthorFilter with disabled filter
          const result = checkAuthorFilter(bookAuthor, config);
          
          // PROPERTY ASSERTION: Must always pass when disabled
          expect(result.passed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Author filter is case-insensitive (Requirement 5.2.5)
   */
  it('Property 3b: Author filter matching is case-insensitive', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Robin Sharma', 'Paulo Coelho', 'Dale Carnegie'),
        fc.constantFrom('lower', 'upper', 'mixed'),
        (author, caseType) => {
          // Transform author to different case
          let bookAuthor: string;
          let allowedAuthor: string;
          
          if (caseType === 'lower') {
            bookAuthor = author.toLowerCase();
            allowedAuthor = author.toUpperCase();
          } else if (caseType === 'upper') {
            bookAuthor = author.toUpperCase();
            allowedAuthor = author.toLowerCase();
          } else {
            // Mixed case
            bookAuthor = author;
            allowedAuthor = author.split('').map((c, i) => 
              i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()
            ).join('');
          }
          
          const config = {
            allowedGenres: [],
            enableGenreFilter: false,
            allowedAuthors: [allowedAuthor],
            enableAuthorFilter: true
          };
          
          const result = checkAuthorFilter(bookAuthor, config);
          
          // PROPERTY ASSERTION: Must pass despite case differences
          expect(result.passed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Partial author name matching (Requirement 5.2.6)
   */
  it('Property 3c: Filter passes with partial author name match (substring)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Robin Sharma', 'Paulo Coelho', 'Dale Carnegie', 'Stephen King'),
        fc.constantFrom('first', 'last', 'middle'),
        (fullAuthor, partType) => {
          // Extract partial name based on type
          const parts = fullAuthor.split(' ');
          let partialName: string;
          
          if (partType === 'first' && parts.length > 0) {
            partialName = parts[0];
          } else if (partType === 'last' && parts.length > 1) {
            partialName = parts[parts.length - 1];
          } else {
            // Use a substring
            partialName = fullAuthor.substring(0, Math.max(3, fullAuthor.length / 2));
          }
          
          const config = {
            allowedGenres: [],
            enableGenreFilter: false,
            allowedAuthors: [partialName],
            enableAuthorFilter: true
          };
          
          const result = checkAuthorFilter(fullAuthor, config);
          
          // PROPERTY ASSERTION: Must pass because partial name is substring of full name
          expect(result.passed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Filter fails when no allowed author is substring of book author
   */
  it('Property 3d: Filter fails when no allowed author matches book author', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Robin Sharma', 'Paulo Coelho', 'Dale Carnegie'),
        fc.constantFrom('Stephen King', 'J.K. Rowling', 'George Orwell'),
        (bookAuthor, allowedAuthor) => {
          // Ensure they don't overlap
          if (bookAuthor.toLowerCase().includes(allowedAuthor.toLowerCase()) ||
              allowedAuthor.toLowerCase().includes(bookAuthor.toLowerCase())) {
            return; // Skip if they overlap
          }
          
          const config = {
            allowedGenres: [],
            enableGenreFilter: false,
            allowedAuthors: [allowedAuthor],
            enableAuthorFilter: true
          };
          
          const result = checkAuthorFilter(bookAuthor, config);
          
          // PROPERTY ASSERTION: Must fail because no match
          expect(result.passed).toBe(false);
          expect(result.reason).toContain('Author not in allowed list');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Filter fails for books with no author (when filter is active)
   */
  it('Property 3e: Filter fails for books with no author when filter is active', () => {
    fc.assert(
      fc.property(
        allowedAuthorsArb,
        (allowedAuthors) => {
          const config = {
            allowedGenres: [],
            enableGenreFilter: false,
            allowedAuthors,
            enableAuthorFilter: true
          };
          
          // Test with empty string
          const result1 = checkAuthorFilter('', config);
          expect(result1.passed).toBe(false);
          expect(result1.reason).toBe('Book has no author');
          
          // Test with null
          const result2 = checkAuthorFilter(null as any, config);
          expect(result2.passed).toBe(false);
          expect(result2.reason).toBe('Book has no author');
          
          // Test with undefined
          const result3 = checkAuthorFilter(undefined as any, config);
          expect(result3.passed).toBe(false);
          expect(result3.reason).toBe('Book has no author');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Author filter is deterministic (same input always produces same output)
   */
  it('Property 3f: Author filter is deterministic', () => {
    fc.assert(
      fc.property(
        authorNameArb,
        activeAuthorFilterConfigArb,
        (bookAuthor, config) => {
          // Call checkAuthorFilter twice with same inputs
          const result1 = checkAuthorFilter(bookAuthor, config);
          const result2 = checkAuthorFilter(bookAuthor, config);
          
          // PROPERTY ASSERTION: Results must be identical
          expect(result1.passed).toBe(result2.passed);
          expect(result1.reason).toBe(result2.reason);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Author filter result structure is always valid
   */
  it('Property 3g: Author filter always returns valid result structure', () => {
    fc.assert(
      fc.property(
        fc.oneof(authorNameArb, fc.constant(''), fc.constant(null), fc.constant(undefined)),
        fc.oneof(activeAuthorFilterConfigArb, emptyAuthorFilterConfigArb, disabledAuthorFilterConfigArb),
        (bookAuthor, config) => {
          const result = checkAuthorFilter(bookAuthor as any, config);
          
          // PROPERTY ASSERTION: Result must have 'passed' boolean
          expect(typeof result.passed).toBe('boolean');
          
          // PROPERTY ASSERTION: If failed, must have reason
          if (!result.passed) {
            expect(typeof result.reason).toBe('string');
            expect(result.reason!.length).toBeGreaterThan(0);
          }
          
          // PROPERTY ASSERTION: If passed, reason should be undefined
          if (result.passed) {
            expect(result.reason).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Filter passes when book author exactly matches allowed author
   */
  it('Property 3h: Filter passes when book author exactly matches allowed author', () => {
    fc.assert(
      fc.property(
        authorNameArb,
        (author) => {
          const config = {
            allowedGenres: [],
            enableGenreFilter: false,
            allowedAuthors: [author],
            enableAuthorFilter: true
          };
          
          const result = checkAuthorFilter(author, config);
          
          // PROPERTY ASSERTION: Must pass
          expect(result.passed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Filter with multiple allowed authors passes if ANY match
   */
  it('Property 3i: Filter passes if ANY allowed author matches book author', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Robin Sharma', 'Paulo Coelho', 'Dale Carnegie'),
        fc.array(fc.constantFrom('Stephen King', 'J.K. Rowling', 'George Orwell'), { minLength: 1, maxLength: 3 }),
        (matchingAuthor, nonMatchingAuthors) => {
          // Create allowed authors: some non-matching + one matching
          const allowedAuthors = [...nonMatchingAuthors, matchingAuthor];
          
          const config = {
            allowedGenres: [],
            enableGenreFilter: false,
            allowedAuthors,
            enableAuthorFilter: true
          };
          
          const result = checkAuthorFilter(matchingAuthor, config);
          
          // PROPERTY ASSERTION: Must pass because at least one author matches
          expect(result.passed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Whitespace handling in author names
   */
  it('Property 3j: Filter handles whitespace correctly (trim)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Robin Sharma', 'Paulo Coelho', 'Dale Carnegie'),
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        (author, leadingSpaces, trailingSpaces) => {
          // Add whitespace to book author
          const bookAuthor = ' '.repeat(leadingSpaces) + author + ' '.repeat(trailingSpaces);
          
          const config = {
            allowedGenres: [],
            enableGenreFilter: false,
            allowedAuthors: [author],
            enableAuthorFilter: true
          };
          
          const result = checkAuthorFilter(bookAuthor, config);
          
          // PROPERTY ASSERTION: Must pass despite whitespace
          expect(result.passed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Filter with allowed author as substring of book author passes
   */
  it('Property 3k: Filter passes when allowed author is substring of book author', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Sharma', 'Coelho', 'Carnegie', 'King'),
        fc.constantFrom('Robin Sharma', 'Paulo Coelho', 'Dale Carnegie', 'Stephen King'),
        (partialAuthor, fullAuthor) => {
          // Only test if partial is actually a substring of full
          if (!fullAuthor.toLowerCase().includes(partialAuthor.toLowerCase())) {
            return; // Skip if not a substring
          }
          
          const config = {
            allowedGenres: [],
            enableGenreFilter: false,
            allowedAuthors: [partialAuthor],
            enableAuthorFilter: true
          };
          
          const result = checkAuthorFilter(fullAuthor, config);
          
          // PROPERTY ASSERTION: Must pass
          expect(result.passed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty allowed authors with disabled filter still allows all
   */
  it('Property 4a: Empty allowed authors with disabled filter allows all', () => {
    fc.assert(
      fc.property(
        authorNameArb,
        (bookAuthor) => {
          const config = {
            allowedGenres: [],
            enableGenreFilter: false,
            allowedAuthors: [],
            enableAuthorFilter: false
          };
          
          const result = checkAuthorFilter(bookAuthor, config);
          
          // PROPERTY ASSERTION: Must pass
          expect(result.passed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Filter with single allowed author works correctly
   */
  it('Property 3l: Filter with single allowed author works correctly', () => {
    fc.assert(
      fc.property(
        authorNameArb,
        authorNameArb,
        (bookAuthor, allowedAuthor) => {
          const config = {
            allowedGenres: [],
            enableGenreFilter: false,
            allowedAuthors: [allowedAuthor],
            enableAuthorFilter: true
          };
          
          const result = checkAuthorFilter(bookAuthor, config);
          
          // Calculate expected result
          const normalizedBook = bookAuthor.toLowerCase().trim();
          const normalizedAllowed = allowedAuthor.toLowerCase().trim();
          const shouldPass = normalizedBook.includes(normalizedAllowed);
          
          // PROPERTY ASSERTION: Result must match expected
          expect(result.passed).toBe(shouldPass);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Filter handles special characters in author names
   */
  it('Property 3m: Filter handles special characters in author names', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "O'Brien",
          "García Márquez",
          "Saint-Exupéry",
          "Müller",
          "Søren Kierkegaard"
        ),
        (author) => {
          const config = {
            allowedGenres: [],
            enableGenreFilter: false,
            allowedAuthors: [author],
            enableAuthorFilter: true
          };
          
          const result = checkAuthorFilter(author, config);
          
          // PROPERTY ASSERTION: Must pass with exact match
          expect(result.passed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Filter order independence (order of allowed authors doesn't matter)
   */
  it('Property 3n: Filter result is independent of allowed authors order', () => {
    fc.assert(
      fc.property(
        authorNameArb,
        fc.array(authorNameArb, { minLength: 2, maxLength: 5 }),
        (bookAuthor, allowedAuthors) => {
          // Remove duplicates
          const uniqueAllowed = [...new Set(allowedAuthors)];
          
          if (uniqueAllowed.length < 2) {
            return; // Skip if not enough unique authors
          }
          
          const config1 = {
            allowedGenres: [],
            enableGenreFilter: false,
            allowedAuthors: uniqueAllowed,
            enableAuthorFilter: true
          };
          
          const config2 = {
            allowedGenres: [],
            enableGenreFilter: false,
            allowedAuthors: [...uniqueAllowed].reverse(),
            enableAuthorFilter: true
          };
          
          const result1 = checkAuthorFilter(bookAuthor, config1);
          const result2 = checkAuthorFilter(bookAuthor, config2);
          
          // PROPERTY ASSERTION: Results must be the same
          expect(result1.passed).toBe(result2.passed);
        }
      ),
      { numRuns: 100 }
    );
  });
});
