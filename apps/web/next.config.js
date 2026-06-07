/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.PRECIOUS_STATIC_EXPORT === '1' ? 'export' : undefined,
  images: { unoptimized: true },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    return [
      { source: '/api/auth/:path*', destination: `${apiUrl}/api/auth/:path*` },
      { source: '/api/keys/unified', destination: `${apiUrl}/api/keys/unified` },
      { source: '/api/keys/providers', destination: `${apiUrl}/api/keys/providers` },
      { source: '/api/keys/settings', destination: `${apiUrl}/api/keys/settings` },
      { source: '/api/keys/:id', destination: `${apiUrl}/api/keys/:id` },
      { source: '/api/keys', destination: `${apiUrl}/api/keys` },
      { source: '/api/fallback-chain', destination: `${apiUrl}/api/fallback-chain` },
      { source: '/v1/:path*', destination: `${apiUrl}/v1/:path*` },
    ];
  },
};

module.exports = nextConfig;
