import type { ErrorEvent, EventHint } from '@sentry/nextjs';

const AUTH_PATH_MARKERS = [
  '/auth',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/api/auth',
];

function isAuthRelatedUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const path = url.startsWith('http') ? new URL(url).pathname : url;
    return AUTH_PATH_MARKERS.some((marker) => path.includes(marker));
  } catch {
    return AUTH_PATH_MARKERS.some((marker) => url.includes(marker));
  }
}

/** Strip credentials / bodies on auth routes before events leave the process. */
export function scrubSentryEvent(
  event: ErrorEvent,
  _hint?: EventHint
): ErrorEvent | null {
  if (event.request && isAuthRelatedUrl(event.request.url)) {
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.headers) {
      const headers = { ...event.request.headers };
      for (const key of Object.keys(headers)) {
        const lower = key.toLowerCase();
        if (
          lower === 'authorization' ||
          lower === 'cookie' ||
          lower === 'x-supabase-auth'
        ) {
          delete headers[key];
        }
      }
      event.request.headers = headers;
    }
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = event.request.query_string.replace(
        /(password|token|code|email)=[^&]*/gi,
        '$1=[Filtered]'
      );
    }
  }
  return event;
}

export function getSentryDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
}

/** Shared init options for client / server / edge (Sentry SDK v11). */
export function getSentryInitOptions() {
  return {
    dsn: getSentryDsn(),
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpBodies: [],
      urlQueryParams: {
        deny: ['password', 'token', 'code', 'email', 'refresh_token'],
      },
    },
    beforeSend: scrubSentryEvent,
  };
}
