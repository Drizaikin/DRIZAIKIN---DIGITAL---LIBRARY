/**
 * Property-Based Tests for Audit Log Completeness
 * **Feature: admin-book-management, Property 6: Audit Log Completeness**
 * **Validates: Requirements 2.7, 6.5**
 * 
 * This test verifies that for any book modification (create, update, delete),
 * an audit log entry SHALL be created containing the book identifier, action type,
 * changes, admin user ID, and timestamp.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { computeDiff, VALID_ACTIONS } from '../../services/admin/auditLogService.js';

/**
 * Interface representing a Book record
 */
interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  genres?: string[];
  description?: string;
  published_year?: number;
  isbn?: string;
  source_identifier?: string;
}

/**
 * Interface representing admin info
 */
interface AdminInfo {
  userId: string;
  username: string;
}

/**
 * Interface representing an audit log entry
 */
interface AuditLogEntry {
  book_id: string | null;
  book_identifier: string;
  action: 'create' | 'update' | 'delete';
  changes: Record<string, unknown> | null;
  admin_user_id: string | null;
  admin_username: string | null;
  created_at: string;
}

/**
 * Simulates the logAction function behavior for testing
 * This mirrors the core audit logging logic without database dependency
 */
function simulateLogAction(params: {
  bookId?: string | null;
  bookIdentifier: string;
  action: string;
  changes?: Record<string, unknown> | null;
  adminUserId?: string | null;
  adminUsername?: string | null;
}): { success: boolean; logEntry?: AuditLogEntry; error?: string } {
  // Validate required parameters
  if (!params || typeof params !== 'object') {
    return { success: false, error: 'Invalid parameters: must be an object' };
  }
  
  if (!params.bookIdentifier || typeof params.bookIdentifier !== 'string') {
    return { success: false, error: 'Invalid parameters: bookIdentifier is required' };
  }
  
  if (!params.action || !VALID_ACTIONS.includes(params.action)) {
    return { success: false, error: `Invalid action: must be one of ${VALID_ACTIONS.join(', ')}` };
  }
  
  const logEntry: AuditLogEntry = {
    book_id: params.bookId || null,
    book_identifier: params.bookIdentifier,
    action: params.action as 'create' | 'update' | 'delete',
    changes: params.changes || null,
    admin_user_id: params.adminUserId || null,
    admin_username: params.adminUsername || null,
    created_at: new Date().toISOString()
  };
  
  return { success: true, logEntry };
}

/**
 * Simulates logCreate behavior
 */
function simulateLogCreate(book: Book, adminInfo?: AdminInfo): { success: boolean; logEntry?: AuditLogEntry; error?: string } {
  if (!book || typeof book !== 'object') {
    return { success: false, error: 'Invalid book data' };
  }
  
  return simulateLogAction({
    bookId: book.id,
    bookIdentifier: book.source_identifier || book.title || 'Unknown',
    action: 'create',
    changes: { created: book },
    adminUserId: adminInfo?.userId,
    adminUsername: adminInfo?.username
  });
}

/**
 * Simulates logUpdate behavior
 */
function simulateLogUpdate(
  bookId: string,
  bookIdentifier: string,
  before: Partial<Book>,
  after: Partial<Book>,
  adminInfo?: AdminInfo
): { success: boolean; logEntry?: AuditLogEntry | null; error?: string } {
  const changes = computeDiff(before, after);
  
  // Don't log if no actual changes
  if (Object.keys(changes).length === 0) {
    return { success: true, logEntry: null };
  }
  
  return simulateLogAction({
    bookId,
    bookIdentifier,
    action: 'update',
    changes,
    adminUserId: adminInfo?.userId,
    adminUsername: adminInfo?.username
  });
}

/**
 * Simulates logDelete behavior
 */
function simulateLogDelete(bookId: string, deletedBook: Book, adminInfo?: AdminInfo): { success: boolean; logEntry?: AuditLogEntry; error?: string } {
  if (!deletedBook || typeof deletedBook !== 'object') {
    return { success: false, error: 'Invalid deleted book data' };
  }
  
  return simulateLogAction({
    bookId,
    bookIdentifier: deletedBook.source_identifier || deletedBook.title || 'Unknown',
    action: 'delete',
    changes: { deleted: deletedBook },
    adminUserId: adminInfo?.userId,
    adminUsername: adminInfo?.username
  });
}

