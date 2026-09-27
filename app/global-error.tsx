'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#f9fafb',
          color: '#111827',
        }}
      >
        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: '0.5rem', color: '#6b7280' }}>
            An unexpected error occurred. Please try again.
          </p>
        </div>
      </body>
    </html>
  );
}
