/**
 * AI Book Search Service
 * 
 * Provides AI-powered book search across multiple sources with relevance ranking.
 * Integrates Internet Archive, Open Library, and Google Books APIs.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 9.1
 */

import { createClient } from '@supabase/supabase-js';
import * as openLibraryFetcher from './openLibraryFetcher.js';
import * as googleBooksFetcher from './googleBooksFetcher.js';

// Configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_LIMIT = 20;

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
 * Get configuration from environment
 * @returns {Object} Configuration object
 */
function getConfig() {
  return {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.AI_SEARCH_MODEL || DEFAULT_MODEL,
    timeout: parseInt(process.env.AI_SEARCH_TIMEOUT, 10) || DEFAULT_TIMEOUT_MS,
    enableAIRanking: process.env.ENABLE_AI_RANKING !== 'false'
  };
}

/**
 * Delays execution for rate limiting
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Searches Internet Archive for books
 * @param {Object} options - Search options
 * @returns {Promise<{books: Array, total: number}>}
 */
export async function searchInternetArchive(options = {}) {
  const { query, author, yearFrom, yearTo, limit = DEFAULT_LIMIT } = options;
  
  // Build Internet Archive query
  let queryParts = ['mediatype:texts', 'format:pdf'];
  
  if (query) {
    queryParts.push(`(title:${query} OR description:${query})`);
  }
  
  if (author) {
    queryParts.push(`creator:${author}`);
  }
  
  // Year range filter
  if (yearFrom && yearTo) {
    queryParts.push(`date:[${yearFrom} TO ${yearTo}]`);
  } else if (yearFrom) {
    queryParts.push(`date:[${yearFrom} TO *]`);
  } else if (yearTo) {
    queryParts.push(`date:[* TO ${yearTo}]`);
  }
  
  const iaQuery = encodeURIComponent(queryParts.join(' AND '));
  const fields = 'identifier,title,creator,date,language,description';
  const url = `https://archive.org/advancedsearch.php?q=${iaQuery}&fl[]=${fields}&sort[]=downloads+desc&rows=${limit}&output=json`;
  
  console.log(`[AIBookSearch] Searching Internet Archive...`);
  
  try {
    await delay(500);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'DrizaiknDigitalLibrary/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Internet Archive API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.response || !Array.isArray(data.response.docs)) {
      return { books: [], total: 0 };
    }
    
    const books = data.response.docs
      .filter(doc => doc.identifier)
      .map(doc => normalizeInternetArchiveBook(doc));
    
    console.log(`[AIBookSearch] Internet Archive found ${books.length} books`);
    
    return {
      books,
      total: data.response.numFound || books.length
    };
  } catch (error) {
    console.error('[AIBookSearch] Internet Archive error:', error.message);
    return { books: [], total: 0 };
  }
}


/**
 * Normalizes Internet Archive document to standard format
 * @param {Object} doc - Internet Archive document
 * @returns {Object} Normalized book
 */
export function normalizeInternetArchiveBook(doc) {
  const year = doc.date ? parseInt(doc.date.substring(0, 4), 10) : null;
  
  return {
    identifier: doc.identifier,
    title: doc.title || 'Unknown Title',
    author: Array.isArray(doc.creator) 
      ? doc.creator.join(', ') 
      : (doc.creator || 'Unknown Author'),
    description: Array.isArray(doc.description) 
      ? doc.description.join(' ') 
      : (doc.description || null),
    year: year,
    coverUrl: `https://archive.org/services/img/${doc.identifier}`,
    language: Array.isArray(doc.language) ? doc.language[0] : doc.language,
    source: 'internet_archive',
    accessType: determineInternetArchiveAccessType(year),
    completenessScore: calculateIACompletenessScore(doc)
  };
}

/**
 * Determines access type for Internet Archive books
 * @param {number|null} year - Publication year
 * @returns {string} Access type
 */
