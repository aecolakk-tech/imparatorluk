import type { Good, Listing, Person, World } from './types';
import { GOODS } from './types';
import { rand } from './rng';
import { BASE_PRICE, DECAY, PRODUCES, RANKS, STOCK_LIMIT } from './constants';
import { findPerson } from './world';
import { nextId } from './rng';

/** Single place where Dinar moves. Accounts: person id, 'saray' (treasury), 'proje:<id>', 'fon' (plot fund). */
export function transfer(w: World, from: string, to: string, amount: number, reason: string): boolean {
  const amt = Math.round(amount * 100) / 100;
  if (!(amt > 0)) return false;
  if (balance(w, from) + 1e-9 < amt) return false;
  adjust(w, from, -amt); adjust(w, to, amt);
  if (from === 'saray' || to === 'saray') {
    if (to === 'saray') w.dailyIncome += amt; else w.dailyExpense += amt;
  }
  w.ledger.push({ day: w.day, from, to, amount: amt, reason });
  if (w.ledger.length > 600) w.ledger.splice(0, w.ledger.length - 600);
  return true;
}

export function balance(w: World, acc: string): number {
  if (acc === 'saray') return w.treasury;
  if (acc === 'fon') return w.coup?.fund ?? 0;
  if (acc === 'dis') return Infinity;
  if (acc.startsWith('proje:')) return w.projects.find((p) => `proje:${p.id}` === acc)?.paid ?? 0;
  return findPerson(w, acc)?.money ?? 0;
}

function adjust(w: World, acc: string, d: number): void {
  const r = (v: number): number => Math.round(v * 100) / 100;
  if (acc === 'saray') { w.treasury = r(w.treasury + d); return; }
  if (acc === 'fon') { if (w.coup) w.coup.fund = r(w.coup.fund + d); return; }
  if (acc === 'dis') { w.outsideNet = r((w.outsideNet ?? 0) + d); return; }
  if (acc.startsWith('proje:')) { const p = w.projects.find((x) => `proje:${x.id}` === acc); if (p) p.paid = r(p.paid + d); return; }
  const p = findPerson(w, acc); if (p) p.money = r(p.money + d);
}

export function totalMoney(w: World): number {
  return Math.round((w.people.reduce((s, p) => s + p.money, 0) + w.treasury + w.projects.reduce((s, p) => s + p.paid, 0) + (w.coup?.fund ?? 0) + (w.outsideNet ?? 0)) * 100) / 100;
}

export function lawOn(w: World, id: string): boolean { return w.laws.some((l) => l.id === id && l.active); }
export function lawParam(w: World, id: string, def: number): number { return w.laws.find((l) => l.id === id)?.param ?? def; }

export function marketPrice(w: World, g: Good): number {
  if (g === 'su' && lawOn(w, 'devletsuyu')) return Math.min(w.prices.su, lawParam(w, 'devletsuyu', 2));
  const cap = w.priceCaps[g]; return cap ? Math.min(cap, w.prices[g]) : w.prices[g];
}
export const rankOf = (p: Person): { label: string; mult: number } => [...RANKS].reverse().find((r) => p.xp >= r.xp)!;
/** Total units a seller has listed of a good. */
export const listedQty = (w: World, sellerId: string, g: Good): number => w.listings.filter((l) => l.sellerId === sellerId && l.good === g).reduce((s, l) => s + l.qty, 0);

export function addListing(w: World, seller: Person, good: Good, qty: number, price: number, market: string): void {
  const room = Math.max(0, STOCK_LIMIT[good] - listedQty(w, seller.id, good));
  if (qty > room) { seller.inv[good] += qty - room; qty = room; } // anti-hoarding: the rest stays home (and spoils)
  if (qty <= 0) return;
  const cap = w.priceCaps[good]; if (cap && price > cap) price = cap;
  price = Math.max(0.1, price);
  const ex = w.listings.find((l) => l.sellerId === seller.id && l.good === good && Math.abs(l.price - price) < 0.01);
  if (ex) { ex.qty += qty; return; }
  w.listings.push({ id: nextId(w, 'L'), sellerId: seller.id, good, qty, price: Math.round(price * 100) / 100, market });
}

