'use client';

export default function Header({ stats, status }) {
  return (
    <header className="header" id="app-header">
      <div className="header__brand">
        <div className="header__logo">👁️</div>
        <div>
          <h1 className="header__title">Unveil</h1>
          <div className="header__subtitle">Multi-Agent AI · Fact-Checking Swarm</div>
        </div>
      </div>
      <div className="header__network">
        <div className="header__stat">
          <span className="header__stat-value">{stats.totalAgents}</span>
          <span className="header__stat-label">Agents</span>
        </div>
        <div className="header__stat">
          <span className="header__stat-value">{stats.avgTrust}%</span>
          <span className="header__stat-label">Avg Trust</span>
        </div>
        <div className="header__stat">
          <span className="header__stat-value">{stats.totalAnalyses}</span>
          <span className="header__stat-label">Analyses</span>
        </div>
        <div className="header__status">
          <span className="header__status-dot" style={status.color ? { background: status.color } : {}} />
          <span className="header__status-text" style={status.color ? { color: status.color } : {}}>
            {status.text}
          </span>
        </div>
      </div>
    </header>
  );
}
