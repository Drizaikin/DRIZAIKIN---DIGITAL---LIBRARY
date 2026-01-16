/**
 * Metadata Mapper Service
 * 
 * Normalizes book metadata from various sources to a unified schema.
 * Handles differences in field names, formats, and data structures
 * across different book sources.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

/**
 * @typedef {import('./fetcherInterface.js').RawBook} RawBook
 * @typedef {import('./fetcherInterface.js').NormalizedBook} NormalizedBook
 */

/**
 * Year extraction patterns for various date formats
 */
const YEAR_PATTERNS = [
  /^(\d{4})$/,                    // YYYY
  /^(\d{4})-\d{2}-\d{2}/,         // YYYY-MM-DD
  /^(\d{4})\/\d{2}\/\d{2}/,       // YYYY/MM/DD
  /(\d{4})/,                       // Any 4-digit year
  /circa\s*(\d{4})/i,             // circa YYYY
  /c\.\s*(\d{4})/i,               // c. YYYY
  /\[(\d{4})\]/,                  // [YYYY]
];

/**
 * Valid year range
 */
const MIN_YEAR = 1000;
const MAX_YEAR = 2999;

/**
 * Source-specific field mappings
 */
const SOURCE_FIELD_MAPPINGS = {
  internet_archive: {
    identifier: 'identifier',
    title: 'title',
    creator: 'creator',
    date: 'date',
    language: 'language',
    description: 'description'
  },
  project_gutenberg: {
    identifier: 'id',
    title: 'title',
    creator: 'author',
    date: 'issued',
    language: 'language',
    description: 'description'
  },
  open_library: {
    identifier: 'key',
    title: 'title',
    creator: 'author_name',
    date: 'first_publish_year',
    language: 'language',
    description: 'description'
  },
  standard_ebooks: {
    identifier: 'id',
    title: 'title',
    creator: 'author',
    date: 'published',
    language: 'language',
    description: 'summary'
  }
};

/**
 * MetadataMapper class for normalizing book metadata
 */
class MetadataMapper {
  /**
   * Normalize raw book data to unified schema
   * Requirement: 4.1, 4.2
   * @param {RawBook} rawBook - Source-specific book data
   * @param {string} sourceId - Source identifier
   * @returns {NormalizedBook} Unified book schema
   */
  normalize(rawBook, sourceId) {
    if (!rawBook) {
      throw new Error('rawBook is required');
    }
    
    if (!sourceId) {
      throw new Error('sourceId is required');
    }
    
    // Apply source-specific transformations first
    const transformed = this.applySourceTransforms(rawBook, sourceId);
    
    // Build normalized book object
    const normalized = {
      title: this.normalizeTitle(transformed.title),
      author: this.normalizeAuthor(transformed.creator),
      year: this.extractYear(transformed.date),
      language: this.normalizeLanguage(transformed.language),
      description: this.normalizeDescription(transformed.description),
      source: sourceId,
      source_identifier: this.normalizeIdentifier(transformed.identifier, sourceId)
    };
    
    // Add optional fields if present
    if (transformed.downloadUrl) {
      normalized.pdf_url = transformed.downloadUrl;
    }
    
    if (transformed.coverUrl) {
      normalized.cover_url = transformed.coverUrl;
    }
    
    return normalized;
  }
  
