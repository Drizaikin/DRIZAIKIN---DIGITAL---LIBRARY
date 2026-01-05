// AI-powered Book Metadata Service
// Uses OpenRouter API to search for book information and generate cover descriptions

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface BookMetadata {
  title?: string;
  author?: string;
  isbn?: string;
  publishedYear?: number;
  publisher?: string;
  description?: string;
  coverUrl?: string;
  category?: string;
}

export const bookMetadataService = {
  /**
   * Search for book metadata using AI
   * @param title - Book title to search for
   * @param author - Optional author name
   * @returns Book metadata from online sources
   */
  async searchBookMetadata(title: string, author?: string): Promise<BookMetadata> {
    try {
      const response = await fetch(`${API_URL}/ai/book-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, author })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch book metadata');
      }

      const data = await response.json();
      return data.metadata || {};
    } catch (err) {
      console.error('Book metadata search error:', err);
      return {};
    }
  },

  /**
   * Search for book cover image URL
   * @param title - Book title
   * @param author - Author name
   * @param isbn - ISBN if available
   * @returns Cover image URL
   */
  async searchBookCover(title: string, author?: string, isbn?: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_URL}/ai/book-cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, author, isbn })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch book cover');
      }

      const data = await response.json();
      return data.coverUrl || null;
    } catch (err) {
      console.error('Book cover search error:', err);
      return null;
    }
  },

  /**
   * Extract metadata from uploaded PDF
   * @param pdfBase64 - Base64 encoded PDF data
   * @param fileName - Original file name
   * @returns Extracted metadata
   */
  async extractFromPdf(pdfBase64: string, fileName: string): Promise<BookMetadata> {
    try {
      const response = await fetch(`${API_URL}/ai/extract-pdf-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfData: pdfBase64, fileName })
      });

      if (!response.ok) {
        throw new Error('Failed to extract PDF metadata');
      }

      const data = await response.json();
      return data.metadata || {};
    } catch (err) {
      console.error('PDF metadata extraction error:', err);
      return {};
    }
  }
};
