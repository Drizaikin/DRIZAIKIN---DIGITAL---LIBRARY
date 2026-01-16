/**
 * Open Library Fetcher Service
 * 
 * Fetches book metadata from Open Library API.
 * Implements rate limiting and metadata normalization.
 * 
 * Requirements: 9.1, 9.3
 */

export const USER_AGENT = 'DrizaiknDigitalLibrary/1.0 (Educational Library System; contact@drizaikn.edu)';
export const DEFAULT_LIMIT = 20;
export const DEFAULT_DELAY_MS = 500;

/**
 * Delays execution for rate limiting
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Builds the Open Library Search API URL
 * @param {Object} options - Search options
 * @param {string} options.query - Search query
 * @param {string} [options.author] - Author filter
 * @param {number} [options.yearFrom] - Start year filter
 * @param {number} [options.yearTo] - End year filter
 * @param {number} [options.limit] - Number of results
 * @param {number} [options.offset] - Offset for pagination
 * @returns {string} API URL
 */
export function buildSearchUrl(options = {}) {
  const limit = options.limit || DEFAULT_LIMIT;
  const offset = options.offset || 0;
  
  let queryParts = [];
  
  if (options.query) {
    queryParts.push(options.query);
  }
  
  if (options.author) {
    queryParts.push(`author:${options.author}`);
  }
  
  if (options.yearFrom || options.yearTo) {
    const from = options.yearFrom || '*';
    const to = options.yearTo || '*';
    queryParts.push(`first_publish_year:[${from} TO ${to}]`);
  }
  
  const query = encodeURIComponent(queryParts.join(' '));
  
  return `https://openlibrary.org/search.json?q=${query}&limit=${limit}&offset=${offset}`;
}

/**
 * Extracts the best cover URL from Open Library data
 * @param {Object} doc - Open Library document
 * @returns {string|null} Cover URL or null
 */
export function getCoverUrl(doc) {
  if (doc.cover_i) {
    return `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
  }
  if (doc.isbn && doc.isbn.length > 0) {
    return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-M.jpg`;
  }
  return null;
}

/**
 * Determines access type based on availability
 * @param {Object} doc - Open Library document
 * @returns {string} Access type
 */
export function determineAccessType(doc) {
  // Check if book has lending availability
  if (doc.lending_edition_s || doc.lending_identifier_s) {
    return 'open_access';
  }
  
  // Check publication year for public domain
  const year = doc.first_publish_year;
  if (year && year < 1928) {
    return 'public_domain';
  }
  
  // Check if has ebook access
  if (doc.ebook_access === 'public' || doc.public_scan_b) {
    return 'public_domain';
  }
  
  if (doc.ebook_access === 'borrowable') {
    return 'open_access';
  }
  
  return 'preview_only';
}

/**
 * Normalizes Open Library document to standard book format
 * @param {Object} doc - Raw document from API
 * @returns {Object} Normalized book metadata
 */
export function normalizeBook(doc) {
  const identifier = doc.key ? doc.key.replace('/works/', '') : null;
  
  return {
    identifier: identifier,
    title: doc.title || 'Unknown Title',
    author: Array.isArray(doc.author_name) 
      ? doc.author_name.join(', ') 
      : (doc.author_name || 'Unknown Author'),
    description: doc.first_sentence 
      ? (Array.isArray(doc.first_sentence) ? doc.first_sentence[0] : doc.first_sentence)
      : null,
    year: doc.first_publish_year || null,
    coverUrl: getCoverUrl(doc),
    isbn: doc.isbn ? doc.isbn[0] : null,
    language: doc.language ? doc.language[0] : null,
    subjects: doc.subject ? doc.subject.slice(0, 10) : [],
    source: 'open_library',
    accessType: determineAccessType(doc),
    // Metadata completeness score (for source preference)
    completenessScore: calculateCompletenessScore(doc)
  };
}

/**
 * Calculates metadata completeness score
 * @param {Object} doc - Open Library document
 * @returns {number} Score from 0-100
 */
export function calculateCompletenessScore(doc) {
  let score = 0;
  
  if (doc.title) score += 15;
  if (doc.author_name && doc.author_name.length > 0) score += 15;
  if (doc.first_publish_year) score += 10;
  if (doc.first_sentence) score += 15;
  if (doc.cover_i) score += 10;
  if (doc.isbn && doc.isbn.length > 0) score += 10;
  if (doc.subject && doc.subject.length > 0) score += 10;
  if (doc.language && doc.language.length > 0) score += 5;
  if (doc.publisher && doc.publisher.length > 0) score += 5;
  if (doc.number_of_pages_median) score += 5;
  
  return score;
}


/**
 * Fetches books from Open Library API
 * @param {Object} options - Search options
 * @param {string} options.query - Search query
 * @param {string} [options.author] - Author filter
 * @param {number} [options.yearFrom] - Start year filter
 * @param {number} [options.yearTo] - End year filter
 * @param {number} [options.limit] - Number of results (default: 20)
 * @param {number} [options.offset] - Offset for pagination
 * @param {number} [options.delayMs] - Delay between requests (default: 500)
 * @returns {Promise<{books: Array, total: number}>}
 */
export async function searchBooks(options = {}) {
  const delayMs = options.delayMs || DEFAULT_DELAY_MS;
  const url = buildSearchUrl(options);
  
  console.log(`[OpenLibraryFetcher] Searching Open Library...`);
  console.log(`[OpenLibraryFetcher] URL: ${url}`);
  
  try {
    // Apply rate limiting delay before request
    if (delayMs > 0) {
      await delay(delayMs);
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    });
    
    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 60;
      console.log(`[OpenLibraryFetcher] Rate limited. Waiting ${retryAfter} seconds...`);
      await delay(parseInt(retryAfter, 10) * 1000);
      return searchBooks(options);
    }
    
    if (!response.ok) {
      throw new Error(`Open Library API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.docs || !Array.isArray(data.docs)) {
      console.log('[OpenLibraryFetcher] No documents found in response');
      return { books: [], total: 0 };
    }
    
    const books = data.docs
      .filter(doc => doc.key) // Must have identifier
      .map(normalizeBook);
    
    console.log(`[OpenLibraryFetcher] Found ${books.length} books (total: ${data.numFound || 0})`);
    
    return {
      books,
      total: data.numFound || 0
    };
  } catch (error) {
    console.error('[OpenLibraryFetcher] Error searching books:', error.message);
    throw error;
  }
}

/**
 * Gets detailed book information by work ID
 * @param {string} workId - Open Library work ID
 * @returns {Promise<Object|null>} Book details or null
 */
export async function getBookDetails(workId) {
  if (!workId) {
    return null;
  }
  
  const url = `https://openlibrary.org/works/${workId}.json`;
  
  try {
    await delay(DEFAULT_DELAY_MS);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    return {
      identifier: workId,
      title: data.title || 'Unknown Title',
      description: typeof data.description === 'string' 
        ? data.description 
        : (data.description?.value || null),
      subjects: data.subjects || [],
      source: 'open_library'
    };
  } catch (error) {
    console.error('[OpenLibraryFetcher] Error getting book details:', error.message);
    return null;
  }
}
