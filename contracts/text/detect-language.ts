/**
 * Script-based language detection.
 *
 * Deliberately tiny and dependency-free: it looks at which writing system dominates the text and,
 * for Latin text, whether Vietnamese-only letters or everyday Vietnamese words are present. It returns
 * a BCP 47 primary subtag that the Voiceover node uses to pick a voice; the user can always override
 * the voice by hand. Latin text with no sign of Vietnamese is reported as English.
 */

type Range = { lang: string; re: RegExp };

const SCRIPTS: Range[] = [
  { lang: 'ja', re: /[\u3040-\u30ff]/g }, // Hiragana + Katakana (checked before Han: Japanese mixes both)
  { lang: 'ko', re: /[\uac00-\ud7af\u1100-\u11ff]/g },
  { lang: 'zh', re: /[\u4e00-\u9fff\u3400-\u4dbf]/g },
  { lang: 'th', re: /[\u0e00-\u0e7f]/g },
  { lang: 'ar', re: /[\u0600-\u06ff]/g },
  { lang: 'hi', re: /[\u0900-\u097f]/g },
  { lang: 'ru', re: /[\u0400-\u04ff]/g },
  { lang: 'el', re: /[\u0370-\u03ff]/g },
  { lang: 'he', re: /[\u0590-\u05ff]/g },
];

/** Letters that occur in Vietnamese and in (almost) no other Latin-script language. */
const VIETNAMESE_MARKERS = /[đĐăĂơƠưƯạảẠẢấầẩẫậẤẦẨẪẬắằẳẵặẮẰẲẴẶẹẻẽẸẺẼếềểễệẾỀỂỄỆịỉĩỊỈĨọỏõỌỎÕốồổỗộỐỒỔỖỘớờởỡợỚỜỞỠỢụủũỤỦŨứừửữựỨỪỬỮỰỳỷỹỵỲỶỸỴ]/g;

/**
 * Short Vietnamese sentences can carry none of those letters — "so sánh frontend và backend" has only
 * the tone marks Spanish and French use too. Everyday Vietnamese words settle those: a word from this
 * list beside a Latin tone mark, or two of them, is Vietnamese.
 */
const VIETNAMESE_WORDS = /(?<![\p{L}])(và|là|của|có|không|được|một|những|với|cho|khi|thì|ở|để|nào|sao|gì|nhưng|hoặc|rồi|chưa|nữa|rất|này|về|theo|trong|làm|nói|bạn|tôi|mình)(?![\p{L}])/giu;

/** A Latin letter carrying any accent: Vietnamese tone marks, and every other language's too. */
const LATIN_ACCENTS = /[À-ɏḀ-ỿ]/g;

const count = (text: string, re: RegExp): number => (text.match(re) ?? []).length;

export function detectLanguage(text: string): string {
  const sample = text.normalize('NFC');
  if (!sample.trim()) return 'en';

  // Non-Latin scripts: the first script with a meaningful share of letters wins.
  const letters = count(sample, /\p{L}/gu) || 1;
  for (const { lang, re } of SCRIPTS) {
    const n = count(sample, re);
    if (n > 0 && n / letters >= 0.2) return lang;
  }

  if (count(sample, VIETNAMESE_MARKERS) > 0) return 'vi';
  const words = count(sample, VIETNAMESE_WORDS);
  if (words >= 2 || (words === 1 && count(sample, LATIN_ACCENTS) > 0)) return 'vi';
  return 'en';
}
