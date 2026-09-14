import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * The scripts a composition inlines, read from the installed packages: gsap and the runtime always, lottie-web and three when a clip's format asks for them. The paths are fixed
 * relative to the app's own `node_modules` — never derived from a request — and handed to the app's
 * vendor registry (`server/vendor.ts`) at registration, so the vendor route can only ever serve these two files. (A resolver would be nicer, but Next's bundler rewrites `require`
 * inside route modules, so `createRequire` cannot be used here.)
 */
export const VENDOR_FILES = {
  'gsap.js': 'gsap/dist/gsap.min.js',
  'hyperframes-runtime.js': '@hyperframes/core/dist/hyperframe.runtime.iife.js',
  'lottie.js': 'lottie-web/build/player/lottie.min.js',
  // Made from three's ES module by scripts/vendor-three.mjs at `nodes:prepare`; a page cannot inline an ES module.
  'three.js': '.nodecine/vendor/three.iife.js',
} as const;
export type VendorName = keyof typeof VENDOR_FILES;

const cache = new Map<VendorName, Promise<string>>();

export function vendorSource(name: VendorName): Promise<string> {
  let p = cache.get(name);
  if (!p) {
    const rel = VENDOR_FILES[name];
    const file = rel.startsWith('.nodecine/') ? path.join(process.cwd(), rel) : path.join(process.cwd(), 'node_modules', rel);
    p = readFile(file, 'utf8').catch((e: unknown) => {
      cache.delete(name);
      throw Object.assign(new Error(`vendor script ${name} is missing at ${file}; run npm install${name === 'three.js' ? ' and npm run vendor:three' : ''}`), { code: 'ENGINE_NOT_READY', cause: e });
    });
    cache.set(name, p);
  }
  return p;
}

export const isVendorName = (s: string): s is VendorName => Object.prototype.hasOwnProperty.call(VENDOR_FILES, s);

/** Tell the app's vendor route about the files. */
export function registerVendorSources(register: (name: string, load: () => Promise<string>) => void): void {
  for (const name of Object.keys(VENDOR_FILES) as VendorName[]) register(name, () => vendorSource(name));
}
