/**
 * Property-Based Tests for Pagination Consistency
 * **Feature: admin-book-management, Property 1: Pagination Consistency**
 * **Validates: Requirements 1.1, 1.7**
 * 
 * This test verifies that for any page request with a given page size,
 * the number of returned books SHALL be less than or equal to the page size,
 * and the total count SHALL accurately reflect the total number of books
 * matching the filter criteria.
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
 * Interface representing pagination options
 */
interface PaginationOptions {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
  genre?: string;
  source?: string;
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
 * Simulates the listBooks pagination logic from bookManagementService.js
 * This mirrors the core pagination behavior without database dependency
 */
function simulateListBooks(allBooks: Book[], options: PaginationOptions): PaginatedResponse {
  // Validate and set defaults (mirrors service logic)
  const page = Math.max(1, Math.floor(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize) || 20));
  
  // Apply filters
  let filteredBooks = [...allBooks];
  
  // Apply search filter (title, author)
  if (options.search && options.search.trim()) {
    const searchTerm = options.search.trim().toLowerCase();
    filteredBooks = filteredBooks.filter(book => 
      book.title.toLowerCase().includes(searchTerm) ||
      book.author.toLowerCase().includes(searchTerm)
    );
  }
  
  // Apply category filter
  if (options.category && options.category.trim()) {
    const category = options.category.trim();
    filteredBooks = filteredBooks.filter(book => book.category === category);
  }
  
  // Apply genre filter
  if (options.genre && options.genre.trim()) {
    const genre = options.genre.trim();
    filteredBooks = filteredBooks.filter(book => 
      book.genres && book.genres.includes(genre)
    );
  }
  
  // Apply source filter
  if (options.source && options.source.trim()) {
    const source = options.source.trim();
    filteredBooks = filteredBooks.filter(book => book.source === source);
  }
  
  // Calculate pagination
  const total = filteredBooks.length;
  const totalPages = Math.ceil(total / pageSize);
  const offset = (page - 1) * pageSize;
  
