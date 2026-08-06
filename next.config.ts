import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  webpack(config, { webpack }) {
    if (process.env.RAPIDEX_RUNTIME === "vercel" || process.env.VERCEL) {
      const replacement = path.resolve(process.cwd(), "lib/vercel-cloudflare.ts");
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/, replacement),
      );
    }
    return config;
  },
};

export default nextConfig;
