import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  ...(isDevelopment ? {} : { output: 'export' as const }),
  poweredByHeader: false,
  trailingSlash: true,
  turbopack: { root: process.cwd() },
  ...(isDevelopment ? {
    async rewrites() {
      return [{
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8001/api/:path*',
      }];
    },
  } : {}),
};

export default nextConfig;
