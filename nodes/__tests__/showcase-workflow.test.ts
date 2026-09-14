import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensureServerRegistrations } from '@/server/register';
import { getNodeType } from '@/core/nodes/definition';
import { topoSort, validateGraph } from '@/core/engine/graph';
import { CONTENT_KEYS, PAYLOAD_SCHEMAS, PlateSheetSchema, type ContentKey, type PlateSheet, type SceneContent } from '@/contracts/types/payloads';
import { TemplateDefinitionSchema } from '@/core/templates/registry';
import { fillPlate, plateFor, signatureKey } from '@/contracts/visual/plates';
import { esc } from '@/contracts/visual/scene-markup';
import { lintPlate } from '@/nodes/plates/prompt';

/**
 * The showcase workflow, checked without running it.
 *
 * What it claims: paste a repository link, and the screenwriter writes the film choosing a layout
 * per scene from a catalogue drawn once and pinned. So what is worth a test is the catalogue and
 * the wire that puts it in front of the model — a shape the model can write but nothing can draw
 * stops the film at the scene builder, after the expensive half of the run is already paid for.
 */

const FILE = path.resolve(process.cwd(), '.nodecine/workflows/t03-github-showcase.json');
const doc = TemplateDefinitionSchema.parse(JSON.parse(readFileSync(FILE, 'utf8')));
const nodeOf = (id: string) => doc.graph.nodes.find((n) => n.id === id)!;
const catalogue = (): PlateSheet => PlateSheetSchema.parse(nodeOf('plates').pinned!.outputs.plates);

describe('the showcase workflow', () => {
  ensureServerRegistrations();

  it('names only nodes this build ships, and gives each parameters it accepts', () => {
    for (const n of doc.graph.nodes) {
      const def = getNodeType(n.type);
      expect(def, n.type).toBeTruthy();
      expect(() => def!.paramsSchema.parse(n.params), `${n.id} params`).not.toThrow();
    }
  });

  it('is a graph the engine will run: nothing blocking, and no cycle', () => {
    expect(validateGraph(doc.graph).filter((i) => i.severity === 'error')).toEqual([]);
    expect(topoSort(doc.graph)).not.toHaveProperty('cycleEdges');
  });

  it('wires every edge between ports that exist and agree on their payload', () => {
    for (const e of doc.graph.edges) {
      const from = getNodeType(nodeOf(e.source).type)!.outputs.find((p) => p.name === e.sourcePort);
      const to = getNodeType(nodeOf(e.target).type)!.inputs.find((p) => p.name === e.targetPort);
      expect(from, `${e.source}.${e.sourcePort}`).toBeTruthy();
      expect(to, `${e.target}.${e.targetPort}`).toBeTruthy();
      expect(from!.type, e.id).toBe(to!.type);
    }
  });

  it('pins outputs that still fit the payloads this build reads', () => {
    for (const n of doc.graph.nodes) {
      if (!n.pinned) continue;
      const def = getNodeType(n.type)!;
      for (const [port, payload] of Object.entries(n.pinned.outputs)) {
        const declared = def.outputs.find((p) => p.name === port);
        expect(declared, `${n.id}.${port}`).toBeTruthy();
        expect(() => PAYLOAD_SCHEMAS[declared!.type as keyof typeof PAYLOAD_SCHEMAS].parse(payload), `${n.id}.${port}`).not.toThrow();
      }
    }
  });

  it('starts from a link, and the writer sees both the link and what was fetched from it', () => {
    expect(String(nodeOf('input').params.value)).toMatch(/^https?:\/\//);
    const into = (target: string, port: string) => doc.graph.edges.some((e) => e.target === target && e.targetPort === port);
    expect(into('github', 'source')).toBe(true);
    expect(into('writer', 'source')).toBe(true);
    expect(into('writer', 'facts')).toBe(true);
  });

  it('puts the catalogue in front of the writer, which is what lets it choose a layout', () => {
    // Without this wire the model writes whatever shape it likes and the scene builder refuses the
    // film. Checked on the port's payload type, not on a node's name.
    const wire = doc.graph.edges.find((e) => e.target === 'writer' && e.targetPort === 'plates');
    expect(wire, 'no catalogue reaches the screenwriter').toBeTruthy();
    const from = getNodeType(nodeOf(wire!.source).type)!.outputs.find((p) => p.name === wire!.sourcePort);
    expect(from!.type).toBe('PlateSheet');
  });

  it('offers more layouts than the film has scenes, so choosing one is a real choice', () => {
    const beats = nodeOf('writer').params.beats as { count: number }[];
    const scenes = beats.reduce((n, b) => n + b.count, 0);
    expect(scenes).toBeGreaterThan(10);
    expect(catalogue().plates.length).toBeGreaterThanOrEqual(scenes);
  });

  it('holds one plate per shape: a signature drawn twice is a choice nothing can resolve', () => {
    const plates = catalogue().plates;
    const signatures = plates.map((p) => signatureKey(p.keys));
    expect(new Set(signatures).size, signatures.join(' ')).toBe(plates.length);
    expect(new Set(plates.map((p) => p.id)).size).toBe(plates.length);
  });

  it('draws every key it declares, with a budget the script can be held to', () => {
    for (const p of catalogue().plates) {
      expect(lintPlate(p.source, p.keys), p.id).toEqual([]);
      for (const k of p.keys) expect(p.budget?.[k], `${p.id} · ${k} has no budget`).toBeGreaterThan(0);
    }
  });

  it('fills each plate from a scene of its own shape, leaving no placeholder behind', () => {
    const sheet = catalogue();
    for (const p of sheet.plates) {
      // A scene that says exactly what this plate draws, which is what the writer is asked for.
      const content = Object.fromEntries(p.keys.map((k) => [k, k === 'points' ? [`${k} một`, `${k} hai`] : `giá trị ${k}`])) as SceneContent;
      expect(plateFor(sheet, content)?.id, `${p.id} is not found by its own shape`).toBe(p.id);
      const out = fillPlate(p, content);
      for (const k of p.keys) {
        const v = (content as Record<string, unknown>)[k];
        for (const text of Array.isArray(v) ? (v as string[]) : [String(v)]) expect(out, `${p.id} · ${k}`).toContain(esc(text));
      }
      // Balanced markup: an unbalanced fill used to eat the rest of the layout without a word.
      expect(out.split('<div').length, p.id).toBe(out.split('</div>').length);
    }
  });

  it('keeps every key of its catalogue inside the vocabulary a model can write', () => {
    const writable = new Set<ContentKey>(CONTENT_KEYS.filter((k) => k !== 'image' && k !== 'clip'));
    for (const p of catalogue().plates) for (const k of p.keys) expect(writable.has(k), `${p.id} asks for ${k}`).toBe(true);
  });
});
