/**
 * Metadata Extractor Service
 * 
 * Uses Gemini AI (via OpenRouter) to extract book metadata from PDF content.
 * Handles PDF text extraction, AI-powered metadata generation, and cover image fetching.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Book metadata structure extracted from PDF content
 */
export interface BookMetadata {
  title: string;
  author: string;
  description: string;  // 100-200 words
  synopsis: string;     // 50-100 words
  suggestedCategory: string;
  confidence: number;   // 0-1 score
}

/**
 * Options for metadata extraction
 */
export interface ExtractionOptions {
  maxTextLength?: number;  // Maximum characters to extract from PDF
  categories?: string[];   // Available categories to suggest from
}

/**
 * Result of cover image search
 */
export interface CoverSearchResult {
  coverUrl: string;
  source: 'google_books' | 'open_library' | 'placeholder';
}

/**
 * Extracts text content from a PDF buffer (first few pages)
 * This is a client-side helper that calls the backend API
 * 
 * @param pdfBase64 - Base64 encoded PDF data
 * @returns Extracted text content
 */
export async function extractTextFromPdf(pdfBase64: string): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/ai/extract-pdf-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfData: pdfBase64 })
    });

    if (!response.ok) {
      throw new Error('Failed to extract PDF text');
    }

    const data = await response.json();
    return data.text || '';
  } catch (error) {
    console.error('PDF text extraction error:', error);
    return '';
  }
}


/**
 * Extracts book metadata from PDF content using Gemini AI
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 * 
 * @param pdfBase64 - Base64 encoded PDF data
 * @param options - Extraction options including available categories
 * @returns Extracted book metadata
 */
export async function extractMetadataFromPdf(
  pdfBase64: string,
  options: ExtractionOptions = {}
): Promise<BookMetadata> {
  try {
    const response = await fetch(`${API_URL}/ai/extract-book-metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdfData: pdfBase64,
        maxTextLength: options.maxTextLength || 5000,
        categories: options.categories || []
      })
    });

    if (!response.ok) {
      throw new Error('Failed to extract metadata');
    }

    const data = await response.json();
    return data.metadata;
  } catch (error) {
    console.error('Metadata extraction error:', error);
    // Return default metadata on error
    return {
      title: 'Unknown Title',
      author: 'Unknown Author',
      description: '',
      synopsis: '',
      suggestedCategory: '',
      confidence: 0
    };
  }
}

/**
 * Searches for a book cover image using Google Books API
 * Falls back to Open Library, then generates a placeholder
 * 
 * Requirements: 3.6, 3.7
 * 
 * @param title - Book title
 * @param author - Book author
 * @returns Cover image URL and source
 */
export async function findCoverImage(
  title: string,
  author: string
): Promise<CoverSearchResult> {
  try {
    const response = await fetch(`${API_URL}/ai/book-cover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, author })
    });

    if (!response.ok) {
      throw new Error('Failed to find cover image');
    }

    const data = await response.json();
    
    // Determine source based on URL pattern
    let source: 'google_books' | 'open_library' | 'placeholder' = 'placeholder';
    if (data.coverUrl) {
      if (data.coverUrl.includes('googleapis.com')) {
        source = 'google_books';
      } else if (data.coverUrl.includes('openlibrary.org')) {
        source = 'open_library';
      }
    }

    return {
      coverUrl: data.coverUrl || generatePlaceholderCover(title),
      source
    };
  } catch (error) {
    console.error('Cover image search error:', error);
    return {
      coverUrl: generatePlaceholderCover(title),
      source: 'placeholder'
    };
  }
}

/**
 * Generates a placeholder cover image URL with the book title
 * 
 * Requirement: 3.7
 * 
 * @param title - Book title to display on placeholder
 * @returns Placeholder image URL
 */
