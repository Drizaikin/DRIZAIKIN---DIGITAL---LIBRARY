/**
 * Property-Based Tests for State Transition Timestamps
 * **Feature: book-borrowing-approval, Property 9: State transition timestamps**
 * **Validates: Requirements 7.2**
 * 
 * This test verifies that when a borrow request transitions from pending to
 * approved or rejected, the system records the processed_at timestamp.
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
let rejectFunctionAvailable = false;

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
  
  tableExists = await checkBorrowRequestsTableExists();
  
  if (!tableExists) {
    console.warn('WARNING: borrow_requests table does not exist.');
  }
  
  approveFunctionAvailable = await checkApproveFunctionExists();
  rejectFunctionAvailable = await checkRejectFunctionExists();
});

afterEach(async () => {
  for (const loanId of createdLoanIds) {
    await supabase.from('loans').delete().eq('id', loanId);
  }
  createdLoanIds.length = 0;
  
  for (const requestId of createdRequestIds) {
    await supabase.from('borrow_requests').delete().eq('id', requestId);
  }
  createdRequestIds.length = 0;
});

afterAll(async () => {
  for (const bookId of createdBookIds) {
    await supabase.from('books').delete().eq('id', bookId);
  }
  for (const userId of createdUserIds) {
    await supabase.from('users').delete().eq('id', userId);
  }
});


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

async function checkApproveFunctionExists(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('approve_borrow_request', {
      p_request_id: '00000000-0000-0000-0000-000000000000',
      p_admin_id: '00000000-0000-0000-0000-000000000000'
    });
    return !error || !error.message.includes('Could not find the function');
  } catch {
    return false;
  }
}

async function checkRejectFunctionExists(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('reject_borrow_request', {
      p_request_id: '00000000-0000-0000-0000-000000000000',
      p_admin_id: '00000000-0000-0000-0000-000000000000',
      p_rejection_reason: null
    });
    return !error || !error.message.includes('Could not find the function');
  } catch {
    return false;
  }
}

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

async function createTestAdmin(admissionNo: string): Promise<string> {
  return createTestUser(admissionNo, 'Admin');
}

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

async function getRequestTimestamps(requestId: string): Promise<{
  status: string;
  requestedAt: string;
  processedAt: string | null;
  processedBy: string | null;
} | null> {
  const { data, error } = await supabase
    .from('borrow_requests')
    .select('status, requested_at, processed_at, processed_by')
    .eq('id', requestId)
    .single();
  
  if (error) return null;
  return {
    status: data.status,
    requestedAt: data.requested_at,
    processedAt: data.processed_at,
    processedBy: data.processed_by
  };
}

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


describe('State Transition Timestamps - Property Tests', () => {
  /**
   * **Feature: book-borrowing-approval, Property 9: State transition timestamps**
   * **Validates: Requirements 7.2**
   * 
   * Property: For any request that transitions from pending to approved or rejected,
   * the system SHALL record the processed_at timestamp.
   */
  it('Property 9: State transition timestamps - Approval records processed_at', async () => {
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
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 999999 }),
        async (initialCopies, admissionSuffix) => {
          const timestamp = Date.now();
          const timeBefore = new Date();
          
          const userAdmissionNo = `TEST_TS_APPR_USER_${timestamp}_${admissionSuffix}`;
          const userId = await createTestUser(userAdmissionNo);
          
          const adminAdmissionNo = `TEST_TS_APPR_ADMIN_${timestamp}_${admissionSuffix}`;
          const adminId = await createTestAdmin(adminAdmissionNo);
          
          const bookId = await createTestBook(initialCopies);
          const requestId = await createPendingRequest(userId, bookId);
          
          // Verify pending request has no processed_at
          const beforeApproval = await getRequestTimestamps(requestId);
          expect(beforeApproval).not.toBeNull();
          expect(beforeApproval!.status).toBe('pending');
          expect(beforeApproval!.processedAt).toBeNull();
          expect(beforeApproval!.processedBy).toBeNull();
          
          // Approve the request
          const result = await approveBorrowRequest(requestId, adminId);
          const timeAfter = new Date();
          
          if (!result.success) {
            throw new Error(`Approval should succeed: ${result.error}`);
          }
          
          // PROPERTY ASSERTION: processed_at must be recorded
          const afterApproval = await getRequestTimestamps(requestId);
          expect(afterApproval).not.toBeNull();
          expect(afterApproval!.status).toBe('approved');
          expect(afterApproval!.processedAt).not.toBeNull();
          expect(afterApproval!.processedBy).toBe(adminId);
          
          // Verify timestamp is reasonable (within a reasonable window)
          // Allow 5 second tolerance for clock drift between client and database server
          const processedAt = new Date(afterApproval!.processedAt!);
          expect(processedAt.getTime()).toBeGreaterThanOrEqual(timeBefore.getTime() - 5000);
          expect(processedAt.getTime()).toBeLessThanOrEqual(timeAfter.getTime() + 5000);
          
          // Cleanup
          if (result.loanId) {
            await supabase.from('loans').delete().eq('id', result.loanId);
            const loanIdx = createdLoanIds.indexOf(result.loanId);
            if (loanIdx > -1) createdLoanIds.splice(loanIdx, 1);
          }
          
          await supabase.from('borrow_requests').delete().eq('id', requestId);
          const reqIdx = createdRequestIds.indexOf(requestId);
          if (reqIdx > -1) createdRequestIds.splice(reqIdx, 1);
          
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
      { numRuns: 10 }
    );
  }, 180000);

  it('Property 9: State transition timestamps - Rejection records processed_at', async () => {
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
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 1, max: 999999 }),
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
        async (initialCopies, admissionSuffix, rejectionReason) => {
          const timestamp = Date.now();
          const timeBefore = new Date();
          
          const userAdmissionNo = `TEST_TS_REJ_USER_${timestamp}_${admissionSuffix}`;
          const userId = await createTestUser(userAdmissionNo);
          
          const adminAdmissionNo = `TEST_TS_REJ_ADMIN_${timestamp}_${admissionSuffix}`;
          const adminId = await createTestAdmin(adminAdmissionNo);
          
          const bookId = await createTestBook(initialCopies);
          const requestId = await createPendingRequest(userId, bookId);
          
          // Verify pending request has no processed_at
          const beforeRejection = await getRequestTimestamps(requestId);
          expect(beforeRejection).not.toBeNull();
          expect(beforeRejection!.status).toBe('pending');
          expect(beforeRejection!.processedAt).toBeNull();
          expect(beforeRejection!.processedBy).toBeNull();
          
          // Reject the request
          const result = await rejectBorrowRequest(requestId, adminId, rejectionReason);
          const timeAfter = new Date();
          
          if (!result.success) {
            throw new Error(`Rejection should succeed: ${result.error}`);
          }
          
          // PROPERTY ASSERTION: processed_at must be recorded
          const afterRejection = await getRequestTimestamps(requestId);
          expect(afterRejection).not.toBeNull();
          expect(afterRejection!.status).toBe('rejected');
          expect(afterRejection!.processedAt).not.toBeNull();
          expect(afterRejection!.processedBy).toBe(adminId);
          
          // Verify timestamp is reasonable (within a reasonable window)
          // Allow 5 second tolerance for clock drift between client and database server
          const processedAt = new Date(afterRejection!.processedAt!);
          expect(processedAt.getTime()).toBeGreaterThanOrEqual(timeBefore.getTime() - 5000);
          expect(processedAt.getTime()).toBeLessThanOrEqual(timeAfter.getTime() + 5000);
          
          // Cleanup
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
      { numRuns: 10 }
    );
  }, 180000);
});
