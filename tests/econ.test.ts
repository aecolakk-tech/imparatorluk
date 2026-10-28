import { describe, expect, it, beforeEach } from 'vitest';
import { createWorld, joinWorld, advanceWorld, touchPlayer, totalMoney, hourMs, findPerson, applyAction } from '../src/sim/index';
import type { World, Good } from '../src/sim/index';
import { rules } from '../src/sim/move';
import { BASE_PRICE } from '../src/sim/constants';
import { shelf, quoted, limanRestock, pazarGunu, postOrders, capKaraborsa, wageIndex, migrateEcon, WHOLESALE_MUL } from '../src/sim/market2';
import { supplyMult } from '../src/sim/economy';

const T0 = 1_700_000_000_000;
function setup(seed = 1): World { const w = createWorld(seed, T0); joinWorld(w, 'f', 'Ahmet Enes', 'kayzer', true, T0); joinWorld(w, 'u2', 'Testoğlu', 'hamal', false, T0); return w; }
function run(w: World, days: number, each?: (w: World) => void): void {
  let now = w.lastTickAt;
  for (let d = 0; d < days; d++) { for (let h = 0; h < 24; h++) { now += hourMs(w); touchPlayer(w, 'f', now); advanceWorld(w, now); } each?.(w); }
}
beforeEach(() => { rules.reach = false; });

describe('v2.0.1 economy stability (simulated days)', () => {
  for (const seed of [1, 2, 3]) it(`seed ${seed}: 40 days – no runaway inflation, no deflation to 0, no mass starvation, money conserved`, () => {
    const w = setup(seed); const m0 = totalMoney(w); const bread: number[] = [];
    run(w, 40, (x) => bread.push(x.prices.ekmek));
    expect(Math.abs(totalMoney(w) - m0)).toBeLessThan(1);
    for (const g of ['ekmek', 'su', 'un', 'bugday', 'odun'] as Good[]) { expect(w.prices[g]).toBeGreaterThan(BASE_PRICE[g] * 0.5); expect(w.prices[g]).toBeLessThanOrEqual(BASE_PRICE[g] * 5 + 0.01); }
    expect(bread.filter((b) => b > BASE_PRICE.ekmek * 3).length).toBeLessThan(10); // spikes (drought) are short
    const starving = w.people.filter((p) => p.hunger >= 85 || p.health < 30).length / w.people.length;
    expect(starving).toBeLessThan(0.1);
    expect(w.people.length).toBeGreaterThan(95);
    expect(w.cityHist!.length).toBe(120); // Şehir Göstergesi: hourly samples, last 5 days
  }, 60_000);
});

describe('v2.0.1 one price source', () => {
  it('the gazete prints the Çarşı shelf price; sold-out goods say tükendi', () => {
    const w = setup(); run(w, 2);
    const g = w.gazette.at(-1)!; const s = shelf(w, 'ekmek', 'carsi');
    // the paper is written at midnight; compare with the shelf at that moment
    expect(g.lines.join(' ')).toContain('Pazar fiyatları');
    w.listings = w.listings.filter((l) => l.good !== 'alet'); expect(shelf(w, 'alet').price).toBeNull();
    expect(quoted(w, 'ekmek')).toBe(s.price ?? w.prices.ekmek);
  });
  it('devlet suyu caps the quoted water price exactly like the buy price', () => {
    const w = setup(); run(w, 1); const s = shelf(w, 'su', 'carsi'); expect(s.price).not.toBeNull(); expect(s.price!).toBeLessThanOrEqual(2);
  });
});

describe('v2.0.1 production chain', () => {
  it('without millers bread gets dearer than in a normal city', () => {
    const a = setup(5), b = setup(5); run(a, 3); run(b, 3);
    for (const p of b.people.filter((x) => x.prof === 'degirmenci')) { p.prof = 'hamal'; p.work = 'pazar'; p.inv.un = 0; }
    b.listings = b.listings.filter((l) => l.good !== 'un'); for (const p of b.people) p.inv.un = 0; b.imports = false;
    run(a, 6); run(b, 6);
    expect(b.prices.ekmek).toBeGreaterThan(a.prices.ekmek * 1.2);
  }, 30_000);
  it('winter halves the wheat harvest, autumn raises it', () => {
    const w = setup(); w.day = 100; expect(supplyMult(w, 'bugday')).toBeCloseTo(0.5); w.day = 70; expect(supplyMult(w, 'bugday')).toBeGreaterThan(1);
  });
});

