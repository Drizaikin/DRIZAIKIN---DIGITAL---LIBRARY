/**
 * Internet Archive Fetcher Service
 * 
 * Fetches public-domain book metadata from Internet Archive Advanced Search API.
 * Implements rate limiting and respectful crawling practices.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 8.3
 */

export const USER_AGENT = 'DrizaiknDigitalLibrary/1.0 (Educational Library System; contact@drizaikn.edu)';
export const DEFAULT_BATCH_SIZE = 30;
export const DEFAULT_DELAY_MS = 1500; // 1.5 seconds between requests

/**
 * Delays execution for rate limiting
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Constructs the PDF download URL for a given Internet Archive identifier
 * @param {string} identifier - Internet Archive item identifier
 * @returns {string} Direct PDF download URL
 */
export function getPdfUrl(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error('Invalid identifier: must be a non-empty string');
  }
  return `https://archive.org/download/${identifier}/${identifier}.pdf`;
}

/**
 * Builds the Internet Archive Advanced Search API URL
 * @param {Object} options - Search options
 * @param {number} options.batchSize - Number of books to fetch
 * @param {number} options.page - Page number for pagination
 * @returns {string} API URL
 */
export function buildSearchUrl(options = {}) {
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const page = options.page || 1;
  
  // Query for public domain texts with PDF format, published before 1928
  const query = encodeURIComponent('mediatype:texts AND format:pdf AND date:[* TO 1927]');
  const fields = 'identifier,title,creator,date,language,description';
  
  return `https://archive.org/advancedsearch.php?q=${query}&fl[]=${fields}&sort[]=downloads+desc&rows=${batchSize}&page=${page}&output=json`;
}

/**
 * Parses a book document from Internet Archive API response
 * @param {Object} doc - Raw document from API
 * @returns {Object} Parsed book metadata
 */
export function parseBookDocument(doc) {
  return {
    identifier: doc.identifier || '',
    title: doc.title || 'Unknown Title',
    creator: Array.isArray(doc.creator) ? doc.creator.join(', ') : (doc.creator || 'Unknown Author'),
    date: doc.date || null,
    language: Array.isArray(doc.language) ? doc.language[0] : (doc.language || null),
    description: Array.isArray(doc.description) ? doc.description.join(' ') : (doc.description || null)
  };
}

/**
 * Fetches public-domain book metadata from Internet Archive
 * @param {Object} options - Search options
 * @param {number} options.batchSize - Number of books to fetch (default: 30)
 * @param {number} options.page - Page number for pagination (default: 1)
 * @param {number} options.delayMs - Delay between requests in ms (default: 1500)
 * @returns {Promise<Array>} Array of book metadata objects
 */
export async function fetchBooks(options = {}) {
  const delayMs = options.delayMs || DEFAULT_DELAY_MS;
  const url = buildSearchUrl(options);
  
  console.log(`[InternetArchiveFetcher] Fetching books from Internet Archive...`);
  console.log(`[InternetArchiveFetcher] URL: ${url}`);
  
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
      console.log(`[InternetArchiveFetcher] Rate limited. Waiting ${retryAfter} seconds...`);
      await delay(parseInt(retryAfter, 10) * 1000);
      // Retry once after waiting
      return fetchBooks(options);
    }
    
    if (!response.ok) {
      throw new Error(`Internet Archive API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.response || !Array.isArray(data.response.docs)) {
      console.log('[InternetArchiveFetcher] No documents found in response');
      return [];
    }
    
    const books = data.response.docs
      .filter(doc => doc.identifier) // Must have identifier
      .map(parseBookDocument);
    
    console.log(`[InternetArchiveFetcher] Fetched ${books.length} books`);
    
    return books;
  } catch (error) {
    console.error('[InternetArchiveFetcher] Error fetching books:', error.message);
    throw error;
  }
}
