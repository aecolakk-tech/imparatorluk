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

import { meclisElection, meclisDay, members, propose, ANAYASA_YES } from '../src/sim/meclis';
import { fullAI } from '../src/sim/index';
import type { Bill } from '../src/sim/types';
describe('v2.0.1 Cumhuriyet İlanı (anayasa değişikliği)', () => {
  function meclisWith(salt: number): World {
    const w = setup(); meclisElection(w, [], {}, fullAI);
    const ms = members(w);
    // exactly `salt` Saltanat MPs, the rest spread over other parties
    ms.forEach((p, i) => { p.faction = i < salt ? 'saltanat' : (['cumhuriyet', 'esnaf', 'halk'][i % 3]!); });
    return w;
  }
  const run = (w: World, b: Bill): void => { for (let i = 0; i < 6 && ['tartisma', 'oylama'].includes(b.status); i += 1) { w.day += 1; meclisDay(w, () => false, true); } };
  it('needs 14 yes, is free of party discipline, Saltanat defectors are logged, and passes peacefully under low mood + high republic', () => {
    const w = meclisWith(4); const ms = members(w); const kid = w.kayzerId!;
    for (const p of w.people) { p.republic = 85; p.mood = 25; p.loyalty = 25; }
    const b = propose(w, ms.find((p) => p.faction === 'cumhuriyet')!, 'cumhuriyet', 0, '') as Bill;
    expect(typeof b).toBe('object'); expect(b.debateUntil).toBe(w.day + 2);
    run(w, b);
    const yes = Object.values(b.votes).filter((v) => v === 'evet').length;
    expect(yes).toBeGreaterThanOrEqual(ANAYASA_YES);
    expect(b.lines?.saltanat).toBe('hayir');
    const saltYes = ms.filter((p) => p.faction === 'saltanat' && b.votes[p.id] === 'evet');
    expect(saltYes.length).toBeGreaterThanOrEqual(3); // Saltanat holds 4 seats, 3+ vote for the republic
    expect(b.defectors?.length).toBeGreaterThanOrEqual(3);
    expect(w.meclis.log.some((l) => l.text.includes('vicdan oyu'))).toBe(true);
    for (const p of saltYes) expect(p.faction).toBe('saltanat'); // not expelled for a vicdan oyu
    expect(b.status).toBe('kabul'); // no Kayzer veto possible
    expect(w.regime).toBe('cumhuriyet'); expect(w.kayzerId).toBeNull();
    const old = findPerson(w, kid)!; expect(old.prof).not.toBe('kayzer'); expect(old.soylu).toBe(false);
    expect(w.election.baskanNextDay).toBe(w.day + 1);
  });
  it('fails below 14 under a loyal, content city: proposer loses favour and a cooldown starts', () => {
    const w = meclisWith(5); const ms = members(w);
    for (const p of w.people) { p.republic = 40; p.mood = 70; p.loyalty = 70; }
    const pr = ms.find((p) => p.faction !== 'saltanat')!;
    const before = pr.relations[w.kayzerId!] ?? 0;
    const b = propose(w, pr, 'cumhuriyet', 0, '') as Bill; run(w, b);
    expect(b.status).toBe('ret'); expect(w.regime).toBe('imparatorluk');
    expect(pr.relations[w.kayzerId!]).toBeLessThan(before);
    expect(typeof propose(w, ms.find((p) => p.id !== pr.id)!, 'cumhuriyet', 0, '')).toBe('string');
  });
});

