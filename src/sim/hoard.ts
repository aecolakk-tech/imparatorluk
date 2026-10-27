/**
 * Hoarding (karaborsa) detection by the bekçi corps: daily patrols, suspicion from price spikes,
 * tips and gossip from neighbours, and a catch chance that depends on the bekçi's diligence and loyalty.
 * Corrupt bekçis may pocket a bribe instead of confiscating.
 */
import type { Good, Person, World } from './types';
import { GOODS } from './types';
import { BASE_PRICE, GOOD_LABEL, STOCK_LIMIT } from './constants';
import { chance, clamp, pick, rand } from './rng';
import { buy, transfer } from './economy';
import { findPerson } from './world';
import { log, personal } from './log';

const LIMIT = (g: Good): number => (STOCK_LIMIT as Partial<Record<Good, number>>)[g] ?? 100;
const active = (p: Person): boolean => p.prof !== 'naip' && p.jailedDays === 0 && p.exiledDays === 0;

/** 0..1 – how carefully a bekçi works: honesty and loyalty, plus experience. */
export function diligence(b: Person): number { return clamp(b.honesty * 0.45 + b.loyalty * 0.4 + Math.min(15, (b.xp ?? 0) / 10), 0, 100) / 100; }
/** Goods whose price jumped well above their 7-day average – patrols look for stockpiles of these. */
export function spikedGoods(w: World): Good[] {
  return GOODS.filter((g) => { const h = w.priceHist?.[g] ?? []; if (h.length < 3) return false; const avg = h.reduce((a, b) => a + b, 0) / h.length; return w.prices[g] > avg * 1.35 && w.prices[g] > BASE_PRICE[g]; });
}
const excess = (p: Person): [Good, number][] => GOODS.map((g): [Good, number] => [g, p.inv[g] - LIMIT(g)]).filter(([, x]) => x > 0);

/** Greedy merchants speculate when a staple spikes (drought): they buy up and sit on stock. */
export function hoarderAI(w: World): void {
  const spiked = spikedGoods(w).filter((g) => g === 'bugday' || g === 'ekmek' || g === 'odun' || g === 'kumas');
  if (!spiked.length && w.nature?.kind !== 'kuraklik') return;
  const goods = spiked.length ? spiked : (['bugday'] as Good[]);
  for (const p of w.people.filter((x) => !x.playerId && active(x) && x.honesty < 35 && x.money > 80 && (x.prof === 'tuccar' || x.ambition > 65))) {
    if (!chance(w, 0.35)) continue;
    const g = pick(w, goods); buy(w, p.id, g, Math.min(60, Math.floor(p.money / Math.max(0.5, w.prices[g]) / 3)), w.prices[g] * 1.1);
    if (p.inv[g] > LIMIT(g)) p.lastAction = `${GOOD_LABEL[g]} stokluyor`;
  }
}

/** Daily: suspicion grows from price spikes and tips; patrols search the most suspicious. */
export function patrolDay(w: World): void {
  w.suspicion = w.suspicion ?? {};
  const S = w.suspicion;
  for (const id of Object.keys(S)) { S[id] = S[id]! * 0.8; if (S[id]! < 2) delete S[id]; }
  const spiked = spikedGoods(w);
  if (spiked.length) log(w, `Bekçiler ${spiked.map((g) => GOOD_LABEL[g]).join(', ')} fiyatı fırlayınca stokçuların peşine düştü.`);
  for (const p of w.people) {
    const ex = excess(p); if (!ex.length || !active(p)) continue;
    let s = 0;
    for (const [g, x] of ex) { s += Math.min(40, x / LIMIT(g) * 40); if (spiked.includes(g)) s += 25; }
    // neighbours who dislike the hoarder tip off the bekçi; gossip spreads the word
    const neighbours = w.people.filter((n) => n.home === p.home || (n.relations[p.id] ?? 0) < -30);
    const tipsters = neighbours.filter((n) => n.id !== p.id && (n.relations[p.id] ?? 0) < 0 && n.honesty > 40);
    if (tipsters.length && chance(w, 0.5)) { s += 15 * Math.min(3, tipsters.length); if (chance(w, 0.4)) w.rumors.push({ day: w.day, text: `${p.name}'ın mahzeni ${GOOD_LABEL[ex[0]![0]]} dolu diyorlar…`, about: p.id }); }
    if (w.rumors.some((r) => r.about === p.id && w.day - r.day <= 3)) s += 10;
    S[p.id] = clamp((S[p.id] ?? 0) + s, 0, 100);
  }
  // patrols: each bekçi (and anyone on mandatory service) searches one suspect
  const patrol = w.people.filter((x) => x.prof === 'bekci' && active(x)).concat((w.serving ?? []).map((id) => findPerson(w, id)).filter((x): x is Person => !!x).filter(active));
  const suspects = Object.entries(S).sort((a, b) => b[1] - a[1]).map(([id]) => findPerson(w, id)).filter((x): x is Person => !!x && active(x));
  for (const b of patrol) {
    const t = suspects.shift(); if (!t) break;
    if (t.playerId && !t.npc && b.prof !== 'bekci') continue;
    const catchP = clamp((S[t.id] ?? 0) / 100 * (0.35 + diligence(b) * 0.65), 0, 0.95);
    if (rand(w) < catchP) searchAndSeize(w, b, t);
  }
}

