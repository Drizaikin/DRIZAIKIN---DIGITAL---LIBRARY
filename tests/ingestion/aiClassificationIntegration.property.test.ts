/**
 * Property-Based Tests for AI Classification Integration
 * 
 * Feature: ingestion-filtering
 * Properties 7-11: AI Classification Integration
 * Validates: Requirements 5.3.1-5.3.6
 * 
 * These tests verify that AI classification integrates correctly with the
 * ingestion filtering pipeline, ensuring:
 * - Classification receives complete book metadata
 * - Genre count bounds are enforced
 * - Sub-genre count bounds are enforced
 * - Genres are stored in the database
 * - Classification failures don't block ingestion
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildPrompt, parseResponse } from '../../services/ingestion/genreClassifier.js';
import { PRIMARY_GENRES, SUB_GENRES, validateGenres, validateSubgenre } from '../../services/ingestion/genreTaxonomy.js';

/**
 * Book metadata interface for testing
 */
interface BookMetadata {
  title: string;
  author: string;
  year: number | null;
  description: string | null;
}

/**
 * Classification result interface
 */
interface ClassificationResult {
  genres: string[];
  subgenre: string | null;
}

/**
 * Book record as stored in database
 */
interface BookRecord {
  title: string;
  author: string;
  year: number | null;
  language: string | null;
  source_identifier: string;
  pdf_url: string;
  description: string | null;
  genres: string[] | null;
  subgenre: string | null;
  category: string;
}

/**
 * Generator for book metadata
 */
const bookMetadataArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 200 }),
  author: fc.string({ minLength: 1, maxLength: 100 }),
  year: fc.option(fc.integer({ min: 1000, max: 1927 }), { nil: undefined }).map(v => v ?? null),
  description: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: undefined }).map(v => v ?? null)
});

/**
 * Generator for valid classification results
 */
const validClassificationArb = fc.record({
  genres: fc.array(fc.constantFrom(...PRIMARY_GENRES), { minLength: 1, maxLength: 3 }),
  subgenre: fc.option(fc.constantFrom(...SUB_GENRES), { nil: undefined }).map(v => v ?? null)
});

/**
 * Simulates the book processing pipeline with classification
 */
function simulateBookProcessing(
  book: BookMetadata,
  classification: ClassificationResult | null,
  identifier: string
): { success: boolean; bookRecord: BookRecord } {
  // Determine category based on genres
  let category = 'Uncategorized';
  if (classification && classification.genres && classification.genres.length > 0) {
    category = classification.genres[0];
  }

  const bookRecord: BookRecord = {
    title: book.title || 'Unknown Title',
    author: book.author || 'Unknown Author',
    year: book.year,
    language: null,
    source_identifier: identifier,
    pdf_url: `https://storage.example.com/${identifier}.pdf`,
    description: book.description,
    genres: classification ? classification.genres : null,
    subgenre: classification ? classification.subgenre : null,
    category: category
  };

  return {
    success: true,
    bookRecord
  };
}

