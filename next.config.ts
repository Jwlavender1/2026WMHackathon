import type { NextConfig } from 'next';
const config: NextConfig = {
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
};
export default config;
