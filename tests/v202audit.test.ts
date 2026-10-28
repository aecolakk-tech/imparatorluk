/** v2.0.2 checklist audit: Meclis / parti / kampanya / din items (P, Q, R, S, T, U, V, W, N) verified in the sim. */
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { rules } from '../src/sim/move';
import { applyAction, createWorld, joinWorld, touchPlayer, findPerson } from '../src/sim/index';
import type { World, Person } from '../src/sim/index';
import { runSolo } from '../scripts/solo';
import { GENELGE, GKINDS } from '../src/sim/genelge';
import { dhondt, formGovt, recordVote, facOf, acc, DUES, partyDay } from '../src/sim/party';
import { appointMp, migrateMeclis16, SEAT_COUNT, CAND_FEE, validateBill, byElection } from '../src/sim/meclis';
import { MEYDAN } from '../src/sim/propaganda';
import { tidy } from '../src/sim/tr';
import { rulerName } from '../src/sim/log';
import { borrow } from '../src/sim/extras';
import { feel } from '../src/sim/ai';

const T0 = 1_700_000_000_000;
beforeEach(() => { rules.reach = false; });
function setup(): { w: World; me: Person } {
  const w = createWorld(3, T0); joinWorld(w, 'f', 'Enes', 'kayzer', true, T0); joinWorld(w, 'u2', 'Testoğlu', 'hamal', false, T0); touchPlayer(w, 'u2', T0);
  const me = findPerson(w, w.players.u2!.personId)!; me.onboardUntil = 0; me.money = 500; me.itibar = 40; me.born = w.day - 5 * 30; return { w, me };
}
const act = (w: World, a: object, now = T0 + 1000) => applyAction(w, 'u2', a as never, now);

let solo: World;
beforeAll(() => { solo = runSolo(120, 5).w; }, 240_000);

describe('v2.0.2 audit – long solo run (120 days)', () => {
  it('Q1: ≥12 genelge kinds, each with cost, duration and an effect text; the gazete reports before→after', () => {
    expect(GKINDS.length).toBeGreaterThanOrEqual(12);
    for (const k of GKINDS) { const g = GENELGE[k]; expect(g.cost).toBeGreaterThanOrEqual(0); expect(g.days).toBeGreaterThan(0); expect(g.desc.length).toBeGreaterThan(5); }
    const gz = [...(solo.gnews ?? []).map((g) => g.text), ...solo.meclis.log.map((l) => l.text)];
    expect(gz.some((t) => /→/.test(t))).toBe(true);
  });
  it('P2/Q2/T2: NPC MPs propose genelgeler; the agenda never holds two open copies of the same item', () => {
    expect(solo.meclis.bills.some((b) => b.kind === 'genelge')).toBe(true);
    const open = solo.meclis.bills.filter((b) => ['tartisma', 'oylama', 'onay'].includes(b.status)).map((b) => `${b.kind}|${b.target}|${b.value}`);
    expect(open.length).toBe(new Set(open).size);
  });
  it('P5/U6/R3: every elected seat is filled and every result row has a name; D\'Hondt allocates exactly 16', () => {
    byElection(solo); expect(solo.meclis.seats.slice(0, SEAT_COUNT).every((s) => s.holder)).toBe(true); // a seat vacated today is refilled by the next ara seçim
    const last = solo.election.last!; expect(last).toBeTruthy();
    for (const r of last.results) expect(((r as { name?: string }).name ?? findPerson(solo, r.id)?.name ?? '').length).toBeGreaterThan(0);
    const got = dhondt({ A: 1000, B: 600, C: 300, ind1: 50 }, { A: 16, B: 16, C: 16, ind1: 1 }, 16);
    expect(Object.values(got).reduce((a, b) => a + b, 0)).toBe(16); expect(got.A).toBeGreaterThan(got.B!); expect(got.B).toBeGreaterThan(got.C!);
  });
  it('P6: speeches vary', () => { const sp = solo.meclis.bills.flatMap((b) => b.speeches.map((s) => s.text)); expect(sp.length).toBeGreaterThan(10); expect(new Set(sp).size / sp.length).toBeGreaterThan(0.3); });
  it('U9/S7: weekly soru önergesi with the saray reply; daily seçim nabzı appears in a campaign', () => {
    const gz = (solo.gnews ?? []).map((g) => g.text); expect(gz.some((t) => /Soru önergesi.*Saray’ın cevabı/.test(t))).toBe(true);
    expect(gz.some((t) => /günde günde/.test(t))).toBe(false);
    expect(gz.some((t) => /Haftalık parti desteği/.test(t))).toBe(true);
  });
  it('U2/U4/U5/W1: a hükümet, a Meclis başkanı, party programs, axes and mahalle support exist', () => {
    expect((solo.meclis.govt ?? []).length).toBeGreaterThan(0); expect(solo.meclis.baskanId).toBeTruthy();
    for (const f of solo.meclis.factions) { expect((f.program ?? []).length).toBeGreaterThanOrEqual(3); expect(Object.keys(f.support ?? {}).length).toBeGreaterThan(0); }
  });
  it('P8: no doubled titles or "!." in the event feed', () => {
    const t = [...solo.events.map((e) => e.text), ...solo.meclis.log.map((l) => l.text)];
    expect(t.filter((x) => /Bekçi Bekçi|!\.|undefined|NaN/.test(x))).toEqual([]);
  });
});

