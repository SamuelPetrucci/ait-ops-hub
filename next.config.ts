import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The hub is a private, per-request app. Cache Components would force every
  // cookie read behind a static shell, which fights auth and live queues.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
