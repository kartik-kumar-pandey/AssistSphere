/** @type {import('next').NextConfig} */
const nextConfig = {
  // WebRTC + Socket.io: avoid double-mount tearing down active connections
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', '@excalidraw/excalidraw'],
  },
  // Fix for OneDrive/Windows symlink and diagnostics issues
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  webpack: (config) => {
    config.cache = false;
    return config;
  },
};
export default nextConfig;