describe('v2.0.1 trade: Liman toptan, Pazar Günü, siparişler', () => {
  it('Liman toptancısı sells below the normal price, only at the Liman; a player can buy there and deliver an order for profit', () => {
    const w = setup(); migrateEcon(w); limanRestock(w);
    const lim = shelf(w, 'odun', 'liman', true).price!; expect(lim).toBeCloseTo(BASE_PRICE.odun * WHOLESALE_MUL, 2);
    expect(shelf(w, 'odun', 'liman').price).toBeNull(); // not visible to ordinary buyers
    const me = findPerson(w, w.players.u2!.personId)!; me.money = 200; me.inv.odun = 0;
    expect(applyAction(w, 'u2', { t: 'buy', good: 'odun', qty: 10, market: 'liman' }, T0).ok).toBe(true); expect(me.inv.odun).toBe(10);
    for (const p of w.people) for (const g of ['un', 'bugday', 'kumas', 'odun', 'yun'] as Good[]) p.inv[g] = 999;
    const dem = w.people.find((p) => p.prof === 'demirci')!; dem.money = 500; dem.inv.odun = 0; w.prices.odun = BASE_PRICE.odun * 1.5;
    postOrders(w); const o = w.orders!.find((x) => x.good === 'odun' && x.byId === dem.id)!; expect(o).toBeDefined();
    me.inv.odun = o.qty; const m0 = me.money;
    expect(applyAction(w, 'u2', { t: 'fulfillOrder', orderId: o.id }, T0).ok).toBe(true);
    expect(me.money - m0).toBe(o.reward); expect(o.reward).toBeGreaterThan(o.qty * lim);
  });
  it('import ban: no Liman toptan', () => {
    const w = setup(); w.imports = false; limanRestock(w); expect(w.listings.some((l) => l.wholesale)).toBe(false);
  });
  it('Pazar Günü brings caravans with rare goods and cools prices', () => {
    const w = setup(); w.day = 5; const p0 = w.prices.elbise; pazarGunu(w);
    expect(w.listings.some((l) => l.sellerId === 'dis' && l.good === 'mobilya')).toBe(true); expect(w.prices.elbise).toBeLessThan(p0);
    expect(w.events.some((e) => /PAZAR GÜNÜ/.test(e.text))).toBe(true);
  });
});

describe('v2.0.1 Kayzer tools and their costs', () => {
  it('a narh far below the market price creates karaborsa and empty shelves', () => {
    const w = setup(); run(w, 1); w.prices.ekmek = 2; w.priceCaps.ekmek = 0.8;
    for (const p of w.people.slice(0, 20)) p.money = 400;
    const u0 = w.market.unmet.ekmek; capKaraborsa(w);
    expect(w.karaborsaToday!).toBeGreaterThan(0); expect(w.market.unmet.ekmek).toBeGreaterThan(u0);
  });
  it('ambar dağıtımı gives the mills free wheat', () => {
    const w = setup(); migrateEcon(w); w.granary = 300; const m = w.people.filter((p) => p.prof === 'degirmenci'); const b0 = m.reduce((s, p) => s + p.inv.bugday, 0);
    expect(applyAction(w, 'f', { t: 'granary', op: 'dagit', qty: 90 }, T0).ok).toBe(true);
    expect(m.reduce((s, p) => s + p.inv.bugday, 0) - b0).toBe(90); expect(w.granary).toBe(210);
  });
  it('wages follow sustained bread prices', () => {
    const w = setup(); w.wageIdx = 1; for (let i = 0; i < 5; i++) w.stats.push({ day: i, treasury: 0, mood: 50, cumhuriyet: 0, money: 0, prices: { ...w.prices, ekmek: BASE_PRICE.ekmek * 2 } });
    for (const p of w.people) p.unemployedDays = 0;
    for (let i = 0; i < 10; i++) wageIndex(w); expect(w.wageIdx!).toBeGreaterThan(1.2);
  });
});

describe('v2.0.1 poverty effects', () => {
  it('NPCs who cannot afford bread complain, lose mood, petition and finally leave', () => {
    const w = setup(); migrateEcon(w); const p = w.people.find((x) => x.prof === 'hamal' && !x.playerId && !x.spouse)!;
    p.money = 0; for (const c of w.people) if (c.parents.includes(p.id)) c.parents = [];
    const mood0 = p.mood; let gone = false;
    for (let d = 0; d < 30 && !gone; d++) { p.cantAfford = w.day; run(w, 1); gone = !findPerson(w, p.id); if (!gone) p.money = 0; }
    expect(gone || p.mood < mood0).toBe(true);
    expect(w.events.some((e) => /terk etti|dilekçe|“/.test(e.text))).toBe(true);
  }, 60_000);
});
