/**
 * Health Service Module
 * 
 * Aggregates health metrics from ingestion, maintenance, storage, and AI classification services.
 * Provides status calculation based on defined rules.
 * 
 * Requirements: 2.1-2.7, 3.1-3.6, 4.1-4.5, 5.1-5.5, 6.1-6.5
 */

import { createClient } from '@supabase/supabase-js';

let supabase = null;

/**
 * Initialize Supabase client
 * @param {string} url - Supabase URL
 * @param {string} key - Supabase service key
 */
export function initSupabase(url, key) {
  if (!url || !key) {
    throw new Error('Supabase URL and key are required');
  }
  supabase = createClient(url, key);
  return supabase;
}

/**
 * Get the Supabase client instance
 * @returns {Object} Supabase client
 */
export function getSupabase() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (url && key) {
      return initSupabase(url, key);
    }
    throw new Error('Supabase client not initialized. Call initSupabase() first.');
  }
  return supabase;
}

/**
 * Calculates system status based on timestamps and error counts
 * 
 * Rules:
 * - If last run failed, status is 'failed'
 * - If no run in 48 hours, status is 'warning'
 * - If more than 5 errors in 24 hours, status is 'warning'
 * - Otherwise, status is 'healthy'
 * 
 * @param {string|null} lastRunAt - ISO timestamp of last run
 * @param {string} lastRunStatus - Status of last run ('completed', 'failed', etc.)
 * @param {number} errorCount24h - Number of errors in last 24 hours
 * @returns {'healthy' | 'warning' | 'failed'} Calculated status
 */
export function calculateStatus(lastRunAt, lastRunStatus, errorCount24h) {
  // Rule 1: If last run failed, status is 'failed'
  if (lastRunStatus === 'failed') {
    return 'failed';
  }
  
  // Rule 2: If no run in 48 hours, status is 'warning'
  const hoursSinceLastRun = lastRunAt 
    ? (Date.now() - new Date(lastRunAt).getTime()) / (1000 * 60 * 60)
    : Infinity;
  
  if (hoursSinceLastRun > 48) {
    return 'warning';
  }
  
  // Rule 3: If more than 5 errors in 24 hours, status is 'warning'
  if (errorCount24h > 5) {
    return 'warning';
  }
  
  // Rule 4: Otherwise, status is 'healthy'
  return 'healthy';
}

/**
 * Gets the error count in the last 24 hours from ingestion_logs
 * @returns {Promise<number>} Error count
 */
async function getErrorCount24h() {
  const client = getSupabase();
  
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { count, error } = await client
      .from('ingestion_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('started_at', twentyFourHoursAgo);
    
    if (error) {
      console.error(`[HealthService] Error fetching error count: ${error.message}`);
      return 0;
    }
    
    return count || 0;
  } catch (err) {
    console.error(`[HealthService] Unexpected error fetching error count: ${err.message}`);
    return 0;
  }
}


/**
 * Gets system status for all services
 * @returns {Promise<Object>} System status object
 */
export async function getSystemStatus() {
  const client = getSupabase();
  
  try {
    // Get ingestion state
    const { data: ingestionState, error: stateError } = await client
      .from('ingestion_state')
      .select('last_run_at, last_run_status')
      .eq('source', 'internet_archive')
      .single();
    
    if (stateError && stateError.code !== 'PGRST116') {
      console.error(`[HealthService] Error fetching ingestion state: ${stateError.message}`);
    }
    
    // Get error count in last 24 hours
    const errorCount24h = await getErrorCount24h();
    
    // Calculate ingestion status
    const ingestionStatus = calculateStatus(
      ingestionState?.last_run_at || null,
      ingestionState?.last_run_status || 'idle',
      errorCount24h
    );
    
    // For maintenance and AI classification, we use similar logic
    // but based on available data (currently using ingestion as proxy)
    const maintenanceStatus = calculateStatus(
      ingestionState?.last_run_at || null,
      ingestionState?.last_run_status || 'idle',
      0 // Maintenance doesn't have separate error tracking yet
    );
    
    const aiClassificationStatus = calculateStatus(
      ingestionState?.last_run_at || null,
      ingestionState?.last_run_status || 'idle',
      errorCount24h
    );
    
    // Overall status is the worst of all statuses
    const statuses = [ingestionStatus, maintenanceStatus, aiClassificationStatus];
    let overall = 'healthy';
    if (statuses.includes('failed')) {
      overall = 'failed';
    } else if (statuses.includes('warning')) {
      overall = 'warning';
    }
    
    return {
      ingestion: ingestionStatus,
      maintenance: maintenanceStatus,
      aiClassification: aiClassificationStatus,
      overall
    };
  } catch (err) {
    console.error(`[HealthService] Unexpected error in getSystemStatus: ${err.message}`);
    return {
      ingestion: 'failed',
      maintenance: 'failed',
      aiClassification: 'failed',
      overall: 'failed'
    };
  }
}

