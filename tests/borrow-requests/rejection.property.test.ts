/**
 * Property-Based Tests for Borrow Request Rejection
 * **Feature: book-borrowing-approval, Property 6: Rejection preserves book count**
 * **Validates: Requirements 5.1, 5.3, 5.4**
 * 
 * This test verifies that when a borrow request is rejected:
 * - The book's copies_available count remains unchanged
 * - The request status changes to 'rejected'
 * - The request is removed from pending status
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase: SupabaseClient;
let tableExists = false;
let rejectFunctionAvailable = false;

// Test data tracking for cleanup
const createdUserIds: string[] = [];
const createdBookIds: string[] = [];
const createdRequestIds: string[] = [];

beforeAll(async () => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in .env.local');
  }
  supabase = createClient(supabaseUrl, supabaseKey);
  
  // Check if borrow_requests table exists
  tableExists = await checkBorrowRequestsTableExists();
  
  if (!tableExists) {
    console.warn('WARNING: borrow_requests table does not exist. Please run supabase_borrow_requests.sql first.');
  }
  
  // Check if the reject function exists
  rejectFunctionAvailable = await checkRejectFunctionExists();
});

afterEach(async () => {
  // Clean up created borrow requests
  for (const requestId of createdRequestIds) {
    await supabase.from('borrow_requests').delete().eq('id', requestId);
  }
  createdRequestIds.length = 0;
});

afterAll(async () => {
  // Clean up test books and users
  for (const bookId of createdBookIds) {
    await supabase.from('books').delete().eq('id', bookId);
  }
  for (const userId of createdUserIds) {
    await supabase.from('users').delete().eq('id', userId);
  }
});

/**
 * Check if borrow_requests table exists
 */
async function checkBorrowRequestsTableExists(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('borrow_requests')
      .select('id')
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Check if reject_borrow_request function exists
 */
async function checkRejectFunctionExists(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('reject_borrow_request', {
      p_request_id: '00000000-0000-0000-0000-000000000000',
      p_admin_id: '00000000-0000-0000-0000-000000000000',
      p_rejection_reason: null
    });
    // If we get a "Request not found" error, the function exists
    return !error || !error.message.includes('Could not find the function');
  } catch {
    return false;
  }
}

/**
 * Helper to create a test user
 */
async function createTestUser(admissionNo: string, role: string = 'Student'): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .insert({
      name: `Test User ${admissionNo}`,
      email: `test_${admissionNo}@test.com`,
      admission_no: admissionNo,
      password_hash: 'test_hash',
      role: role,
      max_books_allowed: 5
    })
    .select('id')
    .single();
  
  if (error) throw new Error(`Failed to create test user: ${error.message}`);
  createdUserIds.push(data.id);
  return data.id;
}

/**
 * Helper to create a test admin user
 */
async function createTestAdmin(admissionNo: string): Promise<string> {
  return createTestUser(admissionNo, 'Admin');
}

/**
 * Helper to create a test book with specified copies
 */
async function createTestBook(copiesAvailable: number): Promise<string> {
  const { data, error } = await supabase
    .from('books')
    .insert({
      title: `Test Book ${Date.now()}`,
      author: 'Test Author',
      copies_available: copiesAvailable,
      total_copies: copiesAvailable
    })
    .select('id')
    .single();
  
  if (error) throw new Error(`Failed to create test book: ${error.message}`);
  createdBookIds.push(data.id);
  return data.id;
}

/**
 * Helper to get book's copies_available count
 */
async function getBookCopiesAvailable(bookId: string): Promise<number> {
  const { data, error } = await supabase
    .from('books')
    .select('copies_available')
    .eq('id', bookId)
    .single();
  
  if (error) throw new Error(`Failed to get book: ${error.message}`);
  return data.copies_available;
}

/**
 * Helper to create a pending borrow request directly
 */
async function createPendingRequest(userId: string, bookId: string): Promise<string> {
  const { data, error } = await supabase
    .from('borrow_requests')
    .insert({
      user_id: userId,
      book_id: bookId,
      status: 'pending'
    })
    .select('id')
    .single();
  
  if (error) throw new Error(`Failed to create borrow request: ${error.message}`);
  createdRequestIds.push(data.id);
  return data.id;
}

/**
 * Helper to get request details
 */
async function getRequestDetails(requestId: string): Promise<{ status: string; rejectionReason: string | null } | null> {
  const { data, error } = await supabase
    .from('borrow_requests')
    .select('status, rejection_reason')
    .eq('id', requestId)
    .single();
  
  if (error) return null;
  return { status: data.status, rejectionReason: data.rejection_reason };
}

/**
 * Helper to reject a borrow request using the database function
 */
