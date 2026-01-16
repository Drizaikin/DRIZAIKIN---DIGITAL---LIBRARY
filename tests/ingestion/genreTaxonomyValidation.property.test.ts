/**
 * Property-Based Tests for Genre Taxonomy Validation
 * **Feature: ingestion-filtering, Property 5: Genre Taxonomy Validation**
 * **Validates: Requirements 5.1.5**
 * 
 * This test verifies that:
 * - For any genre name in the filter configuration, the system SHALL validate it against 
 *   the PRIMARY_GENRES taxonomy and reject invalid genres
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateGenreNames } from '../../services/ingestion/ingestionFilter.js';
import { PRIMARY_GENRES, validateGenre, isValidGenre } from '../../services/ingestion/genreTaxonomy.js';

/**
 * Generator for valid genre names from the taxonomy
 */
const validGenreArb = fc.constantFrom(...PRIMARY_GENRES);

/**
 * Generator for invalid genre names (not in taxonomy)
 */
const invalidGenreArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => !PRIMARY_GENRES.includes(s)),
  fc.constantFrom(
    'InvalidGenre',
    'NotAGenre',
    'FakeCategory',
    'Unknown',
    'Test Genre',
    'Fiction', // Not in our taxonomy
    'Mystery',
    'Romance',
    'Thriller'
  )
);

/**
 * Generator for arrays of valid genres
 */
const validGenresArrayArb = fc.array(validGenreArb, { minLength: 1, maxLength: 10 });

/**
 * Generator for arrays containing at least one invalid genre
 */
const mixedGenresArrayArb = fc.tuple(
  fc.array(validGenreArb, { minLength: 0, maxLength: 5 }),
  fc.array(invalidGenreArb, { minLength: 1, maxLength: 3 })
).map(([valid, invalid]) => [...valid, ...invalid]);

