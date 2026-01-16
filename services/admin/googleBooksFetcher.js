/**
 * Google Books Fetcher Service
 * 
 * Fetches book metadata from Google Books API.
 * Implements rate limiting and metadata normalization.
 * 
 * Requirements: 9.1, 9.3
 */

export const USER_AGENT = 'DrizaiknDigitalLibrary/1.0 (Educational Library System; contact@drizaikn.edu)';
export const DEFAULT_LIMIT = 20;
export const DEFAULT_DELAY_MS = 300;
export const API_BASE_URL = 'https://www.googleapis.com/books/v1/volumes';

/**
 * Delays execution for rate limiting
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Builds the Google Books API URL
 * @param {Object} options - Search options
 * @param {string} options.query - Search query
 * @param {string} [options.author] - Author filter
 * @param {string} [options.subject] - Subject/genre filter
 * @param {number} [options.limit] - Number of results
 * @param {number} [options.startIndex] - Start index for pagination
 * @returns {string} API URL
 */
export function buildSearchUrl(options = {}) {
  const limit = Math.min(options.limit || DEFAULT_LIMIT, 40); // Google Books max is 40
  const startIndex = options.startIndex || 0;
  
  let queryParts = [];
  
  if (options.query) {
    queryParts.push(options.query);
  }
  
  if (options.author) {
    queryParts.push(`inauthor:${options.author}`);
  }
  
  if (options.subject) {
    queryParts.push(`subject:${options.subject}`);
  }
  
  const query = encodeURIComponent(queryParts.join('+'));
  
  let url = `${API_BASE_URL}?q=${query}&maxResults=${limit}&startIndex=${startIndex}`;
  
  // Add API key if available
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (apiKey) {
    url += `&key=${apiKey}`;
  }
  
  return url;
}

/**
 * Extracts the best cover URL from Google Books data
 * @param {Object} volumeInfo - Google Books volume info
 * @returns {string|null} Cover URL or null
 */
export function getCoverUrl(volumeInfo) {
  if (!volumeInfo.imageLinks) {
    return null;
  }
  
  // Prefer larger images
  return volumeInfo.imageLinks.thumbnail 
    || volumeInfo.imageLinks.smallThumbnail 
    || null;
}

/**
 * Determines access type based on Google Books access info
 * @param {Object} item - Google Books item
 * @returns {string} Access type
 */
export function determineAccessType(item) {
  const accessInfo = item.accessInfo || {};
  const volumeInfo = item.volumeInfo || {};
  
  // Check if fully available
  if (accessInfo.accessViewStatus === 'FULL_PUBLIC_DOMAIN') {
    return 'public_domain';
  }
  
  // Check publication year for public domain
  const publishedDate = volumeInfo.publishedDate;
  if (publishedDate) {
    const year = parseInt(publishedDate.substring(0, 4), 10);
    if (year && year < 1928) {
      return 'public_domain';
    }
  }
  
  // Check if has epub or pdf available
  if (accessInfo.epub?.isAvailable || accessInfo.pdf?.isAvailable) {
    if (accessInfo.viewability === 'ALL_PAGES') {
      return 'open_access';
    }
  }
  
  // Check viewability
  if (accessInfo.viewability === 'PARTIAL' || accessInfo.viewability === 'NO_PAGES') {
    return 'preview_only';
  }
  
  return 'preview_only';
}

/**
 * Normalizes Google Books item to standard book format
 * @param {Object} item - Raw item from API
 * @returns {Object} Normalized book metadata
 */
export function normalizeBook(item) {
  const volumeInfo = item.volumeInfo || {};
  
  return {
    identifier: item.id,
    title: volumeInfo.title || 'Unknown Title',
    author: Array.isArray(volumeInfo.authors) 
      ? volumeInfo.authors.join(', ') 
      : (volumeInfo.authors || 'Unknown Author'),
    description: volumeInfo.description || null,
    year: volumeInfo.publishedDate 
      ? parseInt(volumeInfo.publishedDate.substring(0, 4), 10) || null
      : null,
    coverUrl: getCoverUrl(volumeInfo),
    isbn: getIsbn(volumeInfo),
    language: volumeInfo.language || null,
    subjects: volumeInfo.categories || [],
    pageCount: volumeInfo.pageCount || null,
    publisher: volumeInfo.publisher || null,
    source: 'google_books',
    accessType: determineAccessType(item),
    previewLink: volumeInfo.previewLink || null,
    infoLink: volumeInfo.infoLink || null,
    // Metadata completeness score (for source preference)
    completenessScore: calculateCompletenessScore(volumeInfo)
  };
}


