/**
 * Property-Based Tests for Progress Counter Accuracy
 * **Feature: ai-book-extraction, Property 6: Progress Counter Accuracy**
 * **Validates: Requirements 4.1, 4.3**
 * 
 * This test verifies that for any running extraction job, the books_extracted count
 * SHALL equal the number of extracted_books records with status 'completed' or 'published'.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ExtractionJob,
  ExtractedBook,
  calculateExpectedBooksExtracted,
  isProgressCounterAccurate,
  DEFAULT_MAX_TIME_MINUTES,
  DEFAULT_MAX_BOOKS
} from '../../services/extractionService';

/**
 * Helper to create a mock ExtractionJob for testing
 */
function createMockJob(overrides: Partial<ExtractionJob> = {}): ExtractionJob {
  return {
    id: 'test-job-id',
    sourceUrl: 'https://example.com/books',
    status: 'running',
    maxTimeMinutes: DEFAULT_MAX_TIME_MINUTES,
    maxBooks: DEFAULT_MAX_BOOKS,
    booksExtracted: 0,
    booksQueued: 0,
    errorCount: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    createdBy: 'test-admin-id',
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Helper to create a mock ExtractedBook
 */
function createMockBook(
  jobId: string,
  status: ExtractedBook['status'],
  index: number
): ExtractedBook {
  return {
    id: `book-${index}`,
    jobId,
    title: `Test Book ${index}`,
    author: `Author ${index}`,
    description: 'Test description',
    synopsis: 'Test synopsis',
    categoryId: null,
    categoryName: null,
    coverUrl: 'https://example.com/cover.jpg',
    pdfUrl: 'https://example.com/book.pdf',
    sourcePdfUrl: 'https://example.com/source.pdf',
    status,
    errorMessage: status === 'failed' ? 'Test error' : null,
    extractedAt: new Date().toISOString(),
    publishedAt: status === 'published' ? new Date().toISOString() : null
  };
}

// Arbitrary for book status
const bookStatusArb = fc.constantFrom<ExtractedBook['status']>(
  'processing', 'completed', 'failed', 'published'
);

// Arbitrary for countable book status (completed or published)
const countableStatusArb = fc.constantFrom<ExtractedBook['status']>(
  'completed', 'published'
);

// Arbitrary for non-countable book status (processing or failed)
const nonCountableStatusArb = fc.constantFrom<ExtractedBook['status']>(
  'processing', 'failed'
);

describe('Progress Counter Accuracy - Property Tests', () => {
  /**
   * **Feature: ai-book-extraction, Property 6: Progress Counter Accuracy**
   * **Validates: Requirements 4.1, 4.3**
   * 
   * Property: For any list of extracted books, calculateExpectedBooksExtracted
   * SHALL return the count of books with status 'completed' or 'published'.
   */
  it('Property 6: Expected count equals completed + published books', () => {
    fc.assert(
      fc.property(
        // Number of completed books
        fc.integer({ min: 0, max: 50 }),
        // Number of published books
        fc.integer({ min: 0, max: 50 }),
        // Number of processing books
        fc.integer({ min: 0, max: 50 }),
        // Number of failed books
        fc.integer({ min: 0, max: 50 }),
        (completedCount, publishedCount, processingCount, failedCount) => {
          const jobId = 'test-job';
          const books: ExtractedBook[] = [];
          let index = 0;

          // Add completed books
          for (let i = 0; i < completedCount; i++) {
            books.push(createMockBook(jobId, 'completed', index++));
          }

          // Add published books
          for (let i = 0; i < publishedCount; i++) {
            books.push(createMockBook(jobId, 'published', index++));
          }

          // Add processing books
          for (let i = 0; i < processingCount; i++) {
            books.push(createMockBook(jobId, 'processing', index++));
          }

          // Add failed books
          for (let i = 0; i < failedCount; i++) {
            books.push(createMockBook(jobId, 'failed', index++));
          }

          const expectedCount = calculateExpectedBooksExtracted(books);

          // PROPERTY ASSERTION: Count should equal completed + published
          expect(expectedCount).toBe(completedCount + publishedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 6: Progress Counter Accuracy**
   * **Validates: Requirements 4.1, 4.3**
   * 
   * Property: For any job where booksExtracted equals the count of completed/published books,
   * isProgressCounterAccurate SHALL return true.
   */
  it('Property 6: Accurate counter returns true', () => {
    fc.assert(
      fc.property(
        // Number of countable books (completed + published)
        fc.integer({ min: 0, max: 100 }),
        // Number of non-countable books (processing + failed)
        fc.integer({ min: 0, max: 50 }),
        (countableCount, nonCountableCount) => {
          const jobId = 'test-job';
          const books: ExtractedBook[] = [];
          let index = 0;

          // Add countable books (mix of completed and published)
          for (let i = 0; i < countableCount; i++) {
            const status = i % 2 === 0 ? 'completed' : 'published';
            books.push(createMockBook(jobId, status, index++));
          }

          // Add non-countable books
          for (let i = 0; i < nonCountableCount; i++) {
            const status = i % 2 === 0 ? 'processing' : 'failed';
            books.push(createMockBook(jobId, status, index++));
          }

          // Create job with accurate counter
          const job = createMockJob({
            id: jobId,
            booksExtracted: countableCount
          });

          // PROPERTY ASSERTION: Accurate counter should return true
          expect(isProgressCounterAccurate(job, books)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 6: Progress Counter Accuracy**
   * **Validates: Requirements 4.1, 4.3**
   * 
   * Property: For any job where booksExtracted does NOT equal the count of 
   * completed/published books, isProgressCounterAccurate SHALL return false.
   */
  it('Property 6: Inaccurate counter returns false', () => {
    fc.assert(
      fc.property(
        // Number of countable books
        fc.integer({ min: 0, max: 100 }),
        // Offset from accurate count (non-zero)
        fc.integer({ min: 1, max: 50 }),
        // Direction of offset (true = over, false = under)
        fc.boolean(),
        (countableCount, offset, isOver) => {
          const jobId = 'test-job';
          const books: ExtractedBook[] = [];

          // Add countable books
          for (let i = 0; i < countableCount; i++) {
            const status = i % 2 === 0 ? 'completed' : 'published';
            books.push(createMockBook(jobId, status, i));
          }

          // Create job with inaccurate counter
          const inaccurateCount = isOver 
            ? countableCount + offset 
            : Math.max(0, countableCount - offset);

          // Skip if the inaccurate count happens to equal the actual count
          if (inaccurateCount === countableCount) return;

          const job = createMockJob({
            id: jobId,
            booksExtracted: inaccurateCount
          });

          // PROPERTY ASSERTION: Inaccurate counter should return false
          expect(isProgressCounterAccurate(job, books)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 6: Progress Counter Accuracy**
   * **Validates: Requirements 4.1, 4.3**
   * 
   * Property: For an empty list of books, the expected count SHALL be 0.
   */
  it('Property 6: Empty book list has zero expected count', () => {
    const books: ExtractedBook[] = [];
    const expectedCount = calculateExpectedBooksExtracted(books);

    expect(expectedCount).toBe(0);
  });

  /**
   * **Feature: ai-book-extraction, Property 6: Progress Counter Accuracy**
   * **Validates: Requirements 4.1, 4.3**
   * 
   * Property: For any list containing only 'processing' or 'failed' books,
   * the expected count SHALL be 0.
   */
  it('Property 6: Non-countable books only results in zero count', () => {
    fc.assert(
      fc.property(
        // Number of processing books
        fc.integer({ min: 0, max: 50 }),
        // Number of failed books
        fc.integer({ min: 0, max: 50 }),
        (processingCount, failedCount) => {
          const jobId = 'test-job';
          const books: ExtractedBook[] = [];
          let index = 0;

          // Add only non-countable books
          for (let i = 0; i < processingCount; i++) {
            books.push(createMockBook(jobId, 'processing', index++));
          }
          for (let i = 0; i < failedCount; i++) {
            books.push(createMockBook(jobId, 'failed', index++));
          }

          const expectedCount = calculateExpectedBooksExtracted(books);

          // PROPERTY ASSERTION: Only non-countable books should result in 0
          expect(expectedCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 6: Progress Counter Accuracy**
   * **Validates: Requirements 4.1, 4.3**
   * 
   * Property: Adding a 'completed' or 'published' book increases the expected count by 1.
   */
  it('Property 6: Adding countable book increases count by 1', () => {
    fc.assert(
      fc.property(
        // Initial number of books of each status
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        // Status of new book to add
        countableStatusArb,
        (completedCount, publishedCount, processingCount, failedCount, newStatus) => {
          const jobId = 'test-job';
          const books: ExtractedBook[] = [];
          let index = 0;

          // Create initial books
          for (let i = 0; i < completedCount; i++) {
            books.push(createMockBook(jobId, 'completed', index++));
          }
          for (let i = 0; i < publishedCount; i++) {
            books.push(createMockBook(jobId, 'published', index++));
          }
          for (let i = 0; i < processingCount; i++) {
            books.push(createMockBook(jobId, 'processing', index++));
          }
          for (let i = 0; i < failedCount; i++) {
            books.push(createMockBook(jobId, 'failed', index++));
          }

          const countBefore = calculateExpectedBooksExtracted(books);

          // Add a new countable book
          books.push(createMockBook(jobId, newStatus, index++));

          const countAfter = calculateExpectedBooksExtracted(books);

          // PROPERTY ASSERTION: Count should increase by exactly 1
          expect(countAfter).toBe(countBefore + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 6: Progress Counter Accuracy**
   * **Validates: Requirements 4.1, 4.3**
   * 
   * Property: Adding a 'processing' or 'failed' book does NOT change the expected count.
   */
  it('Property 6: Adding non-countable book does not change count', () => {
    fc.assert(
      fc.property(
        // Initial number of books of each status
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        // Status of new book to add
        nonCountableStatusArb,
        (completedCount, publishedCount, processingCount, failedCount, newStatus) => {
          const jobId = 'test-job';
          const books: ExtractedBook[] = [];
          let index = 0;

          // Create initial books
          for (let i = 0; i < completedCount; i++) {
            books.push(createMockBook(jobId, 'completed', index++));
          }
          for (let i = 0; i < publishedCount; i++) {
            books.push(createMockBook(jobId, 'published', index++));
          }
          for (let i = 0; i < processingCount; i++) {
            books.push(createMockBook(jobId, 'processing', index++));
          }
          for (let i = 0; i < failedCount; i++) {
            books.push(createMockBook(jobId, 'failed', index++));
          }

          const countBefore = calculateExpectedBooksExtracted(books);

          // Add a new non-countable book
          books.push(createMockBook(jobId, newStatus, index++));

          const countAfter = calculateExpectedBooksExtracted(books);

          // PROPERTY ASSERTION: Count should remain unchanged
          expect(countAfter).toBe(countBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 6: Progress Counter Accuracy**
   * **Validates: Requirements 4.1, 4.3**
   * 
   * Property: The order of books in the list does not affect the expected count.
   */
  it('Property 6: Book order does not affect count', () => {
    fc.assert(
      fc.property(
        // Generate a list of book statuses
        fc.array(bookStatusArb, { minLength: 1, maxLength: 50 }),
        (statuses) => {
          const jobId = 'test-job';
          
          // Create books in original order
          const booksOriginal = statuses.map((status, i) => 
            createMockBook(jobId, status, i)
          );
          
          // Create books in reversed order
          const booksReversed = [...statuses].reverse().map((status, i) => 
            createMockBook(jobId, status, i)
          );

          const countOriginal = calculateExpectedBooksExtracted(booksOriginal);
          const countReversed = calculateExpectedBooksExtracted(booksReversed);

          // PROPERTY ASSERTION: Order should not affect count
          expect(countOriginal).toBe(countReversed);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 6: Progress Counter Accuracy**
   * **Validates: Requirements 4.1, 4.3**
   * 
   * Property: Progress counter accuracy check is symmetric - 
   * if job.booksExtracted matches actual count, it's accurate regardless of book composition.
   */
  it('Property 6: Accuracy check is consistent with any book composition', () => {
    fc.assert(
      fc.property(
        // Generate random book statuses
        fc.array(bookStatusArb, { minLength: 0, maxLength: 50 }),
        (statuses) => {
          const jobId = 'test-job';
          
          const books = statuses.map((status, i) => 
            createMockBook(jobId, status, i)
          );

          const expectedCount = calculateExpectedBooksExtracted(books);

          // Create job with accurate counter
          const accurateJob = createMockJob({
            id: jobId,
            booksExtracted: expectedCount
          });

          // Create job with inaccurate counter
          const inaccurateJob = createMockJob({
            id: jobId,
            booksExtracted: expectedCount + 1
          });

          // PROPERTY ASSERTION: Accurate job should pass, inaccurate should fail
          expect(isProgressCounterAccurate(accurateJob, books)).toBe(true);
          expect(isProgressCounterAccurate(inaccurateJob, books)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
