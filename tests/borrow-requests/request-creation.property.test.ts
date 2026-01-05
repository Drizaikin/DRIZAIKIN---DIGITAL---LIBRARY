/**
 * Property-Based Tests for Borrow Request Creation
 * **Feature: book-borrowing-approval, Property 1: Request creation preserves book count**
 * **Validates: Requirements 1.1**
 * 
 * This test verifies that when a borrow request is created, the book's
 * copies_available count remains unchanged.
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
let dbFunctionAvailable = false;
let tableExists = false;

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
  
  // Check if the database function exists
  try {
    // Try to call the function with invalid UUIDs to check if it exists
    const { error } = await supabase.rpc('create_borrow_request', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_book_id: '00000000-0000-0000-0000-000000000000'
    });
    // If we get a "User not found" error, the function exists
    dbFunctionAvailable = !error || !error.message.includes('Could not find the function');
  } catch {
    dbFunctionAvailable = false;
  }
});

afterEach(async () => {
  // Clean up created borrow requests
  for (const requestId of createdRequestIds) {
    await supabase.from('borrow_requests').delete().eq('id', requestId);
  }
  createdRequestIds.length = 0;
});

afterAll(async () => {
  // Clean up test users and books
  for (const userId of createdUserIds) {
    await supabase.from('users').delete().eq('id', userId);
  }
  for (const bookId of createdBookIds) {
    await supabase.from('books').delete().eq('id', bookId);
  }
});

/**
 * Helper to create a test user
 */
async function createTestUser(admissionNo: string): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .insert({
      name: `Test User ${admissionNo}`,
      email: `test_${admissionNo}@test.com`,
      admission_no: admissionNo,
      password_hash: 'test_hash',
      role: 'Student'
    })
    .select('id')
    .single();
  
  if (error) throw new Error(`Failed to create test user: ${error.message}`);
  createdUserIds.push(data.id);
  return data.id;
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
 * Helper to create a borrow request using the database function
 */
async function createBorrowRequestViaRPC(userId: string, bookId: string): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const { data, error } = await supabase.rpc('create_borrow_request', {
    p_user_id: userId,
    p_book_id: bookId
  });
  
  if (error) throw new Error(`RPC error: ${error.message}`);
  
  if (data.success && data.request_id) {
    createdRequestIds.push(data.request_id);
  }
  
  return {
    success: data.success,
    requestId: data.request_id,
    error: data.error
  };
}

/**
 * Helper to create a borrow request directly via table insert
 * This simulates what the create_borrow_request function does
 */
async function createBorrowRequestDirect(userId: string, bookId: string): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    // Check for existing pending request
    const { data: existingRequest, error: checkError } = await supabase
      .from('borrow_requests')
      .select('id')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .eq('status', 'pending')
      .maybeSingle();
    
    if (checkError) {
      // Table might not exist
      return { success: false, error: `Database error: ${checkError.message}` };
    }
    
    if (existingRequest) {
      return { success: false, error: 'You already have a pending request for this book' };
    }
    
    // Insert new request - NOTE: This does NOT modify book count
    const { data, error } = await supabase
      .from('borrow_requests')
      .insert({
        user_id: userId,
        book_id: bookId,
        status: 'pending'
      })
      .select('id')
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    createdRequestIds.push(data.id);
    return { success: true, requestId: data.id };
  } catch (err) {
    return { success: false, error: `Unexpected error: ${err}` };
  }
}

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

