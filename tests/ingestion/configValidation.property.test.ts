/**
 * Property-Based Tests for Configuration Validation
 * **Feature: ingestion-filtering, Property 19: Configuration Validation**
 * **Validates: Requirements 5.8.5**
 * 
 * This test verifies that:
 * - For any filter configuration save operation, the system SHALL validate genre names against taxonomy
 *   and author names are non-empty strings before saving
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PRIMARY_GENRES } from '../../services/ingestion/genreTaxonomy.js';

// Mock the dependencies
import { vi } from 'vitest';

vi.mock('../../services/ingestion/genreTaxonomy.js', async () => {
  const actual = await vi.importActual('../../services/ingestion/genreTaxonomy.js');
  return actual;
});

vi.mock('../../services/ingestion/ingestionFilter.js', async () => {
  const actual = await vi.importActual('../../services/ingestion/ingestionFilter.js');
  return actual;
});

// Import after mocking
const { validateFilterConfig } = await import('../../api/admin/ingestion/filters.js');

/**
 * Generator for valid genre names from the taxonomy
 */
const validGenreArb = fc.constantFrom(...PRIMARY_GENRES);

/**
 * Generator for invalid genre names (not in taxonomy)
 */
const invalidGenreArb = fc.oneof(
  fc.constant('InvalidGenre'),
  fc.constant('FakeCategory'),
  fc.constant('NotARealGenre'),
  fc.constant('Random'),
  fc.constant('Test Genre'),
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => 
    !PRIMARY_GENRES.some(g => g.toLowerCase() === s.toLowerCase())
  )
);

/**
 * Generator for valid author names (non-empty strings)
 */
const validAuthorArb = fc.oneof(
  fc.constant('Robin Sharma'),
  fc.constant('Paulo Coelho'),
  fc.constant('Dale Carnegie'),
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
);

/**
 * Generator for invalid author names (empty or non-string)
 */
const invalidAuthorArb = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('\t'),
  fc.constant('\n')
);

/**
 * Generator for valid filter configuration
 */
const validConfigArb = fc.record({
  allowedGenres: fc.array(validGenreArb, { minLength: 0, maxLength: 10 }),
  allowedAuthors: fc.array(validAuthorArb, { minLength: 0, maxLength: 10 }),
  enableGenreFilter: fc.boolean(),
  enableAuthorFilter: fc.boolean()
});

/**
 * Generator for configuration with invalid genres
 */
const configWithInvalidGenresArb = fc.record({
  allowedGenres: fc.array(
    fc.oneof(validGenreArb, invalidGenreArb),
    { minLength: 1, maxLength: 5 }
  ).filter(genres => genres.some(g => !PRIMARY_GENRES.includes(g))),
  allowedAuthors: fc.array(validAuthorArb, { minLength: 0, maxLength: 5 }),
  enableGenreFilter: fc.boolean(),
  enableAuthorFilter: fc.boolean()
});

/**
 * Generator for configuration with invalid authors
 */
const configWithInvalidAuthorsArb = fc.record({
  allowedGenres: fc.array(validGenreArb, { minLength: 0, maxLength: 5 }),
  allowedAuthors: fc.array(
    fc.oneof(validAuthorArb, invalidAuthorArb),
    { minLength: 1, maxLength: 5 }
  ).filter(authors => authors.some(a => typeof a !== 'string' || a.trim().length === 0)),
  enableGenreFilter: fc.boolean(),
  enableAuthorFilter: fc.boolean()
});

