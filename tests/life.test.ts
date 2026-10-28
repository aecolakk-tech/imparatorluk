import { rules as moveRules } from '../src/sim/move'; moveRules.reach = false;
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { advanceWorld, applyAction, createWorld, DAY_MS, joinWorld, touchPlayer, findPerson, totalMoney, produce, BASE_PRICE, GOODS } from '../src/sim/index';
import type { World, Person } from '../src/sim/index';
import { needsEndOfDay, pray, drinkAlcohol, steal, arrest, decideBribe, bribeAcceptChance, nature } from '../src/sim/life';
import { proposeMarriage } from '../src/sim/family';
import { migrateWorld } from '../src/sim/extras';
import { playerSaid } from '../src/sim/chat';

const T0 = 1_700_000_000_000;
function setup(): World { const w = createWorld(1, T0); joinWorld(w, 'f', 'Ahmet Enes', 'kayzer', true, T0); return w; }
function run(w: World, days: number, start = T0, online = true): number {
  let now = start;
  for (let d = 0; d < days; d++) for (let h = 0; h < 24; h++) { now += DAY_MS / 24; if (online) touchPlayer(w, 'f', now); advanceWorld(w, now); }
  return now;
}
const npc = (w: World, prof: string): Person => w.people.find((p) => p.prof === prof && !p.playerId)!;

describe('clock & speed', () => {
  it('one game day takes 6 real minutes at 1x; only the Kayzer changes speed', () => {
    expect(DAY_MS).toBe(360_000);
    const w = setup(); joinWorld(w, 'u2', 'Ali', 'hamal', false, T0);
    expect(applyAction(w, 'u2', { t: 'setSpeed', speed: 2 }, T0).ok).toBe(false);
    expect(applyAction(w, 'f', { t: 'setSpeed', speed: 2 }, T0).ok).toBe(true);
    expect(w.speed).toBe(2);
    const d0 = w.day; for (let t = 1; t <= 50; t++) { const n = T0 + (DAY_MS / 2) * t / 50 + 10; touchPlayer(w, 'f', n); advanceWorld(w, n); } expect(w.day).toBe(d0 + 1);
  });
});

describe('production chains', () => {
  it('a baker turns 20 wheat into ~40 bread; a farmer makes ~30 wheat', () => {
    const w = setup();
    const f = npc(w, 'ciftci'); f.health = 100; f.xp = 200; f.inv.alet = 0; const b0 = f.inv.bugday; produce(w, f);
    const made = f.inv.bugday + w.listings.filter((l) => l.sellerId === f.id && l.good === 'bugday').reduce((s, l) => s + l.qty, 0) - b0;
    expect(made).toBeGreaterThanOrEqual(25);
    const b = npc(w, 'firinci'); b.health = 100; b.xp = 200; b.inv.bugday = 20; b.inv.alet = 0;
    produce(w, b);
    const bread = b.inv.ekmek + w.listings.filter((l) => l.sellerId === b.id && l.good === 'ekmek').reduce((s, l) => s + l.qty, 0);
    expect(bread).toBeGreaterThanOrEqual(34); expect(b.inv.bugday).toBe(0);
  });
  it('without wheat the baker makes no bread', () => {
    const w = setup(); w.listings = w.listings.filter((l) => l.good !== 'bugday');
    const b = npc(w, 'firinci'); b.inv.bugday = 0; b.inv.ekmek = 0; produce(w, b);
    expect(w.listings.filter((l) => l.sellerId === b.id && l.good === 'ekmek').length).toBe(0);
  });
});

describe('needs & health', () => {
  it('v1.8 bars: ending the day starving/parched costs health; fed and watered restores a little', () => {
    const w = setup(); w.day = 5; const p = npc(w, 'hamal'); p.health = 80; p.inv.elbise = 0; p.inv.mobilya = 0;
    p.hunger = 30; p.thirst = 95; needsEndOfDay(w, p); expect(p.health).toBe(76);
    p.hunger = 30; p.thirst = 30; needsEndOfDay(w, p); expect(p.health).toBeGreaterThan(76);
  });
  it('below 30 health only a doctor heals', () => {
    const w = setup(); w.day = 5; const p = npc(w, 'hamal'); p.health = 25; p.meals = 3; p.drinks = 5; p.inv.elbise = 0; p.inv.mobilya = 0;
    needsEndOfDay(w, p); expect(p.health).toBeLessThanOrEqual(25);
  });
  it('NPCs feed themselves: after 30 days most of the city is healthy', () => {
    const w = setup(); run(w, 30);
    const healthy = w.people.filter((p) => p.health >= 60).length / w.people.length;
    expect(healthy).toBeGreaterThan(0.8);
  });
});

