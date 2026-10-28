import { createWorld, joinWorld, advanceWorld, touchPlayer, totalMoney, hourMs } from '../src/sim/index';
import { quoted, unemployed } from '../src/sim/market2';
let now = 1_700_000_000_000; const w = createWorld(1, now); joinWorld(w, 'f', 'Ahmet Enes', 'kayzer', true, now);
const m0 = totalMoney(w);
for (let d = 0; d < 220; d++) { for (let h = 0; h < 24; h++) { now += hourMs(w); touchPlayer(w, 'f', now); advanceWorld(w, now); }
  if (d % 10 === 0 || d > 210) { const items = w.treasuryBook?.at(-2)?.items ?? {}; const top = Object.entries(items).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6).map(([k, v]) => `${k}:${Math.round(v)}`).join(' ');
  console.log(`d${w.day} pop${w.people.length} T${Math.round(w.treasury)} ekmek${quoted(w, 'ekmek').toFixed(2)} un${w.prices.un.toFixed(2)} bug${w.prices.bugday.toFixed(2)} wage${(w.wageIdx ?? 1).toFixed(2)} unemp${unemployed(w)} mood${Math.round(w.people.reduce((s, p) => s + p.mood, 0) / w.people.length)} hl${(w.people.filter((p) => p.health >= 50).length / w.people.length).toFixed(2)} | ${top}`); } }
console.log('drift', totalMoney(w) - m0, 'out', w.outsideNet);
