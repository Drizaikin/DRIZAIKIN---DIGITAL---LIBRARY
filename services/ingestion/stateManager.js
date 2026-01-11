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
    last_run_failed: 0
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

export { supabase };
