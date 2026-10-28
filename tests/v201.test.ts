import { describe, expect, it, beforeEach } from 'vitest';
import { rules, findPath, walkGrid } from '../src/sim/move';
import { applyAction, createWorld, joinWorld, touchPlayer, findPerson, advanceWorld } from '../src/sim/index';
import { hourMsAt } from '../src/sim/tick';
import type { World } from '../src/sim/index';
import { MAP_W } from '../src/sim/constants';
import { placeOf } from '../src/sim/place';
import { act, heartbeat } from '../src/server/core';
import { startRaidWarning } from '../src/sim/events2';
import { startRaidCombat, attackFoe } from '../src/sim/combat';
import { foePos } from '../src/sim/combatpos';
import { searchPerson } from '../src/sim/arms';
import { QUESTS } from '../src/sim/life';
import { addListing } from '../src/sim/economy';
import { wed, proposeMarriage, answerProposal } from '../src/sim/family';
import { AGE, ORIGIN, TEMPER } from '../src/sim/profile';

const T0 = 1_700_000_000_000;
function setup(): World { const w = createWorld(3, T0); joinWorld(w, 'f', 'Enes', 'kayzer', true, T0); joinWorld(w, 'u2', 'Testoğlu', 'hamal', false, T0); touchPlayer(w, 'u2', T0); return w; }
beforeEach(() => { rules.reach = true; });

