// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // ✅ FIX: Increase body size limit for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb', // Increase from default 1mb to 25mb
    },
  },
};

export default nextConfig;