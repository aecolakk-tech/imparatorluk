import { describe, expect, it, beforeEach } from 'vitest';
import { createWorld, joinWorld, touchPlayer, findPerson } from '../src/sim/index';
import type { World, Person } from '../src/sim/index';
import { rules, doorSpot } from '../src/sim/move';
import { act } from '../src/server/core';
import { startWalk } from '../src/sim/v16';
import { careerHour, careerDay, refreshJobs, itibar, itibarOf, rankOf, nextReqs, migrateCareer, displayName, combatRecord, enlist, MAIN, askJob } from '../src/sim/career';
import { pietyHour, weekday, isCuma, isRamazan, isBayram, trait, ASEVI_DAILY } from '../src/sim/piety';
import { openCase } from '../src/sim/ai';
import { bornForYears } from '../src/sim/age';
import { buy, totalMoney } from '../src/sim/economy';

const T0 = 1_700_000_000_000;
function setup(): World { const w = createWorld(3, T0); joinWorld(w, 'f', 'Enes', 'kayzer', true, T0); joinWorld(w, 'u2', 'Testoğlu', 'hamal', false, T0); touchPlayer(w, 'u2', T0); migrateCareer(w); return w; }
const me = (w: World): Person => findPerson(w, w.players.u2!.personId)!;
const goTo = (w: World, p: Person, id: string, now: number): void => { const b = w.buildings.find((x) => x.id === id)!; startWalk(w, p, doorSpot(b), now - 600_000); };
beforeEach(() => { rules.reach = false; });

describe('v2.0.1 itibar', () => {
  it('starts at 10, is clamped 0..100 and separate from money', () => {
    const w = setup(); const p = me(w); expect(itibarOf(p)).toBeGreaterThanOrEqual(0); p.itibar = 10; const m = p.money;
    itibar(w, p, 200, 'test'); expect(p.itibar).toBe(100); expect(p.money).toBe(m);
    expect(p.notes?.at(-1)?.why).toBe('test');
  });
  it('itibar below 0 costs one rank and bankruptcy makes a Dilenci', () => {
    const w = setup(); const p = me(w); p.yol = 'cirak'; p.itibar = 3; itibar(w, p, -10, 'hırsızlık'); expect(rankOf(p)).toBe('isci'); expect(p.itibar).toBe(0);
    p.money = 0; w.loans.push({ id: 'L1', debtor: p.id, lender: 'saray', amount: 10, due: w.day, day: w.day }); for (const b of w.buildings) if (b.ownerId === p.id) b.ownerId = null as never;
    careerDay(w); expect(rankOf(p)).toBe('dilenci');
  });
  it('crimes cost itibar when they come to light (hırsızlık −10, cinayet −30, rüşvet −15)', () => {
    const w = setup(); const p = me(w); p.itibar = 50; openCase(w, p.id, 'hirsizlik', null, 5, 60); expect(p.itibar).toBe(40);
    const q = me(w); q.itibar = 50; w.cases = []; openCase(w, q.id, 'cinayet', null, 0, 60); expect(q.itibar).toBe(20);
  });
  it('sadaka: +1 itibar per 5 D, at most +3 a day, din +1 once a day', () => {
    const w = setup(); const p = me(w); p.money = 100; p.itibar = 10; const d0 = p.din;
    act(w, 'u2', { t: 'sadaka', amount: 10 }, T0); act(w, 'u2', { t: 'sadaka', amount: 10 }, T0); act(w, 'u2', { t: 'sadaka', amount: 10 }, T0);
    expect(p.itibar).toBe(13); expect(Math.round(p.din - d0)).toBe(1);
  });
  it('10 honest trades give +2 itibar', () => {
    const w = setup(); const p = me(w); p.itibar = 10; p.inv.ekmek = 20; w.listings = w.listings.filter((l) => l.good !== 'ekmek');
    act(w, 'u2', { t: 'sell', good: 'ekmek', qty: 20, price: 0.1, market: 'pazar' } as never, T0);
    const buyers = w.people.filter((x) => !x.playerId).slice(0, 10); for (const b of buyers) { b.money += 5; act; (b as Person).inv.ekmek = 0; }
    for (const b of buyers) buy(w, b.id, 'ekmek', 1);
    expect(p.cs?.trades).toBe(10); expect(p.itibar).toBe(12);
  });
});

