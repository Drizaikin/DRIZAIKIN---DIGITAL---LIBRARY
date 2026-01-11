/**
 * PDF Validator Service
 * 
 * Downloads and validates PDF files before upload.
 * Implements streaming download and validation of PDF header bytes.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

// PDF magic bytes: %PDF (0x25 0x50 0x44 0x46)
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

// Maximum filename length
const MAX_FILENAME_LENGTH = 200;

// Characters allowed in sanitized filenames
const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Sanitizes a filename for safe storage
 * @param {string} identifier - Original identifier
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error('Invalid identifier: must be a non-empty string');
  }
  
  // Replace any character that's not alphanumeric, hyphen, or underscore
  let sanitized = identifier
    .replace(/[^a-zA-Z0-9_-]/g, '_')  // Replace unsafe chars with underscore
    .replace(/_+/g, '_')               // Collapse multiple underscores
    .replace(/^_+|_+$/g, '');          // Trim leading/trailing underscores
  
  // Ensure we have at least one character
  if (sanitized.length === 0) {
    sanitized = 'unnamed';
  }
  
  // Truncate to max length
  if (sanitized.length > MAX_FILENAME_LENGTH) {
    sanitized = sanitized.substring(0, MAX_FILENAME_LENGTH);
  }
  
  return sanitized;
}

/**
 * Validates that a buffer contains valid PDF content
 * @param {Buffer|Uint8Array} buffer - File content buffer
 * @returns {boolean} True if valid PDF
 */
export function isValidPdf(buffer) {
  if (!buffer || buffer.length === 0) {
    return false;
  }
  
  // Check for PDF magic bytes at the start
  if (buffer.length < PDF_MAGIC_BYTES.length) {
    return false;
  }
  
  for (let i = 0; i < PDF_MAGIC_BYTES.length; i++) {
    if (buffer[i] !== PDF_MAGIC_BYTES[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Downloads a PDF and validates it
 * @param {string} url - PDF download URL
 * @param {Object} options - Download options
 * @param {number} options.timeoutMs - Request timeout in milliseconds (default: 30000)
 * @param {number} options.maxSizeBytes - Maximum file size in bytes (default: 100MB)
 * @returns {Promise<{buffer: Buffer, size: number} | null>} PDF data or null if invalid
 */
export async function downloadAndValidate(url, options = {}) {
  const timeoutMs = options.timeoutMs || 30000;
  const maxSizeBytes = options.maxSizeBytes || 100 * 1024 * 1024; // 100MB default
  
  if (!url || typeof url !== 'string') {
    console.error('[PDFValidator] Invalid URL provided');
    return null;
  }
  
  console.log(`[PDFValidator] Downloading PDF from: ${url}`);
  
  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'DrizaiknDigitalLibrary/1.0 (Educational Library System)'
      }
    });
    
    clearTimeout(timeoutId);
    
    // Check response status
    if (!response.ok) {
      console.error(`[PDFValidator] HTTP error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    // Check content length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
      console.error(`[PDFValidator] File too large: ${contentLength} bytes (max: ${maxSizeBytes})`);
      return null;
    }
    
    // Stream the response to a buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Check if empty
    if (buffer.length === 0) {
      console.error('[PDFValidator] Downloaded file is empty');
      return null;
    }
    
    // Check file size
    if (buffer.length > maxSizeBytes) {
      console.error(`[PDFValidator] File too large: ${buffer.length} bytes (max: ${maxSizeBytes})`);
      return null;
    }
    
    // Validate PDF header
    if (!isValidPdf(buffer)) {
      console.error('[PDFValidator] Invalid PDF: missing PDF header');
      return null;
    }
    
    console.log(`[PDFValidator] Successfully validated PDF: ${buffer.length} bytes`);
    
    return {
      buffer,
      size: buffer.length
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`[PDFValidator] Download timeout after ${timeoutMs}ms`);
    } else {
      console.error(`[PDFValidator] Download error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Validates a filename is safe for storage
 * @param {string} filename - Filename to validate
 * @returns {boolean} True if filename is safe
 */
export function isValidFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return false;
  }
  
  // Check length
  if (filename.length === 0 || filename.length > MAX_FILENAME_LENGTH) {
    return false;
  }
  
  // Check for path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }
  
  // Check for safe characters only
  return SAFE_FILENAME_REGEX.test(filename);
}

export { PDF_MAGIC_BYTES, MAX_FILENAME_LENGTH };
