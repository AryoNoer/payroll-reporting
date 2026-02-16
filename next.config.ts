import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output for Docker/Railway deployment
  output: 'standalone',

  // Ensure these packages are loaded from node_modules (not webpack-bundled)
  serverExternalPackages: ['exceljs', 'xlsx'],

  // Server Actions body size limit (500MB for large file uploads)
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },

  // CORS headers for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;