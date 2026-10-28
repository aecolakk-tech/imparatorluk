import { describe, expect, it, beforeEach } from 'vitest';
import { rules } from '../src/sim/move';
import { createWorld, joinWorld, touchPlayer, findPerson, applyAction, advanceWorld } from '../src/sim/index';
import type { World, Person } from '../src/sim/index';
import { season, migrate5, orgsDay } from '../src/sim/realm';
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
});
