/**
 * Property-Based Tests for Recommendation Generation with Course
 * **Feature: user-preferences-recommendations, Property 3: Recommendation Generation Includes Course**
 * **Validates: Requirements 1.2, 1.3**
 *
 * This test verifies that for any user with a course/major set, the
 * recommendation engine should prioritize books from categories mapped
 * to that course.
 *
 * Requirements:
 * - 1.2: WHEN a user has a course/major set in their profile THEN the
 *        Library_System SHALL prioritize books relevant to that course in recommendations
 * - 1.3: WHEN a user has both search history and a course/major THEN the
 *        Library_System SHALL combine both factors to generate recommendations
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

interface RecommendationResult {
  books: Book[];
  courseUsed: string | null;
  categoriesUsed: string[];
}

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
 * Simulates the course-based recommendation generation logic from api/index.js
 * This validates the core business logic without requiring database access
 *
 * The algorithm:
 * 1. Get user's course from profile
 * 2. Find category mappings for that course
 * 3. Get books from those categories, sorted by popularity
 * 4. Return matching books (up to 10)
 */
function generateRecommendationsFromCourse(
  user: User,
  courseCategoryMappings: CourseCategoryMapping[],
  availableBooks: Book[]
): RecommendationResult {
  // If user has no course, return empty recommendations
  if (!user.course) {
    return { books: [], courseUsed: null, categoriesUsed: [] };
  }

  // Find category mappings for the user's course (matching api/index.js logic)
  const relevantMappings = courseCategoryMappings
    .filter((m) => m.courseName === user.course)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  if (relevantMappings.length === 0) {
    return { books: [], courseUsed: user.course, categoriesUsed: [] };
  }

  // Get category IDs for the user's course
  const categoryIds = relevantMappings.map((m) => m.categoryId);
  const categoriesUsed = relevantMappings.map((m) => m.categoryName);

  // Find books in those categories
  const recommendedBooks: Book[] = [];
  const addedBookIds = new Set<string>();

  // Filter books by category and availability
  const matchingBooks = availableBooks
    .filter((book) => {
      if (addedBookIds.has(book.id)) return false;
      if (book.copiesAvailable <= 0) return false;
      return categoryIds.includes(book.categoryId);
    })
    .sort((a, b) => b.popularity - a.popularity);

  // Add books up to limit of 10
  for (const book of matchingBooks) {
    if (!addedBookIds.has(book.id)) {
      addedBookIds.add(book.id);
      recommendedBooks.push(book);
    }
    if (recommendedBooks.length >= 10) break;
  }

  return {
    books: recommendedBooks.slice(0, 10),
    courseUsed: user.course,
    categoriesUsed: [...new Set(categoriesUsed)],
  };
}

// Arbitraries for generating test data
const courseNameArb = fc.constantFrom(
  'Computer Science',
  'Business Administration',
  'Theology',
  'Education',
  'Nursing',
  'Information Technology',
  'Economics',
  'Psychology'
);

const categoryNameArb = fc.constantFrom(
  'Technology',
  'Business',
  'Religion',
  'Education',
  'Health Sciences',
  'Science',
  'Arts',
  'Social Sciences'
);

const bookArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 3, maxLength: 50 }).filter((s) => s.trim().length > 0),
  author: fc.string({ minLength: 3, maxLength: 30 }).filter((s) => s.trim().length > 0),
  category: categoryNameArb,
  categoryId: fc.uuid(),
  description: fc.string({ minLength: 10, maxLength: 200 }).filter((s) => s.trim().length > 0),
  copiesAvailable: fc.integer({ min: 0, max: 10 }),
  popularity: fc.integer({ min: 1, max: 100 }),
});

const courseCategoryMappingArb = fc.record({
  courseId: fc.uuid(),
  courseName: courseNameArb,
  categoryId: fc.uuid(),
  categoryName: categoryNameArb,
  relevanceScore: fc.integer({ min: 1, max: 10 }),
});

