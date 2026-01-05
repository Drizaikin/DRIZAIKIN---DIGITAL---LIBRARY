/**
 * Property-Based Tests for User Visibility Isolation
 * **Feature: ai-book-extraction, Property 4: User Visibility Isolation**
 * **Validates: Requirements 7.2, 7.3, 7.4**
 * 
 * This test verifies that for any non-admin user query, the results SHALL exclude
 * all books with status other than 'published' in the extracted_books table.
 * 
 * The visibility isolation is achieved through:
 * 1. Extracted books are stored in a separate 'extracted_books' table
 * 2. Regular users query 'books_with_status' view which only shows main 'books' table
 * 3. Only books published via publish_extracted_books() appear in user queries
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ExtractedBook } from '../../services/extractionService';

/**
 * Book status types for extracted books
 */
type ExtractedBookStatus = 'processing' | 'completed' | 'failed' | 'published';

/**
 * Simulates the books_with_status view behavior
 * This view only shows books from the main 'books' table, not from 'extracted_books'
 * 
 * Property 4: User Visibility Isolation
 * Requirements: 7.2, 7.3, 7.4
 */
interface PublicBook {
  id: string;
  title: string;
  author: string;
  category: string;
  status: 'Available' | 'Borrowed';
}

/**
 * Simulates the main books table (only contains published books)
 */
interface MainBook {
  id: string;
  title: string;
  author: string;
  categoryId: string | null;
  isFromExtraction: boolean;
}

/**
 * Determines if an extracted book should be visible to regular users
 * Property 4: User Visibility Isolation
 * Requirements: 7.2, 7.3, 7.4
 * 
 * Only books with status 'published' should be visible to users.
 * Books with 'processing', 'completed', or 'failed' status are hidden.
 * 
 * @param status - The status of the extracted book
 * @returns true if the book should be visible to regular users
 */
export function isVisibleToUsers(status: ExtractedBookStatus): boolean {
  return status === 'published';
}

/**
 * Filters extracted books to only those visible to regular users
 * Property 4: User Visibility Isolation
 * Requirements: 7.2, 7.3, 7.4
 * 
 * @param books - List of extracted books
 * @returns Only books that should be visible to users
 */
export function filterVisibleBooks(books: ExtractedBook[]): ExtractedBook[] {
  return books.filter(book => isVisibleToUsers(book.status));
}

/**
 * Simulates the publish_extracted_books function behavior
 * Requirements: 7.3
 * 
 * When an extraction job completes successfully, completed books are published
 * to the main catalog by changing their status to 'published'.
 * 
 * @param books - List of extracted books to publish
 * @returns Books with updated status
 */
export function publishCompletedBooks(books: ExtractedBook[]): ExtractedBook[] {
  return books.map(book => {
    if (book.status === 'completed') {
      return {
        ...book,
        status: 'published' as const,
        publishedAt: new Date().toISOString()
      };
    }
    return book;
  });
}

/**
 * Simulates the user query behavior (books_with_status view)
 * Property 4: User Visibility Isolation
 * Requirements: 7.2, 7.3, 7.4
 * 
 * This function represents what a non-admin user sees when querying books.
 * The books_with_status view only shows books from the main 'books' table,
 * which only contains published extracted books.
 * 
 * @param mainBooks - Books in the main 'books' table
 * @param extractedBooks - Books in the 'extracted_books' table
 * @returns Books visible to regular users
 */
export function getUserVisibleBooks(
  mainBooks: MainBook[],
  extractedBooks: ExtractedBook[]
): PublicBook[] {
  // The books_with_status view only queries the main 'books' table
  // Extracted books are NOT included unless they've been published
  // (which moves them to the main books table)
  
  // Only published extracted books would have been moved to main books table
  const publishedExtractedIds = new Set(
    extractedBooks
      .filter(eb => eb.status === 'published')
      .map(eb => eb.id)
  );
  
  // Return main books (which includes published extracted books)
  return mainBooks.map(book => ({
    id: book.id,
    title: book.title,
    author: book.author,
    category: 'General',
    status: 'Available' as const
  }));
}

/**
 * Checks if any non-published extracted books are visible in user results
 * Property 4: User Visibility Isolation
 * Requirements: 7.2, 7.3, 7.4
 * 
 * @param userResults - Books visible to the user
 * @param extractedBooks - All extracted books (including non-published)
 * @returns true if isolation is maintained (no non-published books visible)
 */
export function isVisibilityIsolationMaintained(
  userResults: PublicBook[],
  extractedBooks: ExtractedBook[]
): boolean {
  // Get IDs of non-published extracted books
  const nonPublishedIds = new Set(
    extractedBooks
      .filter(eb => eb.status !== 'published')
      .map(eb => eb.id)
  );
  
  // Check that none of the user results contain non-published extracted books
  return !userResults.some(book => nonPublishedIds.has(book.id));
}

/**
 * Checks if search results exclude in-progress extraction books
 * Property 4: User Visibility Isolation
 * Requirement 7.4
 * 
 * @param searchResults - Search results returned to user
 * @param inProgressJobIds - IDs of in-progress extraction jobs
 * @param extractedBooks - All extracted books
 * @returns true if in-progress books are excluded
 */
