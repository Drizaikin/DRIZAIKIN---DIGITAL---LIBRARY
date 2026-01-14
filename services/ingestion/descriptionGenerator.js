/**
 * AI Description Generator Service
 * 
 * Generates book descriptions using OpenRouter AI API
 * Similar to manual upload AI extraction but optimized for ingestion
 * 
 * Requirements: Generate descriptions for ingested books
 */

/**
 * Check if AI description generation is enabled
 * @returns {boolean}
 */
export function isDescriptionGenerationEnabled() {
  return !!process.env.OPENROUTER_API_KEY;
}

/**
 * Get the OpenRouter API key from environment
 * @returns {string|undefined}
 */
function getApiKey() {
  return process.env.OPENROUTER_API_KEY;
}

/**
 * Get the OpenRouter model from environment
 * @returns {string}
 */
function getModel() {
  return process.env.OPENROUTER_EXTRACTION_MODEL || 'openai/gpt-4o-mini';
}

/**
 * Generate AI description for a book
 * @param {Object} book - Book metadata
 * @param {string} book.title - Book title
 * @param {string} book.author - Book author
 * @param {number} [book.year] - Publication year
 * @param {string} [book.description] - Existing description from source
 * @returns {Promise<string|null>} Generated description or null if failed
 */
export async function generateDescription(book) {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.log('[DescriptionGenerator] OpenRouter API key not configured, skipping AI description');
    return null;
  }

  const title = book.title || 'Unknown';
  const author = book.author || 'Unknown';
  const year = book.year || 'Unknown';
  const existingDesc = book.description ? book.description.substring(0, 500) : '';

  console.log(`[DescriptionGenerator] Generating description for: ${title} by ${author}`);

  const prompt = `You are an expert librarian writing book descriptions for a digital library catalog.

Book Information:
- Title: ${title}
- Author: ${author}
- Year: ${year}
${existingDesc ? `- Source Description: ${existingDesc}` : ''}

TASK: Write a professional, engaging book description (150-200 words) that includes:
1. Main subject matter and themes
2. Key topics or content covered
3. Target audience (students, professionals, general readers)
4. What makes this book valuable or noteworthy
5. Historical or cultural context if relevant

The description should be informative, accurate, and suitable for a library catalog.
${existingDesc ? 'You may use the source description as reference but expand and improve it.' : ''}

Respond with ONLY the description text, no JSON, no formatting, just the paragraph.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://drizaikn-library.vercel.app',
        'X-Title': 'Drizaikn Digital Library'
      },
      body: JSON.stringify({
        model: getModel(),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[DescriptionGenerator] API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    const description = data.choices[0]?.message?.content?.trim();

    if (description && description.length > 50) {
      console.log(`[DescriptionGenerator] Generated description (${description.length} chars)`);
      return description;
    } else {
      console.warn(`[DescriptionGenerator] Generated description too short or empty`);
      return null;
    }
  } catch (error) {
    console.error(`[DescriptionGenerator] Error generating description: ${error.message}`);
    return null;
  }
}

/**
 * Generate descriptions for multiple books (batch processing)
 * @param {Array<Object>} books - Array of book metadata objects
 * @param {number} [delayMs=1000] - Delay between API calls to avoid rate limiting
 * @returns {Promise<Map<string, string>>} Map of book identifiers to descriptions
 */
export async function generateDescriptionsBatch(books, delayMs = 1000) {
  const descriptions = new Map();

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    const identifier = book.identifier || book.source_identifier || `book_${i}`;

    try {
      const description = await generateDescription(book);
      if (description) {
        descriptions.set(identifier, description);
      }
    } catch (error) {
      console.error(`[DescriptionGenerator] Failed to generate description for ${identifier}: ${error.message}`);
    }

    // Add delay between requests (except for last book)
    if (i < books.length - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return descriptions;
}
