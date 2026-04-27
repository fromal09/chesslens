import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow cross-origin worker from /public
  async headers() {
    return [
      {
        source: '/stockfish.worker.js',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};

export default nextConfig;
