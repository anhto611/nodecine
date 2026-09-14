/** @type {import('next').NextConfig} */
const nextConfig = {
  // The dev badge sits bottom-left by default, right on top of the rail's Settings button.
  devIndicators: { position: 'bottom-right' },
  // The HyperFrames producer drives a browser and ships its own runtime files; Next.js must not
  // bundle it. Puppeteer is here for the same reason: it downloads its own browser.
  serverExternalPackages: ['@hyperframes/producer', '@hyperframes/engine', '@hyperframes/core', '@hyperframes/lint', 'puppeteer', 'puppeteer-core'],
};
export default nextConfig;
