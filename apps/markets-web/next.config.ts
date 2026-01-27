import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vault/ui", "@vault/database", "@vault/auth", "@vault/twitter-service"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Turbopack is now default in Next.js 16, no flag needed
  // turbopack: {} // Add custom turbopack options here if needed
};

export default nextConfig;