/**
 * Gets daily metrics from ingestion logs
 * @returns {Promise<Object>} Daily metrics object
 */
export async function getDailyMetrics() {
  const client = getSupabase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString();
  
  try {
    // Get today's ingestion logs
    const { data: logs, error: logsError } = await client
      .from('ingestion_logs')
      .select('books_added, books_skipped, books_failed')
      .gte('started_at', todayISO)
      .lt('started_at', tomorrowISO);
    
    if (logsError) {
      console.error(`[HealthService] Error fetching daily logs: ${logsError.message}`);
    }
    
    // Aggregate counts from logs
    let booksIngested = 0;
    let booksSkipped = 0;
    let booksFailed = 0;
    
    if (logs && logs.length > 0) {
      logs.forEach(log => {
        booksIngested += log.books_added || 0;
        booksSkipped += log.books_skipped || 0;
        booksFailed += log.books_failed || 0;
      });
    }
    
    // Get books classified today (books with genres created today)
    const { count: classifiedCount, error: classifiedError } = await client
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('genres', 'is', null)
      .gte('created_at', todayISO)
      .lt('created_at', tomorrowISO);
    
    if (classifiedError) {
      console.error(`[HealthService] Error fetching classified count: ${classifiedError.message}`);
    }
    
    // Classification failures are approximated from failed ingestions
    // (since classification happens during ingestion)
    const classificationFailures = booksFailed;
    
    return {
      booksIngested: Math.max(0, booksIngested),
      booksSkipped: Math.max(0, booksSkipped),
      booksFailed: Math.max(0, booksFailed),
      booksClassified: Math.max(0, classifiedCount || 0),
      classificationFailures: Math.max(0, classificationFailures),
      date: todayISO.split('T')[0]
    };
  } catch (err) {
    console.error(`[HealthService] Unexpected error in getDailyMetrics: ${err.message}`);
    return {
      booksIngested: 0,
      booksSkipped: 0,
      booksFailed: 0,
      booksClassified: 0,
      classificationFailures: 0,
      date: todayISO.split('T')[0]
    };
  }
}


/**
 * Gets current ingestion progress from ingestion_state
 * @returns {Promise<Object>} Ingestion progress object
 */
export async function getIngestionProgress() {
  const client = getSupabase();
  
  try {
    const { data, error } = await client
      .from('ingestion_state')
      .select('source, last_page, last_cursor, total_ingested, last_run_at, last_run_status')
      .eq('source', 'internet_archive')
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error(`[HealthService] Error fetching ingestion progress: ${error.message}`);
    }
    
    if (!data) {
      return {
        source: 'internet_archive',
        lastPage: 1,
        lastCursor: null,
        totalIngested: 0,
        lastRunAt: null,
        lastRunStatus: 'idle'
      };
    }
    
    return {
      source: data.source,
      lastPage: data.last_page || 1,
      lastCursor: data.last_cursor || null,
      totalIngested: data.total_ingested || 0,
      lastRunAt: data.last_run_at || null,
      lastRunStatus: data.last_run_status || 'idle'
    };
  } catch (err) {
    console.error(`[HealthService] Unexpected error in getIngestionProgress: ${err.message}`);
    return {
      source: 'internet_archive',
      lastPage: 1,
      lastCursor: null,
      totalIngested: 0,
      lastRunAt: null,
      lastRunStatus: 'idle'
    };
  }
}

/**
 * Gets storage health metrics
 * @returns {Promise<Object>} Storage health object
 */
export async function getStorageHealth() {
  const client = getSupabase();
  
  try {
    // Get total PDFs count (books with pdf_url)
    const { count: totalPdfs, error: pdfError } = await client
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('pdf_url', 'is', null);
    
    if (pdfError) {
      console.error(`[HealthService] Error fetching PDF count: ${pdfError.message}`);
    }
    
    // Estimate storage usage (average PDF size ~5MB)
    const estimatedSizeMb = (totalPdfs || 0) * 5;
    
    // Orphaned files and corrupt files detection would require
    // storage bucket listing which is expensive - return null for now
    return {
      totalPdfs: Math.max(0, totalPdfs || 0),
      estimatedSizeMb: Math.max(0, estimatedSizeMb),
      orphanedFiles: null,
      corruptFiles: null
    };
  } catch (err) {
    console.error(`[HealthService] Unexpected error in getStorageHealth: ${err.message}`);
    return {
      totalPdfs: 0,
      estimatedSizeMb: 0,
      orphanedFiles: null,
      corruptFiles: null
    };
  }
}