export function generatePlaceholderCover(title: string): string {
  const encodedTitle = encodeURIComponent(title.substring(0, 30));
  return `https://via.placeholder.com/400x600/1A365D/FFFFFF?text=${encodedTitle}`;
}

/**
 * Uploads a cover image to Supabase storage
 * 
 * Requirement: 3.6
 * 
 * @param imageData - Base64 encoded image data
 * @param fileName - Name for the uploaded file
 * @param contentType - MIME type of the image
 * @returns URL of the uploaded image
 */
export async function uploadCoverToStorage(
  imageData: string,
  fileName: string,
  contentType: string = 'image/jpeg'
): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/admin/upload-cover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, imageData, contentType })
    });

    if (!response.ok) {
      throw new Error('Failed to upload cover');
    }

    const data = await response.json();
    return data.url || null;
  } catch (error) {
    console.error('Cover upload error:', error);
    return null;
  }
}

/**
 * Fetches a cover image from URL and uploads it to Supabase storage
 * 
 * Requirements: 3.6, 3.7
 * 
 * @param imageUrl - URL of the image to fetch
 * @param fileName - Name for the uploaded file
 * @returns URL of the uploaded image in Supabase storage
 */
export async function fetchAndUploadCover(
  imageUrl: string,
  fileName: string
): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/admin/fetch-and-upload-cover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, fileName })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch and upload cover');
    }

    const data = await response.json();
    return data.url || null;
  } catch (error) {
    console.error('Fetch and upload cover error:', error);
    return null;
  }
}


/**
 * Validates that extracted metadata meets completeness requirements
 * 
 * Property 3: Metadata Completeness
 * For any successfully extracted book, the metadata SHALL include 
 * non-empty values for title, author, description, and synopsis.
 * 
 * @param metadata - The metadata to validate
 * @returns true if metadata is complete
 */
export function isMetadataComplete(metadata: BookMetadata): boolean {
  return (
    metadata.title.trim().length > 0 &&
    metadata.author.trim().length > 0 &&
    metadata.description.trim().length > 0 &&
    metadata.synopsis.trim().length > 0
  );
}

/**
 * Validates description length (100-200 words)
 * 
 * Requirement: 3.3
 * 
 * @param description - The description to validate
 * @returns true if description is within valid word count range
 */
export function isDescriptionValid(description: string): boolean {
  const wordCount = description.trim().split(/\s+/).filter(w => w.length > 0).length;
  return wordCount >= 100 && wordCount <= 200;
}

/**
 * Validates synopsis length (50-100 words)
 * 
 * Requirement: 3.4
 * 
 * @param synopsis - The synopsis to validate
 * @returns true if synopsis is within valid word count range
 */
export function isSynopsisValid(synopsis: string): boolean {
  const wordCount = synopsis.trim().split(/\s+/).filter(w => w.length > 0).length;
  return wordCount >= 50 && wordCount <= 100;
}

/**
 * Full metadata extraction pipeline
 * Extracts metadata from PDF and finds cover image
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 * 
 * @param pdfBase64 - Base64 encoded PDF data
 * @param categories - Available categories to suggest from
 * @returns Complete book metadata with cover URL
 */
export async function extractFullMetadata(
  pdfBase64: string,
  categories: string[] = []
): Promise<BookMetadata & { coverUrl: string }> {
  // Extract metadata from PDF content
  const metadata = await extractMetadataFromPdf(pdfBase64, { categories });
  
  // Find cover image based on extracted title and author
  const coverResult = await findCoverImage(metadata.title, metadata.author);
  
  return {
    ...metadata,
    coverUrl: coverResult.coverUrl
  };
}

// Default export for the service
export const metadataExtractorService = {
  extractTextFromPdf,
  extractMetadataFromPdf,
  findCoverImage,
  generatePlaceholderCover,
  uploadCoverToStorage,
  fetchAndUploadCover,
  isMetadataComplete,
  isDescriptionValid,
  isSynopsisValid,
  extractFullMetadata
};
