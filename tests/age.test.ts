import { describe, expect, it, beforeEach } from 'vitest';
import { createWorld, joinWorld, touchPlayer, findPerson } from '../src/sim/index';
import type { World, Person } from '../src/sim/index';
import { rules } from '../src/sim/move';
import { act } from '../src/server/core';
import { deathChance, fertility, yearsOf, bornForYears, migrateAge, ageText } from '../src/sim/age';
import { DAYS_PER_YEAR, DEATH_START_AGE, DEATH_CERTAIN_AGE } from '../src/sim/constants';
import { wed, proposeMarriage, die, familyDay, stage, setSurname } from '../src/sim/family';
import { makePerson } from '../src/sim/world';

const T0 = 1_700_000_000_000;
function setup(): World { const w = createWorld(3, T0); joinWorld(w, 'f', 'Enes', 'kayzer', true, T0); joinWorld(w, 'u2', 'Testoğlu', 'hamal', false, T0); touchPlayer(w, 'u2', T0); return w; }
const add = (w: World, name: string, female: boolean, years: number): Person => { const p = makePerson(w, { name, prof: 'hamal', female, money: 0 } as never, 'ev1'); p.born = bornForYears(w, years); w.people.push(p); return p; };
beforeEach(() => { rules.reach = true; });

describe('v2.0.1 age & natural death', () => {
  it('death probability table: 0 up to 68, then (age−68)% per year, certain at 88', () => {
    expect(DAYS_PER_YEAR).toBe(5); expect(DEATH_START_AGE).toBe(68); expect(DEATH_CERTAIN_AGE).toBe(88);
    for (const y of [0, 16, 40, 65, 68]) expect(deathChance(y)).toBe(0);
    expect(deathChance(69)).toBeCloseTo(0.01); expect(deathChance(78)).toBeCloseTo(0.10); expect(deathChance(87)).toBeCloseTo(0.19);
    expect(deathChance(88)).toBe(1); expect(deathChance(95)).toBe(1);
  });
  it('everyone who reaches 88 dies at that birthday; nobody under 69 dies of old age', () => {
    const w = setup(); w.day = 500; const old = add(w, 'Yaşlı Dede', false, 87); old.born -= DAYS_PER_YEAR - 1; // turns 88 tomorrow
    const young = add(w, 'Genç Adam', false, 60);
    w.day += 1; expect(yearsOf(w, old)).toBe(88);
    familyDay(w, () => true, T0);
    expect(findPerson(w, old.id)).toBeUndefined(); expect(findPerson(w, young.id)).toBeDefined();
    expect(w.events.some((l) => /Cenaze/.test(l.text))).toBe(true);
  });
  it('ages shown in years with stages', () => {
    const w = setup(); w.day = 400;
    expect(ageText(w, { born: bornForYears(w, 3) })).toMatch(/3 yaşında · Bebek\/Çocuk/);
    expect(ageText(w, { born: bornForYears(w, 12) })).toMatch(/Genç/);
    expect(ageText(w, { born: bornForYears(w, 30) })).toMatch(/Yetişkin/);
    expect(ageText(w, { born: bornForYears(w, 70) })).toMatch(/Yaşlı/);
  });
  it('migration of old day-based ages: no deaths, no adult becomes a child, parents older than kids', () => {
    const w = setup(); w.day = 700; (w as { ageV?: number }).ageV = 1;
    for (const p of w.people) p.born = w.day - 60 - Math.floor(Math.random() * 600);
    const n = w.people.length; migrateAge(w); migrateAge(w);
    expect(w.people.length).toBe(n);
    for (const p of w.people) { expect(yearsOf(w, p)).toBeGreaterThanOrEqual(16); expect(yearsOf(w, p)).toBeLessThanOrEqual(60); }
  });
});

