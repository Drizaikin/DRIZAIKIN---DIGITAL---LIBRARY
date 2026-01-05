/**
 * Property-Based Tests for Metadata Completeness
 * **Feature: ai-book-extraction, Property 3: Metadata Completeness**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * This test verifies that for any successfully extracted book, the metadata
 * SHALL include non-empty values for title, author, description, and synopsis.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  BookMetadata,
  isMetadataComplete,
  isDescriptionValid,
  isSynopsisValid
} from '../../services/metadataExtractorService';

// Helper to generate a word of random length
const wordArb = fc.string({ minLength: 1, maxLength: 15 })
  .filter(s => /^[a-zA-Z]+$/.test(s));

// Helper to generate a sentence (multiple words)
const sentenceArb = fc.array(wordArb, { minLength: 3, maxLength: 15 })
  .map(words => words.join(' '));

// Helper to generate text with specific word count
const textWithWordCountArb = (minWords: number, maxWords: number) =>
  fc.array(wordArb, { minLength: minWords, maxLength: maxWords })
    .map(words => words.join(' '));

// Generate valid description (100-200 words)
const validDescriptionArb = textWithWordCountArb(100, 200);

// Generate valid synopsis (50-100 words)
const validSynopsisArb = textWithWordCountArb(50, 100);

// Generate invalid description (outside 100-200 words)
const invalidDescriptionArb = fc.oneof(
  textWithWordCountArb(1, 99),    // Too short
  textWithWordCountArb(201, 250)  // Too long
);

// Generate invalid synopsis (outside 50-100 words)
const invalidSynopsisArb = fc.oneof(
  textWithWordCountArb(1, 49),    // Too short
  textWithWordCountArb(101, 150)  // Too long
);

// Generate non-empty string (for title/author)
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

// Generate empty or whitespace-only string
const emptyOrWhitespaceArb = fc.constantFrom('', ' ', '  ', '\t', '\n', '   \t\n  ');

// Generate valid BookMetadata
const validMetadataArb = fc.record({
  title: nonEmptyStringArb,
  author: nonEmptyStringArb,
  description: validDescriptionArb,
  synopsis: validSynopsisArb,
  suggestedCategory: fc.string(),
  confidence: fc.float({ min: 0, max: 1 })
});

// Generate categories
const categoryArb = fc.constantFrom(
  'Fiction', 'Non-Fiction', 'Science', 'Technology', 
  'History', 'Biography', 'Self-Help', 'Education'
);

describe('Metadata Completeness - Property Tests', () => {
  /**
   * **Feature: ai-book-extraction, Property 3: Metadata Completeness**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   * 
   * Property: For any metadata with non-empty title, author, description, and synopsis,
   * isMetadataComplete SHALL return true.
   */
  it('Property 3: Complete metadata with all non-empty fields is valid', () => {
    fc.assert(
      fc.property(
        validMetadataArb,
        (metadata: BookMetadata) => {
          // PROPERTY ASSERTION: Metadata with all non-empty fields must be complete
          expect(isMetadataComplete(metadata)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 3: Metadata Completeness**
   * **Validates: Requirements 3.1**
   * 
   * Property: For any metadata with empty or whitespace-only title,
   * isMetadataComplete SHALL return false.
   */
  it('Property 3: Metadata with empty title is incomplete', () => {
    fc.assert(
      fc.property(
        emptyOrWhitespaceArb,
        nonEmptyStringArb,
        validDescriptionArb,
        validSynopsisArb,
        (title, author, description, synopsis) => {
          const metadata: BookMetadata = {
            title,
            author,
            description,
            synopsis,
            suggestedCategory: 'Fiction',
            confidence: 0.8
          };
          
          // PROPERTY ASSERTION: Metadata with empty title must be incomplete
          expect(isMetadataComplete(metadata)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 3: Metadata Completeness**
   * **Validates: Requirements 3.2**
   * 
   * Property: For any metadata with empty or whitespace-only author,
   * isMetadataComplete SHALL return false.
   */
  it('Property 3: Metadata with empty author is incomplete', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        emptyOrWhitespaceArb,
        validDescriptionArb,
        validSynopsisArb,
        (title, author, description, synopsis) => {
          const metadata: BookMetadata = {
            title,
            author,
            description,
            synopsis,
            suggestedCategory: 'Fiction',
            confidence: 0.8
          };
          
          // PROPERTY ASSERTION: Metadata with empty author must be incomplete
          expect(isMetadataComplete(metadata)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 3: Metadata Completeness**
   * **Validates: Requirements 3.3**
   * 
   * Property: For any metadata with empty or whitespace-only description,
   * isMetadataComplete SHALL return false.
   */
  it('Property 3: Metadata with empty description is incomplete', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        nonEmptyStringArb,
        emptyOrWhitespaceArb,
        validSynopsisArb,
        (title, author, description, synopsis) => {
          const metadata: BookMetadata = {
            title,
            author,
            description,
            synopsis,
            suggestedCategory: 'Fiction',
            confidence: 0.8
          };
          
          // PROPERTY ASSERTION: Metadata with empty description must be incomplete
          expect(isMetadataComplete(metadata)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 3: Metadata Completeness**
   * **Validates: Requirements 3.4**
   * 
   * Property: For any metadata with empty or whitespace-only synopsis,
   * isMetadataComplete SHALL return false.
   */
  it('Property 3: Metadata with empty synopsis is incomplete', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        nonEmptyStringArb,
        validDescriptionArb,
        emptyOrWhitespaceArb,
        (title, author, description, synopsis) => {
          const metadata: BookMetadata = {
            title,
            author,
            description,
            synopsis,
            suggestedCategory: 'Fiction',
            confidence: 0.8
          };
          
          // PROPERTY ASSERTION: Metadata with empty synopsis must be incomplete
          expect(isMetadataComplete(metadata)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 3: Metadata Completeness**
   * **Validates: Requirements 3.3**
   * 
   * Property: For any description with 100-200 words, isDescriptionValid SHALL return true.
   */
  it('Property 3: Description with 100-200 words is valid', () => {
    fc.assert(
      fc.property(
        validDescriptionArb,
        (description) => {
          // PROPERTY ASSERTION: Description with valid word count must be valid
          expect(isDescriptionValid(description)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 3: Metadata Completeness**
   * **Validates: Requirements 3.3**
   * 
   * Property: For any description with fewer than 100 or more than 200 words,
   * isDescriptionValid SHALL return false.
   */
  it('Property 3: Description outside 100-200 words is invalid', () => {
    fc.assert(
      fc.property(
        invalidDescriptionArb,
        (description) => {
          // PROPERTY ASSERTION: Description with invalid word count must be invalid
          expect(isDescriptionValid(description)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 3: Metadata Completeness**
   * **Validates: Requirements 3.4**
   * 
   * Property: For any synopsis with 50-100 words, isSynopsisValid SHALL return true.
   */
  it('Property 3: Synopsis with 50-100 words is valid', () => {
    fc.assert(
      fc.property(
        validSynopsisArb,
        (synopsis) => {
          // PROPERTY ASSERTION: Synopsis with valid word count must be valid
          expect(isSynopsisValid(synopsis)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 3: Metadata Completeness**
   * **Validates: Requirements 3.4**
   * 
   * Property: For any synopsis with fewer than 50 or more than 100 words,
   * isSynopsisValid SHALL return false.
   */
  it('Property 3: Synopsis outside 50-100 words is invalid', () => {
    fc.assert(
      fc.property(
        invalidSynopsisArb,
        (synopsis) => {
          // PROPERTY ASSERTION: Synopsis with invalid word count must be invalid
          expect(isSynopsisValid(synopsis)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 3: Metadata Completeness**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   * 
   * Property: For any combination of empty fields, isMetadataComplete SHALL return false.
   */
  it('Property 3: Any combination of empty fields makes metadata incomplete', () => {
    // Generate metadata where at least one required field is empty
    const incompleteMetadataArb = fc.tuple(
      fc.oneof(nonEmptyStringArb, emptyOrWhitespaceArb),
      fc.oneof(nonEmptyStringArb, emptyOrWhitespaceArb),
      fc.oneof(validDescriptionArb, emptyOrWhitespaceArb),
      fc.oneof(validSynopsisArb, emptyOrWhitespaceArb)
    ).filter(([title, author, description, synopsis]) => {
      // At least one field must be empty/whitespace
      return (
        title.trim().length === 0 ||
        author.trim().length === 0 ||
        description.trim().length === 0 ||
        synopsis.trim().length === 0
      );
    });

    fc.assert(
      fc.property(
        incompleteMetadataArb,
        ([title, author, description, synopsis]) => {
          const metadata: BookMetadata = {
            title,
            author,
            description,
            synopsis,
            suggestedCategory: 'Fiction',
            confidence: 0.8
          };
          
          // PROPERTY ASSERTION: Metadata with any empty required field must be incomplete
          expect(isMetadataComplete(metadata)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 3: Metadata Completeness**
   * **Validates: Requirements 3.3, 3.4**
   * 
   * Property: Word count calculation is consistent - the same text always produces
   * the same word count result.
   */
  it('Property 3: Word count validation is deterministic', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 1000 }),
        (text) => {
          // Run validation multiple times
          const result1 = isDescriptionValid(text);
          const result2 = isDescriptionValid(text);
          const result3 = isDescriptionValid(text);
          
          // PROPERTY ASSERTION: Same input must always produce same result
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
          
          const synopsisResult1 = isSynopsisValid(text);
          const synopsisResult2 = isSynopsisValid(text);
          
          expect(synopsisResult1).toBe(synopsisResult2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 3: Metadata Completeness**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   * 
   * Property: Trimming whitespace from fields should not change completeness
   * for fields that have actual content.
   */
  it('Property 3: Leading/trailing whitespace does not affect completeness for non-empty content', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        nonEmptyStringArb,
        validDescriptionArb,
        validSynopsisArb,
        fc.constantFrom('', ' ', '  ', '\t'),
        (title, author, description, synopsis, whitespace) => {
          // Add whitespace padding
          const paddedMetadata: BookMetadata = {
            title: whitespace + title + whitespace,
            author: whitespace + author + whitespace,
            description: whitespace + description + whitespace,
            synopsis: whitespace + synopsis + whitespace,
            suggestedCategory: 'Fiction',
            confidence: 0.8
          };
          
          // PROPERTY ASSERTION: Whitespace padding should not affect completeness
          // since the validation trims before checking
          expect(isMetadataComplete(paddedMetadata)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
