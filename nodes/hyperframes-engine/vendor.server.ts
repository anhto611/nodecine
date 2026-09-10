import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * The two scripts every composition inlines, read from the installed packages. The paths are fixed
 * relative to the app's own `node_modules` — never derived from a request — and handed to the app's
 * vendor registry (`server/vendor.ts`) at registration, so the vendor route can only ever serve these two files. (A resolver would be nicer, but Next's bundler rewrites `require`
 * inside route modules, so `createRequire` cannot be used here.)
 */
export const VENDOR_FILES = {
  'gsap.js': 'gsap/dist/gsap.min.js',
  'hyperframes-runtime.js': '@hyperframes/core/dist/hyperframe.runtime.iife.js',
} as const;
export type VendorName = keyof typeof VENDOR_FILES;

const cache = new Map<VendorName, Promise<string>>();

export function vendorSource(name: VendorName): Promise<string> {
  let p = cache.get(name);
  if (!p) {
    const file = path.join(process.cwd(), 'node_modules', VENDOR_FILES[name]);
    p = readFile(file, 'utf8').catch((e: unknown) => {
      cache.delete(name);
      throw Object.assign(new Error(`vendor script ${name} is missing at ${file}; run npm install`), { code: 'ENGINE_NOT_READY', cause: e });
    });
    cache.set(name, p);
  }
  return p;
}

export const isVendorName = (s: string): s is VendorName => Object.prototype.hasOwnProperty.call(VENDOR_FILES, s);

/** Tell the app's vendor route about the two files. */
export function registerVendorSources(register: (name: string, load: () => Promise<string>) => void): void {
  for (const name of Object.keys(VENDOR_FILES) as VendorName[]) register(name, () => vendorSource(name));
}