/** Buy up to qty of good, cheapest first. Seller pays sales tax. Returns qty bought. */
export function buy(w: World, buyerAcc: string, good: Good, qty: number, maxPrice = Infinity): number {
  let got = 0;
  const offers = w.listings.filter((l) => l.good === good && l.qty > 0 && l.sellerId !== buyerAcc).sort((a, b) => a.price - b.price);
  const fixedWater = good === 'su' && lawOn(w, 'devletsuyu');
  for (const l of offers) {
    while (got < qty && l.qty > 0) {
      const pay = Math.round((fixedWater ? Math.min(l.price, lawParam(w, 'devletsuyu', 2)) : l.price) * 100) / 100;
      if (pay > maxPrice || balance(w, buyerAcc) < pay) return finishPoor();
      transfer(w, buyerAcc, l.sellerId, pay, `${good} alımı`);
      // state water: treasury tops up the difference to the seller
      if (fixedWater && l.price > pay && l.sellerId !== 'dis') transfer(w, 'saray', l.sellerId, l.price - pay, 'su sübvansiyonu');
      // sales tax is owed and collected later by the tahsildar (smugglers hide part of it)
      const tax = pay * w.taxRate / 100;
      const s = findPerson(w, l.sellerId); if (s) { s.taxDue += s.smuggle ? tax * 0.2 : tax; s.incomeToday += pay - tax; }
      else if (l.sellerId === 'dis') { transfer(w, 'dis', 'saray', Math.max(tax, pay * 0.1), 'gümrük'); if (w.caravan) w.caravan.earned = (w.caravan.earned ?? 0) + pay; }
      l.qty -= 1; got += 1;
      w.market.sold[good] += 1;
    }
    if (got >= qty) break;
  }
  return finish();
  // could not afford: poverty, not a shortage – do not push the price up
  function finishPoor(): number { const b = findPerson(w, buyerAcc); if (b) b.inv[good] += got; return got; }
  function finish(): number {
    if (got < qty) w.market.unmet[good] += qty - got;
    const b = findPerson(w, buyerAcc); if (b) b.inv[good] += got;
    return got;
  }
}

export function resetMarketDay(w: World): void { for (const g of GOODS) { w.market.sold[g] = 0; w.market.unmet[g] = 0; } }

export function natureMult(w: World, g: Good): number {
  const n = w.nature; if (!n || w.day < n.start || w.day > n.until) return 1;
  if (n.kind === 'kuraklik' && g === 'bugday') return 0.5;
  if (n.kind === 'kuraklik' && g === 'su') return 0.85;
  if (n.kind === 'bereket' && g === 'bugday') return 1.4;
  if (n.kind === 'sel' && (g === 'balik' || g === 'bugday')) return 0.6;
  if (n.kind === 'balik' && g === 'balik') return 1.6;
  return 1;
}

/** Morning: workers buy missing raw materials, then produce; output depends on inputs, rank, tools, health and nature. */
export function produce(w: World, p: Person): void {
  const spec = PRODUCES[p.prof];
  if (!spec || p.jailedDays > 0 || p.exiledDays > 0) return;
  if (spec.good === 'icki' && w.bans.includes('icki')) { p.lastAction = 'meyhane kapalı'; return; }
  let frac = 1;
  for (const [g, need] of Object.entries(spec.inputs ?? {}) as [Good, number][]) {
    if (p.inv[g] < need) buy(w, p.id, g, need - p.inv[g], Math.max(0.1, Math.min(p.money * 0.7, (spec.qty * w.prices[spec.good] * 0.8) / need / Object.keys(spec.inputs ?? {}).length)));
    frac = Math.min(frac, p.inv[g] / need);
  }
  if (frac <= 0) { p.lastAction = 'ham madde bulamadı'; return; }
  for (const [g, need] of Object.entries(spec.inputs ?? {}) as [Good, number][]) p.inv[g] = Math.max(0, p.inv[g] - Math.ceil(need * frac));
  const tools = p.inv.alet > 0 ? 1.15 : 1; // alet boosts output, wears out
  const r = rankOf(p);
  const qty = Math.max(1, Math.round(spec.qty * frac * tools * r.mult * natureMult(w, spec.good) * Math.max(0.75, 0.5 + p.health / 200)));
  p.xp += 1;
  const price = sellerPrice(w, p, spec.good, spec.inputs, spec.qty);
  addListing(w, p, spec.good, qty, price, spec.market);
  if (spec.extra) addListing(w, p, spec.extra.good, Math.round(spec.extra.qty * frac), sellerPrice(w, p, spec.extra.good), spec.market);
  p.lastAction = `${qty} ${spec.good} üretti (${r.label})`;
}

