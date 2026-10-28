import { describe, expect, it, beforeEach } from 'vitest';
import { rules } from '../src/sim/move';
import { createWorld, joinWorld, touchPlayer, findPerson, applyAction, advanceWorld } from '../src/sim/index';
import type { World, Person } from '../src/sim/index';
import { season, migrate5, migrate6, orgsDay, animalsDay, joinScore } from '../src/sim/realm';
import { handleOrder, parseIntent } from '../src/sim/orders';
import { murder } from '../src/sim/life';
import { meclisElection } from '../src/sim/meclis';
import { totalMoney } from '../src/sim/economy';

const T0 = 1_700_000_000_000;
function setup(): World { const w = createWorld(5, T0); joinWorld(w, 'f', 'Enes', 'kayzer', true, T0); joinWorld(w, 'u2', 'Ali', 'hamal', false, T0); touchPlayer(w, 'f', T0); touchPlayer(w, 'u2', T0); w.serverNow = T0; for (const p of w.people) p.protectedUntil = 0; return w; }
const U = (w: World): Person => findPerson(w, w.players.u2!.personId)!;
const ok = (w: World, uid: string, a: unknown): { ok: boolean; msg: string } => applyAction(w, uid, a as never, T0) as never;
beforeEach(() => { rules.reach = false; });

