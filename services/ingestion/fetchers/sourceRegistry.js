/**
 * Source Registry
 * 
 * Central registry for managing fetcher implementations.
 * Handles registration, validation, and retrieval of book source fetchers.
 * Integrates with database-stored configurations for runtime source management.
 * 
 * Requirements: 1.1, 1.2, 1.4, 1.5, 2.3, 2.4, 6.2, 6.3, 6.5
 */

import { createClient } from '@supabase/supabase-js';
import { validateFetcherInterface, REQUIRED_METHODS } from './fetcherInterface.js';

/**
 * @typedef {import('./fetcherInterface.js').SourceMetadata} SourceMetadata
 */

/**
 * @typedef {Object} SourceConfiguration
 * @property {string} source_id - Unique source identifier
 * @property {string} display_name - Human-readable name
 * @property {boolean} enabled - Whether source is enabled
 * @property {number} priority - Processing priority (lower = higher priority)
 * @property {number} rate_limit_ms - Delay between requests
 * @property {number} batch_size - Books per batch
 * @property {Object} source_specific_config - Source-specific settings
 * @property {string} created_at - Creation timestamp
 * @property {string} updated_at - Last update timestamp
 */

// Supabase client for database operations
let supabase = null;

/**
 * Initialize Supabase client for the registry
 * @param {string} url - Supabase URL
 * @param {string} key - Supabase service key
 */
export function initSupabase(url, key) {
  if (!url || !key) {
    console.warn('[SourceRegistry] Supabase credentials not provided, database operations will be unavailable');
    return;
  }
  supabase = createClient(url, key);
  console.log('[SourceRegistry] Supabase client initialized');
}

/**
 * SourceRegistry class
 * Central registry for managing fetcher implementations
 * 
 * Requirement 1.1: Maintains a registry of all available Fetcher implementations
 */
class SourceRegistry {
  constructor() {
    /**
     * Map of source ID to fetcher instance
     * @type {Map<string, Object>}
     */
    this.fetchers = new Map();
    
    /**
     * Map of source ID to configuration
     * @type {Map<string, SourceConfiguration>}
     */
    this.configurations = new Map();
    
    /**
     * Track registration errors for failed fetchers
     * @type {Map<string, Error>}
     */
    this.registrationErrors = new Map();
  }
  
  /**
   * Register a fetcher implementation
   * Requirement 1.2: Validates that fetcher implements required interface
   * 
   * @param {Object} fetcher - Fetcher instance to register
   * @throws {Error} If fetcher doesn't implement required interface
   */
  register(fetcher) {
    // Validate the fetcher implements required interface
    if (!this.validateFetcher(fetcher)) {
      const validation = validateFetcherInterface(fetcher);
      const error = new Error(
        `Fetcher does not implement required interface. Missing methods: ${validation.missingMethods.join(', ')}`
      );
      
      // Try to get source ID for error tracking
      let sourceId = 'unknown';
      try {
        if (fetcher && typeof fetcher.getSourceId === 'function') {
          sourceId = fetcher.getSourceId();
        }
      } catch (e) {
        // Ignore - use 'unknown'
      }
      
      this.registrationErrors.set(sourceId, error);
      console.error(`[SourceRegistry] Failed to register fetcher: ${error.message}`);
      throw error;
    }
    
    // Get source ID and metadata
    let sourceId;
    let metadata;
    
    try {
      sourceId = fetcher.getSourceId();
      metadata = fetcher.getSourceMetadata();
    } catch (error) {
      // Requirement 1.5: Log error and exclude fetcher if getSourceMetadata() throws
      console.error(`[SourceRegistry] Fetcher threw error during registration: ${error.message}`);
      this.registrationErrors.set('unknown', error);
      throw new Error(`Fetcher threw error during registration: ${error.message}`);
    }
    
    if (!sourceId || typeof sourceId !== 'string') {
      const error = new Error('Fetcher getSourceId() must return a non-empty string');
      this.registrationErrors.set('unknown', error);
      throw error;
    }
    
    // Check for duplicate registration
    if (this.fetchers.has(sourceId)) {
      console.warn(`[SourceRegistry] Fetcher with source ID '${sourceId}' already registered, skipping duplicate`);
      return;
    }
    
    // Register the fetcher
    this.fetchers.set(sourceId, fetcher);
    console.log(`[SourceRegistry] Registered fetcher: ${sourceId} (${metadata?.displayName || 'Unknown'})`);
  }
  
  /**
   * Get a fetcher by source ID
   * Requirement 1.4: Returns appropriate Fetcher based on source configuration
   * 
   * @param {string} sourceId - Source identifier
   * @returns {Object|null} Fetcher instance or null if not found
   */
  getFetcher(sourceId) {
    if (!sourceId || typeof sourceId !== 'string') {
      return null;
    }
    
    return this.fetchers.get(sourceId) || null;
  }
  
  /**
   * Get all registered fetchers
   * Requirement 1.5: Failed fetchers are excluded from available sources
   * 
   * @returns {Object[]} Array of all registered fetchers
   */
  getAllFetchers() {
    return Array.from(this.fetchers.values());
  }
  
