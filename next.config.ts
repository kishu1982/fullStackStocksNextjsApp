import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["typeorm", "mongodb", "ws"],
  allowedDevOrigins: ["43.242.224.95"],
};

export default nextConfig;