describe('v2.0.1 iş bulma', () => {
  it('board has gündelik jobs without requirement; Başvur hires at once', () => {
    const w = setup(); refreshJobs(w); const p = me(w);
    const j = w.jobs!.find((x) => x.id === 'J-irgat')!; expect(j.req).toBeUndefined();
    const r = act(w, 'u2', { t: 'jobApply', jobId: j.id }, T0); expect(r.ok).toBe(true); expect(p.job?.title).toBe(j.title);
  });
  it('a job with an unmet requirement is refused with the reason', () => {
    const w = setup(); refreshJobs(w); const p = me(w); p.itibar = 5; const j = w.jobs!.find((x) => x.id === 'J-bekci')!;
    const r = act(w, 'u2', { t: 'jobApply', jobId: j.id }, T0); expect(r.ok).toBe(false); expect(r.msg).toMatch(/İtibar/);
  });
  it('v2.0.3: 3 İş görevi in a day pay the wage and +1 itibar; online days without tasks lose itibar and get fired', () => {
    const w = setup(); refreshJobs(w); const p = me(w); p.itibar = 10; const j = w.jobs!.find((x) => x.id === 'J-hamal')!; act(w, 'u2', { t: 'jobApply', jobId: j.id }, T0);
    const place = p.job!.place; let now = T0; goTo(w, p, place, now); const m0 = p.money;
    w.day += 1; // the hire day is a grace day
    for (let k = 0; k < 3; k++) { now += 1000; expect(act(w, 'u2', { t: 'jobTask', step: 'start' }, now).ok).toBe(true); now += 30_000; touchPlayer(w, 'u2', now); expect(act(w, 'u2', { t: 'jobTask', step: 'done' }, now).ok).toBe(true); }
    expect(p.money).toBeGreaterThan(m0); expect(p.itibar).toBe(11); expect(p.job!.tasks).toBe(3); expect(p.job!.paidDay).toBe(w.day);
    expect(act(w, 'u2', { t: 'jobTask', step: 'start' }, now + 1000).ok).toBe(false); // 3 a day
    // two days online but no tasks → fired
    for (let d = 0; d < 2; d++) { w.day++; for (let h = 1; h < 24; h++) { w.hour = h; now += 60_000; touchPlayer(w, 'u2', now); goTo(w, p, 'cami', now); careerHour(w, now); } w.day++; w.hour = 0; now += 60_000; careerHour(w, now); w.day--; }
    expect(p.job).toBeUndefined(); expect(p.itibar).toBeLessThan(11);
  });
  it('“Bir iş var mı?”: an usta hires an İşçi as çırak; a dilenci is told to work first', () => {
    const w = setup(); const p = me(w); p.itibar = 10; p.yol = 'isci'; p.din = 40;
    const u = w.people.find((x) => !x.playerId && x.prof === 'firinci')!; u.xp = 80; u.money = 100; u.din = 40;
    const r = askJob(w, p, u); expect(r.ok).toBe(true); expect(p.job?.kind).toBe('cirak');
    p.job = undefined; p.yol = 'dilenci'; expect(askJob(w, p, u).msg).toMatch(/gündelik/);
  });
  it('usta players may post a job notice and must have 3 days of wages', () => {
    const w = setup(); const p = me(w); p.yol = 'isci'; expect(act(w, 'u2', { t: 'jobPost', title: 'Yardımcı', wage: 4, from: 8, to: 14 }, T0).ok).toBe(false);
    p.yol = 'usta'; p.money = 50; expect(act(w, 'u2', { t: 'jobPost', title: 'Yardımcı', wage: 4, from: 8, to: 14 }, T0).ok).toBe(true);
    expect(w.jobs!.some((j) => j.employerId === p.id)).toBe(true);
  });
});