describe('v2.0.1 newcomer', () => {
  it('starts fed, watered, rested with bread+water; needs paused during onboarding; quest 0', () => {
    const w = setup(); const me = findPerson(w, w.players.u2!.personId)!;
    expect(me.hunger).toBe(0); expect(me.thirst).toBe(0); expect(me.energy).toBe(100); expect(me.inv.ekmek).toBe(2); expect(me.inv.su).toBe(1);
    let now = T0; for (let i = 0; i < 40; i++) { now += 12_500; touchPlayer(w, 'u2', now); heartbeat(w, 'u2', now); }
    expect(me.thirst).toBe(0); expect(me.energy).toBeGreaterThanOrEqual(90);
    expect(w.players.u2!.quest ?? 0).toBe(0);
    act(w, 'u2', { t: 'onboardDone' }, now); expect(me.onboardUntil).toBeLessThanOrEqual(now);
    for (let i = 0; i < 10; i++) { now += 12_500; heartbeat(w, 'u2', now); } expect(me.thirst).toBeGreaterThan(0);
  });
  it('quests count only what the player did (first: eat)', () => {
    const w = setup(); rules.reach = false; const me = findPerson(w, w.players.u2!.personId)!; me.meals = 9; me.drinks = 9;
    expect(QUESTS[0]!.done(w, me, w.players.u2!.qf ?? {})).toBe(false);
    me.hunger = 50; const r = act(w, 'u2', { t: 'eat' }, T0 + 1000); expect(r.ok).toBe(true); expect(w.players.u2!.quest).toBe(1);
  });
});
describe('v2.0.1 food from the bag', () => {
  it('Ye uses the Çanta first (free, item consumed, notice), then buys and says the price', () => {
    const w = setup(); rules.reach = false; const me = findPerson(w, w.players.u2!.personId)!; w.players.u2!.quest = 99; me.hunger = 60; me.inv.ekmek = 1; me.inv.et = 0; me.inv.balik = 0; me.inv.yumurta = 0; me.inv.sut = 0; const m0 = me.money;
    let r = act(w, 'u2', { t: 'eat' }, T0 + 1); expect(r.msg).toMatch(/Çantadan Ekmek yediniz \(ücretsiz\)/); expect(me.inv.ekmek).toBe(0); expect(me.money).toBe(m0);
    const baker = w.people.find((p) => p.prof === 'firinci')!; baker.inv.ekmek = 10; addListing(w, baker, 'ekmek', 5, 2, 'pazar'); me.hunger = 60; r = act(w, 'u2', { t: 'eat' }, T0 + 2); expect(r.ok).toBe(true); expect(r.msg).toMatch(/ödenen: [\d.]+ D/);
    me.thirst = 60; me.inv.su = 2; const m1 = me.money; r = act(w, 'u2', { t: 'drinkWater' }, T0 + 3); expect(r.msg).toMatch(/Çantadan su/); expect(me.inv.su).toBe(1); expect(me.money).toBe(m1);
  });
  it('buyBag puts bread / water into the Çanta at the Fırın / Kuyu only', () => {
    const w = setup(); const me = findPerson(w, w.players.u2!.personId)!; me.money = 100; const e0 = me.inv.ekmek; const baker = w.people.find((p) => p.prof === 'firinci')!; baker.inv.ekmek = 10; addListing(w, baker, 'ekmek', 5, 2, 'pazar');
    const firin = w.buildings.find((b) => b.id === 'firin')!; me.walk = { path: [{ x: firin.door.x + 0.5, y: firin.door.y + 0.6 }], t0: T0, speed: 3.6 };
    const r = act(w, 'u2', { t: 'buyBag', good: 'ekmek', qty: 2 }, T0 + 10); expect(r.ok).toBe(true); expect(me.inv.ekmek).toBe(e0 + 2); expect(r.msg).toMatch(/ödenen/);
    me.walk = { path: [{ x: 90, y: 14 }], t0: T0, speed: 3.6 }; expect(act(w, 'u2', { t: 'buyBag', good: 'su', qty: 1 }, T0 + 20).ok).toBe(false);
  });
});
describe('v2.0.1 real-time combat', () => {
  it('raid starts at 22:00 sharp at 0.25x, eşkıya walk in from outside, a player can kill one with a kılıç, speed restored', () => {
    const w = setup(); const me = findPerson(w, w.players.u2!.personId)!; me.arms = { kilic: 1, kalkan: 1 }; me.onboardUntil = 0;
    w.hour = 21; w.lastTickAt = T0; startRaidWarning(w); let now = T0;
    while (w.raid?.phase === 'uyari' && now < T0 + 90_000) { now += 1000; heartbeat(w, 'u2', now); }
    expect(w.raid?.phase).toBe('gece'); expect(w.hour).toBe(22); expect(w.speed).toBe(0.25);
    expect(w.combat!.foes.every((f) => { const p = foePos(f, now); return p.x < 0 || p.x > 100 || p.y < 0; })).toBe(true);
    act(w, 'u2', { t: 'drawWeapon', kind: 'kilic' }, now); expect(me.drawn).toBe('kilic');
    now += 20_000; heartbeat(w, 'u2', now);
    const f = w.combat!.foes.find((x) => x.hp > 0)!; const fp = foePos(f, now); rules.reach = false;
    let k = 0; while (f.hp > 0 && k++ < 12) { now += 1200; attackFoe(w, me, f.id, now); }
    expect(f.hp).toBe(0); expect(w.raid!.killed).toBeGreaterThanOrEqual(1); void fp;
    for (let i = 0; i < 400 && w.combat; i++) { now += 1000; heartbeat(w, 'u2', now); }
    expect(w.combat).toBeFalsy(); expect(w.speed).toBe(1);
  });
  it('no confiscation of a drawn blade while the town is under attack', () => {
    const w = setup(); const me = findPerson(w, w.players.u2!.personId)!; me.arms = { kilic: 1 }; me.drawn = 'kilic'; w.armsReg = [{ ownerId: me.id, kind: 'kilic', day: 1, by: 'demirci' }];
    const b = w.people.find((p) => p.prof === 'bekci')!; startRaidCombat(w, T0, 3);
    searchPerson(w, b, me, T0); expect(me.arms.kilic).toBe(1);
  });
  it('setSpeed during an attack only changes the speed restored afterwards', () => {
    const w = setup(); startRaidCombat(w, T0, 2); expect(w.speed).toBe(0.25);
    const r = applyAction(w, 'f', { t: 'setSpeed', speed: 2 }, T0 + 10); expect(r.ok).toBe(true); expect(w.speed).toBe(0.25); expect(w.speedBefore).toBe(2);
  });
});
describe('v2.0.1 map', () => {
  it('a walk into a house wall ends on a free tile next to it', () => {
    const w = setup(); const g = walkGrid(w);
    for (const b of w.buildings.filter((x) => x.kind === 'ev').slice(0, 10)) { const end = findPath(w, { x: 5.5, y: 13.5 }, { x: b.x + b.w / 2, y: b.y + 1 }).at(-1)!; expect(g[Math.floor(end.y) * MAP_W + Math.floor(end.x)]).toBe(1); }
  });
  it('an NPC held by a talking player stands still', () => {
    const w = setup(); const npc = w.people.find((p) => !p.playerId && p.prof === 'firinci')!; const a = placeOf(w, npc.id, T0)!;
    applyAction(w, 'u2', { t: 'holdNpc', personId: npc.id, on: true }, T0);
    const b = placeOf(w, npc.id, T0 + 40_000)!; expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(0.01);
    applyAction(w, 'u2', { t: 'holdNpc', personId: npc.id, on: false }, T0 + 41_000); expect(npc.hold).toBeUndefined();
  });
});
describe('v2.0.1 clock (20 real min/day, night 2x)', () => {
  it('a full day at 1x takes 20 real minutes; the night part 4 minutes; 0.5x doubles it', () => {
    const w = setup(); w.hour = 6; let now = T0 + 1; touchPlayer(w, 'u2', now); advanceWorld(w, now); w.lastTickAt = now; const d0 = w.day;
    let nightStart = 0;
    while (w.day === d0 || w.hour < 6) { now += 1000; touchPlayer(w, 'u2', now); advanceWorld(w, now); if (w.hour === 22 && !nightStart) nightStart = now; }
    expect(Math.round((now - T0) / 1000)).toBe(1200); expect(Math.round((now - nightStart) / 1000)).toBe(240);
    w.speed = 0.5; const t1 = now; while (w.hour === 6) { now += 1000; touchPlayer(w, 'u2', now); advanceWorld(w, now); } expect(Math.round((now - t1) / 1000)).toBe(120);
  });
  it('3 meals + 3 drinks a day keep a player healthy (no end-of-day penalty)', () => {
    const w = setup(); const me = findPerson(w, w.players.u2!.personId)!; me.onboardUntil = 0; me.inv.ekmek = 10; me.inv.su = 10; me.health = 100; rules.reach = false;
    let now = T0; const d0 = w.day; let lowest = 100;
    for (let i = 0; i < 24 * 2; i++) { now += hourMsAt(w, w.hour) + 1; touchPlayer(w, 'u2', now); advanceWorld(w, now); if ([8, 13, 19].includes(w.hour)) act(w, 'u2', { t: 'eat' }, now); if ([9, 15, 20].includes(w.hour)) act(w, 'u2', { t: 'drinkWater' }, now); lowest = Math.min(lowest, 100 - me.hunger, 100 - me.thirst); }
    expect(w.day).toBeGreaterThanOrEqual(d0 + 2); expect(me.health).toBeGreaterThanOrEqual(95); expect(lowest).toBeGreaterThan(15);
  });
  it('an admin-scheduled landing (landReal) sails in at that real time', () => {
    const w = setup(); w.foreign = { name: 'Macar Krallığı', demand: 1, troops: 6, phase: 'savas', day: w.day, deadline: w.day, landDay: w.day + 99, landReal: T0 + 180_000, recruits: [] };
    let now = T0; while (!w.foreign?.landed && now < T0 + 400_000) { now += 1000; heartbeat(w, 'u2', now); }
    expect(Math.round((now - T0) / 1000)).toBe(180); expect(w.combat?.kind).toBe('war');
  });
});