async function rejectBorrowRequest(
  requestId: string, 
  adminId: string, 
  rejectionReason: string | null = null
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('reject_borrow_request', {
    p_request_id: requestId,
    p_admin_id: adminId,
    p_rejection_reason: rejectionReason
  });
  
  if (error) throw new Error(`RPC error: ${error.message}`);
  
  return {
    success: data.success,
    error: data.error
  };
}

describe('Borrow Request Rejection - Property Tests', () => {
  /**
   * **Feature: book-borrowing-approval, Property 6: Rejection preserves book count**
   * **Validates: Requirements 5.1, 5.3, 5.4**
   * 
   * Property: For any rejected borrow request:
   * - The book's copies_available count SHALL remain unchanged (5.3)
   * - The request status SHALL change to 'rejected' (5.1)
   * - The request SHALL be removed from pending status (5.4)
   */
  it('Property 6: Rejection preserves book count', async () => {
    // Fail test if table doesn't exist - infrastructure must be set up
    if (!tableExists) {
      throw new Error(
        'PREREQUISITE NOT MET: borrow_requests table does not exist. ' +
        'Please run supabase_borrow_requests.sql in your Supabase SQL Editor first.'
      );
    }
    
    if (!rejectFunctionAvailable) {
      throw new Error(
        'PREREQUISITE NOT MET: reject_borrow_request function does not exist. ' +
        'Please run supabase_borrow_requests.sql in your Supabase SQL Editor first.'
      );
    }
    
    await fc.assert(
      fc.asyncProperty(
        // Generate random copies_available between 0 and 50 (can be 0 since rejection doesn't need copies)
        fc.integer({ min: 0, max: 50 }),
        // Generate unique admission number suffix
        fc.integer({ min: 1, max: 999999 }),
        // Generate optional rejection reason (null or non-empty string)
        fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
        async (initialCopies, admissionSuffix, rejectionReason) => {
          const timestamp = Date.now();
          
          // Create test user (borrower)
          const userAdmissionNo = `TEST_REJ_USER_${timestamp}_${admissionSuffix}`;
          const userId = await createTestUser(userAdmissionNo);
          
          // Create test admin
          const adminAdmissionNo = `TEST_REJ_ADMIN_${timestamp}_${admissionSuffix}`;
          const adminId = await createTestAdmin(adminAdmissionNo);
          
          // Create test book with specified copies
          const bookId = await createTestBook(initialCopies);
          
          // Create a pending borrow request
          const requestId = await createPendingRequest(userId, bookId);
          
          // Verify initial state
          const countBefore = await getBookCopiesAvailable(bookId);
          expect(countBefore).toBe(initialCopies);
          
          const detailsBefore = await getRequestDetails(requestId);
          expect(detailsBefore).not.toBeNull();
          expect(detailsBefore!.status).toBe('pending');
          
          // Reject the request
          const result = await rejectBorrowRequest(requestId, adminId, rejectionReason);
          
          if (!result.success) {
            throw new Error(`Rejection should succeed: ${result.error}`);
          }
          
          // PROPERTY ASSERTIONS:
          
          // 1. Verify book count is UNCHANGED (Requirements 5.3)
          const countAfter = await getBookCopiesAvailable(bookId);
          expect(countAfter).toBe(countBefore);
          
          // 2. Verify request status changed to 'rejected' (Requirements 5.1)
          const detailsAfter = await getRequestDetails(requestId);
          expect(detailsAfter).not.toBeNull();
          expect(detailsAfter!.status).toBe('rejected');
          
          // 3. Verify request is no longer pending (Requirements 5.4)
          // This is implicitly verified by status being 'rejected' instead of 'pending'
          expect(detailsAfter!.status).not.toBe('pending');
          
          // 4. Verify rejection reason is stored if provided (Requirements 5.2)
          if (rejectionReason !== null) {
            expect(detailsAfter!.rejectionReason).toBe(rejectionReason);
          }
          
          // Cleanup for this iteration
          await supabase.from('borrow_requests').delete().eq('id', requestId);
          const reqIdx = createdRequestIds.indexOf(requestId);
          if (reqIdx > -1) createdRequestIds.splice(reqIdx, 1);
          
          await supabase.from('books').delete().eq('id', bookId);
          const bookIdx = createdBookIds.indexOf(bookId);
          if (bookIdx > -1) createdBookIds.splice(bookIdx, 1);
          
          await supabase.from('users').delete().eq('id', adminId);
          const adminIdx = createdUserIds.indexOf(adminId);
          if (adminIdx > -1) createdUserIds.splice(adminIdx, 1);
          
          await supabase.from('users').delete().eq('id', userId);
          const userIdx = createdUserIds.indexOf(userId);
          if (userIdx > -1) createdUserIds.splice(userIdx, 1);
        }
      ),
      { numRuns: 10 } // Reduced from 100 due to database operation overhead per iteration
    );
  }, 180000); // 3 minute timeout for database operations
});
