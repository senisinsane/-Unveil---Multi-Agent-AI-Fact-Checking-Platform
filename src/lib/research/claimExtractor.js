/**
 * Claim Extractor — uses OpenAI to extract specific verifiable claims from content.
 * This is the first step in the research pipeline.
 */
import { chatCompletion } from '../llm/openaiClient.js';

const CLAIM_EXTRACTION_PROMPT = `You are a CLAIM EXTRACTOR. Given a social media post or article, your job is to extract every specific, verifiable factual claim made in the content.

Rules:
- Extract ONLY factual claims that can be verified (not opinions or predictions)
- Each claim should be a clear, standalone statement
- Include numerical claims, statistics, scientific claims, historical claims, attribution claims
- For each claim, generate a concise Google search query that would help verify it
- Identify the topic/category of each claim

You MUST respond with valid JSON only:
{
  "claims": [
    {
      "claim": "The specific factual claim extracted from the text",
      "searchQuery": "A concise Google search query to verify this claim",
      "category": "health" | "science" | "politics" | "technology" | "economics" | "history" | "other"
    }
  ],
  "overallTopic": "Brief description of the main topic",
  "hasClaims": true/false
}

If the content is purely opinion with no verifiable factual claims, set hasClaims to false and return an empty claims array. Maximum 5 claims — prioritize the most important/central ones.`;

/**
 * Extract verifiable claims from content using LLM.
 * @param {string} text - The content to analyze
 * @returns {Promise<object>} Extracted claims with search queries
 */
export async function extractClaims(text) {
  try {
    const { data } = await chatCompletion(
      CLAIM_EXTRACTION_PROMPT,
      `Extract verifiable factual claims from this content:\n\n---\n${text}\n---`,
      { temperature: 0.2, maxTokens: 600 }
    );

    // Validate response structure
    if (!data || typeof data.hasClaims !== 'boolean') {
      return { claims: [], overallTopic: 'unknown', hasClaims: false };
    }

    // Sanitize claims
    const claims = Array.isArray(data.claims)
      ? data.claims
          .filter(c => c.claim && c.searchQuery)
          .slice(0, 5)
          .map(c => ({
            claim: String(c.claim).slice(0, 300),
            searchQuery: sanitizeSearchQuery(String(c.searchQuery)),
            category: c.category || 'other'
          }))
      : [];

    return {
      claims,
      overallTopic: String(data.overallTopic || 'general').slice(0, 100),
      hasClaims: claims.length > 0
    };

  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[ClaimExtractor] Failed:', err.message);
    }
    return { claims: [], overallTopic: 'unknown', hasClaims: false };
  }
}

/**
 * Sanitize LLM-generated search queries to prevent misuse.
 * Strips URLs, code, special characters, and limits length.
 */
function sanitizeSearchQuery(query) {
  return query
    // Remove URLs
    .replace(/https?:\/\/\S+/gi, '')
    // Remove code-like patterns
    .replace(/[{}\[\]<>()=;`$]/g, '')
    // Remove excessive punctuation
    .replace(/[!@#%^&*]{2,}/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}