describe('v2.0.1 yükselme yolu', () => {
  it('ladder order and requirements shown for the next rank', () => {
    expect(MAIN).toEqual(['dilenci', 'isci', 'cirak', 'usta', 'tuccar', 'esraf', 'soylu', 'danisman']);
    const w = setup(); const p = me(w); p.yol = 'cirak'; const n = nextReqs(w, p)!; expect(n.next).toBe('Usta'); expect(n.reqs.map((r) => r.label)).toContain('Lonca sınavı (kusursuz mal)');
  });
  it('dilenci → işçi after 3 days not hungry and 10 D saved', () => {
    const w = setup(); const p = me(w); p.yol = 'dilenci'; p.money = 12; p.hunger = 20; p.meals = 2;
    for (let i = 0; i < 3; i++) { careerDay(w); p.meals = 2; } expect(rankOf(p)).toBe('isci');
  });
  it('soyluluk needs the Kayzer: a petition is opened, accepting it makes the player soylu', () => {
    const w = setup(); const p = me(w); p.yol = 'esraf'; p.money = 2500; p.itibar = 65; p.farm = true; w.buildings.find((b) => b.kind === 'ev')!.ownerId = p.id;
    careerDay(w); const pet = w.petitions.find((x) => x.kind === 'unvan' && x.fromId === p.id)!; expect(pet).toBeDefined();
    expect(act(w, 'f', { t: 'answer', petitionId: pet.id, accept: true }, T0).ok).toBe(true); expect(p.soylu).toBe(true); expect(rankOf(p)).toBe('soylu');
  });
  it('existing players are mapped fairly and the Kayzer stays Kayzer', () => {
    const w = createWorld(3, T0); joinWorld(w, 'f', 'Enes', 'kayzer', true, T0); joinWorld(w, 'u2', 'Usta', 'firinci', false, T0); const p = findPerson(w, w.players.u2!.personId)!; p.xp = 90;
    migrateCareer(w); expect(rankOf(p)).toBe('usta'); const k = findPerson(w, w.kayzerId!)!; expect(k.prof).toBe('kayzer');
    expect(p.itibar).toBeGreaterThanOrEqual(0); expect(p.job).toBeDefined();
  });
});

describe('v2.0.1 asker', () => {
  it('kayıt → acemi er; 2 days of talim → Er; rank before the name from Onbaşı', () => {
    const w = setup(); const p = me(w); p.born = bornForYears(w, 20); expect(act(w, 'u2', { t: 'kisla', op: 'kayit' }, T0).ok).toBe(true); expect(p.askerRank).toBe(0);
    expect(act(w, 'u2', { t: 'kisla', op: 'talim' }, T0).ok).toBe(true); w.day++; act(w, 'u2', { t: 'kisla', op: 'talim' }, T0); expect(p.askerRank).toBe(1);
    p.askerRank = 3; expect(displayName(w, p)).toMatch(/^Çavuş /);
  });
  it('raid: fighters gain +5 itibar and a raid; online soldiers who never fought lose 2 ranks', () => {
    const w = setup(); const p = me(w); p.born = bornForYears(w, 20); enlist(w, p); p.askerRank = 3; p.itibar = 20;
    combatRecord(w, 'raid', [p.id], { [p.id]: 2 }, true, [p.id]); expect(p.itibar).toBe(25); expect(p.cs?.raids).toBe(2); expect(p.cs?.defenseWins).toBe(1);
    combatRecord(w, 'raid', [], {}, true, [p.id]); expect(p.askerRank).toBe(1);
  });
  it('minors cannot enlist', () => { const w = setup(); const p = me(w); p.born = bornForYears(w, 14); expect(act(w, 'u2', { t: 'kisla', op: 'kayit' }, T0).ok).toBe(false); });
});