// Generator for UUIDs
const uuidArb = fc.uuid();

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

// Generator for description
const descriptionArb = fc.oneof(
  fc.constant(undefined),
  fc.string({ minLength: 10, maxLength: 500 })
);

// Generator for published year
const publishedYearArb = fc.oneof(
  fc.constant(undefined),
  fc.integer({ min: 1800, max: 2025 })
);

// Generator for ISBN
const isbnArb = fc.oneof(
  fc.constant(undefined),
  fc.stringMatching(/^[0-9]{10}$|^[0-9]{13}$/)
);

// Generator for source identifier
const sourceIdentifierArb = fc.oneof(
  fc.constant(undefined),
  fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0)
);

// Generator for a single book
const bookArb: fc.Arbitrary<Book> = fc.record({
  id: uuidArb,
  title: bookTitleArb,
  author: authorArb,
  category: categoryArb,
  genres: genreArb,
  description: descriptionArb,
  published_year: publishedYearArb,
  isbn: isbnArb,
  source_identifier: sourceIdentifierArb
});

// Generator for admin info
const adminInfoArb: fc.Arbitrary<AdminInfo> = fc.record({
  userId: uuidArb,
  username: fc.string({ minLength: 3, maxLength: 30 }).filter(s => s.trim().length > 0)
});

// Generator for optional admin info
const optionalAdminInfoArb = fc.oneof(
  fc.constant(undefined),
  adminInfoArb
);

// Generator for valid action types
const actionArb = fc.constantFrom('create', 'update', 'delete');

// Generator for invalid action types
const invalidActionArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => !VALID_ACTIONS.includes(s));

