/**
 * PDF Crawler Service
 * 
 * Crawls web pages to discover PDF links for the AI Book Extraction feature.
 * Implements an async generator that yields PDF links from a given URL.
 * 
 * Requirements: 1.1, 1.2
 */

export interface PDFLink {
  url: string;
  filename: string;
  pageSource: string;
}

export interface CrawlOptions {
  maxDepth?: number;
  followLinks?: boolean;
  timeout?: number;
}

/**
 * Validates if a URL points to a PDF file based on extension or content-type
 * @param url - The URL to validate
 * @param contentType - Optional content-type header value
 * @returns true if the URL appears to be a PDF
 */
export function isPdfUrl(url: string, contentType?: string): boolean {
  // Check content-type header if provided
  if (contentType && contentType.toLowerCase().includes('application/pdf')) {
    return true;
  }
  
  // Check file extension
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    return pathname.endsWith('.pdf');
  } catch {
    // If URL parsing fails, try simple string check
    return url.toLowerCase().endsWith('.pdf');
  }
}

/**
 * Converts a relative URL to an absolute URL
 * @param relativeUrl - The relative URL to convert
 * @param baseUrl - The base URL to resolve against
 * @returns The absolute URL
 */
export function toAbsoluteUrl(relativeUrl: string, baseUrl: string): string {
  try {
    // Handle already absolute URLs
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl;
    }
    
    // Handle protocol-relative URLs
    if (relativeUrl.startsWith('//')) {
      const baseUrlObj = new URL(baseUrl);
      return `${baseUrlObj.protocol}${relativeUrl}`;
    }
    
    // Use URL constructor to resolve relative URLs
    const base = new URL(baseUrl);
    const resolved = new URL(relativeUrl, base);
    return resolved.href;
  } catch {
    // If resolution fails, return the original URL
    return relativeUrl;
  }
}

/**
 * Extracts the filename from a PDF URL
 * @param url - The PDF URL
 * @returns The extracted filename
 */
export function extractFilename(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/');
    const lastSegment = segments[segments.length - 1];
    
    // Decode URL-encoded characters
    const decoded = decodeURIComponent(lastSegment);
    
    // If no filename found, generate one from the URL
    if (!decoded || decoded === '') {
      return `document-${Date.now()}.pdf`;
    }
    
    // Ensure .pdf extension
    if (!decoded.toLowerCase().endsWith('.pdf')) {
      return `${decoded}.pdf`;
    }
    
    return decoded;
  } catch {
    return `document-${Date.now()}.pdf`;
  }
}

/**
 * Parses HTML content to extract anchor tags with href attributes
 * @param html - The HTML content to parse
 * @param baseUrl - The base URL for resolving relative links
 * @returns Array of extracted links
 */
export function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  
  // Regular expression to match anchor tags with href attributes
  // Handles both single and double quotes, and various attribute orderings
  const anchorRegex = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    if (href && href.trim()) {
      // Convert to absolute URL
      const absoluteUrl = toAbsoluteUrl(href.trim(), baseUrl);
      links.push(absoluteUrl);
    }
  }
  
  return links;
}

/**
 * Filters links to only include PDF URLs
 * @param links - Array of URLs to filter
 * @returns Array of PDF URLs
 */
export function filterPdfLinks(links: string[]): string[] {
  return links.filter(link => isPdfUrl(link));
}

/**
 * Checks if the crawl operation should be aborted
 * @param signal - The AbortSignal to check
 * @throws Error if the signal is aborted
 */
function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Crawl operation was aborted');
  }
}

/**
 * Async generator that crawls a URL and yields discovered PDF links
 * 
 * @param url - The URL to crawl
 * @param signal - Optional AbortSignal for cancellation
 * @param options - Optional crawl configuration
 * @yields PDFLink objects for each discovered PDF
 * 
 * Requirements: 1.1, 1.2
 */
export async function* crawl(
  url: string,
  signal?: AbortSignal,
  options: CrawlOptions = {}
): AsyncGenerator<PDFLink> {
  const { timeout = 30000 } = options;
  const visitedUrls = new Set<string>();
  
  // Check if already aborted before starting
  checkAborted(signal);
  
  try {
    // Fetch the page content
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Combine external signal with timeout signal
    const combinedSignal = signal 
      ? { aborted: signal.aborted || controller.signal.aborted }
      : controller.signal;
    
    if (combinedSignal.aborted) {
      clearTimeout(timeoutId);
      throw new Error('Crawl operation was aborted');
    }
    
    const response = await fetch(url, {
      signal: signal || controller.signal,
      headers: {
        'User-Agent': 'Drizaikn-Library-Crawler/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    
    clearTimeout(timeoutId);
    
    // Check abort after fetch
    checkAborted(signal);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    
    // If the URL itself is a PDF, yield it directly
    if (isPdfUrl(url, contentType)) {
      yield {
        url: url,
        filename: extractFilename(url),
        pageSource: url
      };
      return;
    }
    
    // Parse HTML content
    const html = await response.text();
    
    // Check abort after reading content
    checkAborted(signal);
    
    // Extract all links from the page
    const allLinks = extractLinksFromHtml(html, url);
    
    // Filter to only PDF links
    const pdfLinks = filterPdfLinks(allLinks);
    
    // Yield each unique PDF link
    for (const pdfUrl of pdfLinks) {
      // Check abort before each yield
      checkAborted(signal);
      
      // Skip already visited URLs
      if (visitedUrls.has(pdfUrl)) {
        continue;
      }
      
      visitedUrls.add(pdfUrl);
      
      yield {
        url: pdfUrl,
        filename: extractFilename(pdfUrl),
        pageSource: url
      };
    }
    
  } catch (error) {
    // Re-throw abort errors
    if (error instanceof Error && error.message.includes('aborted')) {
      throw error;
    }
    
    // Re-throw other errors with context
    if (error instanceof Error) {
      throw new Error(`Crawl failed for ${url}: ${error.message}`);
    }
    
    throw new Error(`Crawl failed for ${url}: Unknown error`);
  }
}

/**
 * Validates a PDF URL by checking its content-type header
 * Makes a HEAD request to verify the URL points to a valid PDF
 * 
 * @param url - The URL to validate
 * @param signal - Optional AbortSignal for cancellation
 * @returns true if the URL is a valid PDF
 * 
 * Requirements: 1.2
 */
export async function validatePdfUrl(
  url: string,
  signal?: AbortSignal
): Promise<boolean> {
  try {
    checkAborted(signal);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal,
      headers: {
        'User-Agent': 'Drizaikn-Library-Crawler/1.0'
      }
    });
    
    if (!response.ok) {
      return false;
    }
    
    const contentType = response.headers.get('content-type') || '';
    return isPdfUrl(url, contentType);
    
  } catch {
    return false;
  }
}

// Default export for the service
export const pdfCrawlerService = {
  crawl,
  isPdfUrl,
  toAbsoluteUrl,
  extractFilename,
  extractLinksFromHtml,
  filterPdfLinks,
  validatePdfUrl
};