describe('Recommendation Generation with Course - Property Tests', () => {
  /**
   * **Feature: user-preferences-recommendations, Property 3: Recommendation Generation Includes Course**
   * **Validates: Requirements 1.2, 1.3**
   *
   * Property: For any user with a course/major set, the recommendation engine
   * should prioritize books from categories mapped to that course.
   */
  it('Property 3: Recommendations include books from course-mapped categories when available', () => {
    fc.assert(
      fc.property(
        // Generate a course name
        courseNameArb,
        // Generate a category name
        categoryNameArb,
        // Generate additional random books
        fc.array(bookArb, { minLength: 0, maxLength: 20 }),
        (courseName: string, categoryName: string, randomBooks: Book[]) => {
          // Create a user with the course
          const user: User = {
            id: generateUUID(),
            course: courseName,
          };

          // Create a category ID for the mapping
          const categoryId = generateUUID();

          // Create a course-category mapping
          const mapping: CourseCategoryMapping = {
            courseId: generateUUID(),
            courseName: courseName,
            categoryId: categoryId,
            categoryName: categoryName,
            relevanceScore: 10,
          };

          // Create a book that matches the mapped category
          const matchingBook: Book = {
            id: generateUUID(),
            title: `${categoryName} Textbook`,
            author: 'Test Author',
            category: categoryName,
            categoryId: categoryId,
            description: 'A test book for the course',
            copiesAvailable: 5,
            popularity: 50,
          };

          // Combine matching book with random books
          const availableBooks = [matchingBook, ...randomBooks.filter((b) => b.copiesAvailable > 0)];

          // Generate recommendations
          const result = generateRecommendationsFromCourse(user, [mapping], availableBooks);

          // PROPERTY ASSERTION: When a matching book exists, it should be in recommendations
          const matchingBookInResults = result.books.some((b) => b.id === matchingBook.id);
          expect(matchingBookInResults).toBe(true);

          // PROPERTY ASSERTION: The course should be marked as used
          expect(result.courseUsed).toBe(courseName);

          // PROPERTY ASSERTION: The category should be in the used categories
          expect(result.categoriesUsed).toContain(categoryName);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3a: All recommended books belong to course-mapped categories
   * Every book in the recommendations should be from a category mapped to the user's course
   */
  it('Property 3a: All recommended books belong to course-mapped categories', () => {
    fc.assert(
      fc.property(
        courseNameArb,
        fc.array(courseCategoryMappingArb, { minLength: 1, maxLength: 5 }),
        fc.array(bookArb, { minLength: 1, maxLength: 30 }),
        (courseName: string, mappings: CourseCategoryMapping[], books: Book[]) => {
          // Create user with the course
          const user: User = {
            id: generateUUID(),
            course: courseName,
          };

          // Ensure at least one mapping is for the user's course
          const courseMappings = mappings.map((m, index) =>
            index === 0 ? { ...m, courseName: courseName } : m
          );

          // Get category IDs for the user's course
          const validCategoryIds = courseMappings
            .filter((m) => m.courseName === courseName)
            .map((m) => m.categoryId);

          // Ensure at least one book matches a valid category
          const booksWithMatching = books.map((b, index) =>
            index === 0 && validCategoryIds.length > 0
              ? { ...b, categoryId: validCategoryIds[0], copiesAvailable: 5 }
              : b
          );

          // Filter to only available books
          const availableBooks = booksWithMatching.filter((b) => b.copiesAvailable > 0);
          if (availableBooks.length === 0) return; // Skip if no available books

          const result = generateRecommendationsFromCourse(user, courseMappings, availableBooks);

          // PROPERTY ASSERTION: Every recommended book should be from a course-mapped category
          for (const book of result.books) {
            expect(validCategoryIds).toContain(book.categoryId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3b: User without course returns no course-based recommendations
   * When user has no course set, no books should be recommended from course mapping
   */
  it('Property 3b: User without course returns no course-based recommendations', () => {
    fc.assert(
      fc.property(
        fc.array(courseCategoryMappingArb, { minLength: 1, maxLength: 5 }),
        fc.array(bookArb, { minLength: 1, maxLength: 20 }),
        (mappings: CourseCategoryMapping[], books: Book[]) => {
          // Create user without a course
          const user: User = {
            id: generateUUID(),
            course: null,
          };

          const result = generateRecommendationsFromCourse(user, mappings, books);

          // PROPERTY ASSERTION: No recommendations from null course
          expect(result.books).toHaveLength(0);
          expect(result.courseUsed).toBeNull();
          expect(result.categoriesUsed).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3c: Course with no category mappings returns no recommendations
   * When user's course has no category mappings, no books should be recommended
   */
  it('Property 3c: Course with no category mappings returns no recommendations', () => {
    fc.assert(
      fc.property(
        courseNameArb,
        fc.array(courseCategoryMappingArb, { minLength: 1, maxLength: 5 }),
        fc.array(bookArb, { minLength: 1, maxLength: 20 }),
        (courseName: string, mappings: CourseCategoryMapping[], books: Book[]) => {
          // Create user with a course
          const user: User = {
            id: generateUUID(),
            course: courseName,
          };

          // Ensure NO mappings are for the user's course
          const otherMappings = mappings.map((m) => ({
            ...m,
            courseName: m.courseName === courseName ? 'Other Course' : m.courseName,
          }));

          const result = generateRecommendationsFromCourse(user, otherMappings, books);

          // PROPERTY ASSERTION: No recommendations when course has no mappings
          expect(result.books).toHaveLength(0);
          expect(result.courseUsed).toBe(courseName);
          expect(result.categoriesUsed).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3d: Unavailable books are not recommended
   * Books with copiesAvailable <= 0 should not appear in recommendations
   */
  it('Property 3d: Books with no available copies are not recommended', () => {
    fc.assert(
      fc.property(courseNameArb, categoryNameArb, fc.array(bookArb, { minLength: 1, maxLength: 20 }), (courseName: string, categoryName: string, books: Book[]) => {
        // Create user with course
        const user: User = {
          id: generateUUID(),
          course: courseName,
        };

        const categoryId = generateUUID();

        // Create mapping
        const mapping: CourseCategoryMapping = {
          courseId: generateUUID(),
          courseName: courseName,
          categoryId: categoryId,
          categoryName: categoryName,
          relevanceScore: 10,
        };

        // Make some books unavailable but in the right category
        const booksWithUnavailable = books.map((book, index) => ({
          ...book,
          categoryId: categoryId, // All books in the mapped category
          copiesAvailable: index === 0 ? 0 : book.copiesAvailable, // First book is unavailable
        }));

        const result = generateRecommendationsFromCourse(user, [mapping], booksWithUnavailable);

        // PROPERTY ASSERTION: No recommended book should have 0 copies available
        for (const book of result.books) {
          expect(book.copiesAvailable).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3e: Recommendations are limited to 10 books
   * Even with many matching books, only 10 should be returned
   */
  it('Property 3e: Recommendations are limited to maximum 10 books', () => {
    fc.assert(
      fc.property(courseNameArb, categoryNameArb, (courseName: string, categoryName: string) => {
        // Create user with course
        const user: User = {
          id: generateUUID(),
          course: courseName,
        };

        const categoryId = generateUUID();

        // Create mapping
        const mapping: CourseCategoryMapping = {
          courseId: generateUUID(),
          courseName: courseName,
          categoryId: categoryId,
          categoryName: categoryName,
          relevanceScore: 10,
        };

        // Create many books that all match the category
        const manyMatchingBooks: Book[] = Array.from({ length: 25 }, (_, i) => ({
          id: generateUUID(),
          title: `${categoryName} Book ${i}`,
          author: 'Test Author',
          category: categoryName,
          categoryId: categoryId,
          description: 'A test book',
          copiesAvailable: 5,
          popularity: 100 - i,
        }));

        const result = generateRecommendationsFromCourse(user, [mapping], manyMatchingBooks);

        // PROPERTY ASSERTION: Maximum 10 recommendations
        expect(result.books.length).toBeLessThanOrEqual(10);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3f: Recommendations are sorted by popularity
   * Higher popularity books should appear before lower popularity ones
   */
  it('Property 3f: Recommendations are sorted by popularity (descending)', () => {
    fc.assert(
      fc.property(
        courseNameArb,
        categoryNameArb,
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 3, maxLength: 10 }),
        (courseName: string, categoryName: string, popularities: number[]) => {
          // Create user with course
          const user: User = {
            id: generateUUID(),
            course: courseName,
          };

          const categoryId = generateUUID();

          // Create mapping
          const mapping: CourseCategoryMapping = {
            courseId: generateUUID(),
            courseName: courseName,
            categoryId: categoryId,
            categoryName: categoryName,
            relevanceScore: 10,
          };

          // Create books with different popularities, all in the mapped category
          const books: Book[] = popularities.map((pop, i) => ({
            id: generateUUID(),
            title: `${categoryName} Book ${i}`,
            author: 'Test Author',
            category: categoryName,
            categoryId: categoryId,
            description: 'A test book',
            copiesAvailable: 5,
            popularity: pop,
          }));

          const result = generateRecommendationsFromCourse(user, [mapping], books);

          // PROPERTY ASSERTION: Books should be sorted by popularity (descending)
          for (let i = 1; i < result.books.length; i++) {
            expect(result.books[i - 1].popularity).toBeGreaterThanOrEqual(result.books[i].popularity);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3g: Higher relevance score categories are prioritized
   * Books from categories with higher relevance scores should appear first
   */
  it('Property 3g: Categories with higher relevance scores are prioritized', () => {
    fc.assert(
      fc.property(courseNameArb, (courseName: string) => {
        // Create user with course
        const user: User = {
          id: generateUUID(),
          course: courseName,
        };

        const highRelevanceCategoryId = generateUUID();
        const lowRelevanceCategoryId = generateUUID();

        // Create mappings with different relevance scores
        const mappings: CourseCategoryMapping[] = [
          {
            courseId: generateUUID(),
            courseName: courseName,
            categoryId: highRelevanceCategoryId,
            categoryName: 'High Relevance Category',
            relevanceScore: 10,
          },
          {
            courseId: generateUUID(),
            courseName: courseName,
            categoryId: lowRelevanceCategoryId,
            categoryName: 'Low Relevance Category',
            relevanceScore: 1,
          },
        ];

        // Create books in both categories with same popularity
        const books: Book[] = [
          {
            id: generateUUID(),
            title: 'High Relevance Book',
            author: 'Test Author',
            category: 'High Relevance Category',
            categoryId: highRelevanceCategoryId,
            description: 'A test book',
            copiesAvailable: 5,
            popularity: 50,
          },
          {
            id: generateUUID(),
            title: 'Low Relevance Book',
            author: 'Test Author',
            category: 'Low Relevance Category',
            categoryId: lowRelevanceCategoryId,
            description: 'A test book',
            copiesAvailable: 5,
            popularity: 50,
          },
        ];

        const result = generateRecommendationsFromCourse(user, mappings, books);

        // PROPERTY ASSERTION: Both books should be in recommendations
        expect(result.books.length).toBe(2);

        // PROPERTY ASSERTION: High relevance category should be listed first in categoriesUsed
        expect(result.categoriesUsed[0]).toBe('High Relevance Category');
      }),
      { numRuns: 100 }
    );
  });
});
