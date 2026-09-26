import { createHash } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { NextResponse } from 'next/server';
import { publicCorsHeaders } from '@/lib/public-cors';
import { getUpstashRedis } from '@/lib/upstash-redis';

export type RateLimitKind =
  | 'register'
  | 'forgot-password'
  | 'public-get';

/** Thresholds chosen for abuse protection without blocking normal gym traffic. */
const LIMITERS: Record<
  RateLimitKind,
  { requests: number; window: `${number} ${'s' | 'm' | 'h' | 'd'}`; prefix: string }
> = {
  // Athlete self-register (email create + profile write)
  register: { requests: 5, window: '1 h', prefix: 'rl:register' },
  // Password reset emails / user lookup
  'forgot-password': { requests: 5, window: '1 h', prefix: 'rl:forgot' },
  // Public tenant/product GETs (slug scraping / scrape bots)
  'public-get': { requests: 60, window: '1 m', prefix: 'rl:public-get' },
};

const limiterCache = new Map<RateLimitKind, Ratelimit>();

function getLimiter(kind: RateLimitKind): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;

  const existing = limiterCache.get(kind);
  if (existing) return existing;

  const cfg = LIMITERS[kind];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(cfg.requests, cfg.window),
    prefix: cfg.prefix,
    analytics: false,
  });
  limiterCache.set(kind, limiter);
  return limiter;
}

/** Hash identifier so rate-limit keys never store raw IP/email (PII). */
export function hashIdentifier(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 32);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

/**
 * Enforce a rate limit. Fails open (allows) when Redis/env is unavailable.
 * Identifier should already be hashed when it contains PII.
 */
export async function enforceRateLimit(
  kind: RateLimitKind,
  identifier: string
): Promise<RateLimitResult> {
  const limiter = getLimiter(kind);
  if (!limiter) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.error(`Rate limit (${kind}) failed open:`, error);
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
}

export function rateLimitExceededResponse(
  result: RateLimitResult,
  extraHeaders?: HeadersInit
): NextResponse {
  const retryAfterSec =
    result.reset > 0
      ? Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
      : 60;

  return NextResponse.json(
    { error: 'rate_limited' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        ...(extraHeaders ?? {}),
      },
    }
  );
}

/** IP-based check for public GET routes. */
export async function enforcePublicGetRateLimit(
  request: Request
): Promise<NextResponse | null> {
  const ipHash = hashIdentifier(getClientIp(request));
  const result = await enforceRateLimit('public-get', ipHash);
  if (!result.success) {
    return rateLimitExceededResponse(
      result,
      publicCorsHeaders(request.headers.get('origin'))
    );
  }
  return null;
}

/**
 * Combined IP + optional email hash for auth POSTs.
 * Both must pass when email is provided.
 */
export async function enforceAuthPostRateLimit(
  kind: 'register' | 'forgot-password',
  request: Request,
  email?: string
): Promise<NextResponse | null> {
  const ipHash = hashIdentifier(getClientIp(request));
  const ipResult = await enforceRateLimit(kind, `ip:${ipHash}`);
  if (!ipResult.success) return rateLimitExceededResponse(ipResult);

  if (email && email.includes('@')) {
    const emailHash = hashIdentifier(email);
    const emailResult = await enforceRateLimit(kind, `email:${emailHash}`);
    if (!emailResult.success) return rateLimitExceededResponse(emailResult);
  }

  return null;
}
