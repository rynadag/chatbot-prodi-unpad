import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Explicitly set the Turbopack root to the front-end folder
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