function determineInternetArchiveAccessType(year) {
  // Internet Archive primarily hosts public domain content
  if (year && year < 1928) {
    return 'public_domain';
  }
  // Books after 1927 might still be public domain or open access
  return 'open_access';
}

/**
 * Calculates completeness score for Internet Archive books
 * @param {Object} doc - Internet Archive document
 * @returns {number} Score from 0-100
 */
function calculateIACompletenessScore(doc) {
  let score = 0;
  
  if (doc.title) score += 20;
  if (doc.creator) score += 20;
  if (doc.date) score += 15;
  if (doc.description) score += 20;
  if (doc.language) score += 10;
  if (doc.identifier) score += 15;
  
  return score;
}

/**
 * Checks which books already exist in the library
 * @param {Array} books - Array of books to check
 * @returns {Promise<Set<string>>} Set of existing identifiers
 */
export async function checkExistingBooks(books) {
  const client = getSupabase();
  const existingIdentifiers = new Set();
  
  if (!books || books.length === 0) {
    return existingIdentifiers;
  }
  
  // Get all identifiers to check
  const identifiers = books.map(b => b.identifier).filter(Boolean);
  const titles = books.map(b => b.title?.toLowerCase()).filter(Boolean);
  
  try {
    // Check by source_identifier
    if (identifiers.length > 0) {
      const { data: byIdentifier } = await client
        .from('books')
        .select('source_identifier')
        .in('source_identifier', identifiers);
      
      if (byIdentifier) {
        byIdentifier.forEach(b => existingIdentifiers.add(b.source_identifier));
      }
    }
    
    // Also check by title (fuzzy match for duplicates)
    if (titles.length > 0) {
      const { data: byTitle } = await client
        .from('books')
        .select('title, source_identifier')
        .in('title', books.map(b => b.title));
      
      if (byTitle) {
        byTitle.forEach(b => {
          if (b.source_identifier) {
            existingIdentifiers.add(b.source_identifier);
          }
        });
      }
    }
    
    console.log(`[AIBookSearch] Found ${existingIdentifiers.size} existing books in library`);
    return existingIdentifiers;
  } catch (error) {
    console.error('[AIBookSearch] Error checking existing books:', error.message);
    return existingIdentifiers;
  }
}

/**
 * Builds AI prompt for relevance ranking
 * @param {string} query - Original search query
 * @param {Array} books - Books to rank
 * @returns {string} AI prompt
 */
function buildRankingPrompt(query, books) {
  const bookList = books.slice(0, 20).map((book, index) => 
    `${index + 1}. "${book.title}" by ${book.author} (${book.year || 'Unknown year'}) - ${(book.description || '').substring(0, 100)}...`
  ).join('\n');
  
  return `You are a librarian helping to rank book search results by relevance.

SEARCH QUERY: "${query}"

BOOKS TO RANK:
${bookList}

TASK: Rank these books by relevance to the search query. Consider:
1. How well the title matches the query
2. How relevant the author is (if searching for an author)
3. How well the description matches the topic
4. Educational and scholarly value

RESPONSE FORMAT (JSON only, no explanations):
{"rankings": [{"index": 1, "score": 95}, {"index": 2, "score": 80}, ...]}

Score from 0-100 where 100 is most relevant. Include ALL books in the rankings.`;
}


/**
 * Calls OpenRouter API for relevance ranking
 * @param {string} prompt - The ranking prompt
 * @param {Object} config - Configuration
 * @returns {Promise<Object|null>} Rankings or null
 */
