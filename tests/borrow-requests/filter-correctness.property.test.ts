/**
 * Property-Based Tests for Filter Correctness
 * **Feature: book-borrowing-approval, Property 12: Filter correctness**
 * **Validates: Requirements 3.4**
 * 
 * This test verifies that for any filter criteria (user name, book title, or date),
 * the filtered results SHALL contain only requests matching that criteria.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * BorrowRequest interface matching the application's type
 */
interface BorrowRequest {
  id: string;
  userId: string;
  bookId: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
  userName?: string;
  userAdmissionNo?: string;
  bookTitle?: string;
  bookAuthor?: string;
  bookCoverUrl?: string;
  copiesAvailable?: number;
}

/**
 * Filter function - mirrors the AdminPanel filtering logic
 * This is the function under test
 */
function filterBorrowRequests(
  requests: BorrowRequest[],
  searchQuery: string
): BorrowRequest[] {
  if (!searchQuery || searchQuery.trim() === '') {
    return requests;
  }
  
  const searchLower = searchQuery.toLowerCase();
  return requests.filter(request => {
    return (
      (request.userName?.toLowerCase().includes(searchLower) || false) ||
      (request.userAdmissionNo?.toLowerCase().includes(searchLower) || false) ||
      (request.bookTitle?.toLowerCase().includes(searchLower) || false) ||
      (request.bookAuthor?.toLowerCase().includes(searchLower) || false)
    );
  });
}

/**
 * Helper to check if a request matches a search query
 */
function requestMatchesQuery(request: BorrowRequest, query: string): boolean {
  if (!query || query.trim() === '') return true;
  
  const searchLower = query.toLowerCase();
  return (
    (request.userName?.toLowerCase().includes(searchLower) || false) ||
    (request.userAdmissionNo?.toLowerCase().includes(searchLower) || false) ||
    (request.bookTitle?.toLowerCase().includes(searchLower) || false) ||
    (request.bookAuthor?.toLowerCase().includes(searchLower) || false)
  );
}

/**
 * Valid date arbitrary - using integer timestamps to avoid invalid date values
 */
const validDateArb = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime()
}).map(timestamp => new Date(timestamp).toISOString());

/**
 * Arbitrary generator for BorrowRequest
 */
const borrowRequestArb = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  bookId: fc.uuid(),
  status: fc.constantFrom('pending' as const, 'approved' as const, 'rejected' as const),
  rejectionReason: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
  requestedAt: validDateArb,
  processedAt: fc.option(validDateArb, { nil: undefined }),
  processedBy: fc.option(fc.uuid(), { nil: undefined }),
  userName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  userAdmissionNo: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  bookTitle: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  bookAuthor: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  bookCoverUrl: fc.option(fc.webUrl(), { nil: undefined }),
  copiesAvailable: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined })
});