/** A bekçi searches someone: confiscates the excess (grain goes to the granary) and fines – or takes a bribe. */
export function searchAndSeize(w: World, b: Person, t: Person): string {
  const ex = excess(t);
  if (!ex.length) { (w.suspicion ?? {})[t.id] = 0; t.relations[b.id] = clamp((t.relations[b.id] ?? 0) - 5, -100, 100); return `${t.name}'ın evinde fazla mal çıkmadı.`; }
  // a corrupt bekçi may look the other way for money
  if (b.honesty < 35 && b.loyalty < 50 && t.money > 20 && !t.playerId && chance(w, 0.6)) {
    const amt = Math.round(Math.min(t.money * 0.3, 15 + ex.length * 10));
    if (transfer(w, t.id, b.id, amt, 'karaborsa rüşveti')) { if (chance(w, 0.3)) w.rumors.push({ day: w.day, text: `Bekçi ${b.name} stokçu ${t.name}'dan rüşvet almış!`, about: b.id }); return `${b.name} rüşvet alıp göz yumdu.`; }
  }
  const parts: string[] = [];
  for (const [g, x] of ex) { t.inv[g] -= x; if (g === 'bugday') w.granary += x; else w.listings.push({ id: `L${++w.idSeq}`, sellerId: 'saray', good: g, qty: x, price: Math.round(BASE_PRICE[g] * 100) / 100, market: 'pazar' }); parts.push(`${x} ${GOOD_LABEL[g]}`); }
  const fine = Math.min(t.money, 10 + ex.reduce((a, [, x]) => a + x, 0) * 0.1);
  transfer(w, t.id, 'saray', fine, 'karaborsa cezası');
  b.xp = (b.xp ?? 0) + 3; b.rep = clamp((b.rep ?? 0) + 2, -100, 100); t.rep = clamp((t.rep ?? 0) - 6, -100, 100);
  t.relations[b.id] = clamp((t.relations[b.id] ?? 0) - 30, -100, 100); (t.relNote ??= {})[b.id] = 'malıma el koydu';
  (w.suspicion ?? {})[t.id] = 0;
  log(w, `🚨 Bekçi ${b.name}, ${t.name}'ın karaborsa stoğuna el koydu: ${parts.join(', ')} (ceza ${Math.round(fine)} D).`, t.id);
  if (t.playerId) personal(w, t.playerId, `Bekçi ${b.name} stoğunuza el koydu: ${parts.join(', ')}.`);
  return `El konuldu: ${parts.join(', ')}; ceza ${Math.round(fine)} D.`;
}
/** Player bekçi/asker searching someone by hand. */
export function inspectPerson(w: World, b: Person, t: Person): string {
  if (b.lastAction === 'arama yaptı') return 'Bugün zaten bir arama yaptınız.';
  b.lastAction = 'arama yaptı';
  return searchAndSeize(w, b, t);
}
