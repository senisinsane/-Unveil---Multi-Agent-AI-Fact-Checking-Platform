'use client';

const LABEL_COLORS = {
  credible: 'var(--credible)',
  suspicious: 'var(--suspicious)',
  misleading: 'var(--misleading)',
  manipulative: 'var(--manipulative)',
  satire: 'var(--satire)'
};

export default function AnalysisPanel({ result, isLoading, error }) {
  return (
    <div className="panel" id="analysis-panel">
      <div className="panel__header">
        <span className="panel__title">
          <span className="panel__title-icon">📊</span>
          Analysis Results
        </span>
      </div>
      <div className="panel__scroll" id="analysis-scroll">
        {error ? (
          <ErrorState message={error} />
        ) : isLoading ? (
          <LoadingState />
        ) : result ? (
          <ResultsView result={result} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="analysis-empty">
      <div className="analysis-empty__icon">🔍</div>
      <div className="analysis-empty__text">
        Select a post from the feed or paste custom content to begin LLM-powered analysis with web verification.
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="analysis-empty">
      <div className="analysis-empty__icon" style={{ animation: 'agentPulse 1s infinite' }}>🌐</div>
      <div className="analysis-empty__text">
        Searching the web & querying 5 AI agents...<br />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Each agent runs a specialized GPT-4o-mini prompt in parallel
        </span>
      </div>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="analysis-empty">
      <div className="analysis-empty__icon">❌</div>
      <div className="analysis-empty__text" style={{ color: 'var(--manipulative)' }}>
        {message}
      </div>
    </div>
  );
}

function ResultsView({ result }) {
  const { consensus, timing, usage, research } = result;
  const color = LABEL_COLORS[consensus.finalLabel] || 'var(--text-primary)';
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (consensus.credibilityScore / 100) * circumference;

  return (
    <>
      {/* Unveil Score */}
      <div className="unveil-score glass animate-scaleIn">
        <div className="unveil-score__ring">
          <svg viewBox="0 0 120 120">
            <circle className="unveil-score__ring-bg" cx="60" cy="60" r="54" />
            <circle
              className="unveil-score__ring-fill"
              cx="60" cy="60" r="54"
              stroke={color}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="unveil-score__value" style={{ color }}>
            {consensus.credibilityScore}
            <small>/ 100</small>
          </div>
        </div>
        <div className={`unveil-score__label label--${consensus.finalLabel}`}>
          {consensus.finalLabel.toUpperCase()}
        </div>
        <div className="unveil-score__consensus">
          {consensus.hasSupermajority ? '✓ Supermajority' : '⚠ No supermajority'} · {consensus.agentCount} agents · {(consensus.confidence * 100).toFixed(0)}% agreement
        </div>
        {timing && (
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 'var(--sp-2)', fontFamily: 'var(--font-code)' }}>
            ⚡ {timing.totalMs}ms · 🌐 {timing.researchMs}ms research · 🤖 {timing.agentMs}ms agents{usage ? ` · ${usage.totalTokens} tokens` : ''}
          </div>
        )}
      </div>

      {/* Web Research */}
      <ResearchSection research={research} />

      {/* Consensus Breakdown */}
      <div className="consensus-view glass animate-fadeIn">
        <div className="consensus-view__title">🗳️ Consensus Breakdown</div>
        <div className="consensus-bars">
          {consensus.ranked.map((r) => (
            <div className="consensus-bar" key={r.label}>
              <span className="consensus-bar__label">{r.label}</span>
              <div className="consensus-bar__track">
                <div className="consensus-bar__fill" style={{
                  width: `${(r.share * 100).toFixed(0)}%`,
                  background: LABEL_COLORS[r.label] || 'var(--text-muted)'
                }} />
              </div>
              <span className="consensus-bar__pct">{(r.share * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Flags */}
      {consensus.topFlags.length > 0 && (
        <div className="top-flags glass animate-fadeIn">
          <div className="top-flags__title">🚩 Key Findings</div>
          {consensus.topFlags.map((f, i) => (
            <div className="top-flag-item" key={i}>
              <span className="top-flag-item__text">{f.flag}</span>
              <span className="top-flag-item__count">{f.agreedByCount} agent{f.agreedByCount > 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Individual Verdicts */}
      <div style={{ padding: 'var(--sp-3) 0' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', padding: 'var(--sp-2) 0', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          🤖 Individual Agent Reports
        </div>
      </div>

      {consensus.verdicts.map((v, i) => (
        <VerdictCard key={v.agentId} verdict={v} index={i} />
      ))}
    </>
  );
}

function ResearchSection({ research }) {
  if (!research || !research.hasEvidence) {
    return (
      <div className="glass animate-fadeIn" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-2)' }}>
          🌐 Web Research
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          No specific verifiable claims detected · Analysis based on content patterns
        </div>
      </div>
    );
  }

  const summary = research.sourceSummary || {};

  return (
    <div className="glass animate-fadeIn" style={{ padding: 'var(--sp-4)' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-3)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        🌐 Web Research Evidence
        <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {research.researchMs}ms
        </span>
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginBottom: 'var(--sp-3)', flexWrap: 'wrap' }}>
        {[
          { value: research.claimsFound, label: 'Claims', color: 'var(--accent-light)' },
          { value: summary.totalSources || 0, label: 'Sources', color: 'var(--text-primary)' },
          { value: summary.trustedSources || 0, label: 'Trusted', color: 'var(--credible)' },
          { value: summary.unreliableSources || 0, label: 'Unreliable', color: 'var(--manipulative)' },
          { value: summary.uniqueDomains || 0, label: 'Domains', color: 'var(--text-muted)' },
        ].map((stat) => (
          <div key={stat.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {(research.claims || []).map((claim, i) => (
        <div key={i} style={{
          padding: 'var(--sp-2) var(--sp-3)',
          marginBottom: 'var(--sp-2)',
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-sm)',
          borderLeft: '3px solid var(--accent)',
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-primary)', marginBottom: 2 }}>
            <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>Claim {i + 1}:</span> {claim.claim}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
            🔎 {claim.searchQuery} · 📂 {claim.category}
          </div>
        </div>
      ))}
    </div>
  );
}

function VerdictCard({ verdict, index }) {
  const color = LABEL_COLORS[verdict.label] || 'var(--text-muted)';
  const confidence = (verdict.confidence * 100).toFixed(0);

  return (
    <div className="verdict-card glass" style={{ animationDelay: `${index * 0.1}s` }}>
      <div className="verdict-card__header">
        <span className="verdict-card__icon">{verdict.icon}</span>
        <span className="verdict-card__agent">{verdict.agentName}</span>
        <span className={`verdict-card__label label--${verdict.label}`}>{verdict.label}</span>
      </div>
      <div className="verdict-card__reasoning">{verdict.reasoning}</div>
      {verdict.flags?.length > 0 && (
        <div className="verdict-card__flags">
          {verdict.flags.slice(0, 4).map((f, i) => (
            <span className="verdict-card__flag" key={i}>⚠ {f}</span>
          ))}
        </div>
      )}
      <div className="verdict-card__confidence">
        <div className="verdict-card__confidence-bar">
          <div className="verdict-card__confidence-fill" style={{ width: `${confidence}%`, background: color }} />
        </div>
        <span className="verdict-card__confidence-text">{confidence}%</span>
      </div>
      {verdict.latencyMs && (
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 'var(--sp-1)', fontFamily: 'var(--font-code)', textAlign: 'right' }}>
          {verdict.latencyMs}ms
        </div>
      )}
    </div>
  );
}
