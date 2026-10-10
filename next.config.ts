import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      { source: "/cuidador", destination: "/familia", permanent: true },
      { source: "/cuidador/:path*", destination: "/familia/:path*", permanent: true },
      // One page for how Qwida was built: tokens, hand art, people, tools.
      { source: "/tools", destination: "/ledger", permanent: false },
      { source: "/tools/", destination: "/ledger", permanent: false },
    ];
  },
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
