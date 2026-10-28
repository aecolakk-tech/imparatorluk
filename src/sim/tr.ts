/** v1.9.3 Turkish case suffixes for names (vowel harmony + buffer letters): ek('Ayşe','a') → "Ayşe’ye", ek('Rüstem','ı') → "Rüstem’i". */
const BACK = 'aıou', FRONT = 'eiöü', VOW = BACK + FRONT, HARD = 'çfhkpsşt';
export function ek(name: string | undefined | null, base: 'ı' | 'a' | 'ın' | 'dan' | 'da' | 'la'): string {
  const n = (name ?? '').trim(); if (!n) return n; const low = n.toLocaleLowerCase('tr');
  let lv = 'a'; for (let i = low.length - 1; i >= 0; i--) if (VOW.includes(low[i]!)) { lv = low[i]!; break; }
  const endsV = VOW.includes(low[low.length - 1]!); const hard = HARD.includes(low[low.length - 1]!);
  const two = BACK.includes(lv) ? 'a' : 'e'; const four = ({ a: 'ı', ı: 'ı', o: 'u', u: 'u', e: 'i', i: 'i', ö: 'ü', ü: 'ü' } as Record<string, string>)[lv]!;
  let s: string;
  switch (base) {
    case 'ı': s = (endsV ? 'y' : '') + four; break;
    case 'a': s = (endsV ? 'y' : '') + two; break;
    case 'ın': s = (endsV ? 'n' : '') + four + 'n'; break;
    case 'dan': s = (hard ? 't' : 'd') + two + 'n'; break;
    case 'da': s = (hard ? 't' : 'd') + two; break;
    case 'la': s = (endsV ? 'y' : '') + 'l' + two; break;
  }
  return `${n}’${s}`;
}
/** Dative for a number: 10 → "10’a", 2 → "2’ye", 6 → "6’ya", 15 → "15’e". */
export function numA(n: number): string {
  const k = Math.round(Math.abs(n)); const d = k % 10, t = k % 100;
  const [back, vow] = d ? ([[false, false], [false, false], [false, true], [false, false], [false, false], [false, false], [true, true], [false, true], [false, false], [true, false]] as const)[d]! : t ? ([[false, false], [true, false], [false, true], [true, false], [true, false], [false, true], [true, false], [false, false], [false, false], [true, false]] as const)[t / 10]! : k === 0 ? [true, false] as const : [false, false] as const;
  return `${Math.round(n)}’${vow ? 'y' : ''}${back ? 'a' : 'e'}`;
}

/** v2.0.2 (P8) text tidy for every log/notice/chat line: doubled titles ("Bekçi Bekçi Ali"), doubled speaker prefixes
 *  ("Barcı Feride: Barcı Feride: …"), "!." / "?." endings, empty names ("Muhbir :"), repeated spaces. */
export function tidy(t: string): string {
  let s = String(t ?? '');
  s = s.replace(/(?<!\p{L})(\p{Lu}\p{L}+) \1(?!\p{L})/gu, '$1'); // Bekçi Bekçi → Bekçi
  s = s.replace(/^([^:]{2,40}): \1:\s*/u, '$1: '); // "X: X: text" → "X: text"
  s = s.replace(/([!?])\.(?=\s|$)/g, '$1').replace(/\.{2}(?=\s|$)/g, '.');
  s = s.replace(/^(Muhbir|Bekçi|Asker)\s*:/u, '$1 (adı bilinmiyor):'); // empty name after a title
  return s.replace(/ {2,}/g, ' ').trim();
}
/** Display name without a duplicated title word. */
export const cleanName = (n: string): string => tidy(n);
