/**
 * Genre Taxonomy Module
 * 
 * Defines the strict controlled vocabulary for book genres and sub-genres.
 * All genre validation uses these arrays - modify here to extend taxonomy.
 * 
 * Requirements: 2.1, 2.2, 2.5, 8.1
 */

/**
 * Primary genres - AI must choose 1-3 from this list only
 * To add a new genre, simply add it to this array.
 */
export const PRIMARY_GENRES = [
  'Philosophy',
  'Religion',
  'Theology',
  'Sacred Texts',
  'History',
  'Biography',
  'Science',
  'Mathematics',
  'Medicine',
  'Law',
  'Politics',
  'Economics',
  'Literature',
  'Poetry',
  'Drama',
  'Mythology',
  'Military & Strategy',
  'Education',
  'Linguistics',
  'Ethics',
  'Anthropology',
  'Sociology',
  'Psychology',
  'Geography',
  'Astronomy',
  'Alchemy & Esoterica',
  'Art & Architecture'
];

/**
 * Sub-genres - AI may optionally choose 1 from this list
 * To add a new sub-genre, simply add it to this array.
 */
export const SUB_GENRES = [
  'Ancient',
  'Medieval',
  'Classical',
  'Early Modern',
  'Commentary',
  'Translation',
  'Manuscript',
  'Legal Code',
  'Canonical Text'
];

// Create lowercase lookup maps for case-insensitive matching
const PRIMARY_GENRES_MAP = new Map(
  PRIMARY_GENRES.map(g => [g.toLowerCase(), g])
);

const SUB_GENRES_MAP = new Map(
  SUB_GENRES.map(g => [g.toLowerCase(), g])
);

/**
 * Validates and normalizes a single genre against the taxonomy
 * @param {string} genre - Genre string to validate
 * @returns {string|null} Normalized genre or null if invalid
 */
export function validateGenre(genre) {
  if (!genre || typeof genre !== 'string') {
    return null;
  }
  
  const normalized = genre.trim().toLowerCase();
  return PRIMARY_GENRES_MAP.get(normalized) || null;
}

/**
 * Validates and filters an array of genres against the taxonomy
 * Returns only valid genres, preserving order
 * 
 * @param {string[]} genres - Array of genre strings
 * @returns {string[]} Filtered array of valid genres only (max 3)
 */
export function validateGenres(genres) {
  if (!Array.isArray(genres)) {
    return [];
  }
  
  const validGenres = [];
  const seen = new Set();
  
  for (const genre of genres) {
    const valid = validateGenre(genre);
    if (valid && !seen.has(valid.toLowerCase())) {
      seen.add(valid.toLowerCase());
      validGenres.push(valid);
      
      // Limit to 3 genres
      if (validGenres.length >= 3) {
        break;
      }
    }
  }
  
  return validGenres;
}

/**
 * Validates a sub-genre against the taxonomy
 * @param {string} subgenre - Sub-genre string to validate
 * @returns {string|null} Normalized sub-genre or null if invalid
 */
export function validateSubgenre(subgenre) {
  if (!subgenre || typeof subgenre !== 'string') {
    return null;
  }
  
  const normalized = subgenre.trim().toLowerCase();
  return SUB_GENRES_MAP.get(normalized) || null;
}

/**
 * Checks if a genre is valid (exists in taxonomy)
 * @param {string} genre - Genre to check
 * @returns {boolean} True if valid
 */
export function isValidGenre(genre) {
  return validateGenre(genre) !== null;
}

/**
 * Checks if a sub-genre is valid (exists in taxonomy)
 * @param {string} subgenre - Sub-genre to check
 * @returns {boolean} True if valid
 */
export function isValidSubgenre(subgenre) {
  return validateSubgenre(subgenre) !== null;
}

/**
 * Gets all valid primary genres (for reference/display)
 * @returns {string[]} Copy of PRIMARY_GENRES array
 */
export function getAllGenres() {
  return [...PRIMARY_GENRES];
}

/**
 * Gets all valid sub-genres (for reference/display)
 * @returns {string[]} Copy of SUB_GENRES array
 */
export function getAllSubgenres() {
  return [...SUB_GENRES];
}
