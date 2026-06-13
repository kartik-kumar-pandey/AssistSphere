/** @type {import('next').NextConfig} */
const nextConfig = {
  // WebRTC + Socket.io: avoid double-mount tearing down active connections
  reactStrictMode: false,
};
export default nextConfig;
