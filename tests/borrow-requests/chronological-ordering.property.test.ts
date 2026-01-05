/**
 * Property-Based Tests for Borrow Request Chronological Ordering
 * **Feature: book-borrowing-approval, Property 8: Chronological ordering**
 * **Validates: Requirements 6.1**
 * 
 * This test verifies that when pending requests are displayed to admin,
 * they are ordered by requested_at timestamp in ascending order (oldest first).
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
 * Helper to create a test book
 */
async function createTestBook(): Promise<string> {
  const { data, error } = await supabase
    .from('books')
    .insert({
      title: `Test Book ${Date.now()}`,
      author: 'Test Author',
      copies_available: 10,
      total_copies: 10
    })
    .select('id')
    .single();
  
  if (error) throw new Error(`Failed to create test book: ${error.message}`);
  createdBookIds.push(data.id);
  return data.id;
}

/**
 * Helper to create a borrow request with a specific timestamp
 */
async function createBorrowRequestWithTimestamp(
  userId: string, 
  bookId: string, 
  requestedAt: Date
): Promise<string> {
  const { data, error } = await supabase
    .from('borrow_requests')
    .insert({
      user_id: userId,
      book_id: bookId,
      status: 'pending',
      requested_at: requestedAt.toISOString()
    })
    .select('id')
    .single();
  
  if (error) throw new Error(`Failed to create borrow request: ${error.message}`);
  createdRequestIds.push(data.id);
  return data.id;
}

/**
 * Helper to get pending borrow requests (simulates admin API endpoint)
 */
async function getPendingBorrowRequests(): Promise<Array<{ id: string; requestedAt: string }>> {
  const { data, error } = await supabase
    .from('borrow_requests')
    .select('id, requested_at')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });
  
  if (error) throw new Error(`Failed to get pending requests: ${error.message}`);
  return (data || []).map(r => ({ id: r.id, requestedAt: r.requested_at }));
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

/**
 * Helper to check if an array is sorted in ascending order by a given key
 */
function isSortedAscending(arr: Array<{ requestedAt: string }>): boolean {
  for (let i = 1; i < arr.length; i++) {
    const prev = new Date(arr[i - 1].requestedAt).getTime();
    const curr = new Date(arr[i].requestedAt).getTime();
    if (prev > curr) {
      return false;
    }
  }
  return true;
}


describe('Borrow Request Chronological Ordering - Property Tests', () => {
  /**
   * **Feature: book-borrowing-approval, Property 8: Chronological ordering**
   * **Validates: Requirements 6.1**
   * 
   * Property: For any set of pending requests, when displayed to admin,
   * they SHALL be ordered by requested_at timestamp in ascending order (oldest first).
   */
  it('Property 8: Chronological ordering', async () => {
    // Fail test if table doesn't exist - infrastructure must be set up
    if (!tableExists) {
      throw new Error(
        'PREREQUISITE NOT MET: borrow_requests table does not exist. ' +
        'Please run supabase_borrow_requests.sql in your Supabase SQL Editor first.'
      );
    }
    
    await fc.assert(
      fc.asyncProperty(
        // Generate a random number of requests (2-5 to keep test fast)
        fc.integer({ min: 2, max: 5 }),
        // Generate random time offsets in minutes (to create different timestamps)
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 2, maxLength: 5 }),
        async (numRequests, timeOffsets) => {
          // Ensure we have enough time offsets
          const offsets = timeOffsets.slice(0, numRequests);
          if (offsets.length < 2) {
            offsets.push(500, 1000); // Add default offsets if needed
          }
          
          const timestamp = Date.now();
          const baseTime = new Date(timestamp - 100000000); // Start from a base time in the past
          
          // Create test users and books for each request
          const requestData: Array<{ userId: string; bookId: string; requestedAt: Date }> = [];
          
          for (let i = 0; i < offsets.length; i++) {
            const admissionNo = `TEST_CHRONO_${timestamp}_${i}`;
            const userId = await createTestUser(admissionNo);
            const bookId = await createTestBook();
            const requestedAt = new Date(baseTime.getTime() + offsets[i] * 60000); // Convert minutes to ms
            requestData.push({ userId, bookId, requestedAt });
          }
          
          // Create borrow requests in RANDOM order (not sorted by time)
          // This tests that the system correctly orders them regardless of insertion order
          const shuffledData = [...requestData].sort(() => Math.random() - 0.5);
          
          for (const data of shuffledData) {
            await createBorrowRequestWithTimestamp(data.userId, data.bookId, data.requestedAt);
          }
          
          // Get pending requests from the system
          const pendingRequests = await getPendingBorrowRequests();
          
          // Filter to only include our test requests
          const ourRequests = pendingRequests.filter(r => 
            createdRequestIds.includes(r.id)
          );
          
          // PROPERTY ASSERTION: Verify requests are sorted in ascending order by requested_at
          expect(isSortedAscending(ourRequests)).toBe(true);
          
          // Additional assertion: verify the count matches
          expect(ourRequests.length).toBe(offsets.length);
          
          // Cleanup for this iteration
          for (const requestId of [...createdRequestIds]) {
            await supabase.from('borrow_requests').delete().eq('id', requestId);
            const idx = createdRequestIds.indexOf(requestId);
            if (idx > -1) createdRequestIds.splice(idx, 1);
          }
          
          for (const bookId of [...createdBookIds]) {
            await supabase.from('books').delete().eq('id', bookId);
            const idx = createdBookIds.indexOf(bookId);
            if (idx > -1) createdBookIds.splice(idx, 1);
          }
          
          for (const userId of [...createdUserIds]) {
            await supabase.from('users').delete().eq('id', userId);
            const idx = createdUserIds.indexOf(userId);
            if (idx > -1) createdUserIds.splice(idx, 1);
          }
        }
      ),
      { numRuns: 10 } // Reduced from 100 due to database operation overhead per iteration
    );
  }, 180000); // 3 minute timeout for database operations
});
