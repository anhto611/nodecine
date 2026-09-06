import { describe, expect, it } from 'vitest';
import { STAGE_ROLES, addImageToCode, addRoleToCode, addShapeToCode, addTextToCode, elementKindOf, elementTextOf, fieldNameOf, nextClass, removeElementFromCode, removeFieldFromCode, rolesIn, setElementText } from '../stage-elements';
import { DEFAULT_STAGE } from '@/nodes/look/node';

const src = DEFAULT_STAGE.code.source;

describe('stage elements', () => {
  it('adds a text element with a rule, inside the root, before the script, and can read and change its text', () => {
    const { code, cls } = addTextToCode(src, 'Kênh của <tôi>');
    expect(cls).toBe('text');
    expect(code.indexOf(`.stage .${cls} {`)).toBeLessThan(code.indexOf('</style>'));
    const el = code.indexOf(`<div class="${cls}">`);
    expect(el).toBeGreaterThan(code.indexOf('data-slot="captions"'));
    expect(el).toBeLessThan(code.indexOf('<script'));
    expect(elementTextOf(code, cls)).toBe('Kênh của <tôi>');
    const renamed = setElementText(code, cls, 'Mới');
    expect(elementTextOf(renamed, cls)).toBe('Mới');
    expect(nextClass(code, 'text')).toBe('text-2');
  });

  it('adds a shape and an image, and refuses an image that is not an asset', () => {
    const { code: c1, cls: s1 } = addShapeToCode(src);
    expect(c1).toContain(`<div class="${s1}"></div>`);
    const { code: c2, cls: i1 } = addImageToCode(c1, '/api/assets/0123456789abcdef0123456789abcdef.png');
    expect(c2).toContain(`<img class="${i1}" src="/api/assets/0123456789abcdef0123456789abcdef.png" alt="">`);
    expect(elementTextOf(c2, i1)).toBe('');
    expect(() => addImageToCode(src, 'https://evil.example/x.png')).toThrow();
  });

  it('removes an element and its rule, including a nested one, and leaves everything else', () => {
    const { code } = addTextToCode(src, 'bye');
    const out = removeElementFromCode(code, 'text');
    expect(out).not.toContain('class="text"');
    expect(out).not.toContain('.stage .text {');
    expect(out).toContain('data-slot="content"');
    const nested = '<style>\n  .stage .card { position: absolute; }\n</style>\n<div class="stage"><div class="card"><div>inner</div></div><div class="rule"></div></div>';
    const gone = removeElementFromCode(nested, 'card');
    expect(gone).toBe('<style>\n</style>\n<div class="stage"><div class="rule"></div></div>');
    expect(elementTextOf(nested, 'card')).toBeNull();
    expect(elementTextOf(src, 'kicker')).toBeNull();
  });

  it('tells slots, fields, images, texts and shapes apart', () => {
    expect(elementKindOf(src, 'content')).toBe('slot');
    expect(elementKindOf(src, 'captions')).toBe('captions');
    expect(elementKindOf(src, 'kicker')).toBe('field');
    expect(elementKindOf(src, 'rule')).toBe('shape');
    const { code } = addTextToCode(src, 'hi');
    expect(elementKindOf(code, 'text')).toBe('text');
    const { code: c2, cls } = addImageToCode(src, '/api/assets/0123456789abcdef0123456789abcdef.png');
    expect(elementKindOf(c2, cls)).toBe('image');
  });

  it('knows which field an element draws and removes the element of a field by the field name', () => {
    expect(fieldNameOf(src, 'kicker')).toBe('kicker');
    expect(fieldNameOf(src, 'rule')).toBeNull();
    const out = removeFieldFromCode(src, 'kicker');
    expect(out).not.toContain('data-field="kicker"');
    expect(out).not.toContain('.stage .kicker {');
    expect(out).toContain('data-slot="content"');
    const bare = '<div class="stage"><span data-field="mood">x</span><div class="rule"></div></div>';
    expect(removeFieldFromCode(bare, 'mood')).toBe('<div class="stage"><div class="rule"></div></div>');
    expect(removeFieldFromCode(src, 'nothing')).toBe(src);
  });

  it('the shipped stage carries four catalogue roles; the rest can be added once each, by role', () => {
    expect(rolesIn(src).sort()).toEqual(['captions', 'content', 'kicker', 'rule']);
    const withSig = addRoleToCode(src, 'signature', { text: '@nodecine' });
    expect(withSig).toContain('<div class="signature">@nodecine</div>');
    expect(withSig).toContain('.stage .signature {');
    expect(addRoleToCode(withSig, 'signature')).toBe(withSig);
    const withSrc = addRoleToCode(withSig, 'source');
    expect(withSrc).toContain('<div class="source" data-field="source"></div>');
    expect(elementKindOf(withSrc, 'source')).toBe('field');
    const withLogo = addRoleToCode(withSrc, 'logo', { src: '/api/assets/0123456789abcdef0123456789abcdef.png' });
    expect(withLogo).toContain('<img class="logo" src="/api/assets/0123456789abcdef0123456789abcdef.png" alt="">');
    expect(() => addRoleToCode(src, 'logo')).toThrow();
    expect(() => addRoleToCode(src, 'banner')).toThrow();
    expect(rolesIn(withLogo).length).toBe(STAGE_ROLES.length);
    expect(STAGE_ROLES.filter((r) => r.required).map((r) => r.id)).toEqual(['content']);
  });
});