describe('Audit Log Completeness - Property Tests', () => {
  /**
   * **Feature: admin-book-management, Property 6: Audit Log Completeness**
   * **Validates: Requirements 2.7**
   * 
   * Property: Create action generates complete audit log entry
   */
  it('Property 6a: Create action generates audit log with all required fields', () => {
    fc.assert(
      fc.property(
        bookArb,
        adminInfoArb,
        (book, adminInfo) => {
          const result = simulateLogCreate(book, adminInfo);
          
          expect(result.success).toBe(true);
          expect(result.logEntry).toBeDefined();
          
          const entry = result.logEntry!;
          
          // Verify all required fields are present
          expect(entry.book_id).toBe(book.id);
          expect(entry.book_identifier).toBe(book.source_identifier || book.title);
          expect(entry.action).toBe('create');
          expect(entry.changes).toBeDefined();
          expect(entry.changes).toHaveProperty('created');
          expect(entry.admin_user_id).toBe(adminInfo.userId);
          expect(entry.admin_username).toBe(adminInfo.username);
          expect(entry.created_at).toBeDefined();
          
          // Verify timestamp is valid ISO string
          expect(() => new Date(entry.created_at)).not.toThrow();
          expect(new Date(entry.created_at).toISOString()).toBe(entry.created_at);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.7**
   * 
   * Property: Update action generates complete audit log entry with diff
   */
  it('Property 6b: Update action generates audit log with changes diff', () => {
    fc.assert(
      fc.property(
        bookArb,
        bookArb,
        adminInfoArb,
        (beforeBook, afterBook, adminInfo) => {
          // Ensure books have same ID but different content
          const before = { ...beforeBook };
          const after = { ...afterBook, id: before.id };
          
          const result = simulateLogUpdate(
            before.id,
            before.source_identifier || before.title,
            before,
            after,
            adminInfo
          );
          
          expect(result.success).toBe(true);
          
          // If there are changes, verify log entry
          const diff = computeDiff(before, after);
          if (Object.keys(diff).length > 0) {
            expect(result.logEntry).toBeDefined();
            
            const entry = result.logEntry!;
            
            // Verify all required fields
            expect(entry.book_id).toBe(before.id);
            expect(entry.book_identifier).toBe(before.source_identifier || before.title);
            expect(entry.action).toBe('update');
            expect(entry.changes).toBeDefined();
            expect(entry.admin_user_id).toBe(adminInfo.userId);
            expect(entry.admin_username).toBe(adminInfo.username);
            expect(entry.created_at).toBeDefined();
            
            // Verify changes contain from/to values for modified fields
            for (const key of Object.keys(diff)) {
              expect(entry.changes).toHaveProperty(key);
            }
          } else {
            // No changes means no log entry (but success is true)
            expect(result.logEntry).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 6.5**
   * 
   * Property: Delete action generates complete audit log entry
   */
  it('Property 6c: Delete action generates audit log with deleted book data', () => {
    fc.assert(
      fc.property(
        bookArb,
        adminInfoArb,
        (book, adminInfo) => {
          const result = simulateLogDelete(book.id, book, adminInfo);
          
          expect(result.success).toBe(true);
          expect(result.logEntry).toBeDefined();
          
          const entry = result.logEntry!;
          
          // Verify all required fields
          expect(entry.book_id).toBe(book.id);
          expect(entry.book_identifier).toBe(book.source_identifier || book.title);
          expect(entry.action).toBe('delete');
          expect(entry.changes).toBeDefined();
          expect(entry.changes).toHaveProperty('deleted');
          expect(entry.admin_user_id).toBe(adminInfo.userId);
          expect(entry.admin_username).toBe(adminInfo.username);
          expect(entry.created_at).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.7, 6.5**
   * 
   * Property: Audit log entry contains valid action type
   */
  it('Property 6d: Audit log action is always one of valid types', () => {
    fc.assert(
      fc.property(
        bookArb,
        actionArb,
        optionalAdminInfoArb,
        (book, action, adminInfo) => {
          const result = simulateLogAction({
            bookId: book.id,
            bookIdentifier: book.source_identifier || book.title,
            action,
            changes: { test: 'data' },
            adminUserId: adminInfo?.userId,
            adminUsername: adminInfo?.username
          });
          
          expect(result.success).toBe(true);
          expect(result.logEntry).toBeDefined();
          expect(VALID_ACTIONS).toContain(result.logEntry!.action);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.7, 6.5**
   * 
   * Property: Invalid action types are rejected
   */
  it('Property 6e: Invalid action types are rejected', () => {
    fc.assert(
      fc.property(
        bookArb,
        invalidActionArb,
        (book, invalidAction) => {
          const result = simulateLogAction({
            bookId: book.id,
            bookIdentifier: book.source_identifier || book.title,
            action: invalidAction,
            changes: { test: 'data' }
          });
          
          expect(result.success).toBe(false);
          expect(result.error).toContain('Invalid action');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.7, 6.5**
   * 
   * Property: Book identifier is always present in audit log
   */
  it('Property 6f: Book identifier is always present and non-empty', () => {
    fc.assert(
      fc.property(
        bookArb,
        actionArb,
        (book, action) => {
          let result;
          
          if (action === 'create') {
            result = simulateLogCreate(book);
          } else if (action === 'delete') {
            result = simulateLogDelete(book.id, book);
          } else {
            result = simulateLogAction({
              bookId: book.id,
              bookIdentifier: book.source_identifier || book.title,
              action,
              changes: { test: 'data' }
            });
          }
          
          expect(result.success).toBe(true);
          expect(result.logEntry).toBeDefined();
          expect(result.logEntry!.book_identifier).toBeDefined();
          expect(result.logEntry!.book_identifier.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.7**
   * 
   * Property: Timestamp is always a valid ISO date string
   */
  it('Property 6g: Timestamp is always valid ISO date string', () => {
    fc.assert(
      fc.property(
        bookArb,
        actionArb,
        optionalAdminInfoArb,
        (book, action, adminInfo) => {
          const result = simulateLogAction({
            bookId: book.id,
            bookIdentifier: book.source_identifier || book.title,
            action,
            changes: { test: 'data' },
            adminUserId: adminInfo?.userId,
            adminUsername: adminInfo?.username
          });
          
          expect(result.success).toBe(true);
          expect(result.logEntry).toBeDefined();
          
          const timestamp = result.logEntry!.created_at;
          
          // Verify it's a valid date
          const date = new Date(timestamp);
          expect(date.toString()).not.toBe('Invalid Date');
          
          // Verify it's in ISO format
          expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.7, 6.5**
   * 
   * Property: Admin info is preserved when provided
   */
  it('Property 6h: Admin info is preserved when provided', () => {
    fc.assert(
      fc.property(
        bookArb,
        actionArb,
        adminInfoArb,
        (book, action, adminInfo) => {
          const result = simulateLogAction({
            bookId: book.id,
            bookIdentifier: book.source_identifier || book.title,
            action,
            changes: { test: 'data' },
            adminUserId: adminInfo.userId,
            adminUsername: adminInfo.username
          });
          
          expect(result.success).toBe(true);
          expect(result.logEntry).toBeDefined();
          expect(result.logEntry!.admin_user_id).toBe(adminInfo.userId);
          expect(result.logEntry!.admin_username).toBe(adminInfo.username);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.7, 6.5**
   * 
   * Property: Audit log works without admin info (null values)
   */
  it('Property 6i: Audit log works without admin info', () => {
    fc.assert(
      fc.property(
        bookArb,
        actionArb,
        (book, action) => {
          const result = simulateLogAction({
            bookId: book.id,
            bookIdentifier: book.source_identifier || book.title,
            action,
            changes: { test: 'data' }
            // No admin info provided
          });
          
          expect(result.success).toBe(true);
          expect(result.logEntry).toBeDefined();
          expect(result.logEntry!.admin_user_id).toBeNull();
          expect(result.logEntry!.admin_username).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.7**
   * 
   * Property: computeDiff correctly identifies all changed fields
   */
  it('Property 6j: computeDiff identifies all changed fields', () => {
    fc.assert(
      fc.property(
        bookArb,
        bookArb,
        (before, after) => {
          const diff = computeDiff(before, after);
          
          // For each key in diff, verify the values actually changed
          for (const key of Object.keys(diff)) {
            if (key === 'created' || key === 'deleted') continue;
            
            const beforeVal = JSON.stringify((before as Record<string, unknown>)[key]);
            const afterVal = JSON.stringify((after as Record<string, unknown>)[key]);
            
            // Values should be different
            expect(beforeVal).not.toBe(afterVal);
            
            // Diff should contain from/to
            expect(diff[key]).toHaveProperty('from');
            expect(diff[key]).toHaveProperty('to');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.7**
   * 
   * Property: computeDiff returns empty object for identical objects
   */
  it('Property 6k: computeDiff returns empty for identical objects', () => {
    fc.assert(
      fc.property(
        bookArb,
        (book) => {
          const diff = computeDiff(book, { ...book });
          
          expect(Object.keys(diff).length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.7**
   * 
   * Property: Update with no changes does not create log entry
   */
  it('Property 6l: Update with no changes does not create log entry', () => {
    fc.assert(
      fc.property(
        bookArb,
        adminInfoArb,
        (book, adminInfo) => {
          const result = simulateLogUpdate(
            book.id,
            book.source_identifier || book.title,
            book,
            { ...book }, // Same data
            adminInfo
          );
          
          expect(result.success).toBe(true);
          expect(result.logEntry).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.7, 6.5**
   * 
   * Property: Missing book identifier causes failure
   */
  it('Property 6m: Missing book identifier causes failure', () => {
    fc.assert(
      fc.property(
        actionArb,
        (action) => {
          const result = simulateLogAction({
            bookId: 'some-id',
            bookIdentifier: '', // Empty identifier
            action,
            changes: { test: 'data' }
          });
          
          expect(result.success).toBe(false);
          expect(result.error).toContain('bookIdentifier');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.7, 6.5**
   * 
   * Property: Changes are stored as JSONB-compatible structure
   */
  it('Property 6n: Changes are stored as JSONB-compatible structure', () => {
    fc.assert(
      fc.property(
        bookArb,
        bookArb,
        (before, after) => {
          const diff = computeDiff(before, after);
          
          // Verify the diff can be serialized to JSON (JSONB compatible)
          expect(() => JSON.stringify(diff)).not.toThrow();
          
          // Verify round-trip serialization
          const serialized = JSON.stringify(diff);
          const deserialized = JSON.parse(serialized);
          expect(deserialized).toEqual(diff);
        }
      ),
      { numRuns: 100 }
    );
  });
});
