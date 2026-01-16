/**
 * Audit Log Service
 * 
 * Provides audit logging functionality for book management operations.
 * Logs create, update, and delete actions with JSONB diff storage.
 * 
 * Requirements: 2.7, 6.5
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
 * Valid action types for audit logging
 */
const VALID_ACTIONS = ['create', 'update', 'delete'];

/**
 * Computes the diff between two objects
 * Returns an object with changed fields showing from/to values
 * 
 * @param {Object} before - Original object state
 * @param {Object} after - New object state
 * @returns {Object} Diff object with changed fields
 */
export function computeDiff(before, after) {
  if (!before || typeof before !== 'object') {
    return { created: after };
  }
  
  if (!after || typeof after !== 'object') {
    return { deleted: before };
  }
  
  const diff = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  
  for (const key of allKeys) {
    const beforeVal = before[key];
    const afterVal = after[key];
    
    // Skip if values are equal (using JSON stringify for deep comparison)
    if (JSON.stringify(beforeVal) === JSON.stringify(afterVal)) {
      continue;
    }
    
    diff[key] = {
      from: beforeVal,
      to: afterVal
    };
  }
  
  return diff;
}


/**
 * Logs an action to the book audit log
 * 
 * @param {Object} params - Log parameters
 * @param {string} params.bookId - Book UUID (can be null for deleted books)
 * @param {string} params.bookIdentifier - Book identifier (source_identifier or title)
 * @param {string} params.action - Action type ('create', 'update', 'delete')
 * @param {Object} [params.changes] - JSONB diff of changes
 * @param {string} [params.adminUserId] - Admin user UUID
 * @param {string} [params.adminUsername] - Admin username
 * @returns {Promise<{success: boolean, logId?: string, error?: string}>}
 */
