const HANGUL = /[\uac00-\ud7af\u1100-\u11ff]/g;
const KANA = /[\u3040-\u309f\u30a0-\u30ff]/g;
const CYRILLIC = /[\u0400-\u04ff]/g;
const ARABIC = /[\u0600-\u06ff]/g;
const HAN = /[\u4e00-\u9fff]/g;

/** Only the Korean/not-Korean distinction actually drives product behaviour. */
export function detectLang(text: string): string {
  const sample = text.slice(0, 4000);
  if (!sample.trim()) return "und";
  const letters = (sample.match(/[\p{L}]/gu) ?? []).length || 1;

  const hangul = (sample.match(HANGUL) ?? []).length;
  if (hangul / letters > 0.12) return "ko";

  const kana = (sample.match(KANA) ?? []).length;
  if (kana / letters > 0.03) return "ja";

  const han = (sample.match(HAN) ?? []).length;
  if (han / letters > 0.3) return "zh";

  const cyr = (sample.match(CYRILLIC) ?? []).length;
  if (cyr / letters > 0.3) return "ru";

  const ar = (sample.match(ARABIC) ?? []).length;
  if (ar / letters > 0.3) return "ar";

  return "en";
}

export function needsTranslation(lang: string | null, text: string): boolean {
  if (lang === "ko") return false;
  if (lang && lang !== "und") return true;
  return detectLang(text) !== "ko";
}
