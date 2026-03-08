/**
 * OpenAI Client — singleton wrapper around the OpenAI SDK.
 * Handles initialization, error mapping, and timeout management.
 */
import OpenAI from 'openai';

let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      throw new Error('OPENAI_API_KEY not configured. Set it in your .env file.');
    }
    client = new OpenAI({ apiKey, timeout: 30000, maxRetries: 2 });
  }
  return client;
}

/**
 * Send a chat completion request to OpenAI.
 * @param {string} systemPrompt - The agent's system prompt
 * @param {string} userMessage - The content to analyze
 * @param {object} options - Optional overrides
 * @returns {object} Parsed JSON response
 */
export async function chatCompletion(systemPrompt, userMessage, options = {}) {
  const openai = getClient();
  const model = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 800,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return {
      data: parsed,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      }
    };

  } catch (err) {
    // Map OpenAI errors to user-friendly messages
    if (err instanceof OpenAI.APIError) {
      if (err.status === 401) {
        throw new Error('Invalid OpenAI API key. Check your .env file.');
      }
      if (err.status === 429) {
        throw new Error('OpenAI rate limit exceeded. Wait a moment and try again.');
      }
      if (err.status === 500 || err.status === 503) {
        throw new Error('OpenAI service temporarily unavailable. Try again shortly.');
      }
      throw new Error(`OpenAI API error (${err.status}): ${err.message}`);
    }

    if (err.name === 'AbortError' || err.code === 'ETIMEDOUT') {
      throw new Error('OpenAI request timed out. Try again.');
    }

    throw err;
  }
}
