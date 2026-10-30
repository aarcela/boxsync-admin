const ALLOWED_ORIGINS = new Set([
  'https://www.getwodus.com',
  'https://getwodus.com',
  'http://localhost:3000',
  'http://localhost:3001',
]);

export function publicCorsHeaders(
  origin: string | null,
  methods = 'GET, OPTIONS'
): HeadersInit {
  const allow =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.getwodus.com';

  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    Vary: 'Origin',
  };
}