describe('v2.0.1 marriage, surnames, fertility', () => {
  it('marriage needs 16+ years', () => {
    const w = setup(); w.day = 300; const a = add(w, 'Kemal Bey', false, 30); const b = add(w, 'Küçük Kız', true, 15);
    expect(proposeMarriage(w, a, b, () => false)).not.toMatch(/evlendi/i); expect(a.spouse).toBeFalsy();
    b.born = bornForYears(w, 16); expect(stage(w, b)).toBe('yetiskin');
  });
  it('wife takes the husband\'s soyadı; children take the father\'s', () => {
    const w = setup(); w.day = 300; const h = add(w, 'Ahmet', false, 30); setSurname(w, h, 'Yılmaz'); const f = add(w, 'Elif', true, 25); setSurname(w, f, 'Kaya');
    wed(w, h, f); expect(f.name).toBe('Elif Yılmaz'); expect(f.profile!.surname).toBe('Yılmaz');
    h.money = 500; f.money = 500; w.pregnancies.push({ parents: [f.id, h.id], due: w.day });
    familyDay(w, () => false, T0); const kid = w.children.find((c) => c.parents.includes(h.id))!;
    expect(kid.name.endsWith('Yılmaz')).toBe(true); expect(kid.surname).toBe('Yılmaz');
  });
  it('fertility: women 16–45, men decline after 60', () => {
    const w = setup(); w.day = 600; const m = add(w, 'M', false, 30), f = add(w, 'F', true, 30);
    expect(fertility(w, m, f)).toBe(1);
    f.born = bornForYears(w, 46); expect(fertility(w, m, f)).toBe(0);
    f.born = bornForYears(w, 40); m.born = bornForYears(w, 65); expect(fertility(w, m, f)).toBeCloseTo(0.5);
    m.born = bornForYears(w, 75); expect(fertility(w, m, f)).toBe(0);
    expect(fertility(w, m, add(w, 'M2', false, 30))).toBe(0); // same sex
  });
});

describe('v2.0.1 death & inheritance', () => {
  it('several adult children: money split equally, heir (player-chosen) gets house, sandık, Çanta', () => {
    const w = setup(); w.day = 400; const me = findPerson(w, w.players.u2!.personId)!; me.born = bornForYears(w, 60);
    const k1 = add(w, 'Oğul', false, 30), k2 = add(w, 'Kız', true, 25); k1.parents = [me.id]; k2.parents = [me.id]; k1.money = 0; k2.money = 0;
    const house = w.buildings.find((b) => b.id.startsWith('ev'))!; house.ownerId = me.id; me.money = 200; me.inv.ekmek = 7;
    die(w, me, 'test');
    const pl = w.players.u2!; expect(pl.dead).toBeDefined(); expect(pl.dead!.heirs.sort()).toEqual([k1.id, k2.id].sort());
    expect(k1.money).toBeCloseTo(90, 0); expect(k2.money).toBeCloseTo(90, 0); // 10% vergi then equal split
    expect(act(w, 'u2', { t: 'eat' }, T0).ok).toBe(false);
    const r = act(w, 'u2', { t: 'continueAs', childId: k2.id } as never, T0); expect(r.ok).toBe(true);
    expect(pl.personId).toBe(k2.id); expect(k2.playerId).toBe('u2'); expect(k2.inv.ekmek).toBeGreaterThanOrEqual(7); expect(house.ownerId).toBe(k2.id); expect(pl.dead).toBeUndefined();
  });
  it('no child → spouse inherits; nobody → hazine; then a new character with the same login', () => {
    const w = setup(); w.day = 400; const a = add(w, 'Koca', false, 40), b = add(w, 'Karı', true, 38); wed(w, a, b); a.money = 100; const b0 = b.money;
    die(w, a, 'x'); expect(b.money - b0).toBeCloseTo(90, 0);
    const me = findPerson(w, w.players.u2!.personId)!; me.money = 100; const t0 = w.treasury;
    die(w, me, 'y'); expect(w.treasury - t0).toBeCloseTo(100, 0); expect(w.players.u2!.dead!.heirs).toEqual([]);
    const r = act(w, 'u2', { t: 'newCharacter', name: 'Yeniden Doğan' } as never, T0); expect(r.ok).toBe(true);
    const np = findPerson(w, w.players.u2!.personId)!; expect(np.name).toBe('Yeniden Doğan'); expect(np.genderSet).toBeFalsy();
  });
  it('the Kayzer dies → adult heir takes the throne; founder keeps admin rights', () => {
    const w = setup(); w.day = 400; const k = findPerson(w, w.kayzerId)!; const son = add(w, 'Şehzade', false, 20); son.parents = [k.id];
    die(w, k, 'z'); expect(w.kayzerId).toBe(son.id); expect(w.players.f!.founder).toBe(true);
    const k2 = findPerson(w, w.kayzerId)!; die(w, k2, 'z2'); expect(findPerson(w, w.kayzerId)?.prof).toBe('naip');
  });
});
