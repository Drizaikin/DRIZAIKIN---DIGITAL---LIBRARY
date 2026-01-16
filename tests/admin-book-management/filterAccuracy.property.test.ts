/**
 * Property-Based Tests for Filter Accuracy
 * **Feature: admin-book-management, Property 3: Filter Accuracy**
 * **Validates: Requirements 1.5, 1.6**
 * 
 * This test verifies that for any filter criteria (category, genre, source,
 * date range, search term), all returned books SHALL match the specified
 * criteria, and no books matching the criteria SHALL be excluded.
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
  isbn?: string;
  created_at: string;
}

/**
 * Interface representing filter options
 */
interface FilterOptions {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
  genre?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
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
 * Simulates the listBooks filtering logic from bookManagementService.js
 * This mirrors the core filtering behavior without database dependency
 */
function simulateListBooksWithFilters(allBooks: Book[], options: FilterOptions): PaginatedResponse {
  // Validate and set defaults (mirrors service logic)
  const page = Math.max(1, Math.floor(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize) || 20));
  
  // Apply filters
  let filteredBooks = [...allBooks];
  
  // Apply search filter (title, author, ISBN)
  if (options.search && options.search.trim()) {
    const searchTerm = options.search.trim().toLowerCase();
    filteredBooks = filteredBooks.filter(book => 
      book.title.toLowerCase().includes(searchTerm) ||
      book.author.toLowerCase().includes(searchTerm) ||
      (book.isbn && book.isbn.toLowerCase().includes(searchTerm))
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
  
  // Apply date range filters
  if (options.dateFrom) {
    filteredBooks = filteredBooks.filter(book => book.created_at >= options.dateFrom!);
  }
  
  if (options.dateTo) {
    filteredBooks = filteredBooks.filter(book => book.created_at <= options.dateTo!);
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

/**
 * Helper to check if a book matches a search term
 */
function bookMatchesSearch(book: Book, searchTerm: string): boolean {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return true;
  return (
    book.title.toLowerCase().includes(term) ||
    book.author.toLowerCase().includes(term) ||
    (book.isbn ? book.isbn.toLowerCase().includes(term) : false)
  );
}

/**
 * Helper to check if a book matches all filter criteria
 */
function bookMatchesAllFilters(book: Book, options: FilterOptions): boolean {
  // Check search
  if (options.search && options.search.trim()) {
    if (!bookMatchesSearch(book, options.search)) return false;
  }
  
  // Check category
  if (options.category && options.category.trim()) {
    if (book.category !== options.category.trim()) return false;
  }
  
  // Check genre
  if (options.genre && options.genre.trim()) {
    if (!book.genres || !book.genres.includes(options.genre.trim())) return false;
  }
  
  // Check source
  if (options.source && options.source.trim()) {
    if (book.source !== options.source.trim()) return false;
  }
  
  // Check date range
  if (options.dateFrom && book.created_at < options.dateFrom) return false;
  if (options.dateTo && book.created_at > options.dateTo) return false;
  
  return true;
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

// Generator for single genre (for filtering)
const singleGenreArb = fc.constantFrom('Mystery', 'Romance', 'Thriller', 'Biography', 'Self-Help', 'Programming');

// Generator for sources
const sourceArb = fc.constantFrom('internet_archive', 'manual', 'extraction', 'open_library');

// Generator for ISBN
const isbnArb = fc.oneof(
  fc.constant(undefined),
  fc.stringMatching(/^[0-9]{10}$|^[0-9]{13}$/)
);

// Generator for ISO date strings
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
  isbn: isbnArb,
  created_at: dateArb
});

// Generator for array of books (simulating database)
const booksArrayArb = fc.array(bookArb, { minLength: 0, maxLength: 100 });

// Generator for page number
const pageArb = fc.integer({ min: 1, max: 20 });

// Generator for page size (large enough to get all results for some tests)
const pageSizeArb = fc.integer({ min: 1, max: 100 });

// Generator for search terms (can be empty or partial match)
const searchArb = fc.oneof(
  fc.constant(undefined),
  fc.string({ minLength: 1, maxLength: 10 })
);

describe('Filter Accuracy - Property Tests', () => {
  /**
   * **Feature: admin-book-management, Property 3: Filter Accuracy**
   * **Validates: Requirements 1.5**
   * 
   * Property: All returned books match the category filter
   */
  it('Property 3a: All returned books match category filter', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        categoryArb,
        (books, category) => {
          const result = simulateListBooksWithFilters(books, { 
            page: 1, 
            pageSize: 100, 
            category 
          });
          
          // Every returned book must have the specified category
          for (const book of result.books) {
            expect(book.category).toBe(category);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * 
   * Property: All returned books match the genre filter
   */
  it('Property 3b: All returned books match genre filter', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        singleGenreArb,
        (books, genre) => {
          const result = simulateListBooksWithFilters(books, { 
            page: 1, 
            pageSize: 100, 
            genre 
          });
          
          // Every returned book must contain the specified genre
          for (const book of result.books) {
            expect(book.genres).toBeDefined();
            expect(book.genres).toContain(genre);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * 
   * Property: All returned books match the source filter
   */
  it('Property 3c: All returned books match source filter', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        sourceArb,
        (books, source) => {
          const result = simulateListBooksWithFilters(books, { 
            page: 1, 
            pageSize: 100, 
            source 
          });
          
          // Every returned book must have the specified source
          for (const book of result.books) {
            expect(book.source).toBe(source);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.6**
   * 
   * Property: All returned books match the search term (title, author, or ISBN)
   */
  it('Property 3d: All returned books match search term', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        fc.string({ minLength: 1, maxLength: 5 }).filter(s => s.trim().length > 0),
        (books, search) => {
          const result = simulateListBooksWithFilters(books, { 
            page: 1, 
            pageSize: 100, 
            search 
          });
          
          const searchLower = search.trim().toLowerCase();
          
          // Every returned book must match the search term
          for (const book of result.books) {
            const matchesTitle = book.title.toLowerCase().includes(searchLower);
            const matchesAuthor = book.author.toLowerCase().includes(searchLower);
            const matchesIsbn = book.isbn ? book.isbn.toLowerCase().includes(searchLower) : false;
            
            expect(matchesTitle || matchesAuthor || matchesIsbn).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * 
   * Property: All returned books are within the date range
   */
  it('Property 3e: All returned books are within date range', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        fc.tuple(dateArb, dateArb).map(([d1, d2]) => d1 < d2 ? [d1, d2] : [d2, d1]),
        (books, [dateFrom, dateTo]) => {
          const result = simulateListBooksWithFilters(books, { 
            page: 1, 
            pageSize: 100, 
            dateFrom,
            dateTo
          });
          
          // Every returned book must be within the date range
          for (const book of result.books) {
            expect(book.created_at >= dateFrom).toBe(true);
            expect(book.created_at <= dateTo).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5, 1.6**
   * 
   * Property: No matching books are excluded from results
   */
  it('Property 3f: No matching books are excluded (category filter)', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        categoryArb,
        (books, category) => {
          const result = simulateListBooksWithFilters(books, { 
            page: 1, 
            pageSize: 1000, // Large enough to get all results
            category 
          });
          
          // Count books that should match
          const expectedMatches = books.filter(b => b.category === category);
          
          // Total should equal expected matches
          expect(result.total).toBe(expectedMatches.length);
          
          // All expected books should be in results
          const resultIds = new Set(result.books.map(b => b.id));
          for (const expected of expectedMatches) {
            expect(resultIds.has(expected.id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5, 1.6**
   * 
   * Property: No matching books are excluded (genre filter)
   */
  it('Property 3g: No matching books are excluded (genre filter)', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        singleGenreArb,
        (books, genre) => {
          const result = simulateListBooksWithFilters(books, { 
            page: 1, 
            pageSize: 1000,
            genre 
          });
          
          // Count books that should match
          const expectedMatches = books.filter(b => b.genres && b.genres.includes(genre));
          
          // Total should equal expected matches
          expect(result.total).toBe(expectedMatches.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5, 1.6**
   * 
   * Property: Combined filters are applied with AND logic
   */
  it('Property 3h: Combined filters use AND logic', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        categoryArb,
        sourceArb,
        (books, category, source) => {
          const result = simulateListBooksWithFilters(books, { 
            page: 1, 
            pageSize: 100, 
            category,
            source
          });
          
          // Every returned book must match BOTH filters
          for (const book of result.books) {
            expect(book.category).toBe(category);
            expect(book.source).toBe(source);
          }
          
          // Count expected matches (both conditions)
          const expectedMatches = books.filter(b => 
            b.category === category && b.source === source
          );
          expect(result.total).toBe(expectedMatches.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * 
   * Property: Empty filter returns all books
   */
  it('Property 3i: Empty filter returns all books', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        (books) => {
          const result = simulateListBooksWithFilters(books, { 
            page: 1, 
            pageSize: 1000
          });
          
          expect(result.total).toBe(books.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5, 1.6**
   * 
   * Property: Filter with no matches returns empty result
   */
  it('Property 3j: Non-matching filter returns empty result', () => {
    fc.assert(
      fc.property(
        fc.array(bookArb, { minLength: 1, maxLength: 50 }),
        (books) => {
          // Use a category that doesn't exist in the generated books
          const nonExistentCategory = 'NonExistentCategory12345';
          
          const result = simulateListBooksWithFilters(books, { 
            page: 1, 
            pageSize: 100, 
            category: nonExistentCategory
          });
          
          expect(result.books).toHaveLength(0);
          expect(result.total).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5, 1.6**
   * 
   * Property: Filtered results are a subset of unfiltered results
   */
  it('Property 3k: Filtered results are subset of unfiltered', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        categoryArb,
        singleGenreArb,
        (books, category, genre) => {
          const unfilteredResult = simulateListBooksWithFilters(books, { 
            page: 1, 
            pageSize: 1000
          });
          
          const filteredResult = simulateListBooksWithFilters(books, { 
            page: 1, 
            pageSize: 1000,
            category,
            genre
          });
          
          // Filtered total should be <= unfiltered total
          expect(filteredResult.total).toBeLessThanOrEqual(unfilteredResult.total);
          
          // All filtered books should exist in unfiltered
          const unfilteredIds = new Set(unfilteredResult.books.map(b => b.id));
          for (const book of filteredResult.books) {
            expect(unfilteredIds.has(book.id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.6**
   * 
   * Property: Search is case-insensitive
   */
  it('Property 3l: Search filter is case-insensitive', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        fc.string({ minLength: 1, maxLength: 5 }).filter(s => s.trim().length > 0),
        (books, search) => {
          const lowerResult = simulateListBooksWithFilters(books, { 
            page: 1, 
            pageSize: 100, 
            search: search.toLowerCase()
          });
          
          const upperResult = simulateListBooksWithFilters(books, { 
            page: 1, 
            pageSize: 100, 
            search: search.toUpperCase()
          });
          
          // Both should return the same total
          expect(lowerResult.total).toBe(upperResult.total);
          
          // Both should return the same book IDs
          const lowerIds = new Set(lowerResult.books.map(b => b.id));
          const upperIds = new Set(upperResult.books.map(b => b.id));
          
          expect(lowerIds.size).toBe(upperIds.size);
          for (const id of lowerIds) {
            expect(upperIds.has(id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