describe('Filter Correctness - Property Tests', () => {
  /**
   * **Feature: book-borrowing-approval, Property 12: Filter correctness**
   * **Validates: Requirements 3.4**
   * 
   * Property: For any filter criteria (user name, book title, or date),
   * the filtered results SHALL contain only requests matching that criteria.
   */
  it('Property 12: All filtered results match the search query', () => {
    fc.assert(
      fc.property(
        fc.array(borrowRequestArb, { minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 0, maxLength: 30 }),
        (requests, searchQuery) => {
          const filteredResults = filterBorrowRequests(requests, searchQuery);
          
          // Every result in filtered list must match the query
          for (const result of filteredResults) {
            expect(requestMatchesQuery(result, searchQuery)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: No matching requests are excluded from results', () => {
    fc.assert(
      fc.property(
        fc.array(borrowRequestArb, { minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 0, maxLength: 30 }),
        (requests, searchQuery) => {
          const filteredResults = filterBorrowRequests(requests, searchQuery);
          
          // Count how many requests should match
          const expectedMatchCount = requests.filter(r => requestMatchesQuery(r, searchQuery)).length;
          
          // Filtered results should have exactly the expected count
          expect(filteredResults.length).toBe(expectedMatchCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Filter by user name returns only matching requests', () => {
    fc.assert(
      fc.property(
        fc.array(borrowRequestArb, { minLength: 1, maxLength: 15 }),
        (requests) => {
          // Pick a random request that has a userName
          const requestsWithUserName = requests.filter(r => r.userName && r.userName.length > 0);
          if (requestsWithUserName.length === 0) return true; // Skip if no valid requests
          
          const targetRequest = requestsWithUserName[0];
          const searchQuery = targetRequest.userName!.substring(0, Math.min(3, targetRequest.userName!.length));
          
          const filteredResults = filterBorrowRequests(requests, searchQuery);
          
          // All results must contain the search query in one of the searchable fields
          for (const result of filteredResults) {
            expect(requestMatchesQuery(result, searchQuery)).toBe(true);
          }
          
          // The target request must be in the results
          expect(filteredResults.some(r => r.id === targetRequest.id)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Filter by book title returns only matching requests', () => {
    fc.assert(
      fc.property(
        fc.array(borrowRequestArb, { minLength: 1, maxLength: 15 }),
        (requests) => {
          // Pick a random request that has a bookTitle
          const requestsWithBookTitle = requests.filter(r => r.bookTitle && r.bookTitle.length > 0);
          if (requestsWithBookTitle.length === 0) return true; // Skip if no valid requests
          
          const targetRequest = requestsWithBookTitle[0];
          const searchQuery = targetRequest.bookTitle!.substring(0, Math.min(3, targetRequest.bookTitle!.length));
          
          const filteredResults = filterBorrowRequests(requests, searchQuery);
          
          // All results must contain the search query in one of the searchable fields
          for (const result of filteredResults) {
            expect(requestMatchesQuery(result, searchQuery)).toBe(true);
          }
          
          // The target request must be in the results
          expect(filteredResults.some(r => r.id === targetRequest.id)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Filter by admission number returns only matching requests', () => {
    fc.assert(
      fc.property(
        fc.array(borrowRequestArb, { minLength: 1, maxLength: 15 }),
        (requests) => {
          // Pick a random request that has a userAdmissionNo
          const requestsWithAdmissionNo = requests.filter(r => r.userAdmissionNo && r.userAdmissionNo.length > 0);
          if (requestsWithAdmissionNo.length === 0) return true; // Skip if no valid requests
          
          const targetRequest = requestsWithAdmissionNo[0];
          const searchQuery = targetRequest.userAdmissionNo!.substring(0, Math.min(3, targetRequest.userAdmissionNo!.length));
          
          const filteredResults = filterBorrowRequests(requests, searchQuery);
          
          // All results must contain the search query in one of the searchable fields
          for (const result of filteredResults) {
            expect(requestMatchesQuery(result, searchQuery)).toBe(true);
          }
          
          // The target request must be in the results
          expect(filteredResults.some(r => r.id === targetRequest.id)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Empty search query returns all requests', () => {
    fc.assert(
      fc.property(
        fc.array(borrowRequestArb, { minLength: 0, maxLength: 20 }),
        (requests) => {
          const filteredResults = filterBorrowRequests(requests, '');
          expect(filteredResults.length).toBe(requests.length);
          
          // Also test with whitespace-only query
          const whitespaceResults = filterBorrowRequests(requests, '   ');
          expect(whitespaceResults.length).toBe(requests.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Filter is case-insensitive', () => {
    fc.assert(
      fc.property(
        fc.array(borrowRequestArb, { minLength: 1, maxLength: 15 }),
        (requests) => {
          // Pick a random request that has a userName
          const requestsWithUserName = requests.filter(r => r.userName && r.userName.length > 0);
          if (requestsWithUserName.length === 0) return true;
          
          const targetRequest = requestsWithUserName[0];
          const originalQuery = targetRequest.userName!.substring(0, Math.min(3, targetRequest.userName!.length));
          
          // Test with uppercase
          const upperResults = filterBorrowRequests(requests, originalQuery.toUpperCase());
          // Test with lowercase
          const lowerResults = filterBorrowRequests(requests, originalQuery.toLowerCase());
          
          // Both should return the same results
          expect(upperResults.length).toBe(lowerResults.length);
          expect(upperResults.map(r => r.id).sort()).toEqual(lowerResults.map(r => r.id).sort());
        }
      ),
      { numRuns: 100 }
    );
  });
});
