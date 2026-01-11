/**
 * Manual Trigger Endpoint for Public Domain Book Ingestion
 * 
 * Handles POST requests to manually trigger ingestion with optional parameters.
 * 
 * Requirements: 9.1, 9.2, 9.4
 * - 9.1: Exposes API endpoint for manual ingestion triggers
 * - 9.2: Accepts optional parameters for batch size and dry-run mode
 * - 9.4: Returns job status including books processed, added, skipped, and failed
 */

import { runIngestionJob, initializeServices, DEFAULT_BATCH_SIZE } from '../../services/ingestion/orchestrator.js';

/**
 * Vercel Serverless Function Handler
 * @param {Request} req - Incoming request
 * @param {Response} res - Outgoing response
 */
export default async function handler(req, res) {
  // Only allow POST requests for manual triggers
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests'
    });
  }

  // Optional: Verify admin authorization
  // In production, you might want to add authentication here
  const authHeader = req.headers['authorization'];
  const adminSecret = process.env.ADMIN_INGEST_SECRET;
  
  // If ADMIN_INGEST_SECRET is set, verify the authorization header
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

    // Parse optional parameters from request body (Requirement 9.2)
    const { batchSize, dryRun, page } = req.body || {};

    // Validate and sanitize parameters
    const options = {
      batchSize: typeof batchSize === 'number' && batchSize > 0 && batchSize <= 100 
        ? batchSize 
        : DEFAULT_BATCH_SIZE,
      dryRun: typeof dryRun === 'boolean' ? dryRun : false,
      page: typeof page === 'number' && page > 0 ? page : 1
    };

    console.log(`[Ingest Trigger] Starting ingestion with options:`, options);

    // Run the ingestion job
    const result = await runIngestionJob(options);

    // Calculate duration
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    console.log(`[Ingest Trigger] Job completed in ${durationMs}ms`);
    console.log(`[Ingest Trigger] Results: processed=${result.processed}, added=${result.added}, skipped=${result.skipped}, failed=${result.failed}`);

    // Return job status (Requirement 9.4)
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
        dryRun: options.dryRun,
        page: options.page
      },
      summary: {
        processed: result.processed,
        added: result.added,
        skipped: result.skipped,
        failed: result.failed
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