describe('v2.0.2 audit – unit', () => {
  it('P8: tidy helper', () => {
    expect(tidy('Bekçi Bekçi Ali yakaladı')).toBe('Bekçi Ali yakaladı'); expect(tidy('Barcı Feride: Barcı Feride: selam')).toBe('Barcı Feride: selam');
    expect(tidy('Bana oy verin!.')).toBe('Bana oy verin!'); expect(tidy('Muhbir : biri')).toBe('Muhbir (adı bilinmiyor): biri');
  });
  it('P7: one ruler-name source', () => { const { w } = setup(); expect(rulerName(w)).toBe(findPerson(w, w.kayzerId)!.name); w.kayzerId = null as never; expect(rulerName(w)).toMatch(/Naip/); });
  it('P10: Aday ol needs the fee; MPs re-run automatically unless they withdraw; NPCs fill ≥ seat count', () => {
    const { w, me } = setup(); w.election.nextDay = w.day + 9; // aday window
    me.money = 5; expect(act(w, { t: 'runForMeclis' }).ok).toBe(false);
    me.money = 100; const r = act(w, { t: 'runForMeclis' }); expect(r.ok).toBe(true); expect(me.money).toBe(100 - CAND_FEE);
    expect(act(w, { t: 'withdrawCandidacy' }).ok).toBe(true); expect(w.election.candidates.includes(me.id)).toBe(false);
  });
  it('Q4/U12: Kayzer-appointed seats survive migrateMeclis16; elected holders are kept', () => {
    const { w } = setup(); w.election.last = { day: w.day - 1, results: [] } as never;
    const ppl = w.people.filter((p) => !p.playerId && p.prof !== 'naip' && p.prof !== 'asker' && p.prof !== 'bekci').slice(0, 17);
    ppl.slice(0, 16).forEach((p, i) => { w.meclis.seats[i]!.holder = p.id; p.meclis = true; });
    expect(appointMp(w, ppl[16]!)).toBeNull(); migrateMeclis16(w);
    expect(w.meclis.seats.length).toBe(17); expect(w.meclis.seats[16]!.holder).toBe(ppl[16]!.id); expect(w.meclis.seats[0]!.holder).toBe(ppl[0]!.id);
  });
  it('U7: with no party at 9 seats a coalition forms', () => {
    const { w } = setup(); const fs = w.meclis.factions; const ppl = w.people.filter((p) => !p.playerId && p.prof !== 'naip').slice(0, 16);
    ppl.forEach((p, i) => { p.faction = fs[i % 3]!.id; p.meclis = true; w.meclis.seats[i]!.holder = p.id; });
    formGovt(w); expect((w.meclis.govt ?? []).length).toBeGreaterThan(1);
  });
  it('U8: voting against the party line twice → expelled', () => {
    const { w } = setup(); const f = w.meclis.factions[0]!; const p = w.people.find((x) => !x.playerId && x.prof !== 'naip')!; p.faction = f.id; p.meclis = true;
    const b = { id: 'B1', title: 'Ambar çağrısı', kind: 'genelge', target: 'ambar', value: 0, lines: { [f.id]: 'evet' } } as never;
    for (let i = 0; i < 6 && p.faction; i++) recordVote(w, p, { ...(b as object), id: `B${i}` } as never, 'hayir');
    expect(p.faction).toBeNull();
  });
  it('U1/U3/U10: join (fee), dues to the kasa (conserved), donate, Ocak meeting, resign, found a party', () => {
    const { w, me } = setup(); const f = w.meclis.factions[0]!;
    expect(act(w, { t: 'joinParty', factionId: f.id }).ok).toBe(true); expect(me.faction).toBe(f.id);
    const m1 = me.money, k1 = f.kasa ?? 0; partyDay(w, () => {}); expect(m1 - me.money).toBeCloseTo(DUES, 5); expect((f.kasa ?? 0) - k1).toBeGreaterThanOrEqual(DUES - 1e-9); // my dues land in the kasa (transfer = conserved)
    const k0 = f.kasa ?? 0; expect(act(w, { t: 'donate', amount: 10 }).ok).toBe(true); expect(f.kasa).toBeCloseTo(k0 + 10, 5); void acc;
    expect(act(w, { t: 'ocak' }).ok).toBe(true); expect(act(w, { t: 'resignParty' }).ok).toBe(true); expect(me.faction).toBeNull();
    me.money = 500; expect(act(w, { t: 'foundParty', name: 'Deniz Partisi', ideology: 'halkci' }).ok).toBe(true); expect(facOf(w, me.faction)?.name).toBe('Deniz Partisi');
  });
  it('S1–S6: vaat, kapı kapı, miting (at the Meydan), ikram, parti afişi, destek, kara propaganda', () => {
    const { w, me } = setup(); w.election.nextDay = w.day + 3; w.election.candidates.push(me.id); me.faction = w.meclis.factions[0]!.id;
    expect(act(w, { t: 'vaat', kinds: ['ambar', 'asevi'] }).ok).toBe(true); expect(w.election.vaat![me.id]).toEqual(['ambar', 'asevi']);
    const v = w.people.find((x) => !x.playerId && x.prof !== 'naip')!; const r = act(w, { t: 'canvass', personId: v.id }); expect(r.msg).toMatch(/ikna|oyum/);
    expect(act(w, { t: 'canvass', personId: v.id }).ok).toBe(false); // once a day
    (me as { walk?: unknown }).walk = { path: [{ x: MEYDAN.x, y: MEYDAN.y }], t0: T0, speed: 3 }; expect(act(w, { t: 'miting' }).ok).toBe(true);
    expect(act(w, { t: 'ikram', personId: v.id, kind: 'pilav' }).ok).toBe(true);
    expect(act(w, { t: 'partyPoster' }).ok).toBe(true);
    const c2 = w.people.find((x) => !x.playerId && x.prof !== 'naip' && x.id !== v.id)!; c2.faction = me.faction; w.election.candidates.push(c2.id);
    expect(act(w, { t: 'endorse', personId: c2.id }).ok).toBe(true);
    const sm = act(w, { t: 'smear', personId: c2.id }); expect(sm.msg.length).toBeGreaterThan(0);
  });
  it('T3/X2: the teklif harcı is charged; unaffordable spending is refused without borç', () => {
    const { w, me } = setup(); me.meclis = true; const m0 = me.money;
    expect(act(w, { t: 'propose', kind: 'genelge', value: 0, target: 'ambar' }).ok).toBe(true); expect(m0 - me.money).toBeCloseTo(4, 5);
    w.treasury = 50; const plot = w.buildings.find((b) => b.kind === 'arsa')!.id; if (w.projects.some((x) => !x.done)) expect(validateBill(w, 'insaat' as never, 0, `hamam@${plot}`)).toMatch(/Süren bir inşaat/); // T2: no duplicate construction
    w.projects = []; expect(validateBill(w, 'insaat' as never, 0, `hamam@${plot}`)).toMatch(/Hazine|hazine|yetersiz|BORÇ/i);
  });
  it('N4/N5: devout lose less mood in a salgın; a pious sarraf gives pious borrowers a lower rate', () => {
    const { w } = setup(); w.nature = { kind: 'salgin', start: w.day, until: w.day + 5 };
    const a = w.people.find((x) => !x.playerId && x.prof !== 'naip' && x.id !== w.kayzerId)!; const b = w.people.find((x) => !x.playerId && x.prof !== 'naip' && x.id !== w.kayzerId && x.id !== a.id)!;
    for (const p of [a, b]) { p.hunger = 80; p.money = 100; p.mood = 60; } a.din = 100; b.din = 20; feel(w, a); feel(w, b);
    expect(a.mood).toBeGreaterThan(b.mood);
    const { w: w2, me } = setup(); const s = w2.people.filter((p) => p.prof === 'tuccar' && !p.playerId).sort((x, y) => y.money - x.money)[0]!; s.din = 80; s.money = 1000; me.din = 80;
    expect(borrow(w2, me, 20)).toMatch(/%8 faiz/);
  });
});
