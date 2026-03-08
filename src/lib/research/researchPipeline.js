/**
 * Research Pipeline — orchestrates the full web research flow.
 *
 * Flow: Content → Extract Claims → Search Web → Fetch Pages → Compile Evidence
 *
 * The compiled evidence is then passed to all agents along with the original content.
 */

const isDev = process.env.NODE_ENV === 'development';
function log(...args) { if (isDev) console.log(...args); }

import { extractClaims } from './claimExtractor.js';
import { searchWeb } from './webSearcher.js';
import { fetchMultiple } from './contentFetcher.js';
import { compileEvidence, formatEvidenceForPrompt } from './evidenceCompiler.js';

/**
 * Run the full research pipeline on content.
 * @param {string} text - Content to research
 * @returns {Promise<ResearchResult>}
 */
export async function runResearch(text) {
  const startTime = Date.now();
  const phases = [];

  try {
    // ─── Phase 1: Extract Claims ───
    console.log('[Research] Phase 1: Extracting claims...');
    const phaseStart1 = Date.now();
    const extraction = await extractClaims(text);
    phases.push({ name: 'claim-extraction', durationMs: Date.now() - phaseStart1 });

    if (!extraction.hasClaims || extraction.claims.length === 0) {
      console.log('[Research] No verifiable claims found. Skipping web research.');
      return {
        hasEvidence: false,
        extraction,
        evidencePackage: null,
        evidenceText: '\n[WEB RESEARCH]: No specific verifiable claims detected in this content. Analysis relies on content patterns only.\n',
        phases,
        totalMs: Date.now() - startTime
      };
    }

    console.log(`[Research] Found ${extraction.claims.length} claims to verify.`);

    // ─── Phase 2: Search Web for Each Claim ───
    console.log('[Research] Phase 2: Searching the web...');
    const phaseStart2 = Date.now();
    const searchResults = new Map();
    const allUrls = new Set();

    // Search for each claim in parallel
    const searchPromises = extraction.claims.map(async (claim, index) => {
      try {
        const results = await searchWeb(claim.searchQuery, 4);
        searchResults.set(index, results);
        results.forEach(r => {
          if (r.url) allUrls.add(r.url);
        });
        console.log(`[Research]   Claim ${index + 1}: ${results.length} results for "${claim.searchQuery}"`);
      } catch (err) {
        console.error(`[Research]   Claim ${index + 1} search failed:`, err.message);
        searchResults.set(index, []);
      }
    });

    await Promise.all(searchPromises);
    phases.push({ name: 'web-search', durationMs: Date.now() - phaseStart2 });

    // ─── Phase 3: Fetch Content from Top URLs ───
    console.log(`[Research] Phase 3: Fetching ${allUrls.size} URLs...`);
    const phaseStart3 = Date.now();
    const fetchedContent = new Map();

    // Only fetch up to 10 URLs to keep things fast
    const urlsToFetch = [...allUrls].slice(0, 10);
    const fetchResults = await fetchMultiple(urlsToFetch, 3, 1500);

    fetchResults.forEach(result => {
      fetchedContent.set(result.url, result);
    });

    const fetchedCount = fetchResults.filter(r => r.fetched).length;
    console.log(`[Research]   Successfully fetched ${fetchedCount}/${urlsToFetch.length} pages.`);
    phases.push({ name: 'content-fetch', durationMs: Date.now() - phaseStart3 });

    // ─── Phase 4: Compile Evidence ───
    console.log('[Research] Phase 4: Compiling evidence...');
    const phaseStart4 = Date.now();
    const evidencePackage = compileEvidence(extraction.claims, searchResults, fetchedContent);
    const evidenceText = formatEvidenceForPrompt(evidencePackage);
    phases.push({ name: 'evidence-compile', durationMs: Date.now() - phaseStart4 });

    const totalMs = Date.now() - startTime;
    console.log(`[Research] ✓ Complete in ${totalMs}ms. ${evidencePackage.sourceSummary.totalSources} sources from ${evidencePackage.sourceSummary.uniqueDomains} domains.`);

    return {
      hasEvidence: true,
      extraction,
      evidencePackage,
      evidenceText,
      phases,
      totalMs
    };

  } catch (err) {
    console.error('[Research] Pipeline failed:', err.message);
    return {
      hasEvidence: false,
      extraction: null,
      evidencePackage: null,
      evidenceText: '\n[WEB RESEARCH]: Research pipeline encountered an error. Analysis relies on content patterns only.\n',
      phases,
      totalMs: Date.now() - startTime,
      error: err.message
    };
  }
}