describe('Genre Taxonomy Validation - Property Tests', () => {
  /**
   * **Feature: ingestion-filtering, Property 5: Genre Taxonomy Validation**
   * **Validates: Requirements 5.1.5**
   * 
   * Property: For any genre name in the filter configuration, the system SHALL validate it 
   * against the PRIMARY_GENRES taxonomy and reject invalid genres
   */
  it('Property 5: All valid genres pass validation', () => {
    fc.assert(
      fc.property(
        validGenresArrayArb,
        (genres) => {
          // Call validateGenreNames with valid genres
          const result = validateGenreNames(genres);
          
          // PROPERTY ASSERTION: Must be valid
          expect(result.valid).toBe(true);
          
          // PROPERTY ASSERTION: No invalid genres should be reported
          expect(result.invalidGenres).toEqual([]);
          expect(result.invalidGenres.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Arrays containing invalid genres are rejected
   */
  it('Property 5a: Invalid genres are detected and rejected', () => {
    fc.assert(
      fc.property(
        mixedGenresArrayArb,
        (genres) => {
          // Call validateGenreNames with mixed valid/invalid genres
          const result = validateGenreNames(genres);
          
          // Count how many are actually invalid
          const actualInvalidCount = genres.filter(g => 
            !PRIMARY_GENRES.some(pg => pg.toLowerCase() === g.toLowerCase())
          ).length;
          
          if (actualInvalidCount > 0) {
            // PROPERTY ASSERTION: Must be invalid
            expect(result.valid).toBe(false);
            
            // PROPERTY ASSERTION: Invalid genres list should not be empty
            expect(result.invalidGenres.length).toBeGreaterThan(0);
            
            // PROPERTY ASSERTION: All reported invalid genres should actually be invalid
            result.invalidGenres.forEach(invalidGenre => {
              expect(PRIMARY_GENRES.some(pg => pg.toLowerCase() === invalidGenre.toLowerCase())).toBe(false);
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Single valid genre passes validation
   */
  it('Property 5b: Single valid genre passes validation', () => {
    fc.assert(
      fc.property(
        validGenreArb,
        (genre) => {
          // Call validateGenreNames with single valid genre
          const result = validateGenreNames([genre]);
          
          // PROPERTY ASSERTION: Must be valid
          expect(result.valid).toBe(true);
          expect(result.invalidGenres).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Single invalid genre fails validation
   */
  it('Property 5c: Single invalid genre fails validation', () => {
    fc.assert(
      fc.property(
        invalidGenreArb,
        (genre) => {
          // Ensure it's actually invalid
          const isActuallyInvalid = !PRIMARY_GENRES.some(pg => pg.toLowerCase() === genre.toLowerCase());
          
          if (!isActuallyInvalid) {
            return; // Skip if accidentally valid
          }
          
          // Call validateGenreNames with single invalid genre
          const result = validateGenreNames([genre]);
          
          // PROPERTY ASSERTION: Must be invalid
          expect(result.valid).toBe(false);
          
          // PROPERTY ASSERTION: Invalid genre should be reported
          expect(result.invalidGenres.length).toBeGreaterThan(0);
          expect(result.invalidGenres).toContain(genre);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Validation is case-insensitive
   */
  it('Property 5d: Validation is case-insensitive', () => {
    fc.assert(
      fc.property(
        validGenreArb,
        fc.constantFrom('lower', 'upper', 'mixed'),
        (genre, caseType) => {
          // Transform genre to different case
          let transformedGenre: string;
          
          if (caseType === 'lower') {
            transformedGenre = genre.toLowerCase();
          } else if (caseType === 'upper') {
            transformedGenre = genre.toUpperCase();
          } else {
            // Mixed case
            transformedGenre = genre.split('').map((c, i) => 
              i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()
            ).join('');
          }
          
          // Call validateGenreNames with transformed genre
          const result = validateGenreNames([transformedGenre]);
          
          // PROPERTY ASSERTION: Must be valid despite case differences
          expect(result.valid).toBe(true);
          expect(result.invalidGenres).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty array is valid (no invalid genres)
   */
  it('Property 5e: Empty genre array is valid', () => {
    const result = validateGenreNames([]);
    
    // PROPERTY ASSERTION: Empty array should be valid
    expect(result.valid).toBe(true);
    expect(result.invalidGenres).toEqual([]);
  });

  /**
   * Property: Validation result structure is always valid
   */
  it('Property 5f: Validation always returns valid result structure', () => {
    fc.assert(
      fc.property(
        fc.oneof(validGenresArrayArb, mixedGenresArrayArb, fc.constant([])),
        (genres) => {
          const result = validateGenreNames(genres);
          
          // PROPERTY ASSERTION: Result must have 'valid' boolean
          expect(typeof result.valid).toBe('boolean');
          
          // PROPERTY ASSERTION: Result must have 'invalidGenres' array
          expect(Array.isArray(result.invalidGenres)).toBe(true);
          
          // PROPERTY ASSERTION: If valid, invalidGenres must be empty
          if (result.valid) {
            expect(result.invalidGenres.length).toBe(0);
          }
          
          // PROPERTY ASSERTION: If invalid, invalidGenres must not be empty
          if (!result.valid) {
            expect(result.invalidGenres.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Validation is deterministic
   */
  it('Property 5g: Validation is deterministic', () => {
    fc.assert(
      fc.property(
        fc.oneof(validGenresArrayArb, mixedGenresArrayArb),
        (genres) => {
          // Call validateGenreNames twice with same input
          const result1 = validateGenreNames(genres);
          const result2 = validateGenreNames(genres);
          
          // PROPERTY ASSERTION: Results must be identical
          expect(result1.valid).toBe(result2.valid);
          expect(result1.invalidGenres).toEqual(result2.invalidGenres);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All reported invalid genres are actually invalid
   */
  it('Property 5h: Reported invalid genres are actually invalid', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(validGenreArb, invalidGenreArb), { minLength: 1, maxLength: 10 }),
        (genres) => {
          const result = validateGenreNames(genres);
          
          // PROPERTY ASSERTION: Every genre in invalidGenres must not be in PRIMARY_GENRES
          result.invalidGenres.forEach(invalidGenre => {
            const isInTaxonomy = PRIMARY_GENRES.some(pg => 
              pg.toLowerCase() === invalidGenre.toLowerCase()
            );
            expect(isInTaxonomy).toBe(false);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Validation handles non-array input gracefully
   */
  it('Property 5i: Validation handles non-array input', () => {
    // Test with null
    const result1 = validateGenreNames(null as any);
    expect(result1.valid).toBe(false);
    expect(Array.isArray(result1.invalidGenres)).toBe(true);
    
    // Test with undefined
    const result2 = validateGenreNames(undefined as any);
    expect(result2.valid).toBe(false);
    expect(Array.isArray(result2.invalidGenres)).toBe(true);
    
    // Test with string
    const result3 = validateGenreNames('Philosophy' as any);
    expect(result3.valid).toBe(false);
    expect(Array.isArray(result3.invalidGenres)).toBe(true);
    
    // Test with object
    const result4 = validateGenreNames({ genre: 'Philosophy' } as any);
    expect(result4.valid).toBe(false);
    expect(Array.isArray(result4.invalidGenres)).toBe(true);
  });

  /**
   * Property: Duplicate genres don't affect validation
   */
  it('Property 5j: Duplicate valid genres still pass validation', () => {
    fc.assert(
      fc.property(
        validGenreArb,
        fc.integer({ min: 2, max: 5 }),
        (genre, count) => {
          // Create array with duplicate genres
          const genres = Array(count).fill(genre);
          
          const result = validateGenreNames(genres);
          
          // PROPERTY ASSERTION: Must be valid
          expect(result.valid).toBe(true);
          expect(result.invalidGenres).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Whitespace-only strings are invalid
   */
  it('Property 5k: Whitespace-only genre names are invalid', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 10 }).map(arr => arr.join('')),
        (whitespaceString) => {
          const result = validateGenreNames([whitespaceString]);
          
          // PROPERTY ASSERTION: Must be invalid
          expect(result.valid).toBe(false);
          expect(result.invalidGenres.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Genres with leading/trailing whitespace are validated correctly
   */
  it('Property 5l: Genres with whitespace are validated after trimming', () => {
    fc.assert(
      fc.property(
        validGenreArb,
        fc.array(fc.constantFrom(' ', '\t'), { minLength: 1, maxLength: 3 }).map(arr => arr.join('')),
        fc.array(fc.constantFrom(' ', '\t'), { minLength: 1, maxLength: 3 }).map(arr => arr.join('')),
        (genre, leadingSpace, trailingSpace) => {
          // Add whitespace around valid genre
          const genreWithWhitespace = leadingSpace + genre + trailingSpace;
          
          const result = validateGenreNames([genreWithWhitespace]);
          
          // PROPERTY ASSERTION: Should be valid (after trimming)
          // The implementation trims whitespace, so " Philosophy " becomes "Philosophy"
          expect(result.valid).toBe(true);
          expect(result.invalidGenres).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Integration with isValidGenre function
   */
  it('Property 5m: validateGenreNames consistent with isValidGenre', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(validGenreArb, invalidGenreArb), { minLength: 1, maxLength: 10 }),
        (genres) => {
          const result = validateGenreNames(genres);
          
          // Check each genre individually with isValidGenre
          const individualChecks = genres.map(g => isValidGenre(g));
          const allValid = individualChecks.every(check => check === true);
          
          // PROPERTY ASSERTION: validateGenreNames result should match individual checks
          expect(result.valid).toBe(allValid);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All PRIMARY_GENRES are valid
   */
  it('Property 5n: All genres in PRIMARY_GENRES taxonomy are valid', () => {
    // Test that every genre in the taxonomy is considered valid
    PRIMARY_GENRES.forEach(genre => {
      const result = validateGenreNames([genre]);
      expect(result.valid).toBe(true);
      expect(result.invalidGenres).toEqual([]);
    });
  });

  /**
   * Property: Validation count matches actual invalid count
   */
  it('Property 5o: Invalid genres count matches actual invalid genres', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(validGenreArb, invalidGenreArb), { minLength: 1, maxLength: 10 }),
        (genres) => {
          const result = validateGenreNames(genres);
          
          // Count actual invalid genres
          const actualInvalidGenres = genres.filter(g => 
            !PRIMARY_GENRES.some(pg => pg.toLowerCase() === g.toLowerCase())
          );
          
          // PROPERTY ASSERTION: Reported count should match actual count
          expect(result.invalidGenres.length).toBe(actualInvalidGenres.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
