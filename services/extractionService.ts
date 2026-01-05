/**
 * Extraction Service
 * 
 * Manages extraction job lifecycle including creation, starting, pausing,
 * resuming, and stopping jobs. Handles job state transitions with validation
 * and enforces time and book count limits.
 * 
 * Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2, 5.3, 5.4
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Default limits as specified in Requirements 2.6
export const DEFAULT_MAX_TIME_MINUTES = 60;
export const DEFAULT_MAX_BOOKS = 100;

/**
 * Job status types
 */
export type JobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';

/**
 * Valid state transitions as defined in design document
 * Property 5: Job State Transitions
 * Requirements: 5.1, 5.2, 5.3
 */
export const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  'pending': ['running'],
  'running': ['paused', 'completed', 'stopped', 'failed'],
  'paused': ['running', 'stopped'],
  'completed': [],
  'failed': [],
  'stopped': []
};

/**
 * Extraction job structure
 */
export interface ExtractionJob {
  id: string;
  sourceUrl: string;
  status: JobStatus;
  maxTimeMinutes: number;
  maxBooks: number;
  booksExtracted: number;
  booksQueued: number;
  errorCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdBy: string;
  createdAt: string;
}

/**
 * Options for creating a new extraction job
 * Requirements: 2.1, 2.2, 2.6
 */
export interface JobOptions {
  maxTimeMinutes?: number;  // Default: 60 (Requirement 2.6)
  maxBooks?: number;        // Default: 100 (Requirement 2.6)
}

/**
 * Extraction progress information
 * Requirements: 4.1, 4.2, 4.3
 */
export interface ExtractionProgress {
  jobId: string;
  status: JobStatus;
  booksExtracted: number;
  booksQueued: number;
  errorCount: number;
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
  maxTimeMinutes: number;
  maxBooks: number;
}

/**
 * Extracted book structure
 */
export interface ExtractedBook {
  id: string;
  jobId: string;
  title: string;
  author: string;
  description: string;
  synopsis: string;
  categoryId: string | null;
  categoryName: string | null;
  coverUrl: string;
  pdfUrl: string;
  sourcePdfUrl: string;
  status: 'processing' | 'completed' | 'failed' | 'published';
  errorMessage: string | null;
  extractedAt: string;
  publishedAt: string | null;
}

/**
 * Extraction log entry
 */