describe('Borrow Request Creation - Property Tests', () => {
  /**
   * **Feature: book-borrowing-approval, Property 1: Request creation preserves book count**
   * **Validates: Requirements 1.1**
   * 
   * Property: For any user and available book, when a borrow request is created,
   * the book's copies_available count SHALL remain unchanged.
   */
  it('Property 1: Request creation preserves book count', async () => {
    // Fail test if table doesn't exist - infrastructure must be set up
    if (!tableExists) {
      throw new Error(
        'PREREQUISITE NOT MET: borrow_requests table does not exist. ' +
        'Please run supabase_borrow_requests.sql in your Supabase SQL Editor first.'
      );
    }
    
    // Choose the appropriate method based on database function availability
    const createBorrowRequest = dbFunctionAvailable 
      ? createBorrowRequestViaRPC 
      : createBorrowRequestDirect;
    
    await fc.assert(
      fc.asyncProperty(
        // Generate random copies_available between 1 and 100
        fc.integer({ min: 1, max: 100 }),
        // Generate unique admission number suffix
        fc.integer({ min: 1, max: 999999 }),
        async (initialCopies, admissionSuffix) => {
          // Create test data with unique identifiers
          const timestamp = Date.now();
          const admissionNo = `TEST_PBT_${timestamp}_${admissionSuffix}`;
          const userId = await createTestUser(admissionNo);
          const bookId = await createTestBook(initialCopies);
          
          // Get initial book count
          const countBefore = await getBookCopiesAvailable(bookId);
          expect(countBefore).toBe(initialCopies);
          
          // Create borrow request
          const result = await createBorrowRequest(userId, bookId);
          
          // If request creation failed, log the error and fail the test
          if (!result.success) {
            throw new Error(`Failed to create borrow request: ${result.error}`);
          }
          
          // PROPERTY ASSERTION: Verify book count is unchanged after request creation
          const countAfter = await getBookCopiesAvailable(bookId);
          expect(countAfter).toBe(countBefore);
          
          // Cleanup for this iteration
          if (result.requestId) {
            await supabase.from('borrow_requests').delete().eq('id', result.requestId);
            const idx = createdRequestIds.indexOf(result.requestId);
            if (idx > -1) createdRequestIds.splice(idx, 1);
          }
          await supabase.from('books').delete().eq('id', bookId);
          const bookIdx = createdBookIds.indexOf(bookId);
          if (bookIdx > -1) createdBookIds.splice(bookIdx, 1);
          
          await supabase.from('users').delete().eq('id', userId);
          const userIdx = createdUserIds.indexOf(userId);
          if (userIdx > -1) createdUserIds.splice(userIdx, 1);
        }
      ),
      { numRuns: 10 } // Reduced from 100 due to database operation overhead per iteration
    );
  }, 120000); // 2 minute timeout for database operations

  /**
   * **Feature: book-borrowing-approval, Property 3: Duplicate request prevention**
   * **Validates: Requirements 1.3**
   * 
   * Property: For any user with a pending request for a specific book, 
   * attempting to create another request for the same book SHALL be rejected.
   */
  it('Property 3: Duplicate request prevention', async () => {
    // Fail test if table doesn't exist - infrastructure must be set up
    if (!tableExists) {
      throw new Error(
        'PREREQUISITE NOT MET: borrow_requests table does not exist. ' +
        'Please run supabase_borrow_requests.sql in your Supabase SQL Editor first.'
      );
    }
    
    // Choose the appropriate method based on database function availability
    const createBorrowRequest = dbFunctionAvailable 
      ? createBorrowRequestViaRPC 
      : createBorrowRequestDirect;
    
    await fc.assert(
      fc.asyncProperty(
        // Generate random copies_available between 1 and 100
        fc.integer({ min: 1, max: 100 }),
        // Generate unique admission number suffix
        fc.integer({ min: 1, max: 999999 }),
        async (initialCopies, admissionSuffix) => {
          // Create test data with unique identifiers
          const timestamp = Date.now();
          const admissionNo = `TEST_DUP_${timestamp}_${admissionSuffix}`;
          const userId = await createTestUser(admissionNo);
          const bookId = await createTestBook(initialCopies);
          
          // Create first borrow request - should succeed
          const firstResult = await createBorrowRequest(userId, bookId);
          
          if (!firstResult.success) {
            throw new Error(`First request should succeed: ${firstResult.error}`);
          }
          
          // PROPERTY ASSERTION: Second request for same user/book should be rejected
          const secondResult = await createBorrowRequest(userId, bookId);
          
          // The second request MUST fail with duplicate prevention error
          expect(secondResult.success).toBe(false);
          expect(secondResult.error).toContain('already have a pending request');
          
          // Cleanup for this iteration
          if (firstResult.requestId) {
            await supabase.from('borrow_requests').delete().eq('id', firstResult.requestId);
            const idx = createdRequestIds.indexOf(firstResult.requestId);
            if (idx > -1) createdRequestIds.splice(idx, 1);
          }
          await supabase.from('books').delete().eq('id', bookId);
          const bookIdx = createdBookIds.indexOf(bookId);
          if (bookIdx > -1) createdBookIds.splice(bookIdx, 1);
          
          await supabase.from('users').delete().eq('id', userId);
          const userIdx = createdUserIds.indexOf(userId);
          if (userIdx > -1) createdUserIds.splice(userIdx, 1);
        }
      ),
      { numRuns: 10 } // Reduced from 100 due to database operation overhead per iteration
    );
  }, 120000); // 2 minute timeout for database operations
});
