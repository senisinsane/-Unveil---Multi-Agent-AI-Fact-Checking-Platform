import { NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/llm/openaiClient';
import { AGENT_PROMPTS, buildUserPrompt } from '@/lib/llm/agentPrompts';
import { runResearch } from '@/lib/research/researchPipeline';

/**
 * Analyze Route — handles content analysis requests.
 * Security: Concurrency limiter, canary integrity check, sanitized errors, request tracing.
 */

const VALID_LABELS = ['credible', 'suspicious', 'misleading', 'manipulative', 'satire'];
const AGENT_IDS = Object.keys(AGENT_PROMPTS);

// ─── Concurrency Limiter ───
let activeAnalyses = 0;
const MAX_CONCURRENT_ANALYSES = 5;

// ─── Conditional Logging ───
const isDev = process.env.NODE_ENV === 'development';
function log(...args) { if (isDev) console.log(...args); }
function logError(...args) { console.error(...args); } // Always log errors

// ─── Request ID ───
function generateRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * POST /api/analyze
 * Body: { text: string }
 * Returns: { verdicts, research, timing, usage, requestId }
 */
export async function POST(request) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Concurrency check
  if (activeAnalyses >= MAX_CONCURRENT_ANALYSES) {
    return NextResponse.json(
      { error: 'Server is busy. Please try again in a moment.', requestId },
      { status: 503 }
    );
  }

  activeAnalyses++;

  try {
    // --- Input Validation ---
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body', requestId }, { status: 400 });
    }

    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing required field: text (string)', requestId }, { status: 400 });
    }

    const trimmed = text.trim();
    if (trimmed.length < 10) {
      return NextResponse.json({ error: 'Text must be at least 10 characters long', requestId }, { status: 400 });
    }
    if (trimmed.length > 5000) {
      return NextResponse.json({ error: 'Text must be under 5000 characters', requestId }, { status: 400 });
    }

    // ─── Phase 1: Web Research ───
    log(`[${requestId}] Starting web research...`);
    const research = await runResearch(trimmed);

    // ─── Phase 2: Run All Agents with Evidence ───
    log(`[${requestId}] Running 5 agents with web evidence...`);
    const userPrompt = buildUserPrompt(trimmed, research.evidenceText);

    const agentResults = await Promise.allSettled(
      AGENT_IDS.map(async (agentId) => {
        const agent = AGENT_PROMPTS[agentId];
        const agentStart = Date.now();
        const { data, usage } = await chatCompletion(agent.systemPrompt, userPrompt);
        const verdict = sanitizeVerdict(data, agent);

        return {
          ...verdict,
          agentId,
          agentName: agent.name,
          icon: agent.icon,
          specialty: agentId,
          usage,
          latencyMs: Date.now() - agentStart
        };
      })
    );

    // --- Process Results ---
    const verdicts = [];
    const errors = [];

    agentResults.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        verdicts.push(result.value);
      } else {
        const agentId = AGENT_IDS[i];
        logError(`[${requestId}] Agent ${agentId} failed:`, result.reason.message);
        errors.push({
          agentId,
          agentName: AGENT_PROMPTS[agentId].name,
          error: sanitizeErrorMessage(result.reason.message)
        });
      }
    });

    if (verdicts.length === 0) {
      return NextResponse.json(
        { error: 'All agents failed to analyze the content', details: errors, requestId },
        { status: 502 }
      );
    }

    // --- Token Usage ---
    const totalUsage = verdicts.reduce(
      (acc, v) => ({
        promptTokens: acc.promptTokens + (v.usage?.promptTokens || 0),
        completionTokens: acc.completionTokens + (v.usage?.completionTokens || 0),
        totalTokens: acc.totalTokens + (v.usage?.totalTokens || 0)
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );

    const totalMs = Date.now() - startTime;

    log(`[${requestId}] ✓ Complete in ${totalMs}ms (research: ${research.totalMs}ms)`);

    return NextResponse.json({
      verdicts,
      research: {
        hasEvidence: research.hasEvidence,
        claimsFound: research.extraction?.claims?.length || 0,
        claims: research.extraction?.claims || [],
        overallTopic: research.extraction?.overallTopic || 'general',
        sourceSummary: research.evidencePackage?.sourceSummary || null,
        phases: research.phases,
        researchMs: research.totalMs
      },
      errors: errors.length > 0 ? errors : undefined,
      timing: {
        totalMs,
        researchMs: research.totalMs,
        agentMs: totalMs - research.totalMs,
        perAgent: verdicts.map(v => ({ agentId: v.agentId, latencyMs: v.latencyMs }))
      },
      usage: totalUsage,
      requestId
    });

  } catch (err) {
    logError(`[${requestId}] Request failed:`, err.message);
    return NextResponse.json(
      { error: sanitizeErrorMessage(err.message), requestId },
      { status: 500 }
    );
  } finally {
    activeAnalyses--;
  }
}

/**
 * Sanitize and validate the LLM response to ensure it matches our schema.
 * Includes canary integrity check for prompt injection detection.
 */
function sanitizeVerdict(data, agent) {
  const reasoning = typeof data.reasoning === 'string' ? data.reasoning.slice(0, 500) : `${agent.name} analysis complete.`;

  // Canary check: detect if the model's response was hijacked by prompt injection
  const integrityOk = reasoning.includes('UNVEIL_INTEGRITY_OK');
  let flags = Array.isArray(data.flags) ? data.flags.filter(f => typeof f === 'string').slice(0, 8) : [];

  if (!integrityOk) {
    // Canary missing — possible prompt injection
    flags = ['⚠ Integrity check failed — possible prompt injection', ...flags];
  }

  return {
    label: VALID_LABELS.includes(data.label) ? data.label : 'suspicious',
    confidence: typeof data.confidence === 'number' ? Math.max(0, Math.min(0.95, data.confidence)) : 0.5,
    flags,
    reasoning,
    evidence: Array.isArray(data.evidence) ? data.evidence.filter(e => typeof e === 'string').slice(0, 6) : [],
    integrityOk,
    timestamp: Date.now()
  };
}

/**
 * Sanitize error messages to prevent information leakage.
 * Strips API keys, file paths, and internal details.
 */
function sanitizeErrorMessage(message) {
  if (!message) return 'An error occurred';

  let safe = message
    // Strip API keys
    .replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***')
    // Strip file paths (Windows & Unix)
    .replace(/[A-Z]:\\[\w\\.-]+/gi, '[path]')
    .replace(/\/[\w\/.-]+\.(js|ts|mjs)/g, '[path]')
    // Strip stack trace lines
    .replace(/\s+at\s+.+/g, '');

  // In production, return generic messages for internal errors
  if (process.env.NODE_ENV === 'production') {
    if (safe.includes('ECONNREFUSED') || safe.includes('ETIMEDOUT')) {
      return 'Service temporarily unavailable. Please try again.';
    }
    if (safe.includes('OpenAI')) {
      return safe; // Keep OpenAI-specific messages (already mapped in openaiClient)
    }
    if (safe.length > 200) {
      return 'An internal error occurred. Please try again.';
    }
  }

  return safe;
}
