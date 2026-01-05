/**
 * Property-Based Tests for Job State Transitions
 * **Feature: ai-book-extraction, Property 5: Job State Transitions**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 * 
 * This test verifies that extraction job state transitions follow valid paths:
 * - pending → running
 * - running → paused, completed, stopped, failed
 * - paused → running, stopped
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
let updateStatusFunctionAvailable = false;

// Valid job statuses
type JobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';

// Valid state transitions as defined in design document
const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  'pending': ['running'],
  'running': ['paused', 'completed', 'stopped', 'failed'],
  'paused': ['running', 'stopped'],
  'completed': [],
  'failed': [],
  'stopped': []
};

// All possible statuses
const ALL_STATUSES: JobStatus[] = ['pending', 'running', 'paused', 'completed', 'failed', 'stopped'];

// Test data tracking for cleanup
const createdJobIds: string[] = [];
const createdUserIds: string[] = [];

beforeAll(async () => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in .env.local');
  }
  supabase = createClient(supabaseUrl, supabaseKey);
  
  tableExists = await checkExtractionJobsTableExists();
  
  if (!tableExists) {
    console.warn('WARNING: extraction_jobs table does not exist.');
  }
  
  updateStatusFunctionAvailable = await checkUpdateStatusFunctionExists();
});

afterEach(async () => {
  // Clean up created jobs
  for (const jobId of createdJobIds) {
    await supabase.from('extraction_logs').delete().eq('job_id', jobId);
    await supabase.from('extracted_books').delete().eq('job_id', jobId);
    await supabase.from('extraction_jobs').delete().eq('id', jobId);
  }
  createdJobIds.length = 0;
});

afterAll(async () => {
  // Clean up created users
  for (const userId of createdUserIds) {
    await supabase.from('users').delete().eq('id', userId);
  }
  createdUserIds.length = 0;
});

async function checkExtractionJobsTableExists(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('extraction_jobs')
      .select('id')
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function checkUpdateStatusFunctionExists(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('update_extraction_job_status', {
      p_job_id: '00000000-0000-0000-0000-000000000000',
      p_new_status: 'running'
    });
    // Function exists if we don't get "Could not find the function" error
    return !error || !error.message.includes('Could not find the function');
  } catch {
    return false;
  }
}

async function createTestAdmin(): Promise<string> {
  const timestamp = Date.now();
  const { data, error } = await supabase
    .from('users')
    .insert({
      name: `Test Admin ${timestamp}`,
      email: `test_admin_${timestamp}@test.com`,
      admission_no: `TEST_ADMIN_${timestamp}`,
      password_hash: 'test_hash',
      role: 'Admin',
      max_books_allowed: 5
    })
    .select('id')
    .single();
  
  if (error) throw new Error(`Failed to create test admin: ${error.message}`);
  createdUserIds.push(data.id);
  return data.id;
}

async function createExtractionJob(adminId: string, initialStatus: JobStatus = 'pending'): Promise<string> {
  const timestamp = Date.now();
  const { data, error } = await supabase
    .from('extraction_jobs')
    .insert({
      source_url: `https://test-${timestamp}.example.com/books`,
      status: initialStatus,
      max_time_minutes: 60,
      max_books: 100,
      created_by: adminId
    })
    .select('id')
    .single();
  
  if (error) throw new Error(`Failed to create extraction job: ${error.message}`);
  createdJobIds.push(data.id);
  return data.id;
}

async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  const { data, error } = await supabase
    .from('extraction_jobs')
    .select('status')
    .eq('id', jobId)
    .single();
  
  if (error) return null;
  return data.status as JobStatus;
}

async function updateJobStatus(jobId: string, newStatus: JobStatus): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('update_extraction_job_status', {
    p_job_id: jobId,
    p_new_status: newStatus
  });
  
  if (error) throw new Error(`RPC error: ${error.message}`);
  
  return {
    success: data.success,
    error: data.error
  };
}

// Direct update for setting up test states (bypasses validation)
async function setJobStatusDirectly(jobId: string, status: JobStatus): Promise<void> {
  const { error } = await supabase
    .from('extraction_jobs')
    .update({ status })
    .eq('id', jobId);
  
  if (error) throw new Error(`Failed to set job status: ${error.message}`);
}

describe('Job State Transitions - Property Tests', () => {
  /**
   * **Feature: ai-book-extraction, Property 5: Job State Transitions**
   * **Validates: Requirements 5.1, 5.2, 5.3**
   * 
   * Property: For any extraction job, state transitions SHALL follow valid paths:
   * pending→running, running→paused, running→completed, running→stopped, 
   * running→failed, paused→running, paused→stopped.
   */
  it('Property 5: Valid state transitions are accepted', async () => {
    if (!tableExists) {
      throw new Error(
        'PREREQUISITE NOT MET: extraction_jobs table does not exist. ' +
        'Please run supabase_extraction_feature.sql in your Supabase SQL Editor first.'
      );
    }
    
    if (!updateStatusFunctionAvailable) {
      throw new Error(
        'PREREQUISITE NOT MET: update_extraction_job_status function does not exist. ' +
        'Please run supabase_extraction_feature.sql in your Supabase SQL Editor first.'
      );
    }

    // Generate all valid transitions as test cases
    const validTransitionPairs: Array<{ from: JobStatus; to: JobStatus }> = [];
    for (const [fromStatus, toStatuses] of Object.entries(VALID_TRANSITIONS)) {
      for (const toStatus of toStatuses) {
        validTransitionPairs.push({ from: fromStatus as JobStatus, to: toStatus });
      }
    }

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...validTransitionPairs),
        fc.integer({ min: 1, max: 999999 }),
        async (transition, suffix) => {
          const adminId = await createTestAdmin();
          const jobId = await createExtractionJob(adminId, 'pending');
          
          // Set up the initial state (bypass validation for setup)
          if (transition.from !== 'pending') {
            await setJobStatusDirectly(jobId, transition.from);
          }
          
          // Verify initial state
          const initialStatus = await getJobStatus(jobId);
          expect(initialStatus).toBe(transition.from);
          
          // Attempt the valid transition
          const result = await updateJobStatus(jobId, transition.to);
          
          // PROPERTY ASSERTION: Valid transitions must succeed
          expect(result.success).toBe(true);
          
          // Verify the status was updated
          const finalStatus = await getJobStatus(jobId);
          expect(finalStatus).toBe(transition.to);
          
          // Cleanup
          await supabase.from('extraction_logs').delete().eq('job_id', jobId);
          await supabase.from('extraction_jobs').delete().eq('id', jobId);
          const jobIdx = createdJobIds.indexOf(jobId);
          if (jobIdx > -1) createdJobIds.splice(jobIdx, 1);
          
          await supabase.from('users').delete().eq('id', adminId);
          const userIdx = createdUserIds.indexOf(adminId);
          if (userIdx > -1) createdUserIds.splice(userIdx, 1);
        }
      ),
      { numRuns: 20 }
    );
  }, 180000);

  /**
   * **Feature: ai-book-extraction, Property 5: Job State Transitions**
   * **Validates: Requirements 5.1, 5.2, 5.3**
   * 
   * Property: For any extraction job, invalid state transitions SHALL be rejected.
   */
  it('Property 5: Invalid state transitions are rejected', async () => {
    if (!tableExists) {
      throw new Error(
        'PREREQUISITE NOT MET: extraction_jobs table does not exist. ' +
        'Please run supabase_extraction_feature.sql in your Supabase SQL Editor first.'
      );
    }
    
    if (!updateStatusFunctionAvailable) {
      throw new Error(
        'PREREQUISITE NOT MET: update_extraction_job_status function does not exist. ' +
        'Please run supabase_extraction_feature.sql in your Supabase SQL Editor first.'
      );
    }

    // Generate all invalid transitions as test cases
    const invalidTransitionPairs: Array<{ from: JobStatus; to: JobStatus }> = [];
    for (const fromStatus of ALL_STATUSES) {
      const validTargets = VALID_TRANSITIONS[fromStatus];
      for (const toStatus of ALL_STATUSES) {
        if (!validTargets.includes(toStatus) && fromStatus !== toStatus) {
          invalidTransitionPairs.push({ from: fromStatus, to: toStatus });
        }
      }
    }

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...invalidTransitionPairs),
        fc.integer({ min: 1, max: 999999 }),
        async (transition, suffix) => {
          const adminId = await createTestAdmin();
          const jobId = await createExtractionJob(adminId, 'pending');
          
          // Set up the initial state (bypass validation for setup)
          if (transition.from !== 'pending') {
            await setJobStatusDirectly(jobId, transition.from);
          }
          
          // Verify initial state
          const initialStatus = await getJobStatus(jobId);
          expect(initialStatus).toBe(transition.from);
          
          // Attempt the invalid transition
          const result = await updateJobStatus(jobId, transition.to);
          
          // PROPERTY ASSERTION: Invalid transitions must fail
          expect(result.success).toBe(false);
          expect(result.error).toContain('Invalid status transition');
          
          // Verify the status was NOT changed
          const finalStatus = await getJobStatus(jobId);
          expect(finalStatus).toBe(transition.from);
          
          // Cleanup
          await supabase.from('extraction_logs').delete().eq('job_id', jobId);
          await supabase.from('extraction_jobs').delete().eq('id', jobId);
          const jobIdx = createdJobIds.indexOf(jobId);
          if (jobIdx > -1) createdJobIds.splice(jobIdx, 1);
          
          await supabase.from('users').delete().eq('id', adminId);
          const userIdx = createdUserIds.indexOf(adminId);
          if (userIdx > -1) createdUserIds.splice(userIdx, 1);
        }
      ),
      { numRuns: 30 }
    );
  }, 180000);

  /**
   * **Feature: ai-book-extraction, Property 5: Job State Transitions**
   * **Validates: Requirements 5.1 (pause preserves progress)**
   * 
   * Property: When a job is paused, it retains its current progress (books_extracted count).
   */
  it('Property 5: Pausing a job preserves progress', async () => {
    if (!tableExists) {
      throw new Error(
        'PREREQUISITE NOT MET: extraction_jobs table does not exist. ' +
        'Please run supabase_extraction_feature.sql in your Supabase SQL Editor first.'
      );
    }
    
    if (!updateStatusFunctionAvailable) {
      throw new Error(
        'PREREQUISITE NOT MET: update_extraction_job_status function does not exist. ' +
        'Please run supabase_extraction_feature.sql in your Supabase SQL Editor first.'
      );
    }

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 100 }),
        async (booksExtracted, booksQueued) => {
          const adminId = await createTestAdmin();
          const jobId = await createExtractionJob(adminId, 'pending');
          
          // Set up a running job with some progress
          await setJobStatusDirectly(jobId, 'running');
          await supabase
            .from('extraction_jobs')
            .update({ 
              books_extracted: booksExtracted,
              books_queued: booksQueued,
              started_at: new Date().toISOString()
            })
            .eq('id', jobId);
          
          // Pause the job
          const result = await updateJobStatus(jobId, 'paused');
          expect(result.success).toBe(true);
          
          // PROPERTY ASSERTION: Progress must be preserved after pause
          const { data: pausedJob } = await supabase
            .from('extraction_jobs')
            .select('status, books_extracted, books_queued')
            .eq('id', jobId)
            .single();
          
          expect(pausedJob?.status).toBe('paused');
          expect(pausedJob?.books_extracted).toBe(booksExtracted);
          expect(pausedJob?.books_queued).toBe(booksQueued);
          
          // Cleanup
          await supabase.from('extraction_logs').delete().eq('job_id', jobId);
          await supabase.from('extraction_jobs').delete().eq('id', jobId);
          const jobIdx = createdJobIds.indexOf(jobId);
          if (jobIdx > -1) createdJobIds.splice(jobIdx, 1);
          
          await supabase.from('users').delete().eq('id', adminId);
          const userIdx = createdUserIds.indexOf(adminId);
          if (userIdx > -1) createdUserIds.splice(userIdx, 1);
        }
      ),
      { numRuns: 15 }
    );
  }, 180000);

  /**
   * **Feature: ai-book-extraction, Property 5: Job State Transitions**
   * **Validates: Requirements 5.2 (resume continues from where it stopped)**
   * 
   * Property: When a paused job is resumed, it continues from where it stopped.
   */
  it('Property 5: Resuming a job continues from previous progress', async () => {
    if (!tableExists) {
      throw new Error(
        'PREREQUISITE NOT MET: extraction_jobs table does not exist. ' +
        'Please run supabase_extraction_feature.sql in your Supabase SQL Editor first.'
      );
    }
    
    if (!updateStatusFunctionAvailable) {
      throw new Error(
        'PREREQUISITE NOT MET: update_extraction_job_status function does not exist. ' +
        'Please run supabase_extraction_feature.sql in your Supabase SQL Editor first.'
      );
    }

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 100 }),
        async (booksExtracted, booksQueued) => {
          const adminId = await createTestAdmin();
          const jobId = await createExtractionJob(adminId, 'pending');
          
          // Set up a paused job with some progress
          await setJobStatusDirectly(jobId, 'paused');
          const startedAt = new Date(Date.now() - 60000); // Started 1 minute ago
          await supabase
            .from('extraction_jobs')
            .update({ 
              books_extracted: booksExtracted,
              books_queued: booksQueued,
              started_at: startedAt.toISOString()
            })
            .eq('id', jobId);
          
          // Resume the job
          const result = await updateJobStatus(jobId, 'running');
          expect(result.success).toBe(true);
          
          // PROPERTY ASSERTION: Progress must be preserved after resume
          const { data: resumedJob } = await supabase
            .from('extraction_jobs')
            .select('status, books_extracted, books_queued, started_at')
            .eq('id', jobId)
            .single();
          
          expect(resumedJob?.status).toBe('running');
          expect(resumedJob?.books_extracted).toBe(booksExtracted);
          expect(resumedJob?.books_queued).toBe(booksQueued);
          // started_at should be preserved (not reset) - compare as Date objects to handle timezone format differences
          const resumedStartedAt = new Date(resumedJob?.started_at);
          expect(resumedStartedAt.getTime()).toBe(startedAt.getTime());
          
          // Cleanup
          await supabase.from('extraction_logs').delete().eq('job_id', jobId);
          await supabase.from('extraction_jobs').delete().eq('id', jobId);
          const jobIdx = createdJobIds.indexOf(jobId);
          if (jobIdx > -1) createdJobIds.splice(jobIdx, 1);
          
          await supabase.from('users').delete().eq('id', adminId);
          const userIdx = createdUserIds.indexOf(adminId);
          if (userIdx > -1) createdUserIds.splice(userIdx, 1);
        }
      ),
      { numRuns: 15 }
    );
  }, 180000);

  /**
   * **Feature: ai-book-extraction, Property 5: Job State Transitions**
   * **Validates: Requirements 5.3, 5.4 (stop retains extracted books)**
   * 
   * Property: When a job is stopped, all books extracted before stopping are retained.
   */
  it('Property 5: Stopping a job retains extracted books', async () => {
    if (!tableExists) {
      throw new Error(
        'PREREQUISITE NOT MET: extraction_jobs table does not exist. ' +
        'Please run supabase_extraction_feature.sql in your Supabase SQL Editor first.'
      );
    }
    
    if (!updateStatusFunctionAvailable) {
      throw new Error(
        'PREREQUISITE NOT MET: update_extraction_job_status function does not exist. ' +
        'Please run supabase_extraction_feature.sql in your Supabase SQL Editor first.'
      );
    }

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (bookCount) => {
          const adminId = await createTestAdmin();
          const jobId = await createExtractionJob(adminId, 'pending');
          
          // Set up a running job
          await setJobStatusDirectly(jobId, 'running');
          await supabase
            .from('extraction_jobs')
            .update({ 
              books_extracted: bookCount,
              started_at: new Date().toISOString()
            })
            .eq('id', jobId);
          
          // Add some extracted books
          const extractedBookIds: string[] = [];
          for (let i = 0; i < bookCount; i++) {
            const { data: book } = await supabase
              .from('extracted_books')
              .insert({
                job_id: jobId,
                title: `Test Book ${i}`,
                author: `Test Author ${i}`,
                pdf_url: `https://example.com/book${i}.pdf`,
                source_pdf_url: `https://source.com/book${i}.pdf`,
                status: 'completed'
              })
              .select('id')
              .single();
            if (book) extractedBookIds.push(book.id);
          }
          
          // Stop the job
          const result = await updateJobStatus(jobId, 'stopped');
          expect(result.success).toBe(true);
          
          // PROPERTY ASSERTION: All extracted books must be retained
          const { data: books } = await supabase
            .from('extracted_books')
            .select('id')
            .eq('job_id', jobId);
          
          expect(books?.length).toBe(bookCount);
          
          // Verify job status
          const { data: stoppedJob } = await supabase
            .from('extraction_jobs')
            .select('status, books_extracted, completed_at')
            .eq('id', jobId)
            .single();
          
          expect(stoppedJob?.status).toBe('stopped');
          expect(stoppedJob?.books_extracted).toBe(bookCount);
          expect(stoppedJob?.completed_at).not.toBeNull();
          
          // Cleanup
          await supabase.from('extracted_books').delete().eq('job_id', jobId);
          await supabase.from('extraction_logs').delete().eq('job_id', jobId);
          await supabase.from('extraction_jobs').delete().eq('id', jobId);
          const jobIdx = createdJobIds.indexOf(jobId);
          if (jobIdx > -1) createdJobIds.splice(jobIdx, 1);
          
          await supabase.from('users').delete().eq('id', adminId);
          const userIdx = createdUserIds.indexOf(adminId);
          if (userIdx > -1) createdUserIds.splice(userIdx, 1);
        }
      ),
      { numRuns: 10 }
    );
  }, 180000);
});
