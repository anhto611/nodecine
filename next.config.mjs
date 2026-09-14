/** @type {import('next').NextConfig} */
const nextConfig = {
  // The dev badge sits bottom-left by default, right on top of the rail's Settings button.
  devIndicators: { position: 'bottom-right' },
  // A preview runs in a sandboxed iframe, which has no origin ('null'), so every font it loads is a
  // cross-origin request the browser refuses without this. Missing fonts drop a preview to a system
  // face and stop it matching the render, which reads as a design bug rather than a policy one.
  async headers() {
    return [{ source: '/fonts/:file*', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }, { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }];
  },
  // Remotion's bundler/renderer ship their own webpack and native binaries;
  // Next.js must not bundle them. Puppeteer is here for the same reason: it downloads its own browser.
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer', '@hyperframes/producer', '@hyperframes/engine', '@hyperframes/core', 'puppeteer', 'puppeteer-core'],
};
export default nextConfig;
