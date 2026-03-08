import { NextResponse } from 'next/server';

/**
 * Unveil — Security Middleware
 * Handles: Rate limiting, CORS, and request validation.
 * Uses in-memory rate limiting (no external dependencies).
 * For production at scale, replace with Upstash Redis.
 */

// ─── In-Memory Rate Limiter ───
// Sliding window: tracks request timestamps per IP
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 15;      // 15 requests per minute per IP
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Clean stale entries every 5 min

// Periodic cleanup to prevent memory leak
if (typeof globalThis.__rateLimitCleanupStarted === 'undefined') {
  globalThis.__rateLimitCleanupStarted = true;
  setInterval(() => {
    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS * 2;
    for (const [key, timestamps] of rateLimitStore.entries()) {
      const filtered = timestamps.filter(t => t > cutoff);
      if (filtered.length === 0) rateLimitStore.delete(key);
      else rateLimitStore.set(key, filtered);
    }
  }, CLEANUP_INTERVAL_MS);
}

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  const timestamps = (rateLimitStore.get(ip) || []).filter(t => t > windowStart);
  timestamps.push(now);
  rateLimitStore.set(ip, timestamps);

  return {
    allowed: timestamps.length <= RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - timestamps.length),
    resetMs: timestamps.length > 0 ? timestamps[0] + RATE_LIMIT_WINDOW_MS - now : 0
  };
}

// ─── CORS Allowed Origins ───
const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // Add your production domain here:
  // 'https://unveil.yourdomain.com',
]);

function getCorsHeaders(origin) {
  const isAllowed = ALLOWED_ORIGINS.has(origin) || process.env.NODE_ENV === 'development';
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age': '86400',
  };
}

// ─── API Key Auth (optional — set UNVEIL_API_KEY in .env.local) ───
function checkApiKey(request) {
  const requiredKey = process.env.UNVEIL_API_KEY;
  if (!requiredKey || requiredKey === 'your_api_key_here') return true; // Not configured — skip

  const providedKey = request.headers.get('x-api-key');
  return providedKey === requiredKey;
}

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const origin = request.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  // --- API Key Auth (if configured) ---
  if (pathname.startsWith('/api/analyze') && !checkApiKey(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid X-API-Key header.' },
      { status: 401, headers: corsHeaders }
    );
  }

  // --- Rate Limiting (for analyze endpoint) ---
  if (pathname.startsWith('/api/analyze') && request.method === 'POST') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    const { allowed, remaining, resetMs } = checkRateLimit(ip);

    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before analyzing more content.', retryAfterMs: resetMs },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Retry-After': String(Math.ceil(resetMs / 1000)),
            'X-RateLimit-Remaining': '0',
          }
        }
      );
    }

    // Attach rate limit headers to the response
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  // For other API routes, just add CORS
  const response = NextResponse.next();
  Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