export async function logAction(params) {
  // Validate required parameters
  if (!params || typeof params !== 'object') {
    return { success: false, error: 'Invalid parameters: must be an object' };
  }
  
  if (!params.bookIdentifier || typeof params.bookIdentifier !== 'string') {
    return { success: false, error: 'Invalid parameters: bookIdentifier is required' };
  }
  
  if (!params.action || !VALID_ACTIONS.includes(params.action)) {
    return { success: false, error: `Invalid action: must be one of ${VALID_ACTIONS.join(', ')}` };
  }
  
  const client = getSupabase();
  
  try {
    const logEntry = {
      book_id: params.bookId || null,
      book_identifier: params.bookIdentifier,
      action: params.action,
      changes: params.changes || null,
      admin_user_id: params.adminUserId || null,
      admin_username: params.adminUsername || null,
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await client
      .from('book_audit_log')
      .insert(logEntry)
      .select('id')
      .single();
    
    if (error) {
      console.error(`[AuditLogService] Error logging action: ${error.message}`);
      return { success: false, error: error.message };
    }
    
    console.log(`[AuditLogService] Logged ${params.action} action for book: ${params.bookIdentifier}`);
    return { success: true, logId: data.id };
  } catch (error) {
    console.error(`[AuditLogService] Unexpected error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Logs a book creation action
 * 
 * @param {Object} book - Created book data
 * @param {Object} [adminInfo] - Admin user info
 * @param {string} [adminInfo.userId] - Admin user ID
 * @param {string} [adminInfo.username] - Admin username
 * @returns {Promise<{success: boolean, logId?: string, error?: string}>}
 */
export async function logCreate(book, adminInfo = {}) {
  if (!book || typeof book !== 'object') {
    return { success: false, error: 'Invalid book data' };
  }
  
  return logAction({
    bookId: book.id,
    bookIdentifier: book.source_identifier || book.title || 'Unknown',
    action: 'create',
    changes: { created: book },
    adminUserId: adminInfo.userId,
    adminUsername: adminInfo.username
  });
}

/**
 * Logs a book update action
 * 
 * @param {string} bookId - Book UUID
 * @param {string} bookIdentifier - Book identifier
 * @param {Object} before - Book state before update
 * @param {Object} after - Book state after update
 * @param {Object} [adminInfo] - Admin user info
 * @param {string} [adminInfo.userId] - Admin user ID
 * @param {string} [adminInfo.username] - Admin username
 * @returns {Promise<{success: boolean, logId?: string, error?: string}>}
 */
export async function logUpdate(bookId, bookIdentifier, before, after, adminInfo = {}) {
  const changes = computeDiff(before, after);
  
  // Don't log if no actual changes
  if (Object.keys(changes).length === 0) {
    return { success: true, logId: null };
  }
  
  return logAction({
    bookId,
    bookIdentifier,
    action: 'update',
    changes,
    adminUserId: adminInfo.userId,
    adminUsername: adminInfo.username
  });
}

/**
 * Logs a book deletion action
 * 
 * @param {string} bookId - Book UUID
 * @param {Object} deletedBook - Deleted book data
 * @param {Object} [adminInfo] - Admin user info
 * @param {string} [adminInfo.userId] - Admin user ID
 * @param {string} [adminInfo.username] - Admin username
 * @returns {Promise<{success: boolean, logId?: string, error?: string}>}
 */
export async function logDelete(bookId, deletedBook, adminInfo = {}) {
  if (!deletedBook || typeof deletedBook !== 'object') {
    return { success: false, error: 'Invalid deleted book data' };
  }
  
  return logAction({
    bookId,
    bookIdentifier: deletedBook.source_identifier || deletedBook.title || 'Unknown',
    action: 'delete',
    changes: { deleted: deletedBook },
    adminUserId: adminInfo.userId,
    adminUsername: adminInfo.username
  });
}


/**
 * Gets audit logs for a specific book
 * 
 * @param {string} bookId - Book UUID
 * @param {number} [limit=50] - Maximum number of logs to return
 * @returns {Promise<{success: boolean, logs?: Array, error?: string}>}
 */
export async function getLogsForBook(bookId, limit = 50) {
  if (!bookId || typeof bookId !== 'string') {
    return { success: false, error: 'Invalid book ID' };
  }
  
  const client = getSupabase();
  
  try {
    const { data, error } = await client
      .from('book_audit_log')
      .select('*')
      .eq('book_id', bookId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error(`[AuditLogService] Error fetching logs: ${error.message}`);
      return { success: false, error: error.message };
    }
    
    return { success: true, logs: data || [] };
  } catch (error) {
    console.error(`[AuditLogService] Unexpected error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Gets recent audit logs across all books
 * 
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=50] - Maximum number of logs to return
 * @param {string} [options.action] - Filter by action type
 * @param {string} [options.adminUserId] - Filter by admin user
 * @param {string} [options.dateFrom] - Filter by date range start
 * @param {string} [options.dateTo] - Filter by date range end
 * @returns {Promise<{success: boolean, logs?: Array, error?: string}>}
 */
export async function getRecentLogs(options = {}) {
  const client = getSupabase();
  const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 50));
  
  try {
    let query = client
      .from('book_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    // Apply filters
    if (options.action && VALID_ACTIONS.includes(options.action)) {
      query = query.eq('action', options.action);
    }
    
    if (options.adminUserId) {
      query = query.eq('admin_user_id', options.adminUserId);
    }
    
    if (options.dateFrom) {
      query = query.gte('created_at', options.dateFrom);
    }
    
    if (options.dateTo) {
      query = query.lte('created_at', options.dateTo);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`[AuditLogService] Error fetching recent logs: ${error.message}`);
      return { success: false, error: error.message };
    }
    
    return { success: true, logs: data || [] };
  } catch (error) {
    console.error(`[AuditLogService] Unexpected error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Gets audit log statistics
 * 
 * @param {string} [dateFrom] - Start date for statistics
 * @param {string} [dateTo] - End date for statistics
 * @returns {Promise<{success: boolean, stats?: Object, error?: string}>}
 */
export async function getAuditStats(dateFrom, dateTo) {
  const client = getSupabase();
  
  try {
    let query = client
      .from('book_audit_log')
      .select('action', { count: 'exact' });
    
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }
    
    // Get counts for each action type
    const stats = {
      create: 0,
      update: 0,
      delete: 0,
      total: 0
    };
    
    for (const action of VALID_ACTIONS) {
      let actionQuery = client
        .from('book_audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('action', action);
      
      if (dateFrom) {
        actionQuery = actionQuery.gte('created_at', dateFrom);
      }
      
      if (dateTo) {
        actionQuery = actionQuery.lte('created_at', dateTo);
      }
      
      const { count, error } = await actionQuery;
      
      if (!error) {
        stats[action] = count || 0;
        stats.total += count || 0;
      }
    }
    
    return { success: true, stats };
  } catch (error) {
    console.error(`[AuditLogService] Unexpected error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export { VALID_ACTIONS };
