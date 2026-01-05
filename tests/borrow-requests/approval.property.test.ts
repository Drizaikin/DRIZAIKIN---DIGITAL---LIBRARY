/**
 * Property-Based Tests for Borrow Request Approval
 * **Feature: book-borrowing-approval, Property 4: Approval creates loan and decrements count**
 * **Validates: Requirements 4.1, 4.2, 4.5**
 * 
 * This test verifies that when a borrow request is approved:
 * - An active loan record is created
 * - The book's copies_available is decremented by exactly one
 * - The request is removed from pending status (status changes to 'approved')
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
let approveFunctionAvailable = false;

// Test data tracking for cleanup
const createdUserIds: string[] = [];
const createdBookIds: string[] = [];
const createdRequestIds: string[] = [];
const createdLoanIds: string[] = [];

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
  
  // Check if the approve function exists
  approveFunctionAvailable = await checkApproveFunctionExists();
});

afterEach(async () => {
  // Clean up created loans first (due to foreign key constraints)
  for (const loanId of createdLoanIds) {
    await supabase.from('loans').delete().eq('id', loanId);
  }
  createdLoanIds.length = 0;
  
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
 * Check if approve_borrow_request function exists
 */
async function checkApproveFunctionExists(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('approve_borrow_request', {
      p_request_id: '00000000-0000-0000-0000-000000000000',
      p_admin_id: '00000000-0000-0000-0000-000000000000'
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
 * Helper to get request status
 */
async function getRequestStatus(requestId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('borrow_requests')
    .select('status')
    .eq('id', requestId)
    .single();
  
  if (error) return null;
  return data.status;
}

/**
 * Helper to get loan by user and book
 */
async function getLoanByUserAndBook(userId: string, bookId: string): Promise<{ id: string; dueDate: string } | null> {
  const { data, error } = await supabase
    .from('loans')
    .select('id, due_date')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .eq('is_returned', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error || !data) return null;
  return { id: data.id, dueDate: data.due_date };
}

/**
 * Helper to approve a borrow request using the database function
 */
async function approveBorrowRequest(requestId: string, adminId: string): Promise<{ success: boolean; loanId?: string; error?: string }> {
  const { data, error } = await supabase.rpc('approve_borrow_request', {
    p_request_id: requestId,
    p_admin_id: adminId
  });
  
  if (error) throw new Error(`RPC error: ${error.message}`);
  
  if (data.success && data.loan_id) {
    createdLoanIds.push(data.loan_id);
  }
  
  return {
    success: data.success,
    loanId: data.loan_id,
    error: data.error
  };
}


describe('Borrow Request Approval - Property Tests', () => {
  /**
   * **Feature: book-borrowing-approval, Property 4: Approval creates loan and decrements count**
   * **Validates: Requirements 4.1, 4.2, 4.5**
   * 
   * Property: For any approved borrow request, the system SHALL:
   * - Create an active loan record
   * - Decrement the book's copies_available by exactly one
   * - Remove the request from pending status (status changes to 'approved')
   */
  it('Property 4: Approval creates loan and decrements count', async () => {
    // Fail test if table doesn't exist - infrastructure must be set up
    if (!tableExists) {
      throw new Error(
        'PREREQUISITE NOT MET: borrow_requests table does not exist. ' +
        'Please run supabase_borrow_requests.sql in your Supabase SQL Editor first.'
      );
    }
    
    if (!approveFunctionAvailable) {
      throw new Error(
        'PREREQUISITE NOT MET: approve_borrow_request function does not exist. ' +
        'Please run supabase_borrow_requests.sql in your Supabase SQL Editor first.'
      );
    }
    
    await fc.assert(
      fc.asyncProperty(
        // Generate random copies_available between 1 and 50 (must be at least 1 for approval)
        fc.integer({ min: 1, max: 50 }),
        // Generate unique admission number suffix
        fc.integer({ min: 1, max: 999999 }),
        async (initialCopies, admissionSuffix) => {
          const timestamp = Date.now();
          
          // Create test user (borrower)
          const userAdmissionNo = `TEST_APPR_USER_${timestamp}_${admissionSuffix}`;
          const userId = await createTestUser(userAdmissionNo);
          
          // Create test admin
          const adminAdmissionNo = `TEST_APPR_ADMIN_${timestamp}_${admissionSuffix}`;
          const adminId = await createTestAdmin(adminAdmissionNo);
          
          // Create test book with specified copies
          const bookId = await createTestBook(initialCopies);
          
          // Create a pending borrow request
          const requestId = await createPendingRequest(userId, bookId);
          
          // Verify initial state
          const countBefore = await getBookCopiesAvailable(bookId);
          expect(countBefore).toBe(initialCopies);
          
          const statusBefore = await getRequestStatus(requestId);
          expect(statusBefore).toBe('pending');
          
          // Approve the request
          const result = await approveBorrowRequest(requestId, adminId);
          
          if (!result.success) {
            throw new Error(`Approval should succeed: ${result.error}`);
          }
          
          // PROPERTY ASSERTIONS:
          
          // 1. Verify loan was created (Requirements 4.1)
          const loan = await getLoanByUserAndBook(userId, bookId);
          expect(loan).not.toBeNull();
          expect(loan!.id).toBe(result.loanId);
          
          // 2. Verify book count was decremented by exactly one (Requirements 4.2)
          const countAfter = await getBookCopiesAvailable(bookId);
          expect(countAfter).toBe(countBefore - 1);
          
          // 3. Verify request status changed to 'approved' (Requirements 4.5)
          const statusAfter = await getRequestStatus(requestId);
          expect(statusAfter).toBe('approved');
          
          // Cleanup for this iteration
          if (result.loanId) {
            await supabase.from('loans').delete().eq('id', result.loanId);
            const loanIdx = createdLoanIds.indexOf(result.loanId);
            if (loanIdx > -1) createdLoanIds.splice(loanIdx, 1);
          }
          
          await supabase.from('borrow_requests').delete().eq('id', requestId);
          const reqIdx = createdRequestIds.indexOf(requestId);
          if (reqIdx > -1) createdRequestIds.splice(reqIdx, 1);
          
          // Restore book count before deleting (to avoid constraint issues)
          await supabase.from('books').update({ copies_available: initialCopies }).eq('id', bookId);
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
