/**
 * Base Fetcher Abstract Class
 * 
 * Provides common functionality for all book source fetchers including:
 * - Rate limiting
 * - Error handling and retries
 * - Logging
 * - Configuration management
 * 
 * Requirements: 1.3, 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { 
  FetcherInterface, 
  createDefaultMetadata, 
  createDefaultFetchOptions 
} from './fetcherInterface.js';

/**
 * Base class for all book source fetchers
 * Provides common functionality that subclasses can use or override
 */
class BaseFetcher extends FetcherInterface {
  constructor(config = {}) {
    super();
    this.config = {
      rateLimitMs: config.rateLimitMs || 1500,
      batchSize: config.batchSize || 30,
      maxRetries: config.maxRetries || 3,
      retryDelayMs: config.retryDelayMs || 1000,
      timeout: config.timeout || 30000,
      ...config
    };
    this.lastRequestTime = 0;
    this.requestCount = 0;
  }
  
  /**
   * Get the source ID - must be overridden by subclass
   * @returns {string}
   */
  getSourceId() {
    throw new Error('getSourceId() must be implemented by subclass');
  }
  
  /**
   * Get source metadata - must be overridden by subclass
   * @returns {import('./fetcherInterface.js').SourceMetadata}
   */
  getSourceMetadata() {
    return createDefaultMetadata({
      sourceId: this.getSourceId()
    });
  }
  
  /**
   * Fetch books - must be overridden by subclass
   * @param {import('./fetcherInterface.js').FetchOptions} options
   * @returns {Promise<import('./fetcherInterface.js').RawBook[]>}
   */
  async fetchBooks(options) {
    throw new Error('fetchBooks() must be implemented by subclass');
  }
  
  /**
   * Parse a book document - must be overridden by subclass
   * @param {Object} doc
   * @returns {import('./fetcherInterface.js').RawBook}
   */
  parseBookDocument(doc) {
    throw new Error('parseBookDocument() must be implemented by subclass');
  }
  
  /**
   * Get download URL - must be overridden by subclass
   * @param {string} identifier
   * @param {string} format
   * @returns {string|null}
   */
  getDownloadUrl(identifier, format = 'pdf') {
    throw new Error('getDownloadUrl() must be implemented by subclass');
  }
  
  /**
   * Apply rate limiting before making a request
   * Requirement: 8.2
   * @returns {Promise<void>}
   */
  async applyRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const delayNeeded = this.config.rateLimitMs - timeSinceLastRequest;
    
    if (delayNeeded > 0) {
      this.log(`Rate limiting: waiting ${delayNeeded}ms`);
      await this.delay(delayNeeded);
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }
  
  /**
   * Make an HTTP request with rate limiting and retries
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>}
   */
  async makeRequest(url, options = {}) {
    await this.applyRateLimit();
    
    let lastError;
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Handle rate limiting (HTTP 429)
        // Requirement: 8.3
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : this.config.rateLimitMs * 2;
          this.log(`Rate limited (429). Waiting ${waitTime}ms before retry`);
          await this.delay(waitTime);
          continue;
        }
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
      } catch (error) {
        lastError = error;
        this.log(`Request failed (attempt ${attempt}/${this.config.maxRetries}): ${error.message}`);
        
        if (attempt < this.config.maxRetries) {
          const backoffDelay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          await this.delay(backoffDelay);
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Make a JSON request
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>}
   */
  async fetchJson(url, options = {}) {
    const response = await this.makeRequest(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...options.headers
      }
    });
    return response.json();
  }
  
  /**
   * Make an XML request
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<string>}
   */
  async fetchXml(url, options = {}) {
    const response = await this.makeRequest(url, {
      ...options,
      headers: {
        'Accept': 'application/xml, text/xml',
        ...options.headers
      }
    });
    return response.text();
  }
  
  /**
   * Delay execution for specified milliseconds
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Log a message with source context
   * @param {string} message - Message to log
   * @param {string} level - Log level (info, warn, error)
   */
  log(message, level = 'info') {
    const prefix = `[${this.getSourceId()}]`;
    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }
  
  /**
   * Update configuration
   * @param {Object} newConfig - New configuration values
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }
  
  /**
   * Get current configuration
   * @returns {Object}
   */
  getConfig() {
    return { ...this.config };
  }
  
  /**
   * Get request statistics
   * @returns {{ requestCount: number, lastRequestTime: number }}
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime
    };
  }
  
  /**
   * Reset request statistics
   */
  resetStats() {
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }
  
  /**
   * Merge fetch options with defaults
   * @param {Partial<import('./fetcherInterface.js').FetchOptions>} options
   * @returns {import('./fetcherInterface.js').FetchOptions}
   */
  mergeOptions(options = {}) {
    return createDefaultFetchOptions({
      batchSize: this.config.batchSize,
      delayMs: this.config.rateLimitMs,
      ...options
    });
  }
}

export { BaseFetcher };
