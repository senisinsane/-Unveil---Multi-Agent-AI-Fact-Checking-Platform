// Consensus engine — runs client-side on agent verdicts
const LABELS = ['credible', 'suspicious', 'misleading', 'manipulative', 'satire'];
const SUPERMAJORITY = 0.66;

export function runConsensus(verdicts) {
  // Edge case: no verdicts
  if (!Array.isArray(verdicts) || verdicts.length === 0) {
    return {
      finalLabel: 'suspicious',
      confidence: 0,
      hasSupermajority: false,
      credibilityScore: 50,
      voteShares: Object.fromEntries(LABELS.map(l => [l, 0])),
      ranked: LABELS.map(l => ({ label: l, share: 0 })),
      topFlags: [],
      verdicts: [],
      agentCount: 0,
      totalWeight: 0
    };
  }

  const voteWeights = {};
  LABELS.forEach(l => voteWeights[l] = 0);
  let totalWeight = 0;

  verdicts.forEach(verdict => {
    const trust = verdict.trustScore || 0.75;
    const weight = trust * verdict.confidence;
    voteWeights[verdict.label] = (voteWeights[verdict.label] || 0) + weight;
    totalWeight += weight;
  });

  const voteShares = {};
  LABELS.forEach(l => {
    voteShares[l] = totalWeight > 0 ? voteWeights[l] / totalWeight : 0;
  });

  const ranked = LABELS
    .map(l => ({ label: l, share: voteShares[l] }))
    .sort((a, b) => b.share - a.share);

  const winner = ranked[0];

  const credibilityScore = Math.max(0, Math.min(100, Math.round(
    (voteShares.credible || 0) * 100 -
    (voteShares.misleading || 0) * 30 -
    (voteShares.manipulative || 0) * 50 -
    (voteShares.suspicious || 0) * 15 +
    50
  )));

  const flagCounts = {};
  verdicts.forEach(v => {
    (v.flags || []).forEach(flag => {
      flagCounts[flag] = (flagCounts[flag] || 0) + 1;
    });
  });

  const topFlags = Object.entries(flagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([flag, count]) => ({ flag, agreedByCount: count }));

  return {
    finalLabel: winner.label,
    confidence: winner.share,
    hasSupermajority: winner.share >= SUPERMAJORITY,
    credibilityScore,
    voteShares,
    ranked,
    topFlags,
    verdicts,
    agentCount: verdicts.length,
    totalWeight
  };
}