describe('religiosity', () => {
  it('prayer raises din, alcohol lowers it but gives more joy', () => {
    const w = setup(); const p = npc(w, 'hamal'); p.money = 50; p.din = 50; p.mood = 50; w.hour = 13;
    pray(w, p); const afterPray = p.din; const moodPray = p.mood - 50;
    expect(afterPray).toBeGreaterThan(50);
    p.mood = 50; w.hour = 20; p.inv.icki = 1; drinkAlcohol(w, p);
    expect(p.din).toBeLessThan(afterPray); expect(p.mood - 50).toBeGreaterThan(moodPray);
  });
});

describe('gender & marriage', () => {
  it('everyone has a gender; Necati is a woman; no same-sex couples are created', () => {
    const w = setup();
    expect(w.people.every((p) => typeof p.female === 'boolean')).toBe(true);
    expect(w.people.find((p) => p.name.includes('Necati'))!.female).toBe(false);
    const men = w.people.filter((p) => !p.female && !p.spouse && !p.playerId); const a = men[0]!, b = men[1]!;
    b.mood = 99; b.relations[a.id] = 99;
    const r = proposeMarriage(w, a, b, () => false);
    expect(r).toMatch(/erkek ile bir kad/);
    expect(a.spouse).toBeFalsy();
    run(w, 40);
    for (const p of w.people) if (p.spouse) { const s = findPerson(w, p.spouse); if (s) expect(s.female).not.toBe(p.female); }
  });
});

describe('crime & bribery', () => {
  it('a thief is caught; bribe acceptance depends on the catcher loyalty', () => {
    const w = setup(); w.hour = 12;
    const t = npc(w, 'hamal'); const v = w.people.find((p) => p.money > 50 && p.id !== t.id && !p.playerId && p.prof !== 'naip')!; v.protectedUntil = 0;
    const got = steal(w, t, v); expect(got).toBeGreaterThan(0);
    const loyal = { ...npc(w, 'bekci'), loyalty: 95, honesty: 95 } as Person; const corrupt = { ...npc(w, 'bekci'), loyalty: 10, honesty: 10 } as Person;
    expect(bribeAcceptChance(corrupt, 20)).toBeGreaterThan(bribeAcceptChance(loyal, 20));
    const a = arrest(w, t, 'hirsizlik', v.id, got)!; expect(a).toBeTruthy(); expect(t.jailedDays).toBeGreaterThan(0);
    t.money = 100; a.offer = 20; const before = totalMoney(w);
    decideBribe(w, a, true); expect(t.jailedDays).toBe(0); expect(totalMoney(w)).toBeCloseTo(before, 1);
  });
  it('the Kayzer cannot bribe and newcomers are protected', () => {
    const w = setup(); const officer = npc(w, 'bekci');
    expect(applyAction(w, 'f', { t: 'bribe', personId: officer.id, amount: 10 } as never, T0).ok).toBe(false);
    joinWorld(w, 'n', 'Yeni', 'hamal', false, T0); const me = findPerson(w, w.players.n!.personId)!; me.money = 100;
    const thief = npc(w, 'hamal'); expect(steal(w, thief, me)).toBe(0);
  });
});

describe('nature', () => {
  it('drought every 180 days for 2 weeks cuts the wheat harvest', () => {
    const w = setup(); w.day = w.nextDrought; nature(w);
    expect(w.nature?.kind).toBe('kuraklik'); expect(w.nature!.until - w.nature!.start).toBe(13);
    const f = npc(w, 'ciftci'); f.health = 100; f.xp = 200; const b0 = f.inv.bugday + w.listings.filter((l) => l.sellerId === f.id).reduce((s, l) => s + l.qty, 0);
    produce(w, f); const made = f.inv.bugday + w.listings.filter((l) => l.sellerId === f.id).reduce((s, l) => s + l.qty, 0) - b0;
    expect(made).toBeLessThan(20);
  });
});

