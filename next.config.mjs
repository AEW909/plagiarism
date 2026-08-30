/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["localhost:3209", "127.0.0.1:3209", "localhost:3000", "127.0.0.1:3000"],
  devIndicators: false,
  reactStrictMode: true
};

export default nextConfig;
