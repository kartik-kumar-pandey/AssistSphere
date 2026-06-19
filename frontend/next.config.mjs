/** @type {import('next').NextConfig} */
const nextConfig = {
  // WebRTC + Socket.io: avoid double-mount tearing down active connections
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', '@excalidraw/excalidraw'],
  },
};
export default nextConfig;
