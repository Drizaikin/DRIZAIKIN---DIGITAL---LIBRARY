/**
 * Property-Based Tests for Due Date Calculation
 * **Feature: book-borrowing-approval, Property 5: Approval sets correct due date**
 * **Validates: Requirements 4.3**
 * 
 * This test verifies that when a borrow request is approved:
 * - The resulting loan's due date is exactly 14 days from the approval timestamp
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

// 14 days in milliseconds
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
// Tolerance for timing differences (5 minutes)
const TOLERANCE_MS = 5 * 60 * 1000;

beforeAll(async () => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in .env.local');
  }
  supabase = createClient(supabaseUrl, supabaseKey);
  
  tableExists = await checkBorrowRequestsTableExists();
  
  if (!tableExists) {
    console.warn('WARNING: borrow_requests table does not exist. Please run supabase_borrow_requests.sql first.');
  }
  
  approveFunctionAvailable = await checkApproveFunctionExists();
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
    const { error } = await supabase.from('borrow_requests').select('id').limit(1);
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

async function getLoanById(loanId: string): Promise<{ id: string; dueDate: string; createdAt: string } | null> {
  const { data, error } = await supabase
    .from('loans')
    .select('id, due_date, created_at')
    .eq('id', loanId)
    .single();
  
  if (error || !data) return null;
  return { id: data.id, dueDate: data.due_date, createdAt: data.created_at };
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


describe('Due Date Calculation - Property Tests', () => {
  /**
   * **Feature: book-borrowing-approval, Property 5: Approval sets correct due date**
   * **Validates: Requirements 4.3**
   * 
   * Property: For any approved borrow request, the resulting loan's due date
   * SHALL be exactly 14 days from the approval timestamp.
   */
  it('Property 5: Approval sets correct due date', async () => {
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
          
          const userAdmissionNo = `TEST_DUE_USER_${timestamp}_${admissionSuffix}`;
          const userId = await createTestUser(userAdmissionNo);
          
          const adminAdmissionNo = `TEST_DUE_ADMIN_${timestamp}_${admissionSuffix}`;
          const adminId = await createTestAdmin(adminAdmissionNo);
          
          const bookId = await createTestBook(initialCopies);
          const requestId = await createPendingRequest(userId, bookId);
          
          // Record time just before approval
          const approvalTimeStart = new Date();
          
          const result = await approveBorrowRequest(requestId, adminId);
          
          // Record time just after approval
          const approvalTimeEnd = new Date();
          
          if (!result.success) {
            throw new Error(`Approval should succeed: ${result.error}`);
          }
          
          // Get the loan details
          const loan = await getLoanById(result.loanId!);
          expect(loan).not.toBeNull();
          
          const dueDate = new Date(loan!.dueDate);
          
          // Calculate expected due date range (14 days from approval window)
          const expectedDueDateMin = new Date(approvalTimeStart.getTime() + FOURTEEN_DAYS_MS - TOLERANCE_MS);
          const expectedDueDateMax = new Date(approvalTimeEnd.getTime() + FOURTEEN_DAYS_MS + TOLERANCE_MS);
          
          // PROPERTY ASSERTION: Due date should be 14 days from approval (within tolerance)
          expect(dueDate.getTime()).toBeGreaterThanOrEqual(expectedDueDateMin.getTime());
          expect(dueDate.getTime()).toBeLessThanOrEqual(expectedDueDateMax.getTime());
          
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
});