import { komisyonMembers, openDilekce, signDilekce, DILEKCE_IMZA, repealables, hoursToCount, turnout, aiApprove, HAZINE_FLOOR } from '../src/sim/meclis';
import { electionPhase } from '../src/sim/tick';
describe('v2.0.1 Meclis acil ekleri', () => {
  const mk = (): World => { const w = setup(); meclisElection(w, [], {}, fullAI); return w; };
  it('Bütçe Komisyonu: 3 MPs (2 bloc + 1 opposition) report on spending ≥200 D; the report is on the bill', () => {
    const w = mk(); w.treasury = 6000; const k = komisyonMembers(w); expect(k.length).toBe(3);
    const govt = new Set(w.meclis.govt ?? []); expect(k.filter((id) => govt.has(findPerson(w, id)!.faction ?? '')).length).toBeGreaterThanOrEqual(1);
    const b = propose(w, members(w)[0]!, 'genelge', 0, 'yol') as Bill; expect(typeof b).toBe('object');
    expect(b.komisyon?.text).toMatch(/Bütçe Komisyonu raporu/); expect(b.komisyon?.ok).toBe(true); expect(b.debateUntil).toBe(w.day + 2);
  });
  it('hazine kilidi: unaffordable spending needs the BORÇLANMA label; it borrows and repays', () => {
    const w = mk(); w.treasury = 400; const m = members(w)[0]!;
    expect(typeof propose(w, m, 'genelge', 0, 'senlik')).toBe('string');
    const b = propose(w, m, 'genelge', 0, 'yol', undefined, undefined, false, { borc: true }) as Bill;
    // gBlock refuses genelge that the hazine can't pay; insaat shows the label path
    if (typeof b === 'string') { const plot = w.buildings.find((x) => x.kind === 'arsa')!; for (const x of w.projects) x.done = true; const c = propose(w, m, 'insaat', 0, `cesme@${plot.id}`, undefined, undefined, false, { borc: true }) as Bill; expect(c.title).toMatch(/BORÇLANMA/); expect(c.komisyon?.ok).toBe(false); }
    else expect(b.title).toMatch(/BORÇLANMA/);
    expect(HAZINE_FLOOR).toBe(300);
  });
  it('halk dilekçesi: 20 signatures put it on the agenda (players and NPCs sign)', () => {
    const w = mk(); const me = findPerson(w, w.players.u2!.personId)!; me.born = -400 * 365;
    const d = openDilekce(w, me, 'af', 0, ''); expect(typeof d).toBe('object'); if (typeof d === 'string') return;
    const signers = w.people.filter((p) => p.id !== me.id && !p.playerId && p.prof !== 'naip' && p.jailedDays === 0).slice(0, DILEKCE_IMZA + 3);
    for (const p of signers) { p.born = -400 * 365; if (d.status === 'acik') signDilekce(w, p, d.id); }
    expect(d.status).toBe('gundem'); const b = w.meclis.bills.find((x) => x.id === d.billId)!; expect(b.title).toMatch(/Halk dilekçesi/); expect(b.dilekce).toBe(d.id);
  });
  it('gerçek sandık: only on election day at the Meclis; secret ballot; turnout; yeter sayı', () => {
    const w = mk(); rules.reach = false; const me = findPerson(w, w.players.u2!.personId)!; me.born = -400 * 365;
    const c = w.people.find((p) => !p.playerId && p.prof !== 'naip')!; w.election.candidates = [c.id];
    expect(applyAction(w, 'u2', { t: 'vote', candidateId: c.id }, T0).ok).toBe(false); // not election day
    w.day = w.election.nextDay; expect(electionPhase(w).phase).toBe('oylama');
    const r = applyAction(w, 'u2', { t: 'vote', candidateId: c.id }, T0); expect(r.ok).toBe(true); expect(r.msg).toMatch(/Oyunuz kaydedildi/);
    expect(w.election.votes[me.id]).toBe('✓'); expect(w.election.ballots).toContain(c.id); // the ballot carries no voter id
    expect(turnout(w).voted).toBe(1); expect(applyAction(w, 'u2', { t: 'vote', candidateId: c.id }, T0).ok).toBe(false);
  });
  it('yeter sayı: fewer than 9 votes → invalid; “Oylama başladı” notice with hours left', () => {
    const w = mk(); const ms = members(w); const pm = ms[0]!; pm.playerId = 'pm'; pm.npc = false;
    w.players.pm = { playerId: 'pm', personId: pm.id, name: pm.name, founder: false, banned: false, lastSeen: T0, lastSeenDay: 1, awayLog: [], awayMoney: 0 };
    const b = propose(w, ms[1]!, 'af', 0, '') as Bill; w.day += 1; w.hour = 11; meclisDay(w, (p) => p.id !== pm.id && ms.indexOf(p) < 9, true);
    expect((w.players.pm!.live ?? []).some((n) => /Oylama başladı/.test(n.t))).toBe(true);
    expect(hoursToCount(w, b)).toBeGreaterThan(0);
    w.day += 1; meclisDay(w, (p) => ms.indexOf(p) < 9, true); // 9 'players' who never vote → only 7 NPC votes
    expect(b.status).toBe('ret'); expect(b.result).toMatch(/Yeter sayı/);
  });
  it('kaldır: active genelge listed with its end day, repealed by the Meclis', () => {
    const w = mk(); w.treasury = 9000; const b = propose(w, members(w)[0]!, 'genelge', 0, 'okul') as Bill; for (const m of members(w)) b.votes[m.id] = 'evet';
    for (let i = 0; i < 4 && b.status !== 'kabul'; i++) { w.day += 1; meclisDay(w, () => true, false); }
    expect(b.status, b.result).toBe('kabul'); const r = repealables(w).find((x) => x.target === 'g:okul')!; expect(r.until).toBeGreaterThan(w.day);
    w.day += 1; const k = propose(w, members(w)[2]!, 'kaldir', 0, 'g:okul') as Bill; for (const m of members(w)) k.votes[m.id] = 'evet';
    for (let i = 0; i < 4 && k.status !== 'kabul'; i++) { w.day += 1; meclisDay(w, () => true, false); }
    expect(k.status, k.result).toBe('kabul'); expect((w.genelgeler ?? []).some((g) => g.kind === 'okul' && g.until >= w.day)).toBe(false);
  });
  it('AI naip answers a pending bill by the next session using the hazine', () => {
    const w = mk(); w.treasury = 600; const b = { kind: 'genelge', cost: 500, votes: {}, proposerId: members(w)[0]!.id } as unknown as Bill;
    expect(aiApprove(w, b)).toBe(false); w.treasury = 20000; expect(aiApprove(w, { ...b, cost: 200 } as Bill)).toBe(true);
  });
  it('ara seçim: an empty seat is filled at the next Meclis session', () => {
    const w = mk(); const ms = members(w); const gone = ms[3]!; w.people = w.people.filter((p) => p.id !== gone.id);
    expect(members(w).length).toBe(15); w.day += 1; meclisDay(w, () => true, false);
    expect(members(w).length).toBe(16); expect(JSON.stringify(w.meclis.log ?? w.events)).toMatch(/Ara seçim/);
  });
  it('Cumhuriyet İlanı: 13 yes is not enough', () => {
    const w = mk(); const ms = members(w); const b = propose(w, ms[0]!, 'cumhuriyet', 0, '') as Bill;
    ms.forEach((m, i) => { b.votes[m.id] = i < 13 ? 'evet' : 'hayir'; });
    for (let i = 0; i < 5 && ['tartisma', 'oylama'].includes(b.status); i++) { w.day += 1; meclisDay(w, () => true, true); }
    expect(b.status).toBe('ret'); expect(w.regime).toBe('imparatorluk'); expect(b.result).toMatch(/14/);
  });
});
