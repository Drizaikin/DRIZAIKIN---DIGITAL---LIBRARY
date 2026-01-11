/**
 * Manual Trigger Endpoint for Public Domain Book Ingestion
 * 
 * Handles POST requests to manually trigger ingestion with optional parameters.
 * Uses the same stateful continuation logic as the cron job.
 * 
 * Requirements: 9.1, 9.2, 9.4
 */

import { runIngestionJob, initializeServices, MAX_BOOKS_PER_RUN } from '../../services/ingestion/orchestrator.js';
import { getIngestionState, resetIngestionState, initSupabase as initState } from '../../services/ingestion/stateManager.js';

/**
 * Vercel Serverless Function Handler
 * @param {Request} req - Incoming request
 * @param {Response} res - Outgoing response
 */
export default async function handler(req, res) {
  // Handle GET for status check
  if (req.method === 'GET') {
    return await handleStatusCheck(req, res);
  }
  
  // Only allow POST requests for manual triggers
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint accepts GET (status) or POST (trigger) requests'
    });
  }

  // Optional: Verify admin authorization
  const authHeader = req.headers['authorization'];
  const adminSecret = process.env.ADMIN_INGEST_SECRET;
  
  if (adminSecret && authHeader !== `Bearer ${adminSecret}`) {
    console.warn('[Ingest Trigger] Unauthorized manual trigger attempt');
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid or missing authorization'
    });
  }

  const startTime = new Date();
  console.log(`[Ingest Trigger] Manual trigger received at ${startTime.toISOString()}`);

  try {
    // Initialize Supabase services
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Ingest Trigger] Missing Supabase configuration');
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Database configuration missing'
      });
    }

    initializeServices(supabaseUrl, supabaseKey);

    // Parse optional parameters from request body
    const { batchSize, maxBooks, dryRun, startPage, reset } = req.body || {};

    // Handle reset request
    if (reset === true) {
      console.log('[Ingest Trigger] Resetting ingestion state to page 1');
      initState(supabaseUrl, supabaseKey);
      await resetIngestionState('internet_archive');
      return res.status(200).json({
        success: true,
        message: 'Ingestion state reset to page 1',
        timestamp: new Date().toISOString()
      });
    }

    // Validate and sanitize parameters
    const options = {
      batchSize: typeof batchSize === 'number' && batchSize > 0 && batchSize <= 100 
        ? batchSize 
        : 50,
      maxBooks: typeof maxBooks === 'number' && maxBooks > 0 && maxBooks <= 500
        ? maxBooks
        : MAX_BOOKS_PER_RUN,
      dryRun: typeof dryRun === 'boolean' ? dryRun : false,
      startPage: typeof startPage === 'number' && startPage > 0 ? startPage : undefined
    };

    console.log(`[Ingest Trigger] Starting ingestion with options:`, options);

    // Run the ingestion job
    const result = await runIngestionJob(options);

    // Calculate duration
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    console.log(`[Ingest Trigger] Job completed in ${durationMs}ms`);

    // Return job status
    return res.status(200).json({
      success: true,
      jobId: result.jobId,
      status: result.status,
      dryRun: options.dryRun,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs,
      options: {
        batchSize: options.batchSize,
        maxBooks: options.maxBooks,
        dryRun: options.dryRun,
        startPage: options.startPage
      },
      summary: {
        processed: result.processed,
        added: result.added,
        skipped: result.skipped,
        failed: result.failed
      },
      continuation: {
        nextPage: result.nextPage,
        lastCursor: result.lastCursor
      },
      errors: result.errors.length > 0 ? result.errors : undefined
    });

  } catch (error) {
    console.error(`[Ingest Trigger] Critical error: ${error.message}`);
    console.error(error.stack);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle GET request for status check
 */
async function handleStatusCheck(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Database configuration missing'
      });
    }

    initState(supabaseUrl, supabaseKey);
    const state = await getIngestionState('internet_archive');

    return res.status(200).json({
      success: true,
      source: 'internet_archive',
      state: {
        currentPage: state.last_page,
        totalIngested: state.total_ingested,
        lastRunAt: state.last_run_at,
        lastRunStatus: state.last_run_status,
        lastRunStats: {
          added: state.last_run_added,
          skipped: state.last_run_skipped,
          failed: state.last_run_failed
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[Ingest Trigger] Status check error: ${error.message}`);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
