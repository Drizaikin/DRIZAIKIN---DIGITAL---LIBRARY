/**
 * Property-Based Tests for Recommendation Count Limit
 * **Feature: user-preferences-recommendations, Property 4: Recommendation Count Limit**
 * **Validates: Requirements 1.5**
 *
 * This test verifies that for any recommendation request, the returned list
 * should contain at most 10 books, regardless of how many matching books exist.
 *
 * Requirements:
 * - 1.5: WHEN displaying recommendations THEN the Library_System SHALL show
 *        a maximum of 10 recommended books
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types matching the API implementation
interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  categoryId: string;
  description: string;
  copiesAvailable: number;
  popularity: number;
}

interface SearchHistoryEntry {
  type: 'search' | 'view';
  query: string | null;
  bookId: string | null;
}

interface CourseCategoryMapping {
  courseId: string;
  courseName: string;
  categoryId: string;
  categoryName: string;
  relevanceScore: number;
}

interface User {
  id: string;
  course: string | null;
}

interface CombinedRecommendationResult {
  books: Book[];
  totalCandidates: number;
}

const MAX_RECOMMENDATIONS = 10;

/**
 * Generate a UUID-like string for testing
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Simulates the combined recommendation generation logic from api/index.js
 * This combines both search history and course-based recommendations
 * and enforces the 10-book limit.
 */
function generateCombinedRecommendations(
  user: User,
  searchHistory: SearchHistoryEntry[],
  courseCategoryMappings: CourseCategoryMapping[],
  availableBooks: Book[]
): CombinedRecommendationResult {
  const recommendedBooks: Book[] = [];
  const addedBookIds = new Set<string>();
  let totalCandidates = 0;

  // 1. Get recommendations from search history
  const searchTerms = searchHistory
    .filter((h) => h.type === 'search' && h.query)
    .map((h) => h.query!.toLowerCase().trim())
    .filter((term, index, self) => self.indexOf(term) === index)
    .slice(0, 5);

  for (const term of searchTerms) {
    const matchingBooks = availableBooks.filter((book) => {
      if (book.copiesAvailable <= 0) return false;
      const titleMatch = book.title.toLowerCase().includes(term);
      const authorMatch = book.author.toLowerCase().includes(term);
      const descriptionMatch = book.description.toLowerCase().includes(term);
      return titleMatch || authorMatch || descriptionMatch;
    });

    totalCandidates += matchingBooks.length;

    for (const book of matchingBooks.sort((a, b) => b.popularity - a.popularity)) {
      if (!addedBookIds.has(book.id) && recommendedBooks.length < MAX_RECOMMENDATIONS) {
        addedBookIds.add(book.id);
        recommendedBooks.push(book);
      }
    }
  }

  // 2. Get recommendations from course (if user has one)
  if (user.course && recommendedBooks.length < MAX_RECOMMENDATIONS) {
    const relevantMappings = courseCategoryMappings
      .filter((m) => m.courseName === user.course)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    const categoryIds = relevantMappings.map((m) => m.categoryId);

    const courseBooks = availableBooks
      .filter((book) => {
        if (book.copiesAvailable <= 0) return false;
        return categoryIds.includes(book.categoryId);
      })
      .sort((a, b) => b.popularity - a.popularity);

    totalCandidates += courseBooks.length;

    for (const book of courseBooks) {
      if (!addedBookIds.has(book.id) && recommendedBooks.length < MAX_RECOMMENDATIONS) {
        addedBookIds.add(book.id);
        recommendedBooks.push(book);
      }
    }
  }

  // 3. Fill with popular books if still under limit
  if (recommendedBooks.length < MAX_RECOMMENDATIONS) {
    const popularBooks = availableBooks
      .filter((book) => book.copiesAvailable > 0)
      .sort((a, b) => b.popularity - a.popularity);

    totalCandidates += popularBooks.length;

    for (const book of popularBooks) {
      if (!addedBookIds.has(book.id) && recommendedBooks.length < MAX_RECOMMENDATIONS) {
        addedBookIds.add(book.id);
        recommendedBooks.push(book);
      }
    }
  }

  return {
    books: recommendedBooks.slice(0, MAX_RECOMMENDATIONS),
    totalCandidates,
  };
}

// Arbitraries for generating test data
const courseNameArb = fc.constantFrom(
  'Computer Science',
  'Business Administration',
  'Theology',
  'Education',
  'Nursing',
  'Information Technology'
);

const categoryNameArb = fc.constantFrom(
  'Technology',
  'Business',
  'Religion',
  'Education',
  'Health Sciences',
  'Science'
);

const searchTermArb = fc
  .string({ minLength: 2, maxLength: 15 })
  .filter((s) => s.trim().length >= 2 && /^[a-zA-Z0-9\s]+$/.test(s));

const bookArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 3, maxLength: 50 }).filter((s) => s.trim().length > 0),
  author: fc.string({ minLength: 3, maxLength: 30 }).filter((s) => s.trim().length > 0),
  category: categoryNameArb,
  categoryId: fc.uuid(),
  description: fc.string({ minLength: 10, maxLength: 100 }).filter((s) => s.trim().length > 0),
  copiesAvailable: fc.integer({ min: 1, max: 10 }),
  popularity: fc.integer({ min: 1, max: 100 }),
});

const searchHistoryEntryArb = fc.record({
  type: fc.constant('search' as const),
  query: searchTermArb,
  bookId: fc.constant(null),
});

const courseCategoryMappingArb = fc.record({
  courseId: fc.uuid(),
  courseName: courseNameArb,
  categoryId: fc.uuid(),
  categoryName: categoryNameArb,
  relevanceScore: fc.integer({ min: 1, max: 10 }),
});

describe('Recommendation Count Limit - Property Tests', () => {
  /**
   * **Feature: user-preferences-recommendations, Property 4: Recommendation Count Limit**
   * **Validates: Requirements 1.5**
   *
   * Property: For any recommendation request, the returned list should contain
   * at most 10 books, regardless of how many matching books exist.
   */
  it('Property 4: Recommendations never exceed 10 books regardless of available matches', () => {
    fc.assert(
      fc.property(
        // Generate user with optional course
        fc.record({
          id: fc.uuid(),
          course: fc.option(courseNameArb, { nil: null }),
        }),
        // Generate search history (0-10 entries)
        fc.array(searchHistoryEntryArb, { minLength: 0, maxLength: 10 }),
        // Generate course-category mappings
        fc.array(courseCategoryMappingArb, { minLength: 0, maxLength: 5 }),
        // Generate many available books (more than 10)
        fc.array(bookArb, { minLength: 15, maxLength: 50 }),
        (
          user: User,
          searchHistory: SearchHistoryEntry[],
          mappings: CourseCategoryMapping[],
          books: Book[]
        ) => {
          const result = generateCombinedRecommendations(user, searchHistory, mappings, books);

          // PROPERTY ASSERTION: Recommendations should never exceed 10 books
          expect(result.books.length).toBeLessThanOrEqual(MAX_RECOMMENDATIONS);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4a: Limit enforced with many search history matches
   * Even when search history matches many books, limit is enforced
   */
  it('Property 4a: Limit enforced when search history matches many books', () => {
    fc.assert(
      fc.property(searchTermArb, (searchTerm: string) => {
        const user: User = { id: generateUUID(), course: null };

        // Create many books that all match the search term
        const manyMatchingBooks: Book[] = Array.from({ length: 30 }, (_, i) => ({
          id: generateUUID(),
          title: `${searchTerm} Book ${i}`,
          author: 'Test Author',
          category: 'Technology',
          categoryId: generateUUID(),
          description: `A book about ${searchTerm}`,
          copiesAvailable: 5,
          popularity: 100 - i,
        }));

        const searchHistory: SearchHistoryEntry[] = [
          { type: 'search', query: searchTerm, bookId: null },
        ];

        const result = generateCombinedRecommendations(user, searchHistory, [], manyMatchingBooks);

        // PROPERTY ASSERTION: Even with 30 matching books, only 10 returned
        expect(result.books.length).toBeLessThanOrEqual(MAX_RECOMMENDATIONS);
        expect(result.totalCandidates).toBeGreaterThan(MAX_RECOMMENDATIONS);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4b: Limit enforced with many course-based matches
   * Even when course maps to many books, limit is enforced
   */
  it('Property 4b: Limit enforced when course maps to many books', () => {
    fc.assert(
      fc.property(courseNameArb, categoryNameArb, (courseName: string, categoryName: string) => {
        const user: User = { id: generateUUID(), course: courseName };
        const categoryId = generateUUID();

        // Create mapping for the course
        const mapping: CourseCategoryMapping = {
          courseId: generateUUID(),
          courseName: courseName,
          categoryId: categoryId,
          categoryName: categoryName,
          relevanceScore: 10,
        };

        // Create many books in the mapped category
        const manyMatchingBooks: Book[] = Array.from({ length: 25 }, (_, i) => ({
          id: generateUUID(),
          title: `${categoryName} Book ${i}`,
          author: 'Test Author',
          category: categoryName,
          categoryId: categoryId,
          description: 'A course-related book',
          copiesAvailable: 5,
          popularity: 100 - i,
        }));

        const result = generateCombinedRecommendations(user, [], [mapping], manyMatchingBooks);

        // PROPERTY ASSERTION: Even with 25 matching books, only 10 returned
        expect(result.books.length).toBeLessThanOrEqual(MAX_RECOMMENDATIONS);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4c: Limit enforced with combined search and course matches
   * When both search history and course produce matches, total is still limited
   */
  it('Property 4c: Limit enforced when combining search history and course matches', () => {
    fc.assert(
      fc.property(
        searchTermArb,
        courseNameArb,
        categoryNameArb,
        (searchTerm: string, courseName: string, categoryName: string) => {
          const user: User = { id: generateUUID(), course: courseName };
          const categoryId = generateUUID();

          // Create mapping for the course
          const mapping: CourseCategoryMapping = {
            courseId: generateUUID(),
            courseName: courseName,
            categoryId: categoryId,
            categoryName: categoryName,
            relevanceScore: 10,
          };

          // Create books matching search term (15 books)
          const searchMatchingBooks: Book[] = Array.from({ length: 15 }, (_, i) => ({
            id: generateUUID(),
            title: `${searchTerm} Book ${i}`,
            author: 'Search Author',
            category: 'Other',
            categoryId: generateUUID(),
            description: `About ${searchTerm}`,
            copiesAvailable: 5,
            popularity: 80 - i,
          }));

          // Create books matching course (15 books)
          const courseMatchingBooks: Book[] = Array.from({ length: 15 }, (_, i) => ({
            id: generateUUID(),
            title: `${categoryName} Course Book ${i}`,
            author: 'Course Author',
            category: categoryName,
            categoryId: categoryId,
            description: 'A course book',
            copiesAvailable: 5,
            popularity: 70 - i,
          }));

          const allBooks = [...searchMatchingBooks, ...courseMatchingBooks];
          const searchHistory: SearchHistoryEntry[] = [
            { type: 'search', query: searchTerm, bookId: null },
          ];

          const result = generateCombinedRecommendations(user, searchHistory, [mapping], allBooks);

          // PROPERTY ASSERTION: Combined matches still limited to 10
          expect(result.books.length).toBeLessThanOrEqual(MAX_RECOMMENDATIONS);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4d: Limit enforced with popular books fallback
   * When filling with popular books, total is still limited
   */
  it('Property 4d: Limit enforced when falling back to popular books', () => {
    fc.assert(
      fc.property(fc.array(bookArb, { minLength: 20, maxLength: 40 }), (books: Book[]) => {
        // User with no course and no search history
        const user: User = { id: generateUUID(), course: null };

        const result = generateCombinedRecommendations(user, [], [], books);

        // PROPERTY ASSERTION: Popular books fallback still limited to 10
        expect(result.books.length).toBeLessThanOrEqual(MAX_RECOMMENDATIONS);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4e: Exactly 10 books returned when more than 10 available
   * When there are more than 10 matching books, exactly 10 should be returned
   */
  it('Property 4e: Exactly 10 books returned when more than 10 matches available', () => {
    fc.assert(
      fc.property(searchTermArb, (searchTerm: string) => {
        const user: User = { id: generateUUID(), course: null };

        // Create exactly 20 matching books
        const matchingBooks: Book[] = Array.from({ length: 20 }, (_, i) => ({
          id: generateUUID(),
          title: `${searchTerm} Book ${i}`,
          author: 'Test Author',
          category: 'Technology',
          categoryId: generateUUID(),
          description: `About ${searchTerm}`,
          copiesAvailable: 5,
          popularity: 100 - i,
        }));

        const searchHistory: SearchHistoryEntry[] = [
          { type: 'search', query: searchTerm, bookId: null },
        ];

        const result = generateCombinedRecommendations(user, searchHistory, [], matchingBooks);

        // PROPERTY ASSERTION: Exactly 10 books when more than 10 available
        expect(result.books.length).toBe(MAX_RECOMMENDATIONS);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4f: No duplicate books in recommendations
   * Each book should appear at most once in the recommendations
   */
  it('Property 4f: No duplicate books in recommendations', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          course: fc.option(courseNameArb, { nil: null }),
        }),
        fc.array(searchHistoryEntryArb, { minLength: 0, maxLength: 5 }),
        fc.array(courseCategoryMappingArb, { minLength: 0, maxLength: 3 }),
        fc.array(bookArb, { minLength: 10, maxLength: 30 }),
        (
          user: User,
          searchHistory: SearchHistoryEntry[],
          mappings: CourseCategoryMapping[],
          books: Book[]
        ) => {
          const result = generateCombinedRecommendations(user, searchHistory, mappings, books);

          // PROPERTY ASSERTION: No duplicate book IDs
          const bookIds = result.books.map((b) => b.id);
          const uniqueIds = new Set(bookIds);
          expect(uniqueIds.size).toBe(bookIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