  /**
   * Get enabled fetchers sorted by priority
   * Requirement 6.2: Process sources in priority order
   * Requirement 6.3: Equal priority sorted alphabetically by source_id
   * Requirement 6.5: Disabled sources are skipped
   * 
   * @returns {Promise<Object[]>} Enabled fetchers in priority order
   */
  async getEnabledFetchers() {
    // Ensure configurations are loaded
    if (this.configurations.size === 0) {
      await this.loadConfigurations();
    }
    
    // Get all fetchers with their configurations
    const fetchersWithConfig = [];
    
    for (const [sourceId, fetcher] of this.fetchers) {
      const config = this.configurations.get(sourceId);
      
      // Requirement 6.5: Skip disabled sources
      if (!config || !config.enabled) {
        continue;
      }
      
      fetchersWithConfig.push({
        fetcher,
        sourceId,
        priority: config.priority ?? 100
      });
    }
    
    // Sort by priority (ascending), then alphabetically by source_id
    // Requirement 6.2, 6.3
    fetchersWithConfig.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.sourceId.localeCompare(b.sourceId);
    });
    
    return fetchersWithConfig.map(item => item.fetcher);
  }
  
  /**
   * Load configurations from database
   * Requirement 2.3: Load Source_Configuration from database on each ingestion run
   * 
   * @returns {Promise<void>}
   */
  async loadConfigurations() {
    if (!supabase) {
      console.warn('[SourceRegistry] Supabase not initialized, using default configurations');
      await this._createDefaultConfigurations();
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('source_configurations')
        .select('*');
      
      if (error) {
        console.error(`[SourceRegistry] Failed to load configurations: ${error.message}`);
        await this._createDefaultConfigurations();
        return;
      }
      
      // Clear existing configurations
      this.configurations.clear();
      
      // Load configurations from database
      if (data && data.length > 0) {
        for (const config of data) {
          this.configurations.set(config.source_id, config);
        }
        console.log(`[SourceRegistry] Loaded ${data.length} configurations from database`);
      }
      
      // Requirement 2.4: Create default configurations for fetchers without configs
      await this._ensureDefaultConfigurations();
      
    } catch (error) {
      console.error(`[SourceRegistry] Error loading configurations: ${error.message}`);
      await this._createDefaultConfigurations();
    }
  }
  
  /**
   * Validate that a fetcher implements required interface
   * Requirement 1.2: Validate required interface methods
   * 
   * @param {Object} fetcher - Fetcher to validate
   * @returns {boolean} True if valid
   */
  validateFetcher(fetcher) {
    const validation = validateFetcherInterface(fetcher);
    return validation.valid;
  }
  
  /**
   * Get registration errors for debugging
   * @returns {Map<string, Error>}
   */
  getRegistrationErrors() {
    return new Map(this.registrationErrors);
  }
  
  /**
   * Get configuration for a specific source
   * @param {string} sourceId - Source identifier
   * @returns {SourceConfiguration|null}
   */
  getConfiguration(sourceId) {
    return this.configurations.get(sourceId) || null;
  }
  
  /**
   * Get all configurations
   * @returns {SourceConfiguration[]}
   */
  getAllConfigurations() {
    return Array.from(this.configurations.values());
  }
  
  /**
   * Clear all registered fetchers and configurations
   * Useful for testing
   */
  clear() {
    this.fetchers.clear();
    this.configurations.clear();
    this.registrationErrors.clear();
  }
  
  /**
   * Create default configurations for all registered fetchers
   * Used when database is not available
   * @private
   */
  async _createDefaultConfigurations() {
    for (const [sourceId, fetcher] of this.fetchers) {
      if (!this.configurations.has(sourceId)) {
        const metadata = fetcher.getSourceMetadata();
        const defaultConfig = this._createDefaultConfig(sourceId, metadata);
        this.configurations.set(sourceId, defaultConfig);
      }
    }
  }
  
  /**
   * Ensure all registered fetchers have configurations
   * Requirement 2.4: Create default configuration with enabled=false for new fetchers
   * @private
   */
  async _ensureDefaultConfigurations() {
    for (const [sourceId, fetcher] of this.fetchers) {
      if (!this.configurations.has(sourceId)) {
        const metadata = fetcher.getSourceMetadata();
        const defaultConfig = this._createDefaultConfig(sourceId, metadata);
        
        // Try to save to database
        if (supabase) {
          try {
            const { data, error } = await supabase
              .from('source_configurations')
              .insert(defaultConfig)
              .select()
              .single();
            
            if (error) {
              console.warn(`[SourceRegistry] Failed to save default config for ${sourceId}: ${error.message}`);
              this.configurations.set(sourceId, defaultConfig);
            } else {
              this.configurations.set(sourceId, data);
              console.log(`[SourceRegistry] Created default configuration for ${sourceId}`);
            }
          } catch (error) {
            console.warn(`[SourceRegistry] Error saving default config for ${sourceId}: ${error.message}`);
            this.configurations.set(sourceId, defaultConfig);
          }
        } else {
          this.configurations.set(sourceId, defaultConfig);
        }
      }
    }
  }
  
  /**
   * Create a default configuration object
   * Requirement 2.4: Default configuration with enabled=false
   * @private
   * @param {string} sourceId - Source identifier
   * @param {SourceMetadata} metadata - Source metadata
   * @returns {SourceConfiguration}
   */
  _createDefaultConfig(sourceId, metadata) {
    const now = new Date().toISOString();
    
    // Internet Archive is enabled by default for backward compatibility
    // Requirement 7.1: Internet Archive as default source with enabled=true
    const isInternetArchive = sourceId === 'internet_archive';
    
    return {
      source_id: sourceId,
      display_name: metadata?.displayName || sourceId,
      enabled: isInternetArchive, // Only IA enabled by default
      priority: isInternetArchive ? 1 : 100, // IA has highest priority
      rate_limit_ms: metadata?.defaultRateLimitMs || 1500,
      batch_size: metadata?.defaultBatchSize || 30,
      source_specific_config: {},
      created_at: now,
      updated_at: now
    };
  }
}

// Export singleton instance
const sourceRegistry = new SourceRegistry();

export { 
  SourceRegistry, 
  sourceRegistry,
  REQUIRED_METHODS
};
