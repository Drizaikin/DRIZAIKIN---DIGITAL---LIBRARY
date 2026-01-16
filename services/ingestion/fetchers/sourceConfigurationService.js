/**
 * Source Configuration Service
 * 
 * Manages source configurations in the database.
 * Provides CRUD operations for source configurations and handles
 * default configuration creation for new sources.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.3
 */

import { createClient } from '@supabase/supabase-js';

/**
 * @typedef {Object} SourceConfiguration
 * @property {string} source_id - Unique source identifier
 * @property {string} display_name - Human-readable name
 * @property {string} [description] - Source description
 * @property {string} [website] - Source website URL
 * @property {boolean} enabled - Whether source is enabled
 * @property {number} priority - Processing priority (lower = higher priority)
 * @property {number} rate_limit_ms - Delay between requests
 * @property {number} batch_size - Books per batch
 * @property {string[]} [supported_formats] - Supported download formats
 * @property {Object} source_specific_config - Source-specific settings
 * @property {string} created_at - Creation timestamp
 * @property {string} updated_at - Last update timestamp
 */

/**
 * @typedef {Object} SourceMetadata
 * @property {string} sourceId - Unique identifier for this source
 * @property {string} displayName - Human-readable name
 * @property {string} description - Description of the source
 * @property {string} website - Source website URL
 * @property {string[]} supportedFormats - Supported download formats
 * @property {number} defaultRateLimitMs - Default delay between requests
 * @property {number} defaultBatchSize - Default number of books per batch
 */

// Supabase client for database operations
let supabase = null;

/**
 * Initialize Supabase client for the configuration service
 * @param {string} url - Supabase URL
 * @param {string} key - Supabase service key
 */
export function initSupabase(url, key) {
  if (!url || !key) {
    console.warn('[SourceConfigurationService] Supabase credentials not provided, database operations will be unavailable');
    return;
  }
  supabase = createClient(url, key);
  console.log('[SourceConfigurationService] Supabase client initialized');
}

/**
 * Get the Supabase client instance
 * @returns {Object|null} Supabase client or null if not initialized
 */
export function getSupabaseClient() {
  return supabase;
}

/**
 * Set the Supabase client instance (useful for testing)
 * @param {Object} client - Supabase client instance
 */
export function setSupabaseClient(client) {
  supabase = client;
}

/**
 * SourceConfigurationService class
 * Manages source configurations in the database
 * 
 * Requirement 2.1: Source_Configuration table stores source settings
 */
class SourceConfigurationService {
  constructor() {
    /**
     * In-memory cache of configurations
     * @type {Map<string, SourceConfiguration>}
     */
    this.cache = new Map();
    
    /**
     * Whether cache is valid
     * @type {boolean}
     */
    this.cacheValid = false;
  }

