/** @type {import('next').NextConfig} */
const nextConfig = {
  // ARCHITECTURE.md §8.2: Remotion's bundler/renderer ship their own webpack and native binaries;
  // Next.js must not bundle them.
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer'],
};
export default nextConfig;
