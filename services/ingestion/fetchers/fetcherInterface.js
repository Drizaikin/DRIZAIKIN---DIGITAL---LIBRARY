/**
 * Fetcher Interface Definition
 * 
 * This module defines the interface that all book source fetchers must implement.
 * The interface follows the Strategy pattern, allowing different sources to be
 * plugged into the ingestion system without modifying core logic.
 * 
 * Requirements: 1.1, 1.2, 1.3
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

/**
 * @typedef {Object} FetchOptions
 * @property {number} [batchSize=30] - Number of books to fetch
 * @property {number} [page=1] - Page number for pagination
 * @property {string} [language] - Filter by language
 * @property {string} [format] - Preferred format
 * @property {number} [delayMs] - Delay between requests
 * @property {Object} [sourceSpecific] - Source-specific options
 */

/**
 * @typedef {Object} RawBook
 * @property {string} identifier - Source-specific book identifier
 * @property {string} title - Book title
 * @property {string|string[]} creator - Author(s)
 * @property {string|null} date - Publication date
 * @property {string|null} language - Language code
 * @property {string|null} description - Book description
 * @property {string} [downloadUrl] - Direct download URL
 * @property {string} [coverUrl] - Cover image URL
 * @property {string[]} [formats] - Available formats
 * @property {Object} [sourceSpecific] - Source-specific metadata
 */

/**
 * @typedef {Object} NormalizedBook
 * @property {string} title - Book title
 * @property {string} author - Author(s) as comma-separated string
 * @property {number|null} year - Publication year
 * @property {string|null} language - Language code
 * @property {string|null} description - Book description
 * @property {string} source - Source identifier
 * @property {string} source_identifier - Source-specific identifier
 * @property {string} [pdf_url] - PDF download URL
 * @property {string} [cover_url] - Cover image URL
 */

/**
 * Required methods that all fetchers must implement
 */
const REQUIRED_METHODS = [
  'getSourceId',
  'getSourceMetadata',
  'fetchBooks',
  'parseBookDocument',
  'getDownloadUrl'
];

/**
 * Validates that an object implements the Fetcher interface
 * @param {Object} fetcher - Object to validate
 * @returns {{ valid: boolean, missingMethods: string[] }}
 */
function validateFetcherInterface(fetcher) {
  if (!fetcher || typeof fetcher !== 'object') {
    return { valid: false, missingMethods: REQUIRED_METHODS };
  }
  
  const missingMethods = REQUIRED_METHODS.filter(
    method => typeof fetcher[method] !== 'function'
  );
  
  return {
    valid: missingMethods.length === 0,
    missingMethods
  };
}

/**
 * Creates a default source metadata object
 * @param {Partial<SourceMetadata>} overrides - Values to override defaults
 * @returns {SourceMetadata}
 */
function createDefaultMetadata(overrides = {}) {
  return {
    sourceId: 'unknown',
    displayName: 'Unknown Source',
    description: '',
    website: '',
    supportedFormats: ['pdf'],
    defaultRateLimitMs: 1500,
    defaultBatchSize: 30,
    ...overrides
  };
}

/**
 * Creates default fetch options
 * @param {Partial<FetchOptions>} overrides - Values to override defaults
 * @returns {FetchOptions}
 */
function createDefaultFetchOptions(overrides = {}) {
  return {
    batchSize: 30,
    page: 1,
    language: null,
    format: null,
    delayMs: 1500,
    sourceSpecific: {},
    ...overrides
  };
}

/**
 * Abstract base class for fetchers (for documentation purposes)
 * JavaScript doesn't have true interfaces, so this serves as documentation
 * and provides default implementations where appropriate.
 */
class FetcherInterface {
  /**
   * Get the unique identifier for this source
   * @returns {string} Source ID (e.g., 'internet_archive', 'project_gutenberg')
   * @abstract
   */
  getSourceId() {
    throw new Error('getSourceId() must be implemented by subclass');
  }
  
  /**
   * Get human-readable metadata about this source
   * @returns {SourceMetadata}
   * @abstract
   */
  getSourceMetadata() {
    throw new Error('getSourceMetadata() must be implemented by subclass');
  }
  
  /**
   * Fetch books from the source
   * @param {FetchOptions} options - Pagination and filtering options
   * @returns {Promise<RawBook[]>} Array of raw book data from source
   * @abstract
   */
  async fetchBooks(options) {
    throw new Error('fetchBooks() must be implemented by subclass');
  }
  
  /**
   * Parse a single book document from source-specific format
   * @param {Object} doc - Raw document from source API
   * @returns {RawBook} Parsed book in source-specific format
   * @abstract
   */
  parseBookDocument(doc) {
    throw new Error('parseBookDocument() must be implemented by subclass');
  }
  
  /**
   * Construct download URL for a book
   * @param {string} identifier - Source-specific book identifier
   * @param {string} [format='pdf'] - Preferred format
   * @returns {string|null} Download URL or null if unavailable
   * @abstract
   */
  getDownloadUrl(identifier, format = 'pdf') {
    throw new Error('getDownloadUrl() must be implemented by subclass');
  }
}

export {
  FetcherInterface,
  validateFetcherInterface,
  createDefaultMetadata,
  createDefaultFetchOptions,
  REQUIRED_METHODS
};