  /**
   * Extract year from various date formats
   * Requirement: 4.4
   * @param {string|number|null} dateStr - Date string in various formats
   * @returns {number|null} Four-digit year or null
   */
  extractYear(dateStr) {
    if (dateStr === null || dateStr === undefined) {
      return null;
    }
    
    // If already a number, validate and return
    if (typeof dateStr === 'number') {
      return this.isValidYear(dateStr) ? dateStr : null;
    }
    
    // Convert to string
    const str = String(dateStr).trim();
    
    if (!str) {
      return null;
    }
    
    // Try each pattern
    for (const pattern of YEAR_PATTERNS) {
      const match = str.match(pattern);
      if (match && match[1]) {
        const year = parseInt(match[1], 10);
        if (this.isValidYear(year)) {
          return year;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Check if a year is valid
   * @param {number} year - Year to validate
   * @returns {boolean}
   */
  isValidYear(year) {
    return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
  }
  
  /**
   * Normalize author field to string
   * Requirement: 4.3
   * @param {string|string[]|null} creator - Author(s) in various formats
   * @returns {string} Comma-separated author string
   */
  normalizeAuthor(creator) {
    if (!creator) {
      return 'Unknown Author';
    }
    
    // If array, join with comma-space
    if (Array.isArray(creator)) {
      const filtered = creator
        .filter(a => a && typeof a === 'string')
        .map(a => a.trim())
        .filter(a => a.length > 0);
      
      if (filtered.length === 0) {
        return 'Unknown Author';
      }
      
      return filtered.join(', ');
    }
    
    // If string, clean it up
    if (typeof creator === 'string') {
      const trimmed = creator.trim();
      return trimmed.length > 0 ? trimmed : 'Unknown Author';
    }
    
    // If object with name property (Open Library format)
    if (typeof creator === 'object' && creator.name) {
      return creator.name;
    }
    
    return 'Unknown Author';
  }
  
  /**
   * Normalize title
   * @param {string|null} title - Raw title
   * @returns {string}
   */
  normalizeTitle(title) {
    if (!title || typeof title !== 'string') {
      return 'Untitled';
    }
    
    const trimmed = title.trim();
    return trimmed.length > 0 ? trimmed : 'Untitled';
  }
  
  /**
   * Normalize language code
   * @param {string|string[]|null} language - Language code(s)
   * @returns {string|null}
   */
  normalizeLanguage(language) {
    if (!language) {
      return null;
    }
    
    // If array, take first
    if (Array.isArray(language)) {
      return language.length > 0 ? this.normalizeLanguageCode(language[0]) : null;
    }
    
    return this.normalizeLanguageCode(language);
  }
  
  /**
   * Normalize a single language code
   * @param {string} code - Language code
   * @returns {string|null}
   */
  normalizeLanguageCode(code) {
    if (!code || typeof code !== 'string') {
      return null;
    }
    
    // Common language code mappings
    const mappings = {
      'english': 'eng',
      'en': 'eng',
      'en-us': 'eng',
      'en-gb': 'eng',
      'french': 'fre',
      'fr': 'fre',
      'german': 'ger',
      'de': 'ger',
      'spanish': 'spa',
      'es': 'spa',
      'italian': 'ita',
      'it': 'ita',
      'portuguese': 'por',
      'pt': 'por',
      'russian': 'rus',
      'ru': 'rus',
      'chinese': 'chi',
      'zh': 'chi',
      'japanese': 'jpn',
      'ja': 'jpn'
    };
    
    const lower = code.toLowerCase().trim();
    return mappings[lower] || lower.substring(0, 3);
  }
  
  /**
   * Normalize description
   * @param {string|string[]|null} description - Raw description
   * @returns {string|null}
   */
  normalizeDescription(description) {
    if (!description) {
      return null;
    }
    
    // If array, join
    if (Array.isArray(description)) {
      const joined = description
        .filter(d => d && typeof d === 'string')
        .join(' ')
        .trim();
      return joined.length > 0 ? joined : null;
    }
    
    if (typeof description !== 'string') {
      return null;
    }
    
    const trimmed = description.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  
  /**
   * Normalize source identifier
   * Requirement: 4.5
   * @param {string} identifier - Raw identifier
   * @param {string} sourceId - Source ID
   * @returns {string}
   */
  normalizeIdentifier(identifier, sourceId) {
    if (!identifier) {
      return `${sourceId}_unknown_${Date.now()}`;
    }
    
    // Preserve original format but ensure it's a string
    return String(identifier).trim();
  }
  
  /**
   * Apply source-specific transformations
   * @param {RawBook} rawBook - Raw book data
   * @param {string} sourceId - Source identifier
   * @returns {Object} Transformed fields
   */
  applySourceTransforms(rawBook, sourceId) {
    const mapping = SOURCE_FIELD_MAPPINGS[sourceId];
    
    if (!mapping) {
      // No specific mapping, return as-is
      return { ...rawBook };
    }
    
    // Map fields according to source-specific mapping
    const transformed = {};
    
    for (const [normalizedField, sourceField] of Object.entries(mapping)) {
      transformed[normalizedField] = rawBook[sourceField] ?? rawBook[normalizedField];
    }
    
    // Preserve additional fields
    transformed.downloadUrl = rawBook.downloadUrl;
    transformed.coverUrl = rawBook.coverUrl;
    transformed.formats = rawBook.formats;
    transformed.sourceSpecific = rawBook.sourceSpecific;
    
    return transformed;
  }
  
  /**
   * Batch normalize multiple books
   * @param {RawBook[]} rawBooks - Array of raw books
   * @param {string} sourceId - Source identifier
   * @returns {NormalizedBook[]}
   */
  normalizeAll(rawBooks, sourceId) {
    if (!Array.isArray(rawBooks)) {
      return [];
    }
    
    return rawBooks
      .filter(book => book != null)
      .map(book => {
        try {
          return this.normalize(book, sourceId);
        } catch (error) {
          console.error(`[MetadataMapper] Failed to normalize book: ${error.message}`);
          return null;
        }
      })
      .filter(book => book != null);
  }
}

// Export singleton instance and class
const metadataMapper = new MetadataMapper();

export { 
  MetadataMapper, 
  metadataMapper,
  YEAR_PATTERNS,
  SOURCE_FIELD_MAPPINGS
};
