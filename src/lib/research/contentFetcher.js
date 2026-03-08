/**
 * Content Fetcher — fetches and extracts readable text from web pages.
 * Used to get the actual content of search results for evidence compilation.
 *
 * Security: SSRF protection, body size limits, domain trust validation.
 */

// ─── Domain Trust Lists ───
const TRUSTED_DOMAINS = new Set([
  'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'nature.com',
  'science.org', 'who.int', 'cdc.gov', 'nih.gov', 'nasa.gov', 'un.org',
  'snopes.com', 'factcheck.org', 'politifact.com', 'fullfact.org',
  'pubmed.ncbi.nlm.nih.gov', 'nytimes.com', 'washingtonpost.com',
  'theguardian.com', 'economist.com', 'ft.com', 'bloomberg.com',
  'wikipedia.org', 'en.wikipedia.org', 'sciencedirect.com',
  'ncbi.nlm.nih.gov', 'mayoclinic.org', 'webmd.com', 'britannica.com',
  'pbs.org', 'npr.org', 'usatoday.com', 'time.com', 'wired.com',
  'arstechnica.com', 'scientificamerican.com', 'newscientist.com'
]);

const UNRELIABLE_DOMAINS = new Set([
  'infowars.com', 'naturalnews.com', 'beforeitsnews.com',
  'worldnewsdailyreport.com', 'yournewswire.com', 'newspunch.com',
  'dailywire.com', 'breitbart.com', 'zerohedge.com'
]);

const SATIRE_DOMAINS = new Set([
  'theonion.com', 'babylonbee.com', 'clickhole.com',
  'waterfordwhispersnews.com', 'newsthump.com', 'dailymash.co.uk'
]);

// ─── SSRF Protection ───
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,                // AWS metadata
  /^0\./,
  /^\[::1\]$/,                  // IPv6 loopback
  /^metadata\.google\./i,       // GCP metadata
  /\.internal$/i,               // Internal domains
  /\.local$/i,
];

const BLOCKED_URL_PATTERNS = [
  /\/latest\/meta-data/i,      // AWS IMDS
  /\/computeMetadata/i,        // GCP metadata
  /\/metadata\/instance/i,     // Azure IMDS
];

const MAX_RESPONSE_BYTES = 500_000; // 500KB — prevents ReDoS on huge pages
const FETCH_TIMEOUT_MS = 8000;

/**
 * Validate a URL is safe to fetch (not internal/private).
 * @throws {Error} if URL targets a blocked destination
 */
function validateUrlSafety(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }

  // Block non-HTTP protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Blocked protocol: ${parsed.protocol}`);
  }

  // Block private/internal hostnames
  const hostname = parsed.hostname;
  for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new Error(`Blocked internal address: ${hostname}`);
    }
  }

  // Block known metadata paths
  const fullUrl = parsed.href;
  for (const pattern of BLOCKED_URL_PATTERNS) {
    if (pattern.test(fullUrl)) {
      throw new Error('Blocked metadata endpoint');
    }
  }
}

/**
 * Fetch and extract text content from a URL.
 * @param {string} url
 * @param {number} maxLength - Max characters to extract
 * @returns {Promise<FetchedContent>}
 */
export async function fetchContent(url, maxLength = 2000) {
  try {
    // SSRF check
    validateUrlSafety(url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Unveil-FactChecker/3.0 (fact-checking research tool)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Validate content type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    // Enforce body size limit to prevent ReDoS
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_RESPONSE_BYTES) {
      throw new Error(`Response too large: ${contentLength} bytes`);
    }

    const html = await response.text();
    if (html.length > MAX_RESPONSE_BYTES) {
      throw new Error(`Response body too large: ${html.length} chars`);
    }

    const text = extractTextFromHTML(html, maxLength);
    const domain = extractDomain(url);

    return {
      url,
      domain,
      text,
      trustLevel: getDomainTrustLevel(domain),
      fetched: true
    };

  } catch (err) {
    const domain = extractDomain(url);
    return {
      url,
      domain,
      text: '',
      trustLevel: getDomainTrustLevel(domain),
      fetched: false,
      error: err.message
    };
  }
}

/**
 * Fetch multiple URLs in parallel with concurrency limit.
 */
export async function fetchMultiple(urls, maxConcurrent = 3, maxLength = 2000) {
  const results = [];

  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const batch = urls.slice(i, i + maxConcurrent);
    const batchResults = await Promise.allSettled(
      batch.map(url => fetchContent(url, maxLength))
    );

    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    });
  }

  return results;
}

/**
 * Get the trust level of a domain.
 * Uses exact domain matching + parent domain matching for subdomains.
 */
export function getDomainTrustLevel(domain) {
  const cleaned = domain.replace(/^www\./, '');

  // Exact match first
  if (TRUSTED_DOMAINS.has(cleaned)) return 'trusted';
  if (UNRELIABLE_DOMAINS.has(cleaned)) return 'unreliable';
  if (SATIRE_DOMAINS.has(cleaned)) return 'satire';

  // Check if it's a subdomain of a trusted/unreliable domain
  // e.g. "health.reuters.com" → check "reuters.com"
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    const parentDomain = parts.slice(-2).join('.');
    if (TRUSTED_DOMAINS.has(parentDomain)) return 'trusted';
    if (UNRELIABLE_DOMAINS.has(parentDomain)) return 'unreliable';
    if (SATIRE_DOMAINS.has(parentDomain)) return 'satire';
  }

  // .gov domains are generally trustworthy
  if (cleaned.endsWith('.gov')) return 'trusted';
  // .edu domains are generally trustworthy
  if (cleaned.endsWith('.edu')) return 'trusted';

  return 'unknown';
}

/**
 * Extract readable text from HTML, stripping scripts, styles, and tags.
 * Simplified to avoid catastrophic regex backtracking (ReDoS).
 */
function extractTextFromHTML(html, maxLength) {
  // Truncate before processing to prevent regex bombs
  const safeHtml = html.slice(0, MAX_RESPONSE_BYTES);

  // Remove scripts, styles, and non-content elements
  let cleaned = safeHtml
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Try to extract <article> or <main> content
  const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);

  if (articleMatch) {
    cleaned = articleMatch[1];
  } else if (mainMatch) {
    cleaned = mainMatch[1];
  }

  // Strip all remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Normalize whitespace
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.slice(0, maxLength);
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
