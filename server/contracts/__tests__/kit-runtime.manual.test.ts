import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { runtimeProblems } from '../kit-session';
import { ensureServerRegistrations } from '../register';

/** Plays every block of a built kit (NODECINE_MANUAL_KIT=<kit folder>) and lists the script errors. */
const dir = process.env.NODECINE_MANUAL_KIT;
describe.skipIf(!dir)('a built kit, played (live)', () => {
  it('reports the blocks that throw', async () => {
    ensureServerRegistrations();
    const files: Record<string, string> = {};
    const walk = (rel: string) => {
      for (const n of readdirSync(path.join(dir!, rel))) {
        if (n.startsWith('.') || ['NODECINE-KIT.md', 'SAMPLE.md', 'sample'].includes(n)) continue;
        const p = rel ? `${rel}/${n}` : n;
        if (statSync(path.join(dir!, p)).isDirectory()) walk(p);
        else if (/\.(html|js|css|md|json)$/.test(n)) files[p] = readFileSync(path.join(dir!, p), 'utf8');
      }
    };
    walk('');
    const blocks = Object.keys(files).filter((p) => /^compositions\/[a-z-]+\.html$/.test(p));
    const problems = await runtimeProblems(files, blocks);
    console.log(problems.join('\n') || 'no problems');
    expect(Array.isArray(problems)).toBe(true);
  }, 300_000);
});
