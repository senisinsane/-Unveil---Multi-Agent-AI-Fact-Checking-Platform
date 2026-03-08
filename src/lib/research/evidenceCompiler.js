/**
 * Evidence Compiler — compiles search results and fetched content into a
 * structured evidence package that agents can use for analysis.
 */

/**
 * Compile raw search results and fetched content into a structured evidence report.
 * @param {object[]} claims - Extracted claims
 * @param {Map<string, object[]>} searchResults - Map of claim→search results
 * @param {Map<string, object[]>} fetchedContent - Map of url→fetched content
 * @returns {EvidencePackage}
 */
export function compileEvidence(claims, searchResults, fetchedContent) {
  const evidenceItems = [];
  const sourceSummary = {
    totalSources: 0,
    trustedSources: 0,
    unreliableSources: 0,
    satireSources: 0,
    unknownSources: 0,
    domains: new Set()
  };

  claims.forEach((claim, claimIndex) => {
    const results = searchResults.get(claimIndex) || [];
    const claimEvidence = {
      claim: claim.claim,
      category: claim.category,
      searchQuery: claim.searchQuery,
      sources: []
    };

    results.forEach(result => {
      const fetched = fetchedContent.get(result.url);
      const source = {
        title: result.title,
        url: result.url,
        domain: result.source,
        snippet: result.snippet,
        trustLevel: fetched?.trustLevel || 'unknown',
        fetchedContent: fetched?.fetched ? fetched.text : null,
        isKnowledgeGraph: result.isKnowledgeGraph || false,
        isAnswerBox: result.isAnswerBox || false,
        isDirectAnswer: result.isDirectAnswer || false
      };

      claimEvidence.sources.push(source);

      // Update source summary
      sourceSummary.totalSources++;
      sourceSummary.domains.add(result.source);
      switch (source.trustLevel) {
        case 'trusted': sourceSummary.trustedSources++; break;
        case 'unreliable': sourceSummary.unreliableSources++; break;
        case 'satire': sourceSummary.satireSources++; break;
        default: sourceSummary.unknownSources++; break;
      }
    });

    evidenceItems.push(claimEvidence);
  });

  return {
    evidenceItems,
    sourceSummary: {
      ...sourceSummary,
      domains: [...sourceSummary.domains],
      uniqueDomains: sourceSummary.domains.size
    },
    timestamp: Date.now()
  };
}

/**
 * Format evidence into a text summary for agent prompts.
 * This is what gets injected into each agent's context.
 */
export function formatEvidenceForPrompt(evidencePackage) {
  if (!evidencePackage || evidencePackage.evidenceItems.length === 0) {
    return '\n[WEB RESEARCH]: No verifiable claims found. Analysis is based on content alone.\n';
  }

  let text = '\n=== WEB RESEARCH EVIDENCE ===\n';
  text += `Sources analyzed: ${evidencePackage.sourceSummary.totalSources} from ${evidencePackage.sourceSummary.uniqueDomains} domains\n`;
  text += `Trusted sources: ${evidencePackage.sourceSummary.trustedSources} | Unreliable: ${evidencePackage.sourceSummary.unreliableSources} | Satire: ${evidencePackage.sourceSummary.satireSources}\n\n`;

  evidencePackage.evidenceItems.forEach((item, i) => {
    text += `--- CLAIM ${i + 1}: "${item.claim}" ---\n`;
    text += `Category: ${item.category}\n`;
    text += `Search query: "${item.searchQuery}"\n`;

    if (item.sources.length === 0) {
      text += `⚠ No web sources found for this claim.\n\n`;
      return;
    }

    item.sources.forEach((source, j) => {
      text += `\n  Source ${j + 1} [${source.trustLevel.toUpperCase()}]: ${source.domain}\n`;
      text += `  Title: ${source.title}\n`;

      if (source.isKnowledgeGraph || source.isAnswerBox || source.isDirectAnswer) {
        text += `  ★ Direct/authoritative answer: ${source.snippet}\n`;
      } else {
        text += `  Snippet: ${source.snippet}\n`;
      }

      if (source.fetchedContent) {
        // Truncate fetched content to keep prompt manageable
        const content = source.fetchedContent.slice(0, 500);
        text += `  Page content: ${content}...\n`;
      }
    });

    text += '\n';
  });

  text += '=== END WEB RESEARCH ===\n';

  return text;
}