describe('Configuration Validation - Property Tests', () => {
  /**
   * **Feature: ingestion-filtering, Property 19: Configuration Validation**
   * **Validates: Requirements 5.8.5**
   * 
   * Property: For any valid filter configuration (with valid genres and non-empty author strings),
   * the validation SHALL pass
   */
  it('Property 19a: Valid configurations always pass validation', () => {
    fc.assert(
      fc.property(
        validConfigArb,
        (config) => {
          // Call validateFilterConfig
          const result = validateFilterConfig(config);
          
          // PROPERTY ASSERTION: Valid config must pass
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ingestion-filtering, Property 19: Configuration Validation**
   * **Validates: Requirements 5.8.5**
   * 
   * Property: For any configuration with invalid genre names (not in taxonomy),
   * the validation SHALL fail and report the invalid genres
   */
  it('Property 19b: Configurations with invalid genres fail validation', () => {
    fc.assert(
      fc.property(
        configWithInvalidGenresArb,
        (config) => {
          // Call validateFilterConfig
          const result = validateFilterConfig(config);
          
          // PROPERTY ASSERTION: Invalid genres must cause failure
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          
          // PROPERTY ASSERTION: Error message must mention invalid genres
          const hasGenreError = result.errors.some(err => 
            err.includes('Invalid genres')
          );
          expect(hasGenreError).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ingestion-filtering, Property 19: Configuration Validation**
   * **Validates: Requirements 5.8.5**
   * 
   * Property: For any configuration with empty or whitespace-only author names,
   * the validation SHALL fail
   */
  it('Property 19c: Configurations with empty author names fail validation', () => {
    fc.assert(
      fc.property(
        configWithInvalidAuthorsArb,
        (config) => {
          // Call validateFilterConfig
          const result = validateFilterConfig(config);
          
          // PROPERTY ASSERTION: Empty authors must cause failure
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          
          // PROPERTY ASSERTION: Error message must mention author validation
          const hasAuthorError = result.errors.some(err => 
            err.includes('author') || err.includes('string')
          );
          expect(hasAuthorError).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty arrays for genres and authors are valid
   */
  it('Property 19d: Empty filter arrays are valid', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        (enableGenre, enableAuthor) => {
          const config = {
            allowedGenres: [],
            allowedAuthors: [],
            enableGenreFilter: enableGenre,
            enableAuthorFilter: enableAuthor
          };
          
          const result = validateFilterConfig(config);
          
          // PROPERTY ASSERTION: Empty arrays are valid
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Configuration with only genres is valid
   */
  it('Property 19e: Configuration with only genres (no authors) is valid', () => {
    fc.assert(
      fc.property(
        fc.array(validGenreArb, { minLength: 1, maxLength: 10 }),
        fc.boolean(),
        (genres, enableGenre) => {
          const config = {
            allowedGenres: genres,
            enableGenreFilter: enableGenre
          };
          
          const result = validateFilterConfig(config);
          
          // PROPERTY ASSERTION: Partial config is valid
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Configuration with only authors is valid
   */
  it('Property 19f: Configuration with only authors (no genres) is valid', () => {
    fc.assert(
      fc.property(
        fc.array(validAuthorArb, { minLength: 1, maxLength: 10 }),
        fc.boolean(),
        (authors, enableAuthor) => {
          const config = {
            allowedAuthors: authors,
            enableAuthorFilter: enableAuthor
          };
          
          const result = validateFilterConfig(config);
          
          // PROPERTY ASSERTION: Partial config is valid
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-boolean enable flags cause validation failure
   */
  it('Property 19g: Non-boolean enable flags fail validation', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.constant(null),
          fc.constant(undefined)
        ),
        (invalidBoolean) => {
          const config1 = {
            allowedGenres: [],
            allowedAuthors: [],
            enableGenreFilter: invalidBoolean
          };
          
          const result1 = validateFilterConfig(config1);
          
          // Skip if undefined (optional field)
          if (invalidBoolean !== undefined) {
            expect(result1.valid).toBe(false);
            expect(result1.errors.some(e => e.includes('enableGenreFilter'))).toBe(true);
          }
          
          const config2 = {
            allowedGenres: [],
            allowedAuthors: [],
            enableAuthorFilter: invalidBoolean
          };
          
          const result2 = validateFilterConfig(config2);
          
          // Skip if undefined (optional field)
          if (invalidBoolean !== undefined) {
            expect(result2.valid).toBe(false);
            expect(result2.errors.some(e => e.includes('enableAuthorFilter'))).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Validation is deterministic (same input always produces same output)
   */
  it('Property 19h: Validation is deterministic', () => {
    fc.assert(
      fc.property(
        fc.oneof(validConfigArb, configWithInvalidGenresArb, configWithInvalidAuthorsArb),
        (config) => {
          // Call validateFilterConfig twice with same input
          const result1 = validateFilterConfig(config);
          const result2 = validateFilterConfig(config);
          
          // PROPERTY ASSERTION: Results must be identical
          expect(result1.valid).toBe(result2.valid);
          expect(result1.errors).toEqual(result2.errors);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Validation result structure is always valid
   */
  it('Property 19i: Validation always returns valid result structure', () => {
    fc.assert(
      fc.property(
        fc.anything(),
        (config) => {
          const result = validateFilterConfig(config);
          
          // PROPERTY ASSERTION: Result must have 'valid' boolean
          expect(typeof result.valid).toBe('boolean');
          
          // PROPERTY ASSERTION: Result must have 'errors' array
          expect(Array.isArray(result.errors)).toBe(true);
          
          // PROPERTY ASSERTION: If valid, errors should be empty
          if (result.valid) {
            expect(result.errors).toHaveLength(0);
          }
          
          // PROPERTY ASSERTION: If invalid, errors should not be empty
          if (!result.valid) {
            expect(result.errors.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Genre validation is case-insensitive
   */
  it('Property 19j: Genre validation is case-insensitive', () => {
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
          
          const config = {
            allowedGenres: [transformedGenre],
            allowedAuthors: [],
            enableGenreFilter: true,
            enableAuthorFilter: false
          };
          
          const result = validateFilterConfig(config);
          
          // PROPERTY ASSERTION: Must pass despite case differences
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple validation errors are all reported
   */
  it('Property 19k: Multiple validation errors are all reported', () => {
    fc.assert(
      fc.property(
        fc.array(invalidGenreArb, { minLength: 1, maxLength: 3 }),
        fc.array(invalidAuthorArb, { minLength: 1, maxLength: 3 }),
        (invalidGenres, invalidAuthors) => {
          const config = {
            allowedGenres: invalidGenres,
            allowedAuthors: invalidAuthors,
            enableGenreFilter: 'not-a-boolean' as any,
            enableAuthorFilter: 123 as any
          };
          
          const result = validateFilterConfig(config);
          
          // PROPERTY ASSERTION: Must fail
          expect(result.valid).toBe(false);
          
          // PROPERTY ASSERTION: Should have multiple errors
          expect(result.errors.length).toBeGreaterThan(0);
          
          // PROPERTY ASSERTION: Should report genre errors
          const hasGenreError = result.errors.some(e => 
            e.includes('Invalid genres') || e.includes('allowedGenres')
          );
          expect(hasGenreError).toBe(true);
          
          // PROPERTY ASSERTION: Should report author errors
          const hasAuthorError = result.errors.some(e => 
            e.includes('author') || e.includes('string')
          );
          expect(hasAuthorError).toBe(true);
          
          // PROPERTY ASSERTION: Should report boolean errors
          const hasBooleanError = result.errors.some(e => 
            e.includes('boolean')
          );
          expect(hasBooleanError).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Null or undefined configuration fails validation
   */
  it('Property 19l: Null or undefined configuration fails validation', () => {
    const result1 = validateFilterConfig(null as any);
    expect(result1.valid).toBe(false);
    expect(result1.errors).toContain('Configuration must be an object');
    
    const result2 = validateFilterConfig(undefined as any);
    expect(result2.valid).toBe(false);
    expect(result2.errors).toContain('Configuration must be an object');
  });

  /**
   * Property: Non-array genres/authors fail validation
   */
  it('Property 19m: Non-array genres and authors fail validation', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.constant(null),
          fc.record({})
        ),
        (nonArray) => {
          const config1 = {
            allowedGenres: nonArray
          };
          
          const result1 = validateFilterConfig(config1);
          expect(result1.valid).toBe(false);
          expect(result1.errors.some(e => e.includes('allowedGenres must be an array'))).toBe(true);
          
          const config2 = {
            allowedAuthors: nonArray
          };
          
          const result2 = validateFilterConfig(config2);
          expect(result2.valid).toBe(false);
          expect(result2.errors.some(e => e.includes('allowedAuthors must be an array'))).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Duplicate genres in configuration are still valid
   */
  it('Property 19n: Duplicate genres in configuration are valid', () => {
    fc.assert(
      fc.property(
        validGenreArb,
        fc.integer({ min: 2, max: 5 }),
        (genre, count) => {
          // Create array with duplicate genres
          const duplicateGenres = Array(count).fill(genre);
          
          const config = {
            allowedGenres: duplicateGenres,
            allowedAuthors: [],
            enableGenreFilter: true,
            enableAuthorFilter: false
          };
          
          const result = validateFilterConfig(config);
          
          // PROPERTY ASSERTION: Duplicates are valid
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Whitespace-trimmed author names are validated correctly
   */
  it('Property 19o: Author names with leading/trailing whitespace are valid', () => {
    fc.assert(
      fc.property(
        validAuthorArb,
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        (author, leadingSpaces, trailingSpaces) => {
          // Add whitespace
          const paddedAuthor = ' '.repeat(leadingSpaces) + author + ' '.repeat(trailingSpaces);
          
          const config = {
            allowedGenres: [],
            allowedAuthors: [paddedAuthor],
            enableGenreFilter: false,
            enableAuthorFilter: true
          };
          
          const result = validateFilterConfig(config);
          
          // PROPERTY ASSERTION: Whitespace-padded valid names are valid
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
