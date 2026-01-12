/**
 * Ingestion State Manager Service
 * 
 * Manages stateful continuation for daily cron-based ingestion.
 * Tracks progress in the database to enable resumable ingestion across runs.
 */

import { createClient } from '@supabase/supabase-js';

let supabase = null;

/**
 * Initialize Supabase client
 * @param {string} url - Supabase URL
 * @param {string} key - Supabase service key
 */
export function initSupabase(url, key) {
  supabase = createClient(url, key);
}

/**
 * Get the current ingestion state for a source
 * @param {string} source - Source identifier (e.g., 'internet_archive')
 * @returns {Promise<Object>} Current state
 */
export async function getIngestionState(source = 'internet_archive') {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabase
    .from('ingestion_state')
    .select('*')
    .eq('source', source)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error(`[StateManager] Error fetching state: ${error.message}`);
    throw error;
  }

  // If no state exists, create default
  if (!data) {
    return await createDefaultState(source);
  }

  return data;
}

/**
 * Create default state for a new source
 * @param {string} source - Source identifier
 * @returns {Promise<Object>} Created state
 */
async function createDefaultState(source) {
  const defaultState = {
    source,
    last_page: 1,
    last_cursor: null,
    total_ingested: 0,
    last_run_at: null,
    last_run_status: 'idle',
    last_run_added: 0,
    last_run_skipped: 0,
    last_run_failed: 0,
    is_paused: false,
    paused_at: null,
    paused_by: null
  };

  const { data, error } = await supabase
    .from('ingestion_state')
    .insert(defaultState)
    .select()
    .single();

  if (error) {
    console.error(`[StateManager] Error creating default state: ${error.message}`);
    // Return default if insert fails (might already exist)
    return defaultState;
  }

  return data;
}

/**
 * Update ingestion state after a run
 * @param {string} source - Source identifier
 * @param {Object} updates - State updates
 * @returns {Promise<Object>} Updated state
 */
export async function updateIngestionState(source, updates) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabase
    .from('ingestion_state')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('source', source)
    .select()
    .single();

  if (error) {
    console.error(`[StateManager] Error updating state: ${error.message}`);
    throw error;
  }

  console.log(`[StateManager] Updated state for ${source}: page=${data.last_page}, total=${data.total_ingested}`);
  return data;
}

/**
 * Mark the start of an ingestion run
 * @param {string} source - Source identifier
 * @returns {Promise<Object>} Updated state
 */
export async function markRunStarted(source = 'internet_archive') {
  return await updateIngestionState(source, {
    last_run_status: 'running',
    last_run_at: new Date().toISOString()
  });
}

/**
 * Mark the completion of an ingestion run
 * @param {string} source - Source identifier
 * @param {Object} result - Run results
 * @returns {Promise<Object>} Updated state
 */
export async function markRunCompleted(source, result) {
  const currentState = await getIngestionState(source);
  
  return await updateIngestionState(source, {
    last_page: result.nextPage || currentState.last_page + 1,
    last_cursor: result.lastCursor || null,
    total_ingested: currentState.total_ingested + result.added,
    last_run_status: result.status || 'completed',
    last_run_added: result.added,
    last_run_skipped: result.skipped,
    last_run_failed: result.failed
  });
}

/**
 * Reset ingestion state to start from beginning
 * @param {string} source - Source identifier
 * @returns {Promise<Object>} Reset state
 */
export async function resetIngestionState(source = 'internet_archive') {
  return await updateIngestionState(source, {
    last_page: 1,
    last_cursor: null,
    last_run_status: 'reset'
  });
}

/**
 * Pause ingestion for a source
 * @param {string} source - Source identifier
 * @param {string} [pausedBy] - Identifier of who paused (for audit trail)
 * @returns {Promise<Object>} Updated state with is_paused = true
 */
export async function pauseIngestion(source = 'internet_archive', pausedBy = 'admin') {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabase
    .from('ingestion_state')
    .update({
      is_paused: true,
      paused_at: new Date().toISOString(),
      paused_by: pausedBy,
      updated_at: new Date().toISOString()
    })
    .eq('source', source)
    .select()
    .single();

  if (error) {
    console.error(`[StateManager] Error pausing ingestion: ${error.message}`);
    throw error;
  }

  console.log(`[StateManager] Ingestion paused for ${source} by ${pausedBy}`);
  return data;
}

/**
 * Resume ingestion for a source
 * @param {string} source - Source identifier
 * @returns {Promise<Object>} Updated state with is_paused = false
 */
export async function resumeIngestion(source = 'internet_archive') {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabase
    .from('ingestion_state')
    .update({
      is_paused: false,
      paused_at: null,
      paused_by: null,
      updated_at: new Date().toISOString()
    })
    .eq('source', source)
    .select()
    .single();

  if (error) {
    console.error(`[StateManager] Error resuming ingestion: ${error.message}`);
    throw error;
  }

  console.log(`[StateManager] Ingestion resumed for ${source}`);
  return data;
}

/**
 * Check if ingestion is paused for a source
 * @param {string} source - Source identifier
 * @returns {Promise<boolean>} True if paused, false otherwise
 */
export async function isIngestionPaused(source = 'internet_archive') {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  try {
    const state = await getIngestionState(source);
    return state.is_paused === true;
  } catch (error) {
    console.error(`[StateManager] Error checking pause state: ${error.message}`);
    // Default to not paused if we can't check
    return false;
  }
}

export { supabase };