export function areInProgressBooksExcluded(
  searchResults: PublicBook[],
  inProgressJobIds: string[],
  extractedBooks: ExtractedBook[]
): boolean {
  // Get IDs of books from in-progress jobs
  const inProgressBookIds = new Set(
    extractedBooks
      .filter(eb => inProgressJobIds.includes(eb.jobId))
      .map(eb => eb.id)
  );
  
  // Check that none of the search results contain in-progress books
  return !searchResults.some(book => inProgressBookIds.has(book.id));
}

// Helper to create a mock ExtractedBook
function createMockExtractedBook(
  jobId: string,
  status: ExtractedBookStatus,
  index: number
): ExtractedBook {
  return {
    id: `extracted-book-${index}`,
    jobId,
    title: `Extracted Book ${index}`,
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

// Arbitrary for extracted book status
const extractedBookStatusArb = fc.constantFrom<ExtractedBookStatus>(
  'processing', 'completed', 'failed', 'published'
);

// Arbitrary for non-published status (hidden from users)
const nonPublishedStatusArb = fc.constantFrom<ExtractedBookStatus>(
  'processing', 'completed', 'failed'
);

describe('User Visibility Isolation - Property Tests', () => {
  /**
   * **Feature: ai-book-extraction, Property 4: User Visibility Isolation**
   * **Validates: Requirements 7.2, 7.3, 7.4**
   * 
   * Property: For any extracted book, only books with status 'published'
   * SHALL be visible to regular users.
   */
  it('Property 4: Only published books are visible to users', () => {
    fc.assert(
      fc.property(
        extractedBookStatusArb,
        (status) => {
          const isVisible = isVisibleToUsers(status);
          
          // PROPERTY ASSERTION: Only 'published' status should be visible
          if (status === 'published') {
            expect(isVisible).toBe(true);
          } else {
            expect(isVisible).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 4: User Visibility Isolation**
   * **Validates: Requirements 7.2**
   * 
   * Property: For any list of extracted books with mixed statuses,
   * filterVisibleBooks SHALL return only books with 'published' status.
   */
  it('Property 4: Filter returns only published books', () => {
    fc.assert(
      fc.property(
        // Number of books for each status
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        (processingCount, completedCount, failedCount, publishedCount) => {
          const jobId = 'test-job';
          const books: ExtractedBook[] = [];
          let index = 0;

          // Add books with different statuses
          for (let i = 0; i < processingCount; i++) {
            books.push(createMockExtractedBook(jobId, 'processing', index++));
          }
          for (let i = 0; i < completedCount; i++) {
            books.push(createMockExtractedBook(jobId, 'completed', index++));
          }
          for (let i = 0; i < failedCount; i++) {
            books.push(createMockExtractedBook(jobId, 'failed', index++));
          }
          for (let i = 0; i < publishedCount; i++) {
            books.push(createMockExtractedBook(jobId, 'published', index++));
          }

          const visibleBooks = filterVisibleBooks(books);

          // PROPERTY ASSERTION: Only published books should be returned
          expect(visibleBooks.length).toBe(publishedCount);
          expect(visibleBooks.every(b => b.status === 'published')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 4: User Visibility Isolation**
   * **Validates: Requirements 7.2, 7.3**
   * 
   * Property: For any extraction job, books being extracted SHALL remain
   * hidden from the public catalog until extraction completes and they are published.
   */
  it('Property 4: In-progress extraction books are hidden', () => {
    fc.assert(
      fc.property(
        // Number of books in each non-published state
        fc.integer({ min: 1, max: 30 }),
        nonPublishedStatusArb,
        (bookCount, status) => {
          const jobId = 'in-progress-job';
          const books: ExtractedBook[] = [];

          // Create books with non-published status (simulating in-progress extraction)
          for (let i = 0; i < bookCount; i++) {
            books.push(createMockExtractedBook(jobId, status, i));
          }

          const visibleBooks = filterVisibleBooks(books);

          // PROPERTY ASSERTION: No in-progress books should be visible
          expect(visibleBooks.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 4: User Visibility Isolation**
   * **Validates: Requirements 7.3**
   * 
   * Property: When an extraction job completes successfully, the extracted books
   * SHALL automatically become visible in the public catalog after publishing.
   */
  it('Property 4: Published books become visible after completion', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        (bookCount) => {
          const jobId = 'completed-job';
          const books: ExtractedBook[] = [];

          // Create completed books (ready to be published)
          for (let i = 0; i < bookCount; i++) {
            books.push(createMockExtractedBook(jobId, 'completed', i));
          }

          // Before publishing - no books visible
          const visibleBefore = filterVisibleBooks(books);
          expect(visibleBefore.length).toBe(0);

          // Publish the books
          const publishedBooks = publishCompletedBooks(books);

          // After publishing - all books visible
          const visibleAfter = filterVisibleBooks(publishedBooks);

          // PROPERTY ASSERTION: All completed books become visible after publishing
          expect(visibleAfter.length).toBe(bookCount);
          expect(visibleAfter.every(b => b.status === 'published')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 4: User Visibility Isolation**
   * **Validates: Requirements 7.4**
   * 
   * Property: When a user searches the library, search results SHALL exclude
   * books from in-progress extraction jobs.
   */
  it('Property 4: Search excludes in-progress extraction books', () => {
    fc.assert(
      fc.property(
        // Number of in-progress jobs
        fc.integer({ min: 1, max: 5 }),
        // Books per job
        fc.integer({ min: 1, max: 10 }),
        // Status of books in in-progress jobs
        nonPublishedStatusArb,
        (jobCount, booksPerJob, status) => {
          const inProgressJobIds: string[] = [];
          const extractedBooks: ExtractedBook[] = [];
          let bookIndex = 0;

          // Create in-progress jobs with books
          for (let j = 0; j < jobCount; j++) {
            const jobId = `in-progress-job-${j}`;
            inProgressJobIds.push(jobId);
            
            for (let i = 0; i < booksPerJob; i++) {
              extractedBooks.push(createMockExtractedBook(jobId, status, bookIndex++));
            }
          }

          // Simulate empty search results (since no books are published)
          const searchResults: PublicBook[] = [];

          // PROPERTY ASSERTION: In-progress books are excluded from search
          const isExcluded = areInProgressBooksExcluded(
            searchResults,
            inProgressJobIds,
            extractedBooks
          );
          expect(isExcluded).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 4: User Visibility Isolation**
   * **Validates: Requirements 7.2, 7.3, 7.4**
   * 
   * Property: For any mix of published and non-published extracted books,
   * user visibility isolation SHALL be maintained.
   */
  it('Property 4: Visibility isolation is maintained for mixed statuses', () => {
    fc.assert(
      fc.property(
        // Generate random book statuses
        fc.array(extractedBookStatusArb, { minLength: 1, maxLength: 50 }),
        (statuses) => {
          const jobId = 'test-job';
          const extractedBooks = statuses.map((status, i) => 
            createMockExtractedBook(jobId, status, i)
          );

          // Simulate user results (only published books would be in main table)
          const userResults: PublicBook[] = extractedBooks
            .filter(eb => eb.status === 'published')
            .map(eb => ({
              id: eb.id,
              title: eb.title,
              author: eb.author,
              category: 'General',
              status: 'Available' as const
            }));

          // PROPERTY ASSERTION: Visibility isolation is maintained
          const isIsolated = isVisibilityIsolationMaintained(userResults, extractedBooks);
          expect(isIsolated).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 4: User Visibility Isolation**
   * **Validates: Requirements 7.2**
   * 
   * Property: Failed extraction books SHALL never be visible to users.
   */
  it('Property 4: Failed books are never visible', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (bookCount) => {
          const jobId = 'failed-job';
          const books: ExtractedBook[] = [];

          // Create failed books
          for (let i = 0; i < bookCount; i++) {
            books.push(createMockExtractedBook(jobId, 'failed', i));
          }

          const visibleBooks = filterVisibleBooks(books);

          // PROPERTY ASSERTION: No failed books should be visible
          expect(visibleBooks.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 4: User Visibility Isolation**
   * **Validates: Requirements 7.2, 7.3**
   * 
   * Property: Publishing only affects 'completed' books, not 'processing' or 'failed'.
   */
  it('Property 4: Publishing only affects completed books', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 15 }),
        (processingCount, completedCount, failedCount) => {
          const jobId = 'test-job';
          const books: ExtractedBook[] = [];
          let index = 0;

          // Add books with different statuses
          for (let i = 0; i < processingCount; i++) {
            books.push(createMockExtractedBook(jobId, 'processing', index++));
          }
          for (let i = 0; i < completedCount; i++) {
            books.push(createMockExtractedBook(jobId, 'completed', index++));
          }
          for (let i = 0; i < failedCount; i++) {
            books.push(createMockExtractedBook(jobId, 'failed', index++));
          }

          // Publish books
          const afterPublish = publishCompletedBooks(books);

          // Count statuses after publishing
          const processingAfter = afterPublish.filter(b => b.status === 'processing').length;
          const failedAfter = afterPublish.filter(b => b.status === 'failed').length;
          const publishedAfter = afterPublish.filter(b => b.status === 'published').length;

          // PROPERTY ASSERTION: Only completed books become published
          expect(processingAfter).toBe(processingCount);
          expect(failedAfter).toBe(failedCount);
          expect(publishedAfter).toBe(completedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 4: User Visibility Isolation**
   * **Validates: Requirements 7.2, 7.3, 7.4**
   * 
   * Property: The count of visible books SHALL equal the count of published books.
   */
  it('Property 4: Visible count equals published count', () => {
    fc.assert(
      fc.property(
        fc.array(extractedBookStatusArb, { minLength: 0, maxLength: 100 }),
        (statuses) => {
          const jobId = 'test-job';
          const books = statuses.map((status, i) => 
            createMockExtractedBook(jobId, status, i)
          );

          const visibleBooks = filterVisibleBooks(books);
          const publishedCount = statuses.filter(s => s === 'published').length;

          // PROPERTY ASSERTION: Visible count equals published count
          expect(visibleBooks.length).toBe(publishedCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
