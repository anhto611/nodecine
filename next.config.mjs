/** @type {import('next').NextConfig} */
const nextConfig = {
  // The dev badge sits bottom-left by default, right on top of the rail's Settings button.
  devIndicators: { position: 'bottom-right' },
  // ARCHITECTURE.md §8.2: Remotion's bundler/renderer ship their own webpack and native binaries;
  // Next.js must not bundle them.
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer', '@hyperframes/producer', '@hyperframes/engine', '@hyperframes/core', 'puppeteer', 'puppeteer-core'],
};
export default nextConfig;
