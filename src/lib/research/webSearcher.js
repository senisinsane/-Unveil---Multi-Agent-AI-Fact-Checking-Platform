/**
 * Web Searcher — searches the web for evidence to verify claims.
 * Primary: Serper.dev (Google Search API, 2500 free/month)
 * Fallback: DuckDuckGo HTML scraping (no API key needed)
 */

const SERPER_API_URL = 'https://google.serper.dev/search';
const SEARCH_TIMEOUT_MS = 10000;

const isDev = process.env.NODE_ENV === 'development';
function log(...args) { if (isDev) console.log(...args); }

/**
 * Search the web for a query. Uses Serper if API key is set, otherwise DuckDuckGo.
 * @param {string} query - Search query
 * @param {number} numResults - Number of results to fetch
 * @returns {Promise<SearchResult[]>}
 */
export async function searchWeb(query, numResults = 5) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return [];
  }

  const serperKey = process.env.SERPER_API_KEY;

  if (serperKey && serperKey !== 'your_serper_api_key_here') {
    return searchWithSerper(query, numResults, serperKey);
  }

  return searchWithDuckDuckGo(query, numResults);
}

/**
 * Search using Serper.dev (Google Search results)
 */
async function searchWithSerper(query, numResults, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(SERPER_API_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: numResults,
        gl: 'us',
        hl: 'en'
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Serper API error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const results = [];

    // Organic results
    if (Array.isArray(data.organic)) {
      data.organic.slice(0, numResults).forEach(item => {
        if (item.link) {
          results.push({
            title: String(item.title || '').slice(0, 200),
            url: item.link,
            snippet: String(item.snippet || '').slice(0, 500),
            source: extractDomain(item.link),
            position: item.position || 0
          });
        }
      });
    }

    // Knowledge graph (if available)
    if (data.knowledgeGraph) {
      const kg = data.knowledgeGraph;
      results.unshift({
        title: String(kg.title || 'Knowledge Graph').slice(0, 200),
        url: kg.website || '',
        snippet: String(kg.description || '').slice(0, 500),
        source: 'Google Knowledge Graph',
        position: 0,
        isKnowledgeGraph: true,
        attributes: kg.attributes || {}
      });
    }

    // Answer box (if available)
    if (data.answerBox) {
      const ab = data.answerBox;
      results.unshift({
        title: String(ab.title || 'Direct Answer').slice(0, 200),
        url: ab.link || '',
        snippet: String(ab.answer || ab.snippet || '').slice(0, 500),
        source: 'Google Answer Box',
        position: 0,
        isAnswerBox: true
      });
    }

    return results;

  } catch (err) {
    clearTimeout(timeout);
    log('[WebSearcher/Serper] Failed:', err.message);
    // Fallback to DuckDuckGo
    return searchWithDuckDuckGo(query, numResults);
  }
}

/**
 * Search using DuckDuckGo (free, no API key needed)
 * Uses the DuckDuckGo instant answer API + lite HTML scraping
 */
async function searchWithDuckDuckGo(query, numResults) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`,
      {
        headers: {
          'User-Agent': 'Unveil-FactChecker/3.0 (fact-checking research tool)'
        },
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`DuckDuckGo API error: ${response.status}`);
    }

    const data = await response.json();
    const results = [];

    // Abstract (main answer)
    if (data.Abstract) {
      results.push({
        title: String(data.Heading || 'DuckDuckGo Answer').slice(0, 200),
        url: data.AbstractURL || '',
        snippet: String(data.Abstract).slice(0, 500),
        source: data.AbstractSource || 'DuckDuckGo',
        position: 0,
        isDirectAnswer: true
      });
    }

    // Related topics
    if (Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics
        .filter(t => t.Text && t.FirstURL)
        .slice(0, numResults - results.length)
        .forEach((topic, i) => {
          results.push({
            title: String(topic.Text.split(' - ')[0] || '').slice(0, 200),
            url: topic.FirstURL,
            snippet: String(topic.Text).slice(0, 500),
            source: extractDomain(topic.FirstURL),
            position: i + 1
          });
        });
    }

    // If we got nothing from instant answers, try lite HTML
    if (results.length === 0) {
      return await searchDDGLite(query, numResults);
    }

    return results;

  } catch (err) {
    clearTimeout(timeout);
    log('[WebSearcher/DDG] Instant answer failed:', err.message);
    try {
      return await searchDDGLite(query, numResults);
    } catch (e) {
      log('[WebSearcher/DDG] Lite also failed:', e.message);
      return [];
    }
  }
}

/**
 * DuckDuckGo Lite HTML search (last resort fallback)
 */
async function searchDDGLite(query, numResults) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodedQuery}`, {
      headers: {
        'User-Agent': 'Unveil-FactChecker/3.0 (fact-checking research tool)'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`DDG Lite error: ${response.status}`);
    }

    const html = await response.text();

    // Guard against huge responses
    if (html.length > 500000) {
      return [];
    }

    const results = [];

    // Simple regex extraction from DDG lite HTML
    const linkRegex = /<a[^>]+rel="nofollow"[^>]+href="([^"]+)"[^>]*class="result-link"[^>]*>([^<]+)<\/a>/gi;
    const snippetRegex = /<td class="result-snippet">([^<]+)<\/td>/gi;

    let linkMatch;
    const links = [];
    while ((linkMatch = linkRegex.exec(html)) !== null && links.length < numResults) {
      links.push({ url: linkMatch[1], title: linkMatch[2].trim() });
    }

    let snippetMatch;
    const snippets = [];
    while ((snippetMatch = snippetRegex.exec(html)) !== null) {
      snippets.push(snippetMatch[1].trim());
    }

    links.forEach((link, i) => {
      results.push({
        title: String(link.title).slice(0, 200),
        url: link.url,
        snippet: String(snippets[i] || '').slice(0, 500),
        source: extractDomain(link.url),
        position: i
      });
    });

    return results;

  } catch (err) {
    clearTimeout(timeout);
    log('[WebSearcher/DDGLite] Failed:', err.message);
    return [];
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
