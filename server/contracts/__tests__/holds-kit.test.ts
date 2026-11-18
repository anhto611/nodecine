import { describe, it, expect } from 'vitest';
import { holdsKit } from '@/contracts/agent/kit';
import { listNodeTypes } from '@/core/nodes/definition';
import { ensureServerRegistrations } from '../register';

/** The node that holds a kit is told by its shape: exactly one node type has it. */
describe('the node that holds a kit', () => {
  it('is the one that puts out a composition and keeps its files', () => {
    ensureServerRegistrations();
    expect(listNodeTypes().filter((d) => holdsKit(d.type)).map((d) => d.type)).toEqual(['composition']);
  });
});
