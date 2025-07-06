import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';
const withMDX = createMDX();

const config: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // Replaced by root workspace command
    ignoreDuringBuilds: true,
  },
};

export default withMDX(config);
