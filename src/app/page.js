'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import ContentFeed from '@/components/ContentFeed';
import AgentNetwork from '@/components/AgentNetwork';
import AnalysisPanel from '@/components/AnalysisPanel';
import { runConsensus } from '@/lib/consensus';

const AGENT_IDS = ['bias-detector', 'fact-checker', 'sentiment-analyzer', 'source-validator', 'logic-analyzer'];

export default function HomePage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [agentStates, setAgentStates] = useState({});
  const [pipelineStatus, setPipelineStatus] = useState('');
  const [analyzedPosts, setAnalyzedPosts] = useState({});
  const [totalAnalyses, setTotalAnalyses] = useState(0);
  const [headerStatus, setHeaderStatus] = useState({ text: 'Connecting...', color: 'var(--text-muted)' });

  // Use ref to avoid stale closure in useCallback
  const isAnalyzingRef = useRef(false);

  // Check backend health on mount
  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/health', { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data.llm?.configured) {
          setHeaderStatus({ text: `Online · ${data.llm.model}`, color: 'var(--credible)' });
        } else {
          setHeaderStatus({ text: 'API Key Missing!', color: 'var(--manipulative)' });
          setAnalysisError('⚠️ OpenAI API key not configured. Set OPENAI_API_KEY in your .env.local file and restart.');
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setHeaderStatus({ text: 'Backend Offline', color: 'var(--manipulative)' });
        }
      });

    return () => controller.abort();
  }, []);

  const runAnalysis = useCallback(async (text, postId = null) => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);
    setAgentStates({});
    setPipelineStatus('📝 Content submitted...');

    // Show research phase
    await sleep(300);
    setPipelineStatus('🔎 Extracting claims & searching the web...');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      // Handle rate limiting specifically
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const retryMs = data.retryAfterMs || 60000;
        throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(retryMs / 1000)} seconds.`);
      }

      // Handle 503 (server busy)
      if (res.status === 503) {
        throw new Error('Server is busy processing other requests. Please try again in a moment.');
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
        throw new Error(err.error || `Server error (${res.status})`);
      }

      const result = await res.json();

      if (!result.verdicts || result.verdicts.length === 0) {
        throw new Error('No analysis results returned. The AI agents may be experiencing issues.');
      }

      // Show research results
      if (result.research) {
        const r = result.research;
        setPipelineStatus(
          `🌐 ${r.claimsFound} claims · ${r.sourceSummary?.totalSources || 0} sources · ${r.sourceSummary?.trustedSources || 0} trusted`
        );
      }

      // Stagger agent animations
      for (let i = 0; i < result.verdicts.length; i++) {
        const v = result.verdicts[i];
        await sleep(150);
        setAgentStates(prev => ({ ...prev, [v.agentId]: 'analyzing' }));
        await sleep(300);
        setAgentStates(prev => ({ ...prev, [v.agentId]: 'done' }));
      }

      setPipelineStatus('🗳️ Running consensus...');
      await sleep(300);

      // Run consensus
      const verdictsWithTrust = result.verdicts.map(v => ({ ...v, trustScore: 0.75 }));
      const consensus = runConsensus(verdictsWithTrust);

      // Mark post analyzed
      if (postId) {
        setAnalyzedPosts(prev => ({ ...prev, [postId]: consensus.finalLabel }));
      }

      setAnalysisResult({
        consensus,
        timing: result.timing,
        usage: result.usage,
        research: result.research
      });

      setTotalAnalyses(prev => prev + 1);
      setPipelineStatus(
        `✅ Done in ${result.timing?.totalMs || '?'}ms (research: ${result.timing?.researchMs || '?'}ms, agents: ${result.timing?.agentMs || '?'}ms)`
      );

    } catch (err) {
      const message = err.name === 'TypeError' && err.message === 'Failed to fetch'
        ? 'Network error — cannot reach the server. Is it running?'
        : err.message;
      setAnalysisError(message);
      setPipelineStatus(`❌ ${message}`);
      setAgentStates({});
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, []);

  const stats = {
    totalAgents: 5,
    avgTrust: 75,
    totalAnalyses
  };

  return (
    <>
      <Header stats={stats} status={headerStatus} />
      <main className="main" role="main">
        <ContentFeed
          onAnalyze={runAnalysis}
          isAnalyzing={isAnalyzing}
          analyzedPosts={analyzedPosts}
        />
        <AgentNetwork
          agentStates={agentStates}
          pipelineStatus={pipelineStatus}
        />
        <AnalysisPanel
          result={analysisResult}
          isLoading={isAnalyzing}
          error={analysisError}
        />
      </main>
    </>
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
