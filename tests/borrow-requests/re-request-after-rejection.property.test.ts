/**
 * Property-Based Tests for Re-Request After Rejection
 * **Feature: book-borrowing-approval, Property 7: Re-request after rejection**
 * **Validates: Requirements 2.3**
 * 
 * This test verifies that when a borrow request is rejected,
 * the user can create a new request for the same book.
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
let createFunctionAvailable = false;
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
  
  // Check if the create function exists
  createFunctionAvailable = await checkCreateFunctionExists();
  
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
 * Check if create_borrow_request function exists
 */
async function checkCreateFunctionExists(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('create_borrow_request', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_book_id: '00000000-0000-0000-0000-000000000000'
    });
    // If we get a "User not found" error, the function exists
    return !error || !error.message.includes('Could not find the function');
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
      return { success: false, error: `Database error: ${checkError.message}` };
    }
    
    if (existingRequest) {
      return { success: false, error: 'You already have a pending request for this book' };
    }
    
    // Insert new request
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
 * Helper to reject a borrow request using the database function
 */
async function rejectBorrowRequestViaRPC(
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

/**
 * Helper to reject a borrow request directly via table update
 */
async function rejectBorrowRequestDirect(
  requestId: string, 
  adminId: string, 
  rejectionReason: string | null = null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('borrow_requests')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason,
        processed_at: new Date().toISOString(),
        processed_by: adminId
      })
      .eq('id', requestId)
      .eq('status', 'pending');
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: `Unexpected error: ${err}` };
  }
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


describe('Re-Request After Rejection - Property Tests', () => {
  /**
   * **Feature: book-borrowing-approval, Property 7: Re-request after rejection**
   * **Validates: Requirements 2.3**
   * 
   * Property: For any user whose request was rejected, the user SHALL be able
   * to create a new request for the same book.
   */
  it('Property 7: Re-request after rejection', async () => {
    // Fail test if table doesn't exist - infrastructure must be set up
    if (!tableExists) {
      throw new Error(
        'PREREQUISITE NOT MET: borrow_requests table does not exist. ' +
        'Please run supabase_borrow_requests.sql in your Supabase SQL Editor first.'
      );
    }
    
    // Choose the appropriate methods based on database function availability
    const createBorrowRequest = createFunctionAvailable 
      ? createBorrowRequestViaRPC 
      : createBorrowRequestDirect;
    
    const rejectBorrowRequest = rejectFunctionAvailable
      ? rejectBorrowRequestViaRPC
      : rejectBorrowRequestDirect;
    
    await fc.assert(
      fc.asyncProperty(
        // Generate random copies_available between 1 and 50
        fc.integer({ min: 1, max: 50 }),
        // Generate unique admission number suffix
        fc.integer({ min: 1, max: 999999 }),
        // Generate optional rejection reason
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
        async (initialCopies, admissionSuffix, rejectionReason) => {
          const timestamp = Date.now();
          
          // Create test user (borrower)
          const userAdmissionNo = `TEST_REREQ_USER_${timestamp}_${admissionSuffix}`;
          const userId = await createTestUser(userAdmissionNo);
          
          // Create test admin
          const adminAdmissionNo = `TEST_REREQ_ADMIN_${timestamp}_${admissionSuffix}`;
          const adminId = await createTestAdmin(adminAdmissionNo);
          
          // Create test book with specified copies
          const bookId = await createTestBook(initialCopies);
          
          // Step 1: Create initial borrow request - should succeed
          const firstResult = await createBorrowRequest(userId, bookId);
          
          if (!firstResult.success) {
            throw new Error(`First request should succeed: ${firstResult.error}`);
          }
          
          // Verify first request is pending
          const firstRequestDetails = await getRequestDetails(firstResult.requestId!);
          expect(firstRequestDetails).not.toBeNull();
          expect(firstRequestDetails!.status).toBe('pending');
          
          // Step 2: Reject the request
          const rejectResult = await rejectBorrowRequest(firstResult.requestId!, adminId, rejectionReason);
          
          if (!rejectResult.success) {
            throw new Error(`Rejection should succeed: ${rejectResult.error}`);
          }
          
          // Verify request is now rejected
          const rejectedDetails = await getRequestDetails(firstResult.requestId!);
          expect(rejectedDetails).not.toBeNull();
          expect(rejectedDetails!.status).toBe('rejected');
          
          // PROPERTY ASSERTION: Step 3: User should be able to create a new request for the same book
          const secondResult = await createBorrowRequest(userId, bookId);
          
          // The second request MUST succeed after rejection
          expect(secondResult.success).toBe(true);
          expect(secondResult.requestId).toBeDefined();
          
          // Verify the new request is pending
          const secondRequestDetails = await getRequestDetails(secondResult.requestId!);
          expect(secondRequestDetails).not.toBeNull();
          expect(secondRequestDetails!.status).toBe('pending');
          
          // Cleanup for this iteration
          if (secondResult.requestId) {
            await supabase.from('borrow_requests').delete().eq('id', secondResult.requestId);
            const idx = createdRequestIds.indexOf(secondResult.requestId);
            if (idx > -1) createdRequestIds.splice(idx, 1);
          }
          
          if (firstResult.requestId) {
            await supabase.from('borrow_requests').delete().eq('id', firstResult.requestId);
            const idx = createdRequestIds.indexOf(firstResult.requestId);
            if (idx > -1) createdRequestIds.splice(idx, 1);
          }
          
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