  /**
   * Get configuration for a source
   * Requirement 2.3: Load Source_Configuration from database
   * 
   * @param {string} sourceId - Source identifier
   * @returns {Promise<SourceConfiguration|null>} Configuration or null if not found
   */
  async getConfiguration(sourceId) {
    if (!sourceId || typeof sourceId !== 'string') {
      return null;
    }

    // Check cache first
    if (this.cacheValid && this.cache.has(sourceId)) {
      return this.cache.get(sourceId);
    }

    if (!supabase) {
      console.warn('[SourceConfigurationService] Supabase not initialized');
      return this.cache.get(sourceId) || null;
    }

    try {
      const { data, error } = await supabase
        .from('source_configurations')
        .select('*')
        .eq('source_id', sourceId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - not found
          return null;
        }
        console.error(`[SourceConfigurationService] Failed to get configuration for ${sourceId}: ${error.message}`);
        return null;
      }

      // Update cache
      if (data) {
        this.cache.set(sourceId, data);
      }

      return data;
    } catch (error) {
      console.error(`[SourceConfigurationService] Error getting configuration for ${sourceId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get all configurations
   * 
   * @returns {Promise<SourceConfiguration[]>} Array of all configurations
   */
  async getAllConfigurations() {
    if (!supabase) {
      console.warn('[SourceConfigurationService] Supabase not initialized');
      return Array.from(this.cache.values());
    }

    try {
      const { data, error } = await supabase
        .from('source_configurations')
        .select('*')
        .order('priority', { ascending: true })
        .order('source_id', { ascending: true });

      if (error) {
        console.error(`[SourceConfigurationService] Failed to get all configurations: ${error.message}`);
        return Array.from(this.cache.values());
      }

      // Update cache
      this.cache.clear();
      if (data) {
        for (const config of data) {
          this.cache.set(config.source_id, config);
        }
        this.cacheValid = true;
      }

      return data || [];
    } catch (error) {
      console.error(`[SourceConfigurationService] Error getting all configurations: ${error.message}`);
      return Array.from(this.cache.values());
    }
  }

  /**
   * Get enabled configurations sorted by priority
   * Requirement 6.2: Process sources in priority order
   * Requirement 6.3: Equal priority sorted alphabetically by source_id
   * Requirement 6.5: Disabled sources are skipped
   * 
   * @returns {Promise<SourceConfiguration[]>} Enabled configurations in priority order
   */
  async getEnabledConfigurations() {
    if (!supabase) {
      console.warn('[SourceConfigurationService] Supabase not initialized');
      // Return cached enabled configs sorted by priority
      return Array.from(this.cache.values())
        .filter(config => config.enabled)
        .sort((a, b) => {
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          return a.source_id.localeCompare(b.source_id);
        });
    }

    try {
      const { data, error } = await supabase
        .from('source_configurations')
        .select('*')
        .eq('enabled', true)
        .order('priority', { ascending: true })
        .order('source_id', { ascending: true });

      if (error) {
        console.error(`[SourceConfigurationService] Failed to get enabled configurations: ${error.message}`);
        // Fall back to cached data
        return Array.from(this.cache.values())
          .filter(config => config.enabled)
          .sort((a, b) => {
            if (a.priority !== b.priority) {
              return a.priority - b.priority;
            }
            return a.source_id.localeCompare(b.source_id);
          });
      }

      // Update cache with enabled configs
      if (data) {
        for (const config of data) {
          this.cache.set(config.source_id, config);
        }
      }

      return data || [];
    } catch (error) {
      console.error(`[SourceConfigurationService] Error getting enabled configurations: ${error.message}`);
      return Array.from(this.cache.values())
        .filter(config => config.enabled)
        .sort((a, b) => {
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          return a.source_id.localeCompare(b.source_id);
        });
    }
  }

  /**
   * Update configuration for a source
   * Requirement 2.2: Persist changes immediately to database
   * Requirement 2.5: Validate JSON structure before saving
   * 
   * @param {string} sourceId - Source identifier
   * @param {Partial<SourceConfiguration>} updates - Fields to update
   * @returns {Promise<SourceConfiguration>} Updated configuration
   * @throws {Error} If update fails or validation fails
   */
  async updateConfiguration(sourceId, updates) {
    if (!sourceId || typeof sourceId !== 'string') {
      throw new Error('Invalid source ID');
    }

    if (!updates || typeof updates !== 'object') {
      throw new Error('Invalid updates object');
    }

    // Validate source_specific_config if provided
    // Requirement 2.5: Validate JSON structure before saving
    if (updates.source_specific_config !== undefined) {
      if (!this._validateSourceSpecificConfig(updates.source_specific_config)) {
        throw new Error('Invalid source_specific_config: must be a valid JSON object');
      }
    }

    // Validate numeric fields
    if (updates.priority !== undefined && (typeof updates.priority !== 'number' || updates.priority < 0)) {
      throw new Error('Invalid priority: must be a non-negative number');
    }

    if (updates.rate_limit_ms !== undefined && (typeof updates.rate_limit_ms !== 'number' || updates.rate_limit_ms < 0)) {
      throw new Error('Invalid rate_limit_ms: must be a non-negative number');
    }

    if (updates.batch_size !== undefined && (typeof updates.batch_size !== 'number' || updates.batch_size < 1)) {
      throw new Error('Invalid batch_size: must be a positive number');
    }

    // Prevent updating source_id
    const safeUpdates = { ...updates };
    delete safeUpdates.source_id;
    delete safeUpdates.created_at;

    if (!supabase) {
      // Update cache only if no database
      const existing = this.cache.get(sourceId);
      if (!existing) {
        throw new Error(`Configuration not found for source: ${sourceId}`);
      }
      const updated = {
        ...existing,
        ...safeUpdates,
        updated_at: new Date().toISOString()
      };
      this.cache.set(sourceId, updated);
      return updated;
    }

    try {
      const { data, error } = await supabase
        .from('source_configurations')
        .update(safeUpdates)
        .eq('source_id', sourceId)
        .select()
        .single();

      if (error) {
        console.error(`[SourceConfigurationService] Failed to update configuration for ${sourceId}: ${error.message}`);
        throw new Error(`Failed to update configuration: ${error.message}`);
      }

      if (!data) {
        throw new Error(`Configuration not found for source: ${sourceId}`);
      }

      // Update cache
      this.cache.set(sourceId, data);

      console.log(`[SourceConfigurationService] Updated configuration for ${sourceId}`);
      return data;
    } catch (error) {
      if (error.message.includes('Failed to update') || error.message.includes('not found')) {
        throw error;
      }
      console.error(`[SourceConfigurationService] Error updating configuration for ${sourceId}: ${error.message}`);
      throw new Error(`Failed to update configuration: ${error.message}`);
    }
  }

  /**
   * Enable or disable a source
   * Requirement 2.2: Persist enabled state immediately
   * Requirement 3.3: Validate required configuration before activation
   * Requirement 13.1, 13.2: Enable/disable without code changes
   * 
   * @param {string} sourceId - Source identifier
   * @param {boolean} enabled - New enabled state
   * @returns {Promise<SourceConfiguration>} Updated configuration
   * @throws {Error} If operation fails or required config is missing
   */
  async setEnabled(sourceId, enabled) {
    if (!sourceId || typeof sourceId !== 'string') {
      throw new Error('Invalid source ID');
    }

    if (typeof enabled !== 'boolean') {
      throw new Error('Invalid enabled value: must be a boolean');
    }

    // Requirement 3.3: Validate required configuration before enabling
    if (enabled) {
      const config = await this.getConfiguration(sourceId);
      if (!config) {
        throw new Error(`Configuration not found for source: ${sourceId}`);
      }

      // Validate that required fields are present
      const validationResult = this._validateRequiredConfig(config);
      if (!validationResult.valid) {
        throw new Error(`Cannot enable source: ${validationResult.reason}`);
      }
    }

    return this.updateConfiguration(sourceId, { enabled });
  }

  /**
   * Create default configuration for a new source
   * Requirement 2.4: Create default configuration with enabled=false
   * 
   * @param {SourceMetadata} metadata - Source metadata
   * @returns {Promise<SourceConfiguration>} Created configuration
   * @throws {Error} If creation fails
   */
  async createDefaultConfiguration(metadata) {
    if (!metadata || !metadata.sourceId) {
      throw new Error('Invalid metadata: sourceId is required');
    }

    const sourceId = metadata.sourceId;

    // Check if configuration already exists
    const existing = await this.getConfiguration(sourceId);
    if (existing) {
      console.log(`[SourceConfigurationService] Configuration already exists for ${sourceId}`);
      return existing;
    }

    // Internet Archive is enabled by default for backward compatibility
    // Requirement 7.1: Internet Archive as default source with enabled=true
    const isInternetArchive = sourceId === 'internet_archive';

    const defaultConfig = {
      source_id: sourceId,
      display_name: metadata.displayName || sourceId,
      description: metadata.description || '',
      website: metadata.website || '',
      enabled: isInternetArchive, // Only IA enabled by default
      priority: isInternetArchive ? 1 : 100, // IA has highest priority
      rate_limit_ms: metadata.defaultRateLimitMs || 1500,
      batch_size: metadata.defaultBatchSize || 30,
      supported_formats: metadata.supportedFormats || ['pdf'],
      source_specific_config: {}
    };

    if (!supabase) {
      // Store in cache only
      const now = new Date().toISOString();
      const configWithTimestamps = {
        ...defaultConfig,
        created_at: now,
        updated_at: now
      };
      this.cache.set(sourceId, configWithTimestamps);
      console.log(`[SourceConfigurationService] Created default configuration for ${sourceId} (cache only)`);
      return configWithTimestamps;
    }

    try {
      const { data, error } = await supabase
        .from('source_configurations')
        .insert(defaultConfig)
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation (config already exists)
        if (error.code === '23505') {
          const existingConfig = await this.getConfiguration(sourceId);
          if (existingConfig) {
            return existingConfig;
          }
        }
        console.error(`[SourceConfigurationService] Failed to create configuration for ${sourceId}: ${error.message}`);
        throw new Error(`Failed to create configuration: ${error.message}`);
      }

      // Also create statistics entry
      await this._createStatisticsEntry(sourceId);

      // Update cache
      this.cache.set(sourceId, data);

      console.log(`[SourceConfigurationService] Created default configuration for ${sourceId}`);
      return data;
    } catch (error) {
      if (error.message.includes('Failed to create')) {
        throw error;
      }
      console.error(`[SourceConfigurationService] Error creating configuration for ${sourceId}: ${error.message}`);
      throw new Error(`Failed to create configuration: ${error.message}`);
    }
  }

  /**
   * Validate source_specific_config is a valid JSON object
   * Requirement 2.5: Validate JSON structure before saving
   * @private
   * @param {*} config - Config to validate
   * @returns {boolean} True if valid
   */
  _validateSourceSpecificConfig(config) {
    if (config === null || config === undefined) {
      return true; // Allow null/undefined
    }

    if (typeof config !== 'object' || Array.isArray(config)) {
      return false;
    }

    // Try to serialize and deserialize to ensure it's valid JSON
    try {
      JSON.parse(JSON.stringify(config));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate required configuration fields for enabling a source
   * Requirement 3.3: Validate required configuration before activation
   * @private
   * @param {SourceConfiguration} config - Configuration to validate
   * @returns {{ valid: boolean, reason?: string }}
   */
  _validateRequiredConfig(config) {
    if (!config.display_name || config.display_name.trim() === '') {
      return { valid: false, reason: 'display_name is required' };
    }

    if (typeof config.rate_limit_ms !== 'number' || config.rate_limit_ms < 0) {
      return { valid: false, reason: 'rate_limit_ms must be a non-negative number' };
    }

    if (typeof config.batch_size !== 'number' || config.batch_size < 1) {
      return { valid: false, reason: 'batch_size must be a positive number' };
    }

    if (typeof config.priority !== 'number' || config.priority < 0) {
      return { valid: false, reason: 'priority must be a non-negative number' };
    }

    return { valid: true };
  }

  /**
   * Create statistics entry for a new source
   * @private
   * @param {string} sourceId - Source identifier
   */
  async _createStatisticsEntry(sourceId) {
    if (!supabase) {
      return;
    }

    try {
      await supabase
        .from('source_statistics')
        .insert({ source_id: sourceId })
        .single();
    } catch (error) {
      // Ignore errors - statistics entry may already exist
      console.log(`[SourceConfigurationService] Statistics entry for ${sourceId} may already exist`);
    }
  }

  /**
   * Invalidate the cache
   */
  invalidateCache() {
    this.cacheValid = false;
  }

  /**
   * Clear the cache completely
   */
  clearCache() {
    this.cache.clear();
    this.cacheValid = false;
  }

  /**
   * Check if a source exists
   * @param {string} sourceId - Source identifier
   * @returns {Promise<boolean>} True if source exists
   */
  async exists(sourceId) {
    const config = await this.getConfiguration(sourceId);
    return config !== null;
  }

  /**
   * Delete a configuration (for testing purposes)
   * @param {string} sourceId - Source identifier
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteConfiguration(sourceId) {
    if (!sourceId || typeof sourceId !== 'string') {
      return false;
    }

    // Remove from cache
    this.cache.delete(sourceId);

    if (!supabase) {
      return true;
    }

    try {
      const { error } = await supabase
        .from('source_configurations')
        .delete()
        .eq('source_id', sourceId);

      if (error) {
        console.error(`[SourceConfigurationService] Failed to delete configuration for ${sourceId}: ${error.message}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[SourceConfigurationService] Error deleting configuration for ${sourceId}: ${error.message}`);
      return false;
    }
  }
}

// Export singleton instance
const sourceConfigurationService = new SourceConfigurationService();

export {
  SourceConfigurationService,
  sourceConfigurationService
};