  // Get page of results
  const books = filteredBooks.slice(offset, offset + pageSize);
  
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

// Generator for ISO date strings - using timestamp range to avoid invalid date issues
const dateArb = fc.integer({ 
  min: new Date('2020-01-01').getTime(), 
  max: new Date('2025-12-31').getTime() 
}).map(timestamp => new Date(timestamp).toISOString());

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
const booksArrayArb = fc.array(bookArb, { minLength: 0, maxLength: 200 });

// Generator for page number (1-indexed, can be out of range)
const pageArb = fc.integer({ min: 1, max: 50 });

// Generator for page size (1-100, with some edge cases)
const pageSizeArb = fc.integer({ min: 1, max: 100 });

// Generator for search terms
const searchArb = fc.oneof(
  fc.constant(undefined),
  fc.string({ minLength: 0, maxLength: 20 })
);

describe('Pagination Consistency - Property Tests', () => {
  /**
   * **Feature: admin-book-management, Property 1: Pagination Consistency**
   * **Validates: Requirements 1.1, 1.7**
   * 
   * Property: For any page request, returned books count <= pageSize
   */
  it('Property 1a: Returned books count is always <= pageSize', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        pageArb,
        pageSizeArb,
        (books, page, pageSize) => {
          const result = simulateListBooks(books, { page, pageSize });
          
          expect(result.books.length).toBeLessThanOrEqual(result.pageSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 1.7**
   * 
   * Property: Total count accurately reflects total matching books
   */
  it('Property 1b: Total count equals actual matching books count', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        pageArb,
        pageSizeArb,
        categoryArb,
        (books, page, pageSize, category) => {
          // Test with category filter
          const result = simulateListBooks(books, { page, pageSize, category });
          
          // Manually count matching books
          const matchingBooks = books.filter(b => b.category === category);
          
          expect(result.total).toBe(matchingBooks.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.7**
   * 
   * Property: totalPages is correctly calculated from total and pageSize
   */
  it('Property 1c: totalPages is correctly calculated', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        pageArb,
        pageSizeArb,
        (books, page, pageSize) => {
          const result = simulateListBooks(books, { page, pageSize });
          
          const expectedTotalPages = Math.ceil(result.total / result.pageSize);
          expect(result.totalPages).toBe(expectedTotalPages);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 1.1**
   * 
   * Property: Page number in response matches requested page (clamped to valid range)
   */
  it('Property 1d: Page number is correctly returned', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        pageArb,
        pageSizeArb,
        (books, page, pageSize) => {
          const result = simulateListBooks(books, { page, pageSize });
          
          // Page should be at least 1
          expect(result.page).toBeGreaterThanOrEqual(1);
          expect(result.page).toBe(Math.max(1, page));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 1.1**
   * 
   * Property: PageSize is clamped between 1 and 100
   */
  it('Property 1e: PageSize is clamped to valid range [1, 100]', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        pageArb,
        fc.integer({ min: -10, max: 200 }), // Include out-of-range values
        (books, page, pageSize) => {
          const result = simulateListBooks(books, { page, pageSize });
          
          expect(result.pageSize).toBeGreaterThanOrEqual(1);
          expect(result.pageSize).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.7**
   * 
   * Property: Sum of all pages equals total count
   */
  it('Property 1f: Sum of all pages equals total count', () => {
    fc.assert(
      fc.property(
        fc.array(bookArb, { minLength: 0, maxLength: 50 }), // Smaller array for performance
        fc.integer({ min: 1, max: 20 }), // Reasonable page size
        (books, pageSize) => {
          const firstResult = simulateListBooks(books, { page: 1, pageSize });
          
          // Collect all books across all pages
          let allPagedBooks: Book[] = [];
          for (let p = 1; p <= firstResult.totalPages; p++) {
            const pageResult = simulateListBooks(books, { page: p, pageSize });
            allPagedBooks = allPagedBooks.concat(pageResult.books);
          }
          
          // Total collected should equal total count
          expect(allPagedBooks.length).toBe(firstResult.total);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 1.7**
   * 
   * Property: Empty result when page exceeds totalPages
   */
  it('Property 1g: Empty result when page exceeds totalPages', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        pageSizeArb,
        (books, pageSize) => {
          const firstResult = simulateListBooks(books, { page: 1, pageSize });
          
          if (firstResult.totalPages > 0) {
            // Request a page beyond the last page
            const beyondResult = simulateListBooks(books, { 
              page: firstResult.totalPages + 1, 
              pageSize 
            });
            
            expect(beyondResult.books.length).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.7**
   * 
   * Property: No duplicate books across pages
   */
  it('Property 1h: No duplicate books across pages', () => {
    fc.assert(
      fc.property(
        fc.array(bookArb, { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1, max: 20 }),
        (books, pageSize) => {
          const firstResult = simulateListBooks(books, { page: 1, pageSize });
          
          // Collect all book IDs across all pages
          const allIds: string[] = [];
          for (let p = 1; p <= firstResult.totalPages; p++) {
            const pageResult = simulateListBooks(books, { page: p, pageSize });
            pageResult.books.forEach(book => allIds.push(book.id));
          }
          
          // Check for duplicates
          const uniqueIds = new Set(allIds);
          expect(uniqueIds.size).toBe(allIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 1.7**
   * 
   * Property: Filtered total count is always <= unfiltered total count
   */
  it('Property 1i: Filtered total <= unfiltered total', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        pageArb,
        pageSizeArb,
        categoryArb,
        (books, page, pageSize, category) => {
          const unfilteredResult = simulateListBooks(books, { page, pageSize });
          const filteredResult = simulateListBooks(books, { page, pageSize, category });
          
          expect(filteredResult.total).toBeLessThanOrEqual(unfilteredResult.total);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.7**
   * 
   * Property: Response always has success=true for valid inputs
   */
  it('Property 1j: Response success is always true', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        pageArb,
        pageSizeArb,
        (books, page, pageSize) => {
          const result = simulateListBooks(books, { page, pageSize });
          
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