/** NPC seller's own price: market reference, own unsold stock, input costs (floor) and rank; changes gradually. */
export function sellerPrice(w: World, p: Person, g: Good, inputs?: Partial<Record<Good, number>>, out = 1): number {
  const ref = marketPrice(w, g);
  const cost = Object.entries(inputs ?? {}).reduce((s, [ig, n]) => s + w.prices[ig as Good] * (n as number), 0) / Math.max(1, out);
  const unsold = listedQty(w, p.id, g);
  const stockAdj = unsold > STOCK_LIMIT[g] * 0.5 ? 0.92 : unsold === 0 ? 1.03 : 1;
  const greed = 1 + (50 - p.honesty) / 500; // greedy sellers ask a little more
  const mine = w.listings.find((l) => l.sellerId === p.id && l.good === g)?.price ?? ref;
  const target = Math.max(cost * 1.1, ref * stockAdj * greed * rankOf(p).mult ** 0.5);
  return Math.round((mine + (target - mine) * 0.5) * 100) / 100; // gradual
}

/** End of day: price adjustment by supply/demand, decay of goods. */
export function settleMarket(w: World): void {
  for (const g of GOODS) {
    const left = w.listings.filter((l) => l.good === g).reduce((s, l) => s + l.qty, 0);
    const sold = w.market.sold[g]; const miss = w.market.unmet[g];
    let p = w.prices[g];
    // supply & demand, gradual (max ±8%/day) to avoid oscillation
    if (miss > 0) p *= 1 + Math.min(0.08, 0.01 + miss / Math.max(20, sold + miss) * 0.15);
    else if (left > sold * 0.3 + 3) p *= 1 - Math.min(0.06, 0.01 + left / Math.max(20, sold + left) * 0.08);
    w.prices[g] = Math.round(Math.max(BASE_PRICE[g] * 0.4, Math.min(BASE_PRICE[g] * 5, p)) * 100) / 100;
  }
  // decay unsold stock and inventories
  // stochastic rounding: a single coat (2%/day) lasts ~50 days on average instead of vanishing overnight
  const lose = (q: number, rate: number): number => { const x = q * rate; const n = Math.floor(x); return n + (rand(w) < x - n ? 1 : 0); };
  for (const l of w.listings) l.qty = Math.max(0, l.qty - lose(l.qty, DECAY[l.good]));
  w.listings = w.listings.filter((l) => l.qty > 0);
  for (const p of w.people) for (const g of GOODS) if (p.inv[g] > 0) p.inv[g] = Math.max(0, Math.floor(p.inv[g]) - lose(Math.floor(p.inv[g]), DECAY[g]));
  // NPC sellers reprice their remaining listings to market
  // NPC sellers reprice their remaining listings, staggered (about half of them each day)
  for (const l of w.listings) { const s = findPerson(w, l.sellerId); if (s && s.npc && (w.day + l.id.length + l.id.charCodeAt(l.id.length - 1)) % 2 === 0) l.price = sellerPrice(w, s, l.good); }
}

export function listingsOf(w: World, personId: string): Listing[] { return w.listings.filter((l) => l.sellerId === personId); }