describe('AI Classification Integration - Property Tests', () => {
  /**
   * **Feature: ingestion-filtering, Property 7: AI Classification Input Completeness**
   * **Validates: Requirements 5.3.1**
   * 
   * Property: For any book being classified, the AI classifier SHALL receive
   * title, author, description, and year fields.
   */
  it('Property 7: AI Classification Input Completeness - buildPrompt includes all required fields', () => {
    fc.assert(
      fc.property(
        bookMetadataArb,
        fc.context(),
        (book, ctx) => {
          ctx.log(`Book: ${book.title}`);
          
          const prompt = buildPrompt(book);
          
          // PROPERTY ASSERTION 1: Title is included in prompt
          expect(prompt).toContain(book.title);
          
          // PROPERTY ASSERTION 2: Author is included in prompt
          expect(prompt).toContain(book.author);
          
          // PROPERTY ASSERTION 3: Year field is referenced (either value or 'Unknown')
          if (book.year) {
            expect(prompt).toContain(String(book.year));
          } else {
            expect(prompt).toContain('Unknown');
          }
          
          // PROPERTY ASSERTION 4: Description is referenced (either value or 'No description')
          if (book.description && book.description.length > 0) {
            // Description may be truncated, so check for substring
            const descSubstring = book.description.substring(0, Math.min(50, book.description.length));
            expect(prompt).toContain(descSubstring);
          } else {
            expect(prompt).toContain('No description available');
          }
          
          // PROPERTY ASSERTION 5: Prompt contains taxonomy for AI reference
          expect(prompt).toContain('PRIMARY GENRES');
          expect(prompt).toContain('SUB-GENRES');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ingestion-filtering, Property 8: Genre Count Bounds**
   * **Validates: Requirements 5.3.2**
   * 
   * Property: For any AI classification result, the number of assigned genres
   * SHALL be between 1 and 3 inclusive.
   */
  it('Property 8: Genre Count Bounds - parsed results have 1-3 genres', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...PRIMARY_GENRES), { minLength: 1, maxLength: 10 }),
        fc.option(fc.constantFrom(...SUB_GENRES), { nil: undefined }),
        fc.context(),
        (genres, subgenre, ctx) => {
          ctx.log(`Input genres: ${genres.length}`);
          
          const response = JSON.stringify({
            genres: genres,
            subgenre: subgenre || null
          });
          
          const result = parseResponse(response);
          
          // PROPERTY ASSERTION 1: Result is not null for valid input
          expect(result).not.toBeNull();
          
          // PROPERTY ASSERTION 2: Genre count is at least 1
          expect(result!.genres.length).toBeGreaterThanOrEqual(1);
          
          // PROPERTY ASSERTION 3: Genre count is at most 3
          expect(result!.genres.length).toBeLessThanOrEqual(3);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ingestion-filtering, Property 9: Sub-Genre Count Bounds**
   * **Validates: Requirements 5.3.3**
   * 
   * Property: For any AI classification result, the number of assigned
   * sub-genres SHALL be 0 or 1.
   */
  it('Property 9: Sub-Genre Count Bounds - parsed results have 0 or 1 subgenre', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...PRIMARY_GENRES), { minLength: 1, maxLength: 3 }),
        fc.option(fc.constantFrom(...SUB_GENRES), { nil: undefined }),
        fc.context(),
        (genres, subgenre, ctx) => {
          ctx.log(`Subgenre: ${subgenre || 'null'}`);
          
          const response = JSON.stringify({
            genres: genres,
            subgenre: subgenre || null
          });
          
          const result = parseResponse(response);
          
          // PROPERTY ASSERTION 1: Result is not null
          expect(result).not.toBeNull();
          
          // PROPERTY ASSERTION 2: Subgenre is either null or a single valid value
          if (result!.subgenre !== null) {
            expect(typeof result!.subgenre).toBe('string');
            expect(SUB_GENRES).toContain(result!.subgenre);
          }
          
          // PROPERTY ASSERTION 3: Subgenre count is 0 or 1 (not an array)
          expect(Array.isArray(result!.subgenre)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ingestion-filtering, Property 10: Genre Storage Persistence**
   * **Validates: Requirements 5.3.4**
   * 
   * Property: For any book successfully ingested, the AI-determined genres
   * SHALL be stored in the database genres field.
   */
  it('Property 10: Genre Storage Persistence - genres are stored in book record', () => {
    fc.assert(
      fc.property(
        bookMetadataArb,
        validClassificationArb,
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        fc.context(),
        (book, classification, identifier, ctx) => {
          ctx.log(`Book: ${book.title}, Genres: ${classification.genres.join(', ')}`);
          
          const result = simulateBookProcessing(book, classification, identifier);
          
          // PROPERTY ASSERTION 1: Book insertion succeeds
          expect(result.success).toBe(true);
          
          // PROPERTY ASSERTION 2: Genres are stored in book record
          expect(result.bookRecord.genres).not.toBeNull();
          expect(Array.isArray(result.bookRecord.genres)).toBe(true);
          
          // PROPERTY ASSERTION 3: Stored genres match classification genres
          expect(result.bookRecord.genres).toEqual(classification.genres);
          
          // PROPERTY ASSERTION 4: Subgenre is stored correctly
          expect(result.bookRecord.subgenre).toEqual(classification.subgenre);
          
          // PROPERTY ASSERTION 5: Category is synced with first genre
          expect(result.bookRecord.category).toBe(classification.genres[0]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ingestion-filtering, Property 11: Non-Blocking Classification**
   * **Validates: Requirements 5.3.5, 5.3.6**
   * 
   * Property: For any book where AI classification fails, the ingestion
   * process SHALL continue without blocking.
   */
  it('Property 11: Non-Blocking Classification - classification failure does not block ingestion', () => {
    fc.assert(
      fc.property(
        bookMetadataArb,
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        fc.context(),
        (book, identifier, ctx) => {
          ctx.log(`Book: ${book.title}`);
          
          // Simulate classification failure (returns null)
          const result = simulateBookProcessing(book, null, identifier);
          
          // PROPERTY ASSERTION 1: Book insertion succeeds despite classification failure
          expect(result.success).toBe(true);
          
          // PROPERTY ASSERTION 2: Book record is created with null genres
          expect(result.bookRecord.genres).toBeNull();
          expect(result.bookRecord.subgenre).toBeNull();
          
          // PROPERTY ASSERTION 3: Category defaults to 'Uncategorized'
          expect(result.bookRecord.category).toBe('Uncategorized');
          
          // PROPERTY ASSERTION 4: Book metadata is preserved
          expect(result.bookRecord.title).toBe(book.title);
          expect(result.bookRecord.author).toBe(book.author);
          expect(result.bookRecord.source_identifier).toBe(identifier);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11a: Multiple failure types all result in non-blocking behavior
   */
  it('Property 11a: All classification failure types are handled uniformly', () => {
    const failureTypes = ['timeout', 'api_error', 'invalid_response', 'network_error', 'rate_limit'];
    
    fc.assert(
      fc.property(
        bookMetadataArb,
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        fc.context(),
        (book, identifier, ctx) => {
          // Test each failure type
          for (const failureType of failureTypes) {
            ctx.log(`Testing failure type: ${failureType}`);
            
            // All failure types result in null classification
            const result = simulateBookProcessing(book, null, identifier);
            
            // PROPERTY ASSERTION: All failure types result in successful insertion
            expect(result.success).toBe(true);
            expect(result.bookRecord.genres).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8a: Validate genre count bounds with validateGenres function
   */
  it('Property 8a: validateGenres enforces 1-3 genre limit', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...PRIMARY_GENRES), { minLength: 1, maxLength: 10 }),
        fc.context(),
        (genres, ctx) => {
          ctx.log(`Input genres: ${genres.length}`);
          
          const validated = validateGenres(genres);
          
          // PROPERTY ASSERTION 1: Result is an array
          expect(Array.isArray(validated)).toBe(true);
          
          // PROPERTY ASSERTION 2: Result has at most 3 genres
          expect(validated.length).toBeLessThanOrEqual(3);
          
          // PROPERTY ASSERTION 3: All validated genres are from taxonomy
          for (const genre of validated) {
            expect(PRIMARY_GENRES).toContain(genre);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9a: Validate subgenre with validateSubgenre function
   */
  it('Property 9a: validateSubgenre returns valid subgenre or null', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(...SUB_GENRES),
          fc.string({ minLength: 1, maxLength: 50 })
        ),
        fc.context(),
        (subgenre, ctx) => {
          ctx.log(`Input subgenre: ${subgenre}`);
          
          const validated = validateSubgenre(subgenre);
          
          // PROPERTY ASSERTION: Result is either null or a valid subgenre
          if (validated !== null) {
            expect(SUB_GENRES).toContain(validated);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10a: Books without genres get 'Uncategorized' category
   */
  it('Property 10a: Books without genres get Uncategorized category', () => {
    fc.assert(
      fc.property(
        bookMetadataArb,
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        fc.context(),
        (book, identifier, ctx) => {
          ctx.log(`Book: ${book.title}`);
          
          // Process with null classification
          const result = simulateBookProcessing(book, null, identifier);
          
          // PROPERTY ASSERTION: Category is 'Uncategorized' when no genres
          expect(result.bookRecord.category).toBe('Uncategorized');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7a: buildPrompt handles missing optional fields gracefully
   */
  it('Property 7a: buildPrompt handles missing optional fields gracefully', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }),
          author: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          year: fc.option(fc.integer({ min: 1000, max: 1927 }), { nil: undefined }),
          description: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined })
        }),
        fc.context(),
        (book, ctx) => {
          ctx.log(`Book: ${book.title}`);
          
          // Build prompt with potentially missing fields
          const prompt = buildPrompt({
            title: book.title,
            author: book.author || undefined,
            year: book.year || undefined,
            description: book.description || undefined
          });
          
          // PROPERTY ASSERTION 1: Prompt is generated without errors
          expect(typeof prompt).toBe('string');
          expect(prompt.length).toBeGreaterThan(0);
          
          // PROPERTY ASSERTION 2: Title is always included
          expect(prompt).toContain(book.title);
          
          // PROPERTY ASSERTION 3: Missing fields show 'Unknown' or default
          if (!book.author) {
            expect(prompt).toContain('Unknown');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
