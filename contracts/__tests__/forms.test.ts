import { beforeEach, describe, expect, it } from 'vitest';
import { FilmFormSchema, _resetForms, getForm, listForms, registerForm } from '../forms/registry';
import { SHIPPED_FORMS, registerForms } from '@/forms';

/**
 * Film forms (CORE_CONTRACTS §6). The registry is the easy half; what these guard is the promise a
 * form makes — that it is data, that a bad one fails at startup rather than mid-run, and that the
 * shipped ones really do ask for different films rather than the same film in different colours.
 */

beforeEach(() => _resetForms());

describe('the registry', () => {
  it('is empty until something fills it, and hands back what it was given', () => {
    expect(listForms()).toEqual([]);
    expect(getForm('explainer')).toBeUndefined();
    const form = registerForm({ id: 'x', name: 'X', script: { guidance: 'say less' }, draw: { guidance: 'draw less' } });
    expect(form.draw.motion).toEqual([]);
    expect(getForm('x')).toEqual(form);
    expect(getForm(undefined)).toBeUndefined();
  });

  it('refuses a form that is the wrong shape, at the moment it is registered', () => {
    expect(() => registerForm({ id: 'No Caps', name: 'x', script: { guidance: 'a' }, draw: { guidance: 'b' } })).toThrow();
    expect(() => registerForm({ id: 'x', name: 'x', script: { guidance: 'a' } })).toThrow();
    expect(() => registerForm({ id: 'x', name: 'x', script: { guidance: 'a', keys: ['nonsense'] }, draw: { guidance: 'b' } })).toThrow();
    expect(() => registerForm({ id: 'x', name: 'x', script: { guidance: 'a' }, draw: { guidance: 'b' }, spanning: { brief: 'c', placement: 'beside' } })).toThrow();
  });
});

describe('the forms this build ships', () => {
  beforeEach(() => registerForms());

  it('all parse, and every one is named and described in both languages', () => {
    expect(SHIPPED_FORMS).toHaveLength(listForms().length);
    for (const raw of SHIPPED_FORMS) {
      const f = FilmFormSchema.parse(raw);
      for (const text of [f.name, f.description]) {
        if (typeof text === 'object') expect(Object.keys(text).sort()).toEqual(['en', 'vi']);
      }
    }
  });

  it('ask for different films: only the plain explainer keeps the default motion', () => {
    const withMotion = listForms().filter((f) => f.draw.motion.length > 0).map((f) => f.id).sort();
    expect(withMotion).toEqual(['data-story', 'device-demo', 'footage-frame', 'kinetic-type', 'music-cuts']);
    // The one that is today's behaviour says so by having nothing of its own to add.
    expect(getForm('explainer')!.draw.motion).toEqual([]);
  });

  it('say what each is made of, so a form is not handed the whole vocabulary', () => {
    for (const f of listForms()) {
      expect(f.script.keys, `${f.id} names no content keys`).toBeTruthy();
      expect(f.script.keys!.length).toBeGreaterThan(0);
    }
    // A film of big numbers has no room for paragraphs; a film of moving type has no room for lists.
    expect(getForm('data-story')!.script.keys).toContain('number');
    expect(getForm('kinetic-type')!.script.keys).not.toContain('body');
    expect(getForm('music-cuts')!.script.keys).not.toContain('body');
  });

  it('carries the device demo\'s spanning thing and the two forms that cut instead of fading', () => {
    expect(getForm('device-demo')!.spanning).toEqual({ brief: expect.stringContaining('phone'), placement: 'over' });
    expect(getForm('explainer')!.spanning).toBeUndefined();
    expect(listForms().filter((f) => f.transition?.type === 'cut').map((f) => f.id).sort()).toEqual(['kinetic-type', 'music-cuts']);
  });

  it('tells the music form not to listen for a voice that is not there', () => {
    const music = getForm('music-cuts')!;
    expect(music.draw.motion.join(' ')).toContain('never call nodecine.when()');
    expect(music.draw.motion.join(' ')).toContain("nodecine.audio('music-1')");
  });
});

describe('how long a scene of each form speaks', () => {
  beforeEach(() => registerForms());

  it('is asked for by every form that is not a paragraph of narration', () => {
    const shapes = Object.fromEntries(listForms().map((f) => [f.id, f.script.words]));
    // The plain explainer keeps the budget the app has always used; the rest say what they are.
    expect(shapes['explainer']).toBeUndefined();
    expect(shapes['kinetic-type']).toEqual({ min: 4, max: 9 });
    expect(shapes['music-cuts']).toEqual({ min: 3, max: 8 });
    for (const [id, w] of Object.entries(shapes)) {
      if (!w) continue;
      expect(w.max, `${id} asks for a max below its min`).toBeGreaterThan(w.min);
    }
  });
});