describe('v1.8 realm', () => {
  it('seasons rotate every 30 days', () => { const w = setup(); w.day = 1; expect(season(w)).toBe('ilkbahar'); w.day = 31; expect(season(w)).toBe('yaz'); w.day = 61; expect(season(w)).toBe('sonbahar'); w.day = 91; expect(season(w)).toBe('kis'); });
  it('farm, animals, milk, slaughter – money is conserved', () => {
    const w = setup(); const u = U(w); u.money = 2000; const m0 = totalMoney(w);
    expect(ok(w, 'u2', { t: 'buyAnimal', animal: 'inek' }).ok).toBe(false); // needs a farm
    expect(ok(w, 'u2', { t: 'buyFarm' }).ok).toBe(true);
    expect(ok(w, 'u2', { t: 'buyAnimal', animal: 'inek' }).ok).toBe(false); // no ahır yet
    expect(ok(w, 'u2', { t: 'buildBarn', kind: 'ahir' }).ok).toBe(true);
    expect(ok(w, 'u2', { t: 'buyAnimal', animal: 'inek' }).ok).toBe(true);
    expect(ok(w, 'u2', { t: 'buyAnimal', animal: 'at' }).ok).toBe(true);
    expect(u.animals!.inek).toBe(1); expect(Math.abs(totalMoney(w) - m0)).toBeLessThan(0.01);
    u.inv.sut = 1; u.thirst = 60; expect(ok(w, 'u2', { t: 'drinkMilk' }).ok).toBe(true); expect(u.thirst).toBeLessThan(60);
    expect(ok(w, 'u2', { t: 'slaughter', animal: 'inek' }).ok).toBe(true); expect(u.animals!.inek).toBe(0); expect(u.inv.et).toBeGreaterThan(0);
  });
  it('only the Kayzer grants and strips titles', () => {
    const w = setup(); const t = w.people.find((p) => !p.playerId && p.prof === 'tuccar')!;
    expect(ok(w, 'u2', { t: 'grantTitle', personId: t.id, rank: 'Bey' }).ok).toBe(false);
    expect(ok(w, 'f', { t: 'grantTitle', personId: t.id, rank: 'Ağa' }).ok).toBe(true); expect(t.rank).toBe('Ağa');
    expect(ok(w, 'f', { t: 'stripTitle', personId: t.id }).ok).toBe(true); expect(t.rank).toBeFalsy();
  });
  it('orgs: found, join, warrant needed to search', () => {
    const w = setup(); const u = U(w); u.money = 500;
    expect(ok(w, 'u2', { t: 'orgFound', kind: 'cumhuriyet', name: 'Hür Ocak' }).ok).toBe(true);
    const o = w.orgs!.find((x) => x.leaderId === u.id)!; expect(o.members).toContain(u.id);
    expect(ok(w, 'f', { t: 'searchHouse', personId: u.id }).ok).toBe(false);
    expect(ok(w, 'f', { t: 'warrant', personId: u.id }).ok).toBe(true);
    const r = ok(w, 'f', { t: 'searchHouse', personId: u.id }); expect(r.ok).toBe(true);
    for (let i = 0; i < 5; i++) orgsDay(w); expect(w.orgs!.length).toBeGreaterThan(0);
  });
  it('a schema-4 world migrates to 5 with needs bars and keeps people', () => {
    const w = setup(); const ids = w.people.map((p) => p.id); (w as { schema: number }).schema = 4; delete (w as Partial<World>).orgs; for (const p of w.people) { p.hunger = 99; delete p.animals; }
    const m = migrate5(w); expect(m.schema).toBe(5); expect(m.people.map((p) => p.id)).toEqual(ids); expect(Math.max(...m.people.map((p) => p.hunger))).toBeLessThanOrEqual(40); expect(m.people.some((p) => p.prof === 'hayvanci')).toBe(true);
  });
  it('hunger and thirst drain continuously', () => {
    const w = setup(); const u = U(w); u.hunger = 0; u.thirst = 0; u.money = 0; let now = T0;
    for (let i = 0; i < 6; i++) { now += 5 * 60_000 / 24; touchPlayer(w, 'u2', now); touchPlayer(w, 'f', now); advanceWorld(w, now); }
    expect(u.hunger + u.thirst).toBeGreaterThan(5);
  });
  it('v1.9: player farm – feed by hand, collect products, ride a horse', () => {
    const w = setup(); const u = U(w); u.money = 3000;
    for (const a of [{ t: 'buyFarm' }, { t: 'buildBarn', kind: 'ahir' }, { t: 'buildBarn', kind: 'kumes' }, { t: 'buyAnimal', animal: 'inek' }, { t: 'buyAnimal', animal: 'tavuk' }, { t: 'buyAnimal', animal: 'at' }]) expect(ok(w, 'u2', a).ok).toBe(true);
    expect(ok(w, 'u2', { t: 'feedAnimals' }).ok).toBe(true);
    animalsDay(w); expect(u.farmStock?.sut).toBe(3);
    expect(ok(w, 'u2', { t: 'collectFarm' }).ok).toBe(true); expect(u.inv.sut).toBeGreaterThanOrEqual(3);
    expect(ok(w, 'u2', { t: 'ride', on: true }).ok).toBe(true); expect(u.riding).toBe(true);
  });
  it('v1.9: invitations depend on ideology, relation, payment; NPCs recruit', () => {
    const w = setup(); const u = U(w); u.money = 500; ok(w, 'u2', { t: 'orgFound', kind: 'cumhuriyet', name: 'Ocak' });
    const o = w.orgs!.find((x) => x.leaderId === u.id)!;
    const fan = w.people.find((p) => !p.playerId && !['asker', 'bekci', 'naip', 'memur', 'savci', 'hakim', 'tahsildar'].includes(p.prof))!; fan.republic = 90; fan.loyalty = 20;
    const loyal = w.people.find((p) => !p.playerId && p !== fan && p.prof === 'asker')!; loyal.republic = 5; loyal.loyalty = 95;
    expect(joinScore(w, fan, o, u)).toBeGreaterThan(joinScore(w, loyal, o, u));
    const r = handleOrder(w, u, fan, { type: 'join', targetId: null }, 'Seni cemiyetimize davet ediyorum', T0); expect(r.d.ok).toBe(true); expect(o.members).toContain(fan.id);
    const r2 = handleOrder(w, u, loyal, { type: 'join', targetId: null }, 'aramıza katıl', T0); expect(r2.d.ok).toBe(false);
    expect(parseIntent(w, fan, u, 'Seni gizlice cemiyetimize davet ediyorum, aramıza katıl.')!.type).toBe('join');
    expect(ok(w, 'u2', { t: 'orgRole', personId: fan.id, role: 'propagandaci' }).ok).toBe(true);
    expect(ok(w, 'u2', { t: 'orgAct', deed: 'propaganda' }).ok).toBe(true);
    expect(ok(w, 'u2', { t: 'orgAct', deed: 'ayaklanma' }).ok).toBe(false); // too few members
  });
  it('v1.9: a fresh world has no Meclis until the first election; speed works from the zindan', () => {
    const w = setup(); expect(w.people.some((p) => p.meclis)).toBe(false); expect(w.election.nextDay).toBe(10);
    const k = findPerson(w, w.kayzerId)!; k.jailedDays = 3; expect(ok(w, 'f', { t: 'setSpeed', speed: 2 }).ok).toBe(true); expect(w.speed).toBe(2);
  });
  it('v1.9: a schema-5 world gets the Hayvan Pazarı without overlapping', () => {
    const w = setup(); w.buildings = w.buildings.filter((b) => b.id !== 'hayvan'); (w as { schema: number }).schema = 5; const m = migrate6(w); const hb = m.buildings.find((b) => b.id === 'hayvan')!;
    expect(hb).toBeTruthy(); expect(m.buildings.filter((o) => o !== hb && hb.x < o.x + o.w && hb.x + hb.w > o.x && hb.y < o.y + o.h && hb.y + hb.h > o.y)).toEqual([]);
  });
  it('v1.9 housing: capacity 5, buy a spot (owner paid), sleep at home = safe', () => {
    const w = setup(); const u = U(w); u.money = 500;
    for (const b of w.buildings.filter((x) => x.kind === 'ev')) expect(w.people.filter((p) => p.home === b.id).length).toBeLessThanOrEqual(5);
    const free = w.buildings.find((b) => b.kind === 'ev' && w.people.filter((p) => p.home === b.id).length < 5 && w.people.some((p) => p.home === b.id && !p.playerId))!;
    const owner = w.people.find((p) => p.id === free.ownerId) ?? w.people.find((p) => p.home === free.id)!; const m0 = owner.money;
    u.home = ''; expect(ok(w, 'u2', { t: 'buyHome', houseId: free.id }).ok).toBe(true); expect(u.home).toBe(free.id); expect(owner.money).toBeCloseTo(m0 + 150, 1);
    expect(ok(w, 'u2', { t: 'goHome', sleep: true }).ok).toBe(true);
    const thief = w.people.find((p) => !p.playerId && p.prof === 'hamal')!; expect(murder(w, thief, u)).toContain('evinde');
  });
  it('v1.9 meclis: a declared player candidate with votes gets a seat; Kayzer tax goes to the Meclis', () => {
    const w = setup(); const u = U(w); w.election.candidates = [u.id];
    for (const p of w.people.slice(0, 30)) w.election.votes[p.id] = u.id;
    meclisElection(w, w.election.candidates, w.election.votes, (p) => !p.playerId);
    expect(u.meclis).toBe(true); expect(w.people.filter((p) => p.meclis).length).toBe(16);
    const r = ok(w, 'f', { t: 'setTax', rate: 20 }); expect(r.ok).toBe(true); expect(w.meclis.bills.some((b) => b.fromKayzer && b.kind === 'vergi')).toBe(true);
    expect(ok(w, 'u2', { t: 'foundFaction', name: 'Yeni Ufuk' }).ok).toBe(true);
  });
});