/**
 * Extracts ISBN from volume info
 * @param {Object} volumeInfo - Google Books volume info
 * @returns {string|null} ISBN or null
 */
export function getIsbn(volumeInfo) {
  if (!volumeInfo.industryIdentifiers) {
    return null;
  }
  
  // Prefer ISBN-13
  const isbn13 = volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_13');
  if (isbn13) {
    return isbn13.identifier;
  }
  
  // Fall back to ISBN-10
  const isbn10 = volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_10');
  if (isbn10) {
    return isbn10.identifier;
  }
  
  return null;
}

/**
 * Calculates metadata completeness score
 * @param {Object} volumeInfo - Google Books volume info
 * @returns {number} Score from 0-100
 */
export function calculateCompletenessScore(volumeInfo) {
  let score = 0;
  
  if (volumeInfo.title) score += 15;
  if (volumeInfo.authors && volumeInfo.authors.length > 0) score += 15;
  if (volumeInfo.publishedDate) score += 10;
  if (volumeInfo.description) score += 15;
  if (volumeInfo.imageLinks) score += 10;
  if (volumeInfo.industryIdentifiers && volumeInfo.industryIdentifiers.length > 0) score += 10;
  if (volumeInfo.categories && volumeInfo.categories.length > 0) score += 10;
  if (volumeInfo.language) score += 5;
  if (volumeInfo.publisher) score += 5;
  if (volumeInfo.pageCount) score += 5;
  
  return score;
}

/**
 * Fetches books from Google Books API
 * @param {Object} options - Search options
 * @param {string} options.query - Search query
 * @param {string} [options.author] - Author filter
 * @param {string} [options.subject] - Subject/genre filter
 * @param {number} [options.yearFrom] - Start year filter (post-filter)
 * @param {number} [options.yearTo] - End year filter (post-filter)
 * @param {number} [options.limit] - Number of results (default: 20, max: 40)
 * @param {number} [options.startIndex] - Start index for pagination
 * @param {number} [options.delayMs] - Delay between requests (default: 300)
 * @returns {Promise<{books: Array, total: number}>}
 */
export async function searchBooks(options = {}) {
  const delayMs = options.delayMs || DEFAULT_DELAY_MS;
  const url = buildSearchUrl(options);
  
  console.log(`[GoogleBooksFetcher] Searching Google Books...`);
  console.log(`[GoogleBooksFetcher] URL: ${url.replace(/key=[^&]+/, 'key=***')}`);
  
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
      console.log(`[GoogleBooksFetcher] Rate limited. Waiting ${retryAfter} seconds...`);
      await delay(parseInt(retryAfter, 10) * 1000);
      return searchBooks(options);
    }
    
    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.items || !Array.isArray(data.items)) {
      console.log('[GoogleBooksFetcher] No items found in response');
      return { books: [], total: 0 };
    }
    
    let books = data.items
      .filter(item => item.id && item.volumeInfo) // Must have identifier and info
      .map(normalizeBook);
    
    // Apply year range filter (Google Books API doesn't support year range directly)
    if (options.yearFrom || options.yearTo) {
      books = books.filter(book => {
        if (!book.year) return false;
        if (options.yearFrom && book.year < options.yearFrom) return false;
        if (options.yearTo && book.year > options.yearTo) return false;
        return true;
      });
    }
    
    console.log(`[GoogleBooksFetcher] Found ${books.length} books (total: ${data.totalItems || 0})`);
    
    return {
      books,
      total: data.totalItems || 0
    };
  } catch (error) {
    console.error('[GoogleBooksFetcher] Error searching books:', error.message);
    throw error;
  }
}

/**
 * Gets detailed book information by volume ID
 * @param {string} volumeId - Google Books volume ID
 * @returns {Promise<Object|null>} Book details or null
 */
export async function getBookDetails(volumeId) {
  if (!volumeId) {
    return null;
  }
  
  let url = `${API_BASE_URL}/${volumeId}`;
  
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (apiKey) {
    url += `?key=${apiKey}`;
  }
  
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
    
    const item = await response.json();
    return normalizeBook(item);
  } catch (error) {
    console.error('[GoogleBooksFetcher] Error getting book details:', error.message);
    return null;
  }
}
