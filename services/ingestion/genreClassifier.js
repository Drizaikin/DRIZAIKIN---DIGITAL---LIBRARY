/**
 * Genre Classifier Service
 * 
 * Uses OpenRouter AI API to classify books into genres from a strict taxonomy.
 * Designed to be non-blocking - failures never stop book ingestion.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 6.1, 6.2, 6.5
 */

import { validateGenres, validateSubgenre, PRIMARY_GENRES, SUB_GENRES } from './genreTaxonomy.js';

// Configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// Environment-based configuration
const getConfig = () => ({
  apiKey: process.env.OPENROUTER_API_KEY,
  model: process.env.GENRE_CLASSIFIER_MODEL || DEFAULT_MODEL,
  timeout: parseInt(process.env.GENRE_CLASSIFIER_TIMEOUT, 10) || DEFAULT_TIMEOUT_MS,
  enabled: process.env.ENABLE_GENRE_CLASSIFICATION !== 'false',
  mockMode: process.env.MOCK_GENRE_CLASSIFIER === 'true'
});

/**
 * Check if classification is enabled
 * @returns {boolean} True if classification should run
 */
export function isClassificationEnabled() {
  const config = getConfig();
  return config.enabled && (config.mockMode || !!config.apiKey);
}

/**
 * Builds the AI prompt with book metadata and taxonomy
 * @param {Object} book - Book metadata
 * @returns {string} Formatted prompt
 */
export function buildPrompt(book) {
  const title = book.title || 'Unknown';
  const author = book.author || 'Unknown';
  const year = book.year || 'Unknown';
  const description = book.description ? book.description.substring(0, 500) : 'No description available';
  
  return `You are a librarian classifying public-domain books. Analyze the book and assign genres.

BOOK INFORMATION:
Title: ${title}
Author: ${author}
Year: ${year}
Description: ${description}
Source: Internet Archive

ALLOWED PRIMARY GENRES (choose 1-3):
${PRIMARY_GENRES.join(', ')}

ALLOWED SUB-GENRES (choose 0-1):
${SUB_GENRES.join(', ')}

RULES:
1. Choose 1-3 primary genres that best describe the book
2. Optionally choose 1 sub-genre if applicable
3. Use ONLY genres from the lists above - do not invent new ones
4. Respond with ONLY valid JSON, no explanations or extra text

RESPONSE FORMAT (JSON only):
{"genres": ["Genre1", "Genre2"], "subgenre": "SubGenre"}

If no sub-genre applies, use: {"genres": ["Genre1"], "subgenre": null}`;
}


/**
 * Mock responses for testing without API calls
 */
const MOCK_RESPONSES = {
  philosophy: { genres: ['Philosophy', 'Ethics'], subgenre: 'Ancient' },
  religion: { genres: ['Religion', 'Theology'], subgenre: 'Canonical Text' },
  history: { genres: ['History', 'Biography'], subgenre: 'Medieval' },
  science: { genres: ['Science', 'Mathematics'], subgenre: null },
  literature: { genres: ['Literature', 'Poetry'], subgenre: 'Classical' },
  law: { genres: ['Law', 'Politics'], subgenre: 'Legal Code' },
  default: { genres: ['Literature'], subgenre: null }
};

/**
 * Get mock classification based on title keywords
 * @param {Object} book - Book metadata
 * @returns {Object} Mock classification result
 */
function getMockClassification(book) {
  const title = (book.title || '').toLowerCase();
  
  if (title.includes('philosoph') || title.includes('plato') || title.includes('aristotle')) {
    return MOCK_RESPONSES.philosophy;
  }
  if (title.includes('bible') || title.includes('religion') || title.includes('god') || title.includes('church')) {
    return MOCK_RESPONSES.religion;
  }
  if (title.includes('history') || title.includes('war') || title.includes('empire')) {
    return MOCK_RESPONSES.history;
  }
  if (title.includes('science') || title.includes('math') || title.includes('physics')) {
    return MOCK_RESPONSES.science;
  }
  if (title.includes('law') || title.includes('legal') || title.includes('court')) {
    return MOCK_RESPONSES.law;
  }
  if (title.includes('poem') || title.includes('poetry') || title.includes('verse')) {
    return MOCK_RESPONSES.literature;
  }
  
  return MOCK_RESPONSES.default;
}

/**
 * Parses and validates AI response
 * @param {string} response - Raw AI response text
 * @returns {{genres: string[], subgenre: string|null} | null} Parsed result or null
 */