async function callOpenRouterForRanking(prompt, config) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);
  
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'HTTP-Referer': 'https://puea-library.vercel.app',
        'X-Title': 'PUEA Digital Library'
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.3
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`[AIBookSearch] Ranking API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      return null;
    }
    
    // Parse JSON from response
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return null;
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn(`[AIBookSearch] Ranking error: ${error.message}`);
    return null;
  }
}

/**
 * Applies AI-powered relevance ranking to search results
 * @param {string} query - Original search query
 * @param {Array} books - Books to rank
 * @returns {Promise<Array>} Books with relevance scores
 */
export async function rankByRelevance(query, books) {
  const config = getConfig();
  
  // If AI ranking is disabled or no API key, use basic scoring
  if (!config.enableAIRanking || !config.apiKey) {
    console.log('[AIBookSearch] Using basic relevance scoring');
    return applyBasicScoring(query, books);
  }
  
  console.log(`[AIBookSearch] Applying AI relevance ranking to ${books.length} books`);
  
  const prompt = buildRankingPrompt(query, books);
  const rankings = await callOpenRouterForRanking(prompt, config);
  
  if (!rankings?.rankings) {
    console.log('[AIBookSearch] AI ranking failed, using basic scoring');
    return applyBasicScoring(query, books);
  }
  
  // Apply AI scores to books
  const scoreMap = new Map();
  rankings.rankings.forEach(r => {
    if (r.index && typeof r.score === 'number') {
      scoreMap.set(r.index, r.score);
    }
  });
  
  return books.map((book, index) => ({
    ...book,
    relevanceScore: scoreMap.get(index + 1) || 50
  })).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Applies basic keyword-based relevance scoring
 * @param {string} query - Search query
 * @param {Array} books - Books to score
 * @returns {Array} Books with relevance scores
 */
export function applyBasicScoring(query, books) {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  
  return books.map(book => {
    let score = 50; // Base score
    
    const titleLower = (book.title || '').toLowerCase();
    const authorLower = (book.author || '').toLowerCase();
    const descLower = (book.description || '').toLowerCase();
    
    // Exact title match
    if (titleLower === queryLower) {
      score += 40;
    } else if (titleLower.includes(queryLower)) {
      score += 25;
    }
    
    // Word matches in title
    queryWords.forEach(word => {
      if (titleLower.includes(word)) score += 5;
    });
    
    // Author match
    if (authorLower.includes(queryLower)) {
      score += 20;
    }
    queryWords.forEach(word => {
      if (authorLower.includes(word)) score += 3;
    });
    
    // Description match
    queryWords.forEach(word => {
      if (descLower.includes(word)) score += 2;
    });
    
    // Bonus for completeness
    score += Math.floor((book.completenessScore || 0) / 10);
    
    return {
      ...book,
      relevanceScore: Math.min(100, score)
    };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}


/**
 * Merges and deduplicates books from multiple sources
 * Prefers source with highest completeness score
 * @param {Array} allBooks - Books from all sources
 * @returns {Array} Deduplicated books
 */
export function mergeAndDeduplicate(allBooks) {
  const bookMap = new Map();
  
  allBooks.forEach(book => {
    // Create a normalized key for deduplication
    const titleKey = (book.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const authorKey = (book.author || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    const key = `${titleKey}-${authorKey}`;
    
    const existing = bookMap.get(key);
    
    if (!existing) {
      bookMap.set(key, book);
    } else {
      // Keep the one with higher completeness score
      if ((book.completenessScore || 0) > (existing.completenessScore || 0)) {
        bookMap.set(key, {
          ...book,
          // Preserve info about other sources
          otherSources: [...(existing.otherSources || []), existing.source]
        });
      } else {
        existing.otherSources = [...(existing.otherSources || []), book.source];
      }
    }
  });
  
  return Array.from(bookMap.values());
}

/**
 * Applies genre and author filters from configuration
 * @param {Array} books - Books to filter
 * @param {Object} filters - Filter configuration
 * @returns {Array} Filtered books
 */
export function applyConfiguredFilters(books, filters = {}) {
  let filtered = [...books];
  
  // Apply genre filter
  if (filters.genre) {
    const genreLower = filters.genre.toLowerCase();
    filtered = filtered.filter(book => {
      const subjects = book.subjects || [];
      return subjects.some(s => s.toLowerCase().includes(genreLower));
    });
  }
  
  // Apply access type filter
  if (filters.accessType && filters.accessType.length > 0) {
    filtered = filtered.filter(book => 
      filters.accessType.includes(book.accessType)
    );
  }
  
  return filtered;
}

/**
 * Main search function - searches multiple sources in parallel
 * @param {Object} criteria - Search criteria
 * @param {string} criteria.query - Search query (required)
 * @param {string} [criteria.topic] - Topic filter
 * @param {string} [criteria.author] - Author filter
 * @param {number} [criteria.yearFrom] - Start year
 * @param {number} [criteria.yearTo] - End year
 * @param {string} [criteria.genre] - Genre filter
 * @param {string[]} [criteria.sources] - Sources to search
 * @param {string[]} [criteria.accessType] - Access type filter
 * @param {number} [criteria.limit] - Results limit
 * @returns {Promise<Object>} Search results
 */
export async function searchBooks(criteria) {
  if (!criteria.query || typeof criteria.query !== 'string') {
    return {
      success: false,
      error: 'Search query is required'
    };
  }
  
  const query = criteria.query.trim();
  const limit = criteria.limit || DEFAULT_LIMIT;
  const sources = criteria.sources || ['internet_archive', 'open_library', 'google_books'];
  
  console.log(`[AIBookSearch] Searching for: "${query}" across ${sources.join(', ')}`);
  
  const searchOptions = {
    query: criteria.topic ? `${query} ${criteria.topic}` : query,
    author: criteria.author,
    yearFrom: criteria.yearFrom,
    yearTo: criteria.yearTo,
    limit: Math.ceil(limit * 1.5) // Fetch extra to account for deduplication
  };
  
  // Search all enabled sources in parallel
  const searchPromises = [];
  const sourceBreakdown = {
    internet_archive: 0,
    open_library: 0,
    google_books: 0
  };
  
  if (sources.includes('internet_archive')) {
    searchPromises.push(
      searchInternetArchive(searchOptions)
        .then(result => {
          sourceBreakdown.internet_archive = result.books.length;
          return result.books;
        })
        .catch(() => [])
    );
  }
  
  if (sources.includes('open_library')) {
    searchPromises.push(
      openLibraryFetcher.searchBooks(searchOptions)
        .then(result => {
          sourceBreakdown.open_library = result.books.length;
          return result.books;
        })
        .catch(() => [])
    );
  }
  
  if (sources.includes('google_books')) {
    searchPromises.push(
      googleBooksFetcher.searchBooks({
        ...searchOptions,
        subject: criteria.genre
      })
        .then(result => {
          sourceBreakdown.google_books = result.books.length;
          return result.books;
        })
        .catch(() => [])
    );
  }
  
  // Wait for all searches to complete
  const results = await Promise.all(searchPromises);
  const allBooks = results.flat();
  
  console.log(`[AIBookSearch] Total raw results: ${allBooks.length}`);
  
  // Merge and deduplicate
  let books = mergeAndDeduplicate(allBooks);
  console.log(`[AIBookSearch] After deduplication: ${books.length}`);
  
  // Apply configured filters
  books = applyConfiguredFilters(books, {
    genre: criteria.genre,
    accessType: criteria.accessType
  });
  console.log(`[AIBookSearch] After filtering: ${books.length}`);
  
  // Check for existing books in library
  const existingIdentifiers = await checkExistingBooks(books);
  
  // Mark books already in library
  books = books.map(book => ({
    ...book,
    alreadyInLibrary: existingIdentifiers.has(book.identifier)
  }));
  
  // Apply AI relevance ranking
  books = await rankByRelevance(query, books);
  
  // Limit results
  books = books.slice(0, limit);
  
  return {
    success: true,
    results: books,
    total: books.length,
    query,
    sourceBreakdown
  };
}

export { DEFAULT_LIMIT, DEFAULT_TIMEOUT_MS };
