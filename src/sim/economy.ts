import type { Good, Listing, Person, World } from './types';
import { GOODS } from './types';
import { BASE_PRICE, DECAY, PRODUCES } from './constants';
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
  if (acc.startsWith('proje:')) return w.projects.find((p) => `proje:${p.id}` === acc)?.paid ?? 0;
  return findPerson(w, acc)?.money ?? 0;
}

function adjust(w: World, acc: string, d: number): void {
  const r = (v: number): number => Math.round(v * 100) / 100;
  if (acc === 'saray') { w.treasury = r(w.treasury + d); return; }
  if (acc === 'fon') { if (w.coup) w.coup.fund = r(w.coup.fund + d); return; }
  if (acc.startsWith('proje:')) { const p = w.projects.find((x) => `proje:${x.id}` === acc); if (p) p.paid = r(p.paid + d); return; }
  const p = findPerson(w, acc); if (p) p.money = r(p.money + d);
}

export function totalMoney(w: World): number {
  return Math.round((w.people.reduce((s, p) => s + p.money, 0) + w.treasury + w.projects.reduce((s, p) => s + p.paid, 0) + (w.coup?.fund ?? 0)) * 100) / 100;
}

export function lawOn(w: World, id: string): boolean { return w.laws.some((l) => l.id === id && l.active); }
export function lawParam(w: World, id: string, def: number): number { return w.laws.find((l) => l.id === id)?.param ?? def; }

export function marketPrice(w: World, g: Good): number {
  if (g === 'su' && lawOn(w, 'devletsuyu')) return lawParam(w, 'devletsuyu', 2);
  return w.prices[g];
}

export function addListing(w: World, seller: Person, good: Good, qty: number, price: number, market: string): void {
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
      const pay = fixedWater ? Math.min(l.price, lawParam(w, 'devletsuyu', 2)) : l.price;
      if (pay > maxPrice || balance(w, buyerAcc) < pay) return finishPoor();
      transfer(w, buyerAcc, l.sellerId, pay, `${good} alımı`);
      // state water: treasury tops up the difference to the seller
      if (fixedWater && l.price > pay) transfer(w, 'saray', l.sellerId, l.price - pay, 'su sübvansiyonu');
      const tax = pay * w.taxRate / 100;
      transfer(w, l.sellerId, 'saray', tax, 'satış vergisi');
      const s = findPerson(w, l.sellerId); if (s) s.incomeToday += pay - tax;
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

export function produce(w: World, p: Person): void {
  const spec = PRODUCES[p.prof];
  if (!spec || p.jailedDays > 0) return;
  const tools = p.inv.alet > 0 ? 1.15 : 1; // alet boosts output, wears out
  const qty = Math.max(1, Math.round(spec.qty * tools * (p.health / 100)));
  addListing(w, p, spec.good, qty, w.prices[spec.good], spec.market);
  p.lastAction = `${spec.qty} ${spec.good} üretti`;
}

/** End of day: price adjustment by supply/demand, decay of goods. */
export function settleMarket(w: World): void {
  for (const g of GOODS) {
    const left = w.listings.filter((l) => l.good === g).reduce((s, l) => s + l.qty, 0);
    const sold = w.market.sold[g]; const miss = w.market.unmet[g];
    let p = w.prices[g];
    if (miss > 0) p *= 1 + Math.min(0.12, 0.02 + miss / Math.max(20, sold + miss) * 0.2);
    else if (left > sold * 0.25 + 2) p *= 0.95;
    w.prices[g] = Math.round(Math.max(BASE_PRICE[g] * 0.4, Math.min(BASE_PRICE[g] * 4, p)) * 100) / 100;
  }
  // decay unsold stock and inventories
  for (const l of w.listings) l.qty = Math.floor(l.qty * (1 - DECAY[l.good]));
  w.listings = w.listings.filter((l) => l.qty > 0);
  for (const p of w.people) for (const g of GOODS) {
    const d = p.inv[g] * DECAY[g]; p.inv[g] = Math.max(0, Math.floor(p.inv[g] - d));
  }
  // NPC sellers reprice their remaining listings to market
  for (const l of w.listings) { const s = findPerson(w, l.sellerId); if (s && s.npc) l.price = w.prices[l.good]; }
}

export function listingsOf(w: World, personId: string): Listing[] { return w.listings.filter((l) => l.sellerId === personId); }