/**
 * Sanitizes error message to remove sensitive data
 * @param {string} message - Raw error message
 * @returns {string} Sanitized message
 */
function sanitizeErrorMessage(message) {
  if (!message || typeof message !== 'string') {
    return 'Unknown error';
  }
  
  // Remove file paths
  let sanitized = message.replace(/[A-Za-z]:\\[^\s]+/g, '[path]');
  sanitized = sanitized.replace(/\/[^\s]+\/[^\s]+/g, '[path]');
  
  // Remove potential API keys (long alphanumeric strings)
  sanitized = sanitized.replace(/[a-zA-Z0-9]{32,}/g, '[redacted]');
  
  // Remove stack traces (lines starting with "at ")
  sanitized = sanitized.replace(/\s+at\s+.+/g, '');
  
  // Remove URLs with credentials
  sanitized = sanitized.replace(/https?:\/\/[^:]+:[^@]+@/g, 'https://[redacted]@');
  
  // Truncate to reasonable length
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200) + '...';
  }
  
  return sanitized.trim() || 'Unknown error';
}


/**
 * Gets recent errors and actions summary
 * @returns {Promise<Object>} Error summary object
 */
export async function getErrorSummary() {
  const client = getSupabase();
  
  try {
    // Get last 10 ingestion errors
    const { data: errorLogs, error: errorLogsError } = await client
      .from('ingestion_logs')
      .select('started_at, status, error_details')
      .not('error_details', 'is', null)
      .order('started_at', { ascending: false })
      .limit(10);
    
    if (errorLogsError) {
      console.error(`[HealthService] Error fetching error logs: ${errorLogsError.message}`);
    }
    
    // Format ingestion errors
    const ingestionErrors = (errorLogs || []).map(log => {
      // error_details can be an array or object
      let errorMessage = 'Unknown error';
      if (Array.isArray(log.error_details) && log.error_details.length > 0) {
        errorMessage = log.error_details[0]?.error || 'Unknown error';
      } else if (typeof log.error_details === 'object' && log.error_details !== null) {
        errorMessage = log.error_details.error || log.error_details.message || 'Unknown error';
      } else if (typeof log.error_details === 'string') {
        errorMessage = log.error_details;
      }
      
      return {
        timestamp: log.started_at,
        type: log.status || 'error',
        message: sanitizeErrorMessage(errorMessage)
      };
    });
    
    // Get last 10 maintenance actions (completed jobs)
    const { data: actionLogs, error: actionLogsError } = await client
      .from('ingestion_logs')
      .select('started_at, status, books_added, books_skipped, books_failed')
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(10);
    
    if (actionLogsError) {
      console.error(`[HealthService] Error fetching action logs: ${actionLogsError.message}`);
    }
    
    // Format maintenance actions
    const maintenanceActions = (actionLogs || []).map(log => ({
      timestamp: log.started_at,
      action: 'ingestion',
      result: `Added: ${log.books_added || 0}, Skipped: ${log.books_skipped || 0}, Failed: ${log.books_failed || 0}`
    }));
    
    // Get last AI classification error (from failed ingestions)
    const lastAiError = ingestionErrors.length > 0 ? ingestionErrors[0] : null;
    
    return {
      ingestionErrors,
      maintenanceActions,
      lastAiError
    };
  } catch (err) {
    console.error(`[HealthService] Unexpected error in getErrorSummary: ${err.message}`);
    return {
      ingestionErrors: [],
      maintenanceActions: [],
      lastAiError: null
    };
  }
}

/**
 * Fetches comprehensive health metrics from all sources
 * @returns {Promise<Object>} Complete health metrics object
 */
export async function getHealthMetrics() {
  try {
    const [systemStatus, dailyMetrics, ingestionProgress, storageHealth, errorSummary] = 
      await Promise.all([
        getSystemStatus(),
        getDailyMetrics(),
        getIngestionProgress(),
        getStorageHealth(),
        getErrorSummary()
      ]);
    
    return {
      systemStatus,
      dailyMetrics,
      ingestionProgress,
      storageHealth,
      errorSummary,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error(`[HealthService] Unexpected error in getHealthMetrics: ${err.message}`);
    throw err;
  }
}

export { sanitizeErrorMessage };