export function parseResponse(response) {
  if (!response || typeof response !== 'string') {
    console.warn('[GenreClassifier] Empty or invalid response');
    return null;
  }
  
  // Try to extract JSON from response (AI might include extra text)
  let jsonStr = response.trim();
  
  // Look for JSON object in the response
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }
  
  try {
    const parsed = JSON.parse(jsonStr);
    
    // Validate structure
    if (!parsed || typeof parsed !== 'object') {
      console.warn('[GenreClassifier] Response is not an object');
      return null;
    }
    
    // Genres must be an array
    if (!Array.isArray(parsed.genres)) {
      console.warn('[GenreClassifier] Response missing genres array');
      return null;
    }
    
    // Validate and filter genres against taxonomy
    const validGenres = validateGenres(parsed.genres);
    
    // Must have at least 1 valid genre
    if (validGenres.length === 0) {
      console.warn('[GenreClassifier] No valid genres in response');
      return null;
    }
    
    // Validate sub-genre (optional)
    const validSubgenre = validateSubgenre(parsed.subgenre);
    
    return {
      genres: validGenres,
      subgenre: validSubgenre
    };
    
  } catch (error) {
    console.warn(`[GenreClassifier] Failed to parse JSON: ${error.message}`);
    return null;
  }
}


/**
 * Calls the OpenRouter API with retry logic
 * @param {string} prompt - The prompt to send
 * @param {Object} config - Configuration object
 * @returns {Promise<string|null>} AI response text or null
 */
async function callOpenRouterAPI(prompt, config) {
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
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3 // Lower temperature for more consistent results
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[GenreClassifier] API error ${response.status}: ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.warn('[GenreClassifier] Invalid API response structure');
      return null;
    }
    
    return data.choices[0].message.content;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.warn('[GenreClassifier] API request timed out');
    } else {
      console.warn(`[GenreClassifier] API request failed: ${error.message}`);
    }
    
    return null;
  }
}

/**
 * Classifies a book's genres using AI
 * Returns null on any failure (non-blocking)
 * 
 * @param {Object} book - Book metadata
 * @param {string} book.title - Book title
 * @param {string} [book.author] - Book author
 * @param {number} [book.year] - Publication year
 * @param {string} [book.description] - Book description
 * @returns {Promise<{genres: string[], subgenre: string|null} | null>}
 */
export async function classifyBook(book) {
  if (!book || !book.title) {
    console.warn('[GenreClassifier] Missing book title');
    return null;
  }
  
  const config = getConfig();
  
  // Check if classification is enabled
  if (!config.enabled) {
    console.log('[GenreClassifier] Classification disabled');
    return null;
  }
  
  // Use mock mode for testing
  if (config.mockMode) {
    console.log('[GenreClassifier] Using mock classification');
    return getMockClassification(book);
  }
  
  // Check for API key
  if (!config.apiKey) {
    console.warn('[GenreClassifier] No API key configured');
    return null;
  }
  
  console.log(`[GenreClassifier] Classifying: ${book.title}`);
  
  // Build prompt
  const prompt = buildPrompt(book);
  
  // Try API call with retries
  let lastError = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const responseText = await callOpenRouterAPI(prompt, config);
      
      if (responseText) {
        const result = parseResponse(responseText);
        
        if (result) {
          console.log(`[GenreClassifier] Classified as: ${result.genres.join(', ')}${result.subgenre ? ` (${result.subgenre})` : ''}`);
          return result;
        }
      }
      
      // If we got here, response was invalid
      if (attempt < MAX_RETRIES) {
        console.log(`[GenreClassifier] Attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
      
    } catch (error) {
      lastError = error;
      console.warn(`[GenreClassifier] Attempt ${attempt} error: ${error.message}`);
      
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
  }
  
  console.warn(`[GenreClassifier] All attempts failed for: ${book.title}`);
  return null;
}

/**
 * Batch classify multiple books (for efficiency)
 * @param {Object[]} books - Array of book metadata
 * @returns {Promise<Map<string, {genres: string[], subgenre: string|null}>>}
 */
export async function classifyBooks(books) {
  const results = new Map();
  
  for (const book of books) {
    const identifier = book.identifier || book.title;
    const result = await classifyBook(book);
    
    if (result) {
      results.set(identifier, result);
    }
    
    // Small delay between API calls to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}
