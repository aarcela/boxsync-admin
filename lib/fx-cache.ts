import { getUpstashRedis } from '@/lib/upstash-redis';

/** Default 10 minutes; override with FX_CACHE_TTL_SECONDS. */
export function getFxCacheTtlSeconds(): number {
  const raw = process.env.FX_CACHE_TTL_SECONDS?.trim();
  if (!raw) return 600;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 600;
}

export function fxCacheKey(currency: string, source: string): string {
  return `fx:${currency.toUpperCase()}:${source.toLowerCase()}`;
}

/** Read cached FX rate. Returns null on miss or Redis failure (fail open). */
export async function getCachedFxRate(
  currency: string,
  source: string
): Promise<number | null> {
  const redis = getUpstashRedis();
  if (!redis) return null;

  try {
    const value = await redis.get<number | string>(fxCacheKey(currency, source));
    if (value == null) return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch (error) {
    console.error('FX cache get failed open:', error);
    return null;
  }
}

/** Store FX rate. Ignores Redis failures (fail open). */
export async function setCachedFxRate(
  currency: string,
  source: string,
  rate: number
): Promise<void> {
  if (!Number.isFinite(rate) || rate <= 0) return;

  const redis = getUpstashRedis();
  if (!redis) return;

  try {
    await redis.set(fxCacheKey(currency, source), rate, {
      ex: getFxCacheTtlSeconds(),
    });
  } catch (error) {
    console.error('FX cache set failed open:', error);
  }
}
