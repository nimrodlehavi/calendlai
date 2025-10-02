import type { NextConfig } from "next";

const allowedDevOrigins = (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: allowedDevOrigins.length
        ? allowedDevOrigins
        : ["http://10.0.0.14:3000", "http://localhost:3000"],
    },
  },
};

export default nextConfig;
