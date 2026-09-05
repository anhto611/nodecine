import { describe, expect, it } from 'vitest';
import { AudioScriptSchema, DirectorPlanSchema } from '@/core/types/payloads';
import { TITLE_CARD } from '@/core/scenes/title-card';
import { DirectorOutputSchema, MAX_QUOTES, MIN_QUOTES, buildQuotePrompt, sameLanguage, toPackets } from '../director';
import { QUOTE, THEME } from '../scenes/schemas';

const quote = (text: string) => ({ text, attribution: 'an old proverb', accentColor: '#b4562f' });

const output = {
  language: 'en',
  title: 'Keep Going',
  subtitle: 'Four lines for the slow days',
  accentColor: '#b4562f',
  audioScript: 'Progress is rarely loud. These four lines are for the stretch where the work looks the same every day.',
  quotes: [
    quote('The oak fought the wind and was broken; the willow bent and survived.'),
    quote('Fall seven times, stand up eight.'),
    quote('A river cuts through rock not because of power but persistence.'),
  ],
};

describe('the prompt', () => {
  it('carries the theme, the language and the exact count', () => {
    const p = buildQuotePrompt('staying focused', 'vi', 5);
    expect(p).toContain('staying focused');
    expect(p).toContain('Vietnamese');
    expect(p).toContain('exactly 5 quotes');
  });

  it('gets stricter only on the retry', () => {
    expect(buildQuotePrompt('x', 'vi', 4, true)).toContain('mandatory');
    expect(buildQuotePrompt('x', 'vi', 4)).not.toContain('mandatory');
  });

  it('stands in for an empty theme rather than asking about nothing', () => {
    expect(buildQuotePrompt('   ', 'en', 4)).toContain('perseverance');
  });
});

describe('the output schema', () => {
  it('holds the model to the agreed range of quotes', () => {
    expect(DirectorOutputSchema.safeParse(output).success).toBe(true);
    expect(DirectorOutputSchema.safeParse({ ...output, quotes: output.quotes.slice(0, MIN_QUOTES - 1) }).success).toBe(false);
    expect(DirectorOutputSchema.safeParse({ ...output, quotes: Array.from({ length: MAX_QUOTES + 1 }, () => quote('long enough to pass')) }).success).toBe(false);
  });

  it('rejects a colour that is not a hex colour, and strips invented fields', () => {
    expect(DirectorOutputSchema.safeParse({ ...output, accentColor: 'rust' }).success).toBe(false);
    const parsed = DirectorOutputSchema.parse({ ...output, quotes: [{ ...output.quotes[0], author: 'someone' }, output.quotes[1], output.quotes[2]] });
    expect('author' in parsed.quotes[0]!).toBe(false);
  });
});

describe('toPackets', () => {
  it('opens with the core title card and then one scene per quote', () => {
    const { plan } = toPackets(DirectorOutputSchema.parse(output));
    expect(plan.scenes.map((s) => s.sceneType)).toEqual([TITLE_CARD, QUOTE, QUOTE, QUOTE]);
    expect(plan.theme).toBe(THEME);
  });

  it('gives the plan a length that follows the model, not a fixed tuple', () => {
    const five = { ...output, quotes: [...output.quotes, quote('Still water runs deep.'), quote('Slow is smooth.')] };
    expect(toPackets(DirectorOutputSchema.parse(five)).plan.scenes).toHaveLength(6);
  });

  it('binds no facts at all, because this pack has none', () => {
    const { plan } = toPackets(DirectorOutputSchema.parse(output));
    for (const s of plan.scenes) expect(s.factBindings).toBeUndefined();
  });

  it('paints every card in the one colour the model chose', () => {
    const mixed = { ...output, quotes: output.quotes.map((q, i) => ({ ...q, accentColor: i === 0 ? '#111111' : q.accentColor })) };
    const { plan } = toPackets(DirectorOutputSchema.parse(mixed));
    const colours = new Set(plan.scenes.map((s) => s.props.accentColor));
    expect([...colours]).toEqual(['#b4562f']);
  });

  it('produces payloads the core schemas accept', () => {
    const { plan, script } = toPackets(DirectorOutputSchema.parse(output));
    expect(DirectorPlanSchema.safeParse(plan).success).toBe(true);
    expect(AudioScriptSchema.safeParse(script).success).toBe(true);
  });
});

describe('sameLanguage', () => {
  it('compares primary subtags only', () => {
    expect(sameLanguage('en-US', 'en')).toBe(true);
    expect(sameLanguage('vi', 'en')).toBe(false);
  });
});
