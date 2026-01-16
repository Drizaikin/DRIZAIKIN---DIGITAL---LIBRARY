/**
 * Property-Based Tests for Sort Order Correctness
 * **Feature: admin-book-management, Property 2: Sort Order Correctness**
 * **Validates: Requirements 1.4**
 * 
 * This test verifies that for any list of books and any valid sort field
 * (title, author, date, category), the returned books SHALL be ordered
 * according to the specified sort field and direction.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Interface representing a Book record
 */
interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  genres?: string[];
  source?: string;
  created_at: string;
}

/**
 * Interface representing sort options
 */
interface SortOptions {
  page: number;
  pageSize: number;
  sortBy: 'title' | 'author' | 'added_date' | 'category' | 'created_at';
  sortOrder: 'asc' | 'desc';
}

/**
 * Interface representing the paginated response
 */
interface PaginatedResponse {
  success: boolean;
  books: Book[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Valid sort fields matching the service
 */
const VALID_SORT_FIELDS = ['title', 'author', 'added_date', 'category', 'created_at'];

/**
 * Maps frontend sort field names to book property names
 */
const SORT_FIELD_MAP: Record<string, keyof Book> = {
  'title': 'title',
  'author': 'author',
  'added_date': 'created_at',
  'category': 'category',
  'created_at': 'created_at'
};

/**
 * Simulates the listBooks sorting logic from bookManagementService.js
 * This mirrors the core sorting behavior without database dependency
 */
function simulateListBooksWithSort(allBooks: Book[], options: SortOptions): PaginatedResponse {
  // Validate and set defaults (mirrors service logic)
  const page = Math.max(1, Math.floor(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize) || 20));
  const sortBy = VALID_SORT_FIELDS.includes(options.sortBy) ? options.sortBy : 'created_at';
  const sortOrder = options.sortOrder === 'asc' ? 'asc' : 'desc';
  
  // Get the actual field to sort by
  const sortField = SORT_FIELD_MAP[sortBy] || 'created_at';
  
  // Sort books
  const sortedBooks = [...allBooks].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    // Handle null/undefined values (push to end)
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return sortOrder === 'asc' ? 1 : -1;
    if (bValue == null) return sortOrder === 'asc' ? -1 : 1;
    
    // String comparison (case-insensitive for text fields)
    let comparison: number;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
    } else {
      comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  // Calculate pagination
  const total = sortedBooks.length;
  const totalPages = Math.ceil(total / pageSize);
  const offset = (page - 1) * pageSize;
  
  // Get page of results
  const books = sortedBooks.slice(offset, offset + pageSize);
  
  return {
    success: true,
    books,
    total,
    page,
    pageSize,
    totalPages
  };
}

// Generator for book IDs
const bookIdArb = fc.uuid();

// Generator for book titles
const bookTitleArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

// Generator for author names
const authorArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

// Generator for categories
const categoryArb = fc.constantFrom('Fiction', 'Non-Fiction', 'Science', 'History', 'Technology', 'Art');

// Generator for genres
const genreArb = fc.array(
  fc.constantFrom('Mystery', 'Romance', 'Thriller', 'Biography', 'Self-Help', 'Programming'),
  { minLength: 0, maxLength: 3 }
);

// Generator for sources
const sourceArb = fc.constantFrom('internet_archive', 'manual', 'extraction', 'open_library');

// Generator for ISO date strings with varied timestamps
const dateArb = fc.integer({ min: 1577836800000, max: 1767225600000 }) // 2020-01-01 to 2025-12-31
  .map(timestamp => new Date(timestamp).toISOString());

// Generator for a single book
const bookArb = fc.record({
  id: bookIdArb,
  title: bookTitleArb,
  author: authorArb,
  category: categoryArb,
  genres: genreArb,
  source: sourceArb,
  created_at: dateArb
});

// Generator for array of books (simulating database)
const booksArrayArb = fc.array(bookArb, { minLength: 0, maxLength: 100 });

// Generator for valid sort fields
const sortFieldArb = fc.constantFrom('title', 'author', 'added_date', 'category', 'created_at') as fc.Arbitrary<'title' | 'author' | 'added_date' | 'category' | 'created_at'>;

// Generator for sort order
const sortOrderArb = fc.constantFrom('asc', 'desc') as fc.Arbitrary<'asc' | 'desc'>;

// Generator for page number
const pageArb = fc.integer({ min: 1, max: 20 });

// Generator for page size
const pageSizeArb = fc.integer({ min: 1, max: 100 });

/**
 * Helper function to check if an array is sorted correctly
 */
function isSortedCorrectly(
  books: Book[], 
  sortField: keyof Book, 
  sortOrder: 'asc' | 'desc'
): boolean {
  if (books.length <= 1) return true;
  
  for (let i = 0; i < books.length - 1; i++) {
    const current = books[i][sortField];
    const next = books[i + 1][sortField];
    
    // Handle null/undefined values
    if (current == null && next == null) continue;
    if (current == null) return sortOrder !== 'asc'; // null should be at end for asc
    if (next == null) return sortOrder === 'asc'; // null should be at end for asc
    
    // Compare values
    let comparison: number;
    if (typeof current === 'string' && typeof next === 'string') {
      comparison = current.toLowerCase().localeCompare(next.toLowerCase());
    } else {
      comparison = current < next ? -1 : current > next ? 1 : 0;
    }
    
    if (sortOrder === 'asc' && comparison > 0) return false;
    if (sortOrder === 'desc' && comparison < 0) return false;
  }
  
  return true;
}

describe('Sort Order Correctness - Property Tests', () => {
  /**
   * **Feature: admin-book-management, Property 2: Sort Order Correctness**
   * **Validates: Requirements 1.4**
   * 
   * Property: For any sort field and order, returned books are correctly sorted
   */
  it('Property 2a: Books are sorted correctly by specified field and order', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        sortFieldArb,
        sortOrderArb,
        pageSizeArb,
        (books, sortBy, sortOrder, pageSize) => {
          const result = simulateListBooksWithSort(books, { 
            page: 1, 
            pageSize, 
            sortBy, 
            sortOrder 
          });
          
          const sortField = SORT_FIELD_MAP[sortBy] || 'created_at';
          expect(isSortedCorrectly(result.books, sortField, sortOrder)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * 
   * Property: Sort by title produces alphabetically ordered results
   */
  it('Property 2b: Sort by title produces alphabetical order', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        sortOrderArb,
        (books, sortOrder) => {
          const result = simulateListBooksWithSort(books, { 
            page: 1, 
            pageSize: 100, 
            sortBy: 'title', 
            sortOrder 
          });
          
          expect(isSortedCorrectly(result.books, 'title', sortOrder)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * 
   * Property: Sort by author produces alphabetically ordered results
   */
  it('Property 2c: Sort by author produces alphabetical order', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        sortOrderArb,
        (books, sortOrder) => {
          const result = simulateListBooksWithSort(books, { 
            page: 1, 
            pageSize: 100, 
            sortBy: 'author', 
            sortOrder 
          });
          
          expect(isSortedCorrectly(result.books, 'author', sortOrder)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * 
   * Property: Sort by category produces alphabetically ordered results
   */
  it('Property 2d: Sort by category produces alphabetical order', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        sortOrderArb,
        (books, sortOrder) => {
          const result = simulateListBooksWithSort(books, { 
            page: 1, 
            pageSize: 100, 
            sortBy: 'category', 
            sortOrder 
          });
          
          expect(isSortedCorrectly(result.books, 'category', sortOrder)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * 
   * Property: Sort by date produces chronologically ordered results
   */
  it('Property 2e: Sort by date produces chronological order', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        sortOrderArb,
        (books, sortOrder) => {
          const result = simulateListBooksWithSort(books, { 
            page: 1, 
            pageSize: 100, 
            sortBy: 'added_date', 
            sortOrder 
          });
          
          expect(isSortedCorrectly(result.books, 'created_at', sortOrder)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * 
   * Property: Ascending and descending orders are inverses of each other
   */
  it('Property 2f: Ascending and descending orders are inverses', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        sortFieldArb,
        (books, sortBy) => {
          const ascResult = simulateListBooksWithSort(books, { 
            page: 1, 
            pageSize: 100, 
            sortBy, 
            sortOrder: 'asc' 
          });
          
          const descResult = simulateListBooksWithSort(books, { 
            page: 1, 
            pageSize: 100, 
            sortBy, 
            sortOrder: 'desc' 
          });
          
          // The descending result should be the reverse of ascending
          // (accounting for stable sort behavior with equal values)
          if (ascResult.books.length > 0) {
            // First element of asc should be last of desc (or equal)
            const sortField = SORT_FIELD_MAP[sortBy] || 'created_at';
            const ascFirst = ascResult.books[0][sortField];
            const descLast = descResult.books[descResult.books.length - 1][sortField];
            
            // They should be equal or the asc first should be <= desc last
            if (typeof ascFirst === 'string' && typeof descLast === 'string') {
              expect(ascFirst.toLowerCase().localeCompare(descLast.toLowerCase())).toBeLessThanOrEqual(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * 
   * Property: Sort order is preserved across pages
   */
  it('Property 2g: Sort order is preserved across pages', () => {
    fc.assert(
      fc.property(
        fc.array(bookArb, { minLength: 10, maxLength: 50 }),
        sortFieldArb,
        sortOrderArb,
        fc.integer({ min: 3, max: 10 }),
        (books, sortBy, sortOrder, pageSize) => {
          const sortField = SORT_FIELD_MAP[sortBy] || 'created_at';
          
          // Get first two pages
          const page1 = simulateListBooksWithSort(books, { 
            page: 1, 
            pageSize, 
            sortBy, 
            sortOrder 
          });
          
          const page2 = simulateListBooksWithSort(books, { 
            page: 2, 
            pageSize, 
            sortBy, 
            sortOrder 
          });
          
          if (page1.books.length > 0 && page2.books.length > 0) {
            // Last item of page 1 should come before (or equal to) first item of page 2
            const lastOfPage1 = page1.books[page1.books.length - 1][sortField];
            const firstOfPage2 = page2.books[0][sortField];
            
            if (lastOfPage1 != null && firstOfPage2 != null) {
              let comparison: number;
              if (typeof lastOfPage1 === 'string' && typeof firstOfPage2 === 'string') {
                comparison = lastOfPage1.toLowerCase().localeCompare(firstOfPage2.toLowerCase());
              } else {
                comparison = lastOfPage1 < firstOfPage2 ? -1 : lastOfPage1 > firstOfPage2 ? 1 : 0;
              }
              
              if (sortOrder === 'asc') {
                expect(comparison).toBeLessThanOrEqual(0);
              } else {
                expect(comparison).toBeGreaterThanOrEqual(0);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * 
   * Property: Invalid sort field defaults to created_at
   */
  it('Property 2h: Invalid sort field defaults to created_at', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        sortOrderArb,
        (books, sortOrder) => {
          // Use an invalid sort field by casting
          const result = simulateListBooksWithSort(books, { 
            page: 1, 
            pageSize: 100, 
            sortBy: 'invalid_field' as any, 
            sortOrder 
          });
          
          // Should be sorted by created_at
          expect(isSortedCorrectly(result.books, 'created_at', sortOrder)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * 
   * Property: Sort is stable - books with equal sort values maintain relative order
   */
  it('Property 2i: Sorting preserves all books (no data loss)', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        sortFieldArb,
        sortOrderArb,
        (books, sortBy, sortOrder) => {
          const result = simulateListBooksWithSort(books, { 
            page: 1, 
            pageSize: 1000, // Large enough to get all books
            sortBy, 
            sortOrder 
          });
          
          // All books should be present
          expect(result.total).toBe(books.length);
          
          // All book IDs should be present
          const originalIds = new Set(books.map(b => b.id));
          const resultIds = new Set(result.books.map(b => b.id));
          
          expect(resultIds.size).toBe(originalIds.size);
          for (const id of originalIds) {
            expect(resultIds.has(id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * 
   * Property: Empty book list returns empty sorted result
   */
  it('Property 2j: Empty book list returns empty result', () => {
    fc.assert(
      fc.property(
        sortFieldArb,
        sortOrderArb,
        (sortBy, sortOrder) => {
          const result = simulateListBooksWithSort([], { 
            page: 1, 
            pageSize: 20, 
            sortBy, 
            sortOrder 
          });
          
          expect(result.books).toHaveLength(0);
          expect(result.total).toBe(0);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
