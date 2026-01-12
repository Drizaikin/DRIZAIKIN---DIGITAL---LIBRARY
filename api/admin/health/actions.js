/**
 * Admin Health Actions API Endpoint
 * 
 * POST /api/admin/health/actions - Triggers admin actions
 * 
 * Requirements: 7.1-7.7
 * - 7.1: Provide button to trigger ingestion manually
 * - 7.2: Provide button to trigger maintenance manually
 * - 7.3: Provide button to pause ingestion
 * - 7.4: Provide button to resume ingestion
 * - 7.5: Log action with timestamp and admin identifier
 * - 7.6: Reuse existing ingestion and maintenance logic
 * - 7.7: No destructive actions
 */

import { createClient } from '@supabase/supabase-js';
import { runIngestionJob, initializeServices } from '../../../services/ingestion/orchestrator.js';
import { 
  getIngestionState, 
  updateIngestionState,
  pauseIngestion as pauseIngestionState,
  resumeIngestion as resumeIngestionState,
  initSupabase as initStateManager 
} from '../../../services/ingestion/stateManager.js';

let supabase = null;

// Action log storage (in-memory for testing, database for production)
const actionLogs = [];

/**
 * Validates authorization header against ADMIN_HEALTH_SECRET
 * @param {string|undefined} authHeader - Authorization header value
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAuthorization(authHeader) {
  const adminSecret = process.env.ADMIN_HEALTH_SECRET;
  
  if (!adminSecret) {
    return { valid: false, error: 'Service not configured' };
  }
  
  if (!authHeader) {
    return { valid: false, error: 'Authorization required' };
  }
  
  const expectedAuth = `Bearer ${adminSecret}`;
  if (authHeader !== expectedAuth) {
    return { valid: false, error: 'Invalid authorization' };
  }
  
  return { valid: true };
}

/**
 * Logs an admin action with timestamp
 * @param {string} action - Action type
 * @param {string} adminId - Admin identifier (from auth)
 * @param {Object} details - Additional details
 * @returns {Object} Log entry
 */
export function logAction(action, adminId, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    adminId: adminId || 'unknown',
    details,
    success: details.success !== false
  };
  
  actionLogs.push(logEntry);
  console.log(`[Health Actions] Action logged: ${action} by ${adminId} at ${logEntry.timestamp}`);
  
  return logEntry;
}

/**
 * Gets recent action logs
 * @param {number} limit - Maximum number of logs to return
 * @returns {Array} Recent action logs
 */
export function getActionLogs(limit = 10) {
  return actionLogs.slice(-limit);
}

/**
 * Clears action logs (for testing)
 */
export function clearActionLogs() {
  actionLogs.length = 0;
}

/**
 * Triggers manual ingestion
 * @returns {Promise<Object>} Result
 */
async function triggerIngestion() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Database configuration missing');
  }
  
  initializeServices(supabaseUrl, supabaseKey);
  
  // Check if ingestion is paused
  initStateManager(supabaseUrl, supabaseKey);
  const state = await getIngestionState('internet_archive');
  
  if (state.is_paused) {
    return {
      success: false,
      message: 'Ingestion is currently paused. Resume it first.'
    };
  }
  
  // Reuse existing ingestion logic (Requirement 7.6)
  const result = await runIngestionJob({
    batchSize: 50,
    maxBooks: 100,
    dryRun: false
  });
  
  return {
    success: true,
    message: 'Ingestion triggered successfully',
    jobId: result.jobId,
    summary: {
      processed: result.processed,
      added: result.added,
      skipped: result.skipped,
      failed: result.failed
    }
  };
}

/**
 * Pauses ingestion
 * @returns {Promise<Object>} Result
 */
async function pauseIngestion() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Database configuration missing');
  }
  
  initStateManager(supabaseUrl, supabaseKey);
  
  const state = await getIngestionState('internet_archive');
  
  if (state.is_paused) {
    return {
      success: false,
      message: 'Ingestion is already paused'
    };
  }
  
  // Use dedicated pause function from stateManager
  await pauseIngestionState('internet_archive', 'admin');
  
  return {
    success: true,
    message: 'Ingestion paused successfully'
  };
}

/**
 * Resumes ingestion
 * @returns {Promise<Object>} Result
 */
async function resumeIngestion() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Database configuration missing');
  }
  
  initStateManager(supabaseUrl, supabaseKey);
  
  const state = await getIngestionState('internet_archive');
  
  if (!state.is_paused) {
    return {
      success: false,
      message: 'Ingestion is not paused'
    };
  }
  
  // Use dedicated resume function from stateManager
  await resumeIngestionState('internet_archive');
  
  return {
    success: true,
    message: 'Ingestion resumed successfully'
  };
}

/**
 * Triggers maintenance (placeholder - to be implemented)
 * @returns {Promise<Object>} Result
 */
async function triggerMaintenance() {
  // Maintenance service not yet implemented
  // This is a placeholder that logs the action
  return {
    success: true,
    message: 'Maintenance triggered (no-op - service not yet implemented)'
  };
}

// Valid actions (Requirement 7.7: No destructive actions)
const VALID_ACTIONS = {
  trigger_ingestion: triggerIngestion,
  trigger_maintenance: triggerMaintenance,
  pause_ingestion: pauseIngestion,
  resume_ingestion: resumeIngestion
};

/**
 * Vercel Serverless Function Handler
 * @param {Request} req - Incoming request
 * @param {Response} res - Outgoing response
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests',
      timestamp: new Date().toISOString()
    });
  }
  
  // Validate authorization
  const authHeader = req.headers['authorization'];
  const authResult = validateAuthorization(authHeader);
  
  if (!authResult.valid) {
    console.warn(`[Health Actions] Unauthorized request: ${authResult.error}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: authResult.error,
      timestamp: new Date().toISOString()
    });
  }
  
  // Parse action from request body
  const { action } = req.body || {};
  
  if (!action) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'Action is required',
      validActions: Object.keys(VALID_ACTIONS),
      timestamp: new Date().toISOString()
    });
  }
  
  // Validate action type
  if (!VALID_ACTIONS[action]) {
    return res.status(400).json({
      error: 'Bad request',
      message: `Invalid action: ${action}`,
      validActions: Object.keys(VALID_ACTIONS),
      timestamp: new Date().toISOString()
    });
  }
  
  // Extract admin identifier from auth header for logging
  const adminId = 'admin'; // In production, extract from JWT or session
  
  try {
    // Log action before execution (Requirement 7.5)
    const logEntry = logAction(action, adminId, { status: 'started' });
    
    // Execute the action
    const actionHandler = VALID_ACTIONS[action];
    const result = await actionHandler();
    
    // Update log with result
    logAction(action, adminId, { 
      status: 'completed', 
      success: result.success,
      message: result.message 
    });
    
    return res.status(200).json({
      success: result.success,
      action,
      message: result.message,
      details: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[Health Actions] Error executing ${action}: ${error.message}`);
    
    // Log failed action
    logAction(action, adminId, { 
      status: 'failed', 
      success: false,
      error: error.message 
    });
    
    return res.status(500).json({
      error: 'Internal server error',
      message: `Failed to execute action: ${action}`,
      timestamp: new Date().toISOString()
    });
  }
}