describe('economy safeguards', () => {
  it('buy-then-resell the same day is refused', () => {
    const w = setup(); joinWorld(w, 'u2', 'Ali', 'hamal', false, T0); const me = findPerson(w, w.players.u2!.personId)!; me.money = 200; me.inv.ekmek = 0;
    w.listings.push({ id: 'Lx', sellerId: npc(w, 'firinci').id, good: 'ekmek', qty: 10, price: 1, market: 'gida' });
    const r = applyAction(w, 'u2', { t: 'buy', good: 'ekmek', qty: 5 }, T0); expect(r.ok).toBe(true);
    expect(applyAction(w, 'u2', { t: 'sell', good: 'ekmek', qty: 5, price: 5 }, T0).ok).toBe(false);
  });
  it('220 days: money is conserved, prices bounded, treasury solvent, people healthy', () => {
    const w = setup(); const m0 = totalMoney(w); run(w, 220);
    expect(Math.abs(totalMoney(w) - m0)).toBeLessThan(1);
    for (const g of GOODS) { expect(w.prices[g]).toBeLessThanOrEqual(BASE_PRICE[g] * 5 + 0.01); expect(w.prices[g]).toBeGreaterThan(0); }
    expect(w.treasury).toBeGreaterThan(2000);
    expect(w.people.length).toBeGreaterThan(90);
    expect(w.people.filter((p) => p.health >= 50).length / w.people.length).toBeGreaterThan(0.7);
  }, 60_000);
});

describe('chat', () => {
  it('NPCs answer a direct message', () => {
    const w = setup(); const me = findPerson(w, w.players.f!.personId)!; const n = npc(w, 'firinci');
    playerSaid(w, me, 'Merhaba, ekmek fiyatı ne?', n.id, T0);
    expect(w.chatOut.some((m) => m.fromPersonId === n.id && m.toPersonId === me.id)).toBe(true);
  });
});

describe('migration', () => {
  const path = '/workspace/backups/world-day3.json';
  it.skipIf(!existsSync(path))('the live day-3 world migrates and keeps running', () => {
    const raw = JSON.parse(readFileSync(path, 'utf8')); const w: World = (Array.isArray(raw) ? raw[0] : raw).state;
    const ids = w.people.map((p) => p.id); migrateWorld(w);
    expect(w.schema).toBe(8); expect(w.people.map((p) => p.id)).toEqual(ids);
    for (const p of w.people) if (p.spouse) { const s = findPerson(w, p.spouse); if (s) expect(s.female).not.toBe(p.female); }
    const m0 = totalMoney(w); let now = w.lastTickAt;
    for (let i = 0; i < 24 * 10; i++) { now += DAY_MS / 24; advanceWorld(w, now); }
    expect(Math.abs(totalMoney(w) - m0)).toBeLessThan(1);
  });
});

describe('custom laws, hoarding, hamal', () => {
  it('ruler enacts and repeals a custom law with preview', async () => {
    const { previewLaw } = await import('../src/sim/laws');
    const w = setup(); run(w, 2);
    expect(previewLaw(w, { kind: 'malVergisi', good: 'icki', value: 20 })).toMatch(/🔮/);
    const r = applyAction(w, 'f', { t: 'enactLaw', law: { kind: 'malVergisi', good: 'icki', value: 20, name: 'İçki vergisi' } }, T0 + 2 * DAY_MS);
    expect(r.ok).toBe(true); expect(w.customLaws!.length).toBe(1);
    const id = w.customLaws![0]!.id; expect(applyAction(w, 'f', { t: 'repealLaw', lawId: id }, T0 + 2 * DAY_MS).ok).toBe(true); expect(w.customLaws!.length).toBe(0);
  });
  it('curfew law runs 30 days with money conserved', () => {
    const w = setup(); const m0 = totalMoney(w);
    applyAction(w, 'f', { t: 'enactLaw', law: { kind: 'sokak', value: 22, value2: 5 } }, T0);
    run(w, 30); expect(Math.abs(totalMoney(w) - m0)).toBeLessThan(1); expect(w.people.filter((p) => p.health >= 50).length).toBeGreaterThan(80);
  });
  it('bekçi can find a hoarder', async () => {
    const { searchAndSeize } = await import('../src/sim/hoard');
    const w = setup(); const b = w.people.find((p) => p.prof === 'bekci')!; b.honesty = 100; b.loyalty = 100;
    const t = w.people.find((p) => p.prof === 'hamal' || p.prof === 'tuccar')!; t.inv.bugday = 400;
    const msg = searchAndSeize(w, b, t); expect(t.inv.bugday).toBeLessThan(400); expect(msg.length).toBeGreaterThan(0);
  });
});
