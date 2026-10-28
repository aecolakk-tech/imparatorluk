/* v2.0.1 solo sim: 1 human player (a hamal), everyone else NPC (NPC Kayzer / naip), N days. Prints the per-feature NPC usage table. */
import { createWorld, joinWorld, touchPlayer, advanceWorld, totalMoney, hourMs } from '../src/sim/index';
import type { World } from '../src/sim/index';
export function runSolo(days = 220, seed = 5): { w: World; m0: number; stats: { day: number; T: number; cum: number; mood: number; pop: number; regime: string }[] } {
  const T0 = 1_700_000_000_000; let now = T0;
  const w = createWorld(seed, T0); joinWorld(w, 'solo', 'Tek Oyuncu', 'hamal', false, T0);
  const m0 = totalMoney(w); const stats: { day: number; T: number; cum: number; mood: number; pop: number; regime: string }[] = [];
  // game days, not wall-clock: raids/battles slow the clock (hourMs), so step by the world's own hour
  for (let d = w.day; w.day < d + days;) {
    const day0 = w.day; now += hourMs(w); touchPlayer(w, 'solo', now); advanceWorld(w, now);
    if (w.day !== day0 && (w.day - 1) % 20 === 0) stats.push({ day: w.day, T: Math.round(w.treasury), cum: w.cumhuriyet, mood: Math.round(w.people.reduce((a, p) => a + p.mood, 0) / w.people.length), pop: w.people.length, regime: w.regime });
  }
  return { w, m0, stats };
}
if (process.argv[1]?.includes('solo')) {
  const { w, m0, stats } = runSolo(Number(process.env.DAYS ?? 220), Number(process.env.SEED ?? 5));
  for (const s of stats) console.log(JSON.stringify(s));
  console.log('money drift', Math.round((totalMoney(w) - m0) * 100) / 100, 'kayzer', w.kayzerId, w.regime);
  const u = Object.entries(w.usage ?? {}).sort((a, b) => a[0].localeCompare(b[0]));
  console.log(u.map(([k, v]) => `${k.padEnd(24)} ${v}`).join('\n'));
}