export interface ExtractionLog {
  id: string;
  jobId: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Validates if a state transition is allowed
 * Property 5: Job State Transitions
 * Requirements: 5.1, 5.2, 5.3
 * 
 * @param fromStatus - Current job status
 * @param toStatus - Target job status
 * @returns true if the transition is valid
 */
export function isValidTransition(fromStatus: JobStatus, toStatus: JobStatus): boolean {
  const validTargets = VALID_TRANSITIONS[fromStatus];
  return validTargets.includes(toStatus);
}

/**
 * Applies default limits when not specified
 * Property 8: Default Limits Application
 * Requirement 2.6
 * 
 * @param options - User-provided options
 * @returns Options with defaults applied
 */
export function applyDefaultLimits(options: JobOptions = {}): Required<JobOptions> {
  return {
    maxTimeMinutes: options.maxTimeMinutes ?? DEFAULT_MAX_TIME_MINUTES,
    maxBooks: options.maxBooks ?? DEFAULT_MAX_BOOKS
  };
}

/**
 * Checks if a job has reached its time limit
 * Property 1: Job Limit Enforcement
 * Requirement 2.3
 * 
 * @param job - The extraction job
 * @returns true if time limit is reached
 */
export function hasReachedTimeLimit(job: ExtractionJob): boolean {
  if (!job.startedAt) return false;
  
  const startTime = new Date(job.startedAt).getTime();
  const now = Date.now();
  const elapsedMinutes = (now - startTime) / (1000 * 60);
  
  return elapsedMinutes >= job.maxTimeMinutes;
}

/**
 * Checks if a job has reached its book count limit
 * Property 1: Job Limit Enforcement
 * Requirement 2.4
 * 
 * @param job - The extraction job
 * @returns true if book limit is reached
 */
export function hasReachedBookLimit(job: ExtractionJob): boolean {
  return job.booksExtracted >= job.maxBooks;
}

/**
 * Checks if a job should stop due to any limit
 * Property 1: Job Limit Enforcement
 * Requirement 2.5: Stop when either limit is reached first
 * 
 * @param job - The extraction job
 * @returns true if any limit is reached
 */
export function shouldStopJob(job: ExtractionJob): boolean {
  return hasReachedTimeLimit(job) || hasReachedBookLimit(job);
}

/**
 * Creates a new extraction job
 * Requirements: 1.1, 2.1, 2.2, 2.6
 * 
 * @param sourceUrl - The URL to crawl for PDFs
 * @param adminId - The ID of the admin creating the job
 * @param options - Optional job configuration
 * @returns The created extraction job
 */
export async function createJob(
  sourceUrl: string,
  adminId: string,
  options: JobOptions = {}
): Promise<ExtractionJob> {
  const limits = applyDefaultLimits(options);
  
  const response = await fetch(`${API_URL}/admin/extractions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceUrl,
      adminId,
      maxTimeMinutes: limits.maxTimeMinutes,
      maxBooks: limits.maxBooks
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create extraction job');
  }

  const data = await response.json();
  return mapJobFromApi(data.job);
}

/**
 * Starts a pending extraction job
 * Requirement 5.1 (via state transition)
 * 
 * @param jobId - The ID of the job to start
 */
export async function startJob(jobId: string): Promise<void> {
  const response = await fetch(`${API_URL}/admin/extractions/${jobId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start extraction job');
  }
}

/**
 * Pauses a running extraction job
 * Requirement 5.1: Suspend processing and retain current progress
 * 
 * @param jobId - The ID of the job to pause
 */
export async function pauseJob(jobId: string): Promise<void> {
  const response = await fetch(`${API_URL}/admin/extractions/${jobId}/pause`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to pause extraction job');
  }
}

/**
 * Resumes a paused extraction job
 * Requirement 5.2: Continue processing from where it stopped
 * 
 * @param jobId - The ID of the job to resume
 */
export async function resumeJob(jobId: string): Promise<void> {
  const response = await fetch(`${API_URL}/admin/extractions/${jobId}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to resume extraction job');
  }
}

/**
 * Stops a running or paused extraction job
 * Requirements 5.3, 5.4: Terminate and retain all extracted books
 * 
 * @param jobId - The ID of the job to stop
 */
export async function stopJob(jobId: string): Promise<void> {
  const response = await fetch(`${API_URL}/admin/extractions/${jobId}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to stop extraction job');
  }
}

/**
 * Gets the current progress of an extraction job
 * Requirements: 4.1, 4.2, 4.3
 * 
 * @param jobId - The ID of the job
 * @returns The job progress information
 */
export async function getJobProgress(jobId: string): Promise<ExtractionProgress> {
  const response = await fetch(`${API_URL}/admin/extractions/${jobId}/progress`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get job progress');
  }

  const data = await response.json();
  return {
    jobId: data.job_id,
    status: data.status,
    booksExtracted: data.books_extracted,
    booksQueued: data.books_queued,
    errorCount: data.error_count,
    elapsedSeconds: data.elapsed_seconds,
    estimatedRemainingSeconds: data.estimated_remaining_seconds,
    maxTimeMinutes: data.max_time_minutes,
    maxBooks: data.max_books
  };
}

/**
 * Gets the extraction job history for an admin
 * Requirement 6.1
 * 
 * @param adminId - The ID of the admin (optional, returns all if not specified)
 * @returns List of extraction jobs
 */
export async function getJobHistory(adminId?: string): Promise<ExtractionJob[]> {
  const url = adminId 
    ? `${API_URL}/admin/extractions?adminId=${adminId}`
    : `${API_URL}/admin/extractions`;
    
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get job history');
  }

  const data = await response.json();
  return data.map(mapJobFromApi);
}

/**
 * Gets a specific extraction job by ID
 * 
 * @param jobId - The ID of the job
 * @returns The extraction job
 */
export async function getJob(jobId: string): Promise<ExtractionJob> {
  const response = await fetch(`${API_URL}/admin/extractions/${jobId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get extraction job');
  }

  const data = await response.json();
  return mapJobFromApi(data);
}

/**
 * Gets the extracted books for a job
 * Requirement 6.3
 * 
 * @param jobId - The ID of the job
 * @returns List of extracted books
 */
export async function getExtractedBooks(jobId: string): Promise<ExtractedBook[]> {
  const response = await fetch(`${API_URL}/admin/extractions/${jobId}/books`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get extracted books');
  }

  const data = await response.json();
  return data.map(mapBookFromApi);
}

/**
 * Deletes an extraction job
 * Requirement 6.4
 * 
 * @param jobId - The ID of the job to delete
 */
export async function deleteJob(jobId: string): Promise<void> {
  const response = await fetch(`${API_URL}/admin/extractions/${jobId}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete extraction job');
  }
}

/**
 * Gets the logs for an extraction job
 * Requirement 4.4
 * 
 * @param jobId - The ID of the job
 * @param limit - Maximum number of logs to return
 * @returns List of extraction logs
 */
export async function getJobLogs(jobId: string, limit: number = 100): Promise<ExtractionLog[]> {
  const response = await fetch(`${API_URL}/admin/extractions/${jobId}/logs?limit=${limit}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get job logs');
  }

  const data = await response.json();
  return data.map(mapLogFromApi);
}

/**
 * Calculates the expected books_extracted count based on extracted books
 * Property 6: Progress Counter Accuracy
 * Requirements: 4.1, 4.3
 * 
 * The count should equal the number of books with status 'completed' or 'published'.
 * 
 * @param books - List of extracted books for a job
 * @returns The expected books_extracted count
 */
export function calculateExpectedBooksExtracted(books: ExtractedBook[]): number {
  return books.filter(book => 
    book.status === 'completed' || book.status === 'published'
  ).length;
}

/**
 * Checks if a job's progress counter is accurate
 * Property 6: Progress Counter Accuracy
 * Requirements: 4.1, 4.3
 * 
 * The job's booksExtracted count should equal the number of extracted_books
 * records with status 'completed' or 'published'.
 * 
 * @param job - The extraction job
 * @param books - List of extracted books for the job
 * @returns true if the counter is accurate
 */
export function isProgressCounterAccurate(job: ExtractionJob, books: ExtractedBook[]): boolean {
  const expectedCount = calculateExpectedBooksExtracted(books);
  return job.booksExtracted === expectedCount;
}

// Helper function to map API response to ExtractionJob
function mapJobFromApi(data: Record<string, unknown>): ExtractionJob {
  return {
    id: data.id as string,
    sourceUrl: data.source_url as string,
    status: data.status as JobStatus,
    maxTimeMinutes: data.max_time_minutes as number,
    maxBooks: data.max_books as number,
    booksExtracted: data.books_extracted as number,
    booksQueued: data.books_queued as number,
    errorCount: data.error_count as number,
    startedAt: data.started_at as string | null,
    completedAt: data.completed_at as string | null,
    createdBy: data.created_by as string,
    createdAt: data.created_at as string
  };
}

// Helper function to map API response to ExtractedBook
function mapBookFromApi(data: Record<string, unknown>): ExtractedBook {
  return {
    id: data.id as string,
    jobId: data.job_id as string,
    title: data.title as string,
    author: data.author as string,
    description: data.description as string,
    synopsis: data.synopsis as string,
    categoryId: data.category_id as string | null,
    categoryName: data.category_name as string | null,
    coverUrl: data.cover_url as string,
    pdfUrl: data.pdf_url as string,
    sourcePdfUrl: data.source_pdf_url as string,
    status: data.status as ExtractedBook['status'],
    errorMessage: data.error_message as string | null,
    extractedAt: data.extracted_at as string,
    publishedAt: data.published_at as string | null
  };
}

// Helper function to map API response to ExtractionLog
function mapLogFromApi(data: Record<string, unknown>): ExtractionLog {
  return {
    id: data.id as string,
    jobId: data.job_id as string,
    level: data.level as ExtractionLog['level'],
    message: data.message as string,
    details: data.details as Record<string, unknown> | null,
    createdAt: data.created_at as string
  };
}

// Default export for the service
export const extractionService = {
  // Constants
  DEFAULT_MAX_TIME_MINUTES,
  DEFAULT_MAX_BOOKS,
  VALID_TRANSITIONS,
  
  // Validation functions
  isValidTransition,
  applyDefaultLimits,
  hasReachedTimeLimit,
  hasReachedBookLimit,
  shouldStopJob,
  calculateExpectedBooksExtracted,
  isProgressCounterAccurate,
  
  // Job lifecycle methods
  createJob,
  startJob,
  pauseJob,
  resumeJob,
  stopJob,
  
  // Query methods
  getJob,
  getJobProgress,
  getJobHistory,
  getExtractedBooks,
  getJobLogs,
  deleteJob
};
