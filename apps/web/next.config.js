/** @type {import('next').NextConfig} */
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

function resolveApiUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  const portFile = join(__dirname, '../server/data/.dev-port');
  try {
    if (existsSync(portFile)) {
      const port = readFileSync(portFile, 'utf8').trim();
      if (port) return `http://localhost:${port}`;
    }
  } catch {
    /* fall through */
  }
  return 'http://localhost:3001';
}

const nextConfig = {
  transpilePackages: ['@precious/panel'],
  output: process.env.PRECIOUS_STATIC_EXPORT === '1' ? 'export' : undefined,
  images: { unoptimized: true },
  async rewrites() {
    const apiUrl = resolveApiUrl();    return [
      { source: '/api/auth/:path*', destination: `${apiUrl}/api/auth/:path*` },
      { source: '/api/chat/:path*', destination: `${apiUrl}/api/chat/:path*` },
      { source: '/api/keys/unified', destination: `${apiUrl}/api/keys/unified` },
      { source: '/api/keys/providers', destination: `${apiUrl}/api/keys/providers` },
      { source: '/api/keys/settings', destination: `${apiUrl}/api/keys/settings` },
      { source: '/api/keys/usage', destination: `${apiUrl}/api/keys/usage` },
      { source: '/api/keys/health-check', destination: `${apiUrl}/api/keys/health-check` },
      { source: '/api/keys/:id/test', destination: `${apiUrl}/api/keys/:id/test` },
      { source: '/api/keys/:id', destination: `${apiUrl}/api/keys/:id` },
      { source: '/api/keys', destination: `${apiUrl}/api/keys` },
      { source: '/api/fallback-chain', destination: `${apiUrl}/api/fallback-chain` },
      { source: '/v1/:path*', destination: `${apiUrl}/v1/:path*` },
    ];
  },
};

module.exports = nextConfig;