describe('v2.0.1 Cuma & dindarlık', () => {
  it('weekday cycle: Cuma = day%7==5, independent of the 5-day year; Ramazan day 3, Bayram day 4, Panayır day 5', () => {
    expect(weekday(5)).toBe('Cuma'); expect(weekday(6)).toBe('Cumartesi'); expect(weekday(7)).toBe('Pazar'); expect(weekday(8)).toBe('Pazartesi');
    expect(isCuma(12)).toBe(true); expect(isRamazan(3)).toBe(true); expect(isBayram(4)).toBe(true); expect(isRamazan(8)).toBe(true); expect(isBayram(5)).toBe(false);
  });
  it('warning at 11:00, ezan at 13:00, being in the cami 13:00–14:00 gives +3 din and +1 itibar once', () => {
    const w = setup(); const p = me(w); w.day = 12; p.itibar = 10; p.din = 40; let now = T0;
    w.hour = 11; pietyHour(w, now); expect(w.players.u2!.awayLog.some((m) => /Cuma namazı yaklaşıyor/.test(m))).toBe(true);
    w.hour = 13; now += 60_000; touchPlayer(w, 'u2', now); goTo(w, p, 'cami', now); pietyHour(w, now); w.hour = 14; pietyHour(w, now);
    expect(p.din).toBe(43); expect(p.itibar).toBe(11);
  });
  it('daily namaz +1 din at most once a day; içki −2', () => {
    const w = setup(); const p = me(w); p.din = 40; act(w, 'u2', { t: 'pray' }, T0); act(w, 'u2', { t: 'pray' }, T0); expect(p.din).toBe(41);
    p.money = 50; p.inv.icki = 1; const r = act(w, 'u2', { t: 'drink' }, T0); expect(r.ok).toBe(true); expect(p.din).toBe(39);
  });
  it('oruç: not eating 06–22 on Ramazan gives +5 din; eating breaks it', () => {
    const w = setup(); const p = me(w); w.day = 3; p.din = 40; w.hour = 22; pietyHour(w, T0); expect(p.din).toBe(45);
    const w2 = setup(); const q = me(w2); w2.day = 8; w2.hour = 12; q.din = 40; q.hunger = 60; q.inv.ekmek = 1; act(w2, 'u2', { t: 'eat' }, T0); w2.hour = 22; pietyHour(w2, T0); expect(q.din).toBe(40);
  });
  it('aşevi: one free soup a day for anyone hungry, paid by the saray (money conserved)', () => {
    const w = setup(); const p = me(w); p.hunger = 70; p.din = 0; const tot = (): number => totalMoney(w);
    const t0 = tot(); expect(act(w, 'u2', { t: 'asevi' }, T0).ok).toBe(true); expect(p.hunger).toBe(40); expect(act(w, 'u2', { t: 'asevi' }, T0).ok).toBe(false);
    expect(Math.abs(tot() - t0)).toBeLessThan(0.01); expect(ASEVI_DAILY).toBeGreaterThan(0);
  });
  it('şifa duası only when there is no hekim, with a cooldown', () => {
    const w = setup(); const p = me(w); p.health = 50; expect(act(w, 'u2', { t: 'sifa' }, T0).ok).toBe(false);
    for (const x of w.people) if (x.prof === 'hekim') x.health = 0; expect(act(w, 'u2', { t: 'sifa' }, T0).ok).toBe(true); expect(act(w, 'u2', { t: 'sifa' }, T0).ok).toBe(false);
  });
  it('trait words: Dindar / Meyhane müdavimi', () => { expect(trait({ din: 80 } as Person)).toBe('Dindar'); expect(trait({ din: 10 } as Person)).toBe('Meyhane müdavimi'); expect(trait({ din: 50, lastAction: '' } as Person)).toBeNull(); });
  it('talebe needs din 30', () => { const w = setup(); const p = me(w); p.din = 20; expect(act(w, 'u2', { t: 'talebe' }, T0).ok).toBe(false); p.din = 35; expect(act(w, 'u2', { t: 'talebe' }, T0).ok).toBe(true); });
});
