/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable image optimization for external domains
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Enable React strict mode for development
  reactStrictMode: true,
};

export default nextConfig;
