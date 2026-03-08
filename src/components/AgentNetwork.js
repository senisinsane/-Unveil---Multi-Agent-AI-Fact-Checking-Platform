'use client';

const AGENTS = [
  { id: 'bias-detector', name: 'Bias Detector', icon: '🔍' },
  { id: 'fact-checker', name: 'Fact Checker', icon: '✅' },
  { id: 'sentiment-analyzer', name: 'Sentiment Analyzer', icon: '💬' },
  { id: 'source-validator', name: 'Source Validator', icon: '🔗' },
  { id: 'logic-analyzer', name: 'Logic Analyzer', icon: '🧠' }
];

export default function AgentNetwork({ agentStates, pipelineStatus }) {
  return (
    <div className="panel" id="agent-network">
      <div className="panel__header">
        <span className="panel__title">
          <span className="panel__title-icon">🌐</span>
          Agent Network
        </span>
        <span className="panel__badge">{AGENTS.length}</span>
      </div>

      <div className="panel__scroll">
        <div className="agent-swarm">
          {AGENTS.map((agent) => {
            const state = agentStates[agent.id] || 'idle';
            return (
              <div
                key={agent.id}
                className={`agent-node ${state !== 'idle' ? `agent-node--${state}` : ''}`}
              >
                <div className="agent-node__icon">{agent.icon}</div>
                <div className="agent-node__name">{agent.name}</div>
                <div className="agent-node__trust">
                  {state === 'analyzing' ? '⚡ Active' : state === 'done' ? '✓ Done' : 'Idle'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pipeline-status">
        {pipelineStatus || 'Ready — Select content to analyze'}
      </div>
    </div>
  );
}
