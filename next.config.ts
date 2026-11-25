import type { NextConfig } from "next";

// Static export for GitHub Pages. The site lives under /haji-training-block there;
// set NEXT_PUBLIC_BASE_PATH="" for local previews at the root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/haji-training-block";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