describe('v2.0.1 character creation: gender, profile, names, marriage', () => {
  const look = { skin: 1, hair: 0, hairColor: 1, beard: 2, eye: 1, build: 1, height: 1, cloth: 1, outfit: 0, head: 0, scarf: false, belt: false, jewel: false };
  it('duplicate names are refused (case-insensitive), the account is not created', () => {
    const w = setup(); expect(() => joinWorld(w, 'u3', 'TESTOĞLU', 'hamal', false, T0)).toThrow(/isimde/); expect(() => joinWorld(w, 'u4', 'FIRINCI AYŞE', 'hamal', false, T0)).toThrow(/isimde/);
    expect(joinWorld(w, 'u5', 'Yepyeni Ad', 'hamal', false, T0).name).toBe('Yepyeni Ad');
  });
  it('a new player must pick gender + profile once; Köken sets meslek and money; women get no beard', () => {
    const w = setup(); const me = findPerson(w, w.players.u2!.personId)!;
    expect(act(w, 'u2', { t: 'customize', look, where: 'ilk' } as never, T0).ok).toBe(false);
    expect(act(w, 'u2', { t: 'customize', look, where: 'ilk', female: true } as never, T0).msg).toMatch(/soyadı/);
    const r = act(w, 'u2', { t: 'customize', look, where: 'ilk', female: true, profile: { surname: 'Karaca', age: 50, origin: 'tuccar', temper: 'kurnaz' } } as never, T0);
    expect(r.ok).toBe(true); expect(me.female).toBe(true); expect(me.look!.beard).toBe(0); expect(me.name).toBe('Testoğlu Karaca'); expect(w.players.u2!.name).toBe('Testoğlu Karaca');
    expect(me.prof).toBe('tuccar'); expect(me.money).toBe(100); expect(me.honesty).toBe(30);
    expect(act(w, 'u2', { t: 'customize', look, where: 'ilk', female: false, profile: { surname: 'X', age: 18, origin: 'yoksul', temper: 'cesur' } } as never, T0).ok).toBe(false); // once only
  });
  it('an existing player chooses once at next login; meslek and money never change', () => {
    const w = setup(); const me = findPerson(w, w.players.u2!.personId)!; delete me.profile; me.lookSet = true; me.prof = 'kasap'; me.money = 77; me.genderSet = undefined;
    const r = act(w, 'u2', { t: 'customize', look, where: 'ilk', female: false, profile: { surname: 'Demir', age: 18, origin: 'yoksul', temper: 'cesur' } } as never, T0);
    expect(r.ok).toBe(true); expect(me.prof).toBe('kasap'); expect(me.money).toBe(77); expect(findPerson(w, w.players.u2!.personId)!.profile?.temper).toBe('cesur');
  });
  it('a married player cannot switch gender to the spouse\'s; marriage only man–woman on every path', () => {
    const w = setup(); const me = findPerson(w, w.players.u2!.personId)!; me.female = false; me.born = -9999;
    const wife = w.people.find((p) => p.female && !p.spouse && !p.playerId && p.prof !== 'naip')!; wife.born = -9999; wed(w, me, wife); expect(me.spouse).toBe(wife.id);
    expect(act(w, 'u2', { t: 'customize', look, where: 'ilk', female: true, profile: { surname: 'Ak', age: 30, origin: 'koylu', temper: 'durust' } } as never, T0).ok).toBe(false);
    const man = w.people.find((p) => !p.female && !p.spouse && !p.playerId && p.prof !== 'naip' && p.prof !== 'kayzer')!; man.born = -9999;
    const man2 = w.people.find((p) => !p.female && !p.spouse && !p.playerId && p !== man && p.prof !== 'naip' && p.prof !== 'kayzer')!; man2.born = -9999;
    expect(proposeMarriage(w, man, man2, () => false)).toMatch(/erkek ile bir kadın/); wed(w, man, man2); expect(man.spouse).toBeNull();
    // a proposal that became same-sex (gender chosen after) is refused on answer
    const woman = w.people.find((p) => p.female && !p.spouse && !p.playerId && p.prof !== 'naip')!; woman.born = -9999;
    w.proposals.push({ id: 'E1', kind: 'evlilik', from: man.id, to: woman.id, day: w.day }); woman.female = false;
    expect(answerProposal(w, woman, 'E1', true)).toMatch(/erkek ile bir kadın/); expect(woman.spouse).toBeNull();
    // NPC–NPC weddings over a year never pair the same sex
    let now = T0; for (let i = 0; i < 24 * 40; i++) { now += hourMsAt(w, w.hour) + 1; touchPlayer(w, 'u2', now); advanceWorld(w, now); }
    for (const p of w.people) { const s = p.spouse ? findPerson(w, p.spouse) : null; if (s) expect(s.female).not.toBe(p.female); }
  });
  it('profile options trade off (no option strictly best)', () => {
    const tot = (o: keyof typeof ORIGIN, a: keyof typeof AGE) => ORIGIN[o].money + AGE[a].money;
    expect(tot('tuccar', 'yasli')).toBeGreaterThan(tot('yoksul', 'genc')); // money vs …
    expect(AGE.genc.fight).toBeGreaterThan(AGE.yasli.fight); expect(AGE.yasli.xp).toBeGreaterThan(AGE.genc.xp);
    for (const t of Object.values(TEMPER)) expect([t.rel > 0, t.bribe > 1, t.fight > 1, t.ambition >= 85, t.din >= 85].some(Boolean) || t.label === 'Dürüst').toBe(true);
    expect(TEMPER.durust.bribe).toBeLessThan(1); expect(TEMPER.kurnaz.rel).toBeLessThan(0); expect(TEMPER.cesur.fight).toBeGreaterThan(1);
  });
});
