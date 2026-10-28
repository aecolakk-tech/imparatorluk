import { describe, expect, it, beforeEach } from 'vitest';
import { rules, findPath, walkGrid, walkEnd } from '../src/sim/move';
import { advanceWorld, applyAction, createWorld, DAY_MS, joinWorld, touchPlayer, findPerson } from '../src/sim/index';
import type { World, Person } from '../src/sim/index';
import { MAP_W } from '../src/sim/constants';
import { placeOf } from '../src/sim/place';
import { realtime, startTrial, myPos } from '../src/sim/v16';
import { act, makeChat } from '../src/server/core';
import { replyTo } from '../src/sim/chat';
import { openCase } from '../src/sim/ai';
import { electionDates, electionPhase } from '../src/sim/tick';

const T0 = 1_700_000_000_000;
function setup(): World { const w = createWorld(3, T0); joinWorld(w, 'f', 'Enes', 'kayzer', true, T0); joinWorld(w, 'u2', 'Ali', 'hamal', false, T0); touchPlayer(w, 'u2', T0); return w; }
beforeEach(() => { rules.reach = true; });

describe('movement', () => {
  it('A* never walks through a building', () => {
    const w = setup(); const g = walkGrid(w);
    const path = findPath(w, { x: 5, y: 13.5 }, { x: 60, y: 36 });
    expect(path.length).toBeGreaterThan(1);
    for (let i = 1; i < path.length; i++) { const a = path[i - 1]!, b = path[i]!; const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 4); for (let k = 0; k <= n; k++) { const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n; expect(g[Math.floor(y) * MAP_W + Math.floor(x)]).toBe(1); } }
  });
  it('interactions need the character at the building: walk there, then it works', () => {
    const w = setup(); const me = findPerson(w, w.players.u2!.personId)!;
    const kuyu = w.buildings.find((b) => b.id === 'kuyu')!;
    applyAction(w, 'u2', { t: 'move', x: 90, y: 14 }, T0); let now = walkEnd(me.walk!) + 10; touchPlayer(w, 'u2', now);
    const far = applyAction(w, 'u2', { t: 'drinkWater' }, now); expect(far.ok).toBe(false); expect(far.msg).toMatch(/yürümelisiniz/);
    applyAction(w, 'u2', { t: 'move', x: kuyu.door.x + 0.5, y: kuyu.door.y + 0.6 }, now); now = walkEnd(me.walk!) + 10; touchPlayer(w, 'u2', now);
    const p = myPos(w, me, now); expect(Math.hypot(p.x - kuyu.door.x - 0.5, p.y - kuyu.door.y - 0.6)).toBeLessThan(1);
    me.money = 50; const r = applyAction(w, 'u2', { t: 'drinkWater' }, now); expect(r.msg).not.toMatch(/yürümelisiniz/);
  });
  it('person actions need you next to the person', () => {
    const w = setup(); const v = w.people.find((p) => !p.playerId && p.prof === 'hamal')!;
    applyAction(w, 'u2', { t: 'move', x: 95, y: 5 }, T0); const now = walkEnd(findPerson(w, w.players.u2!.personId)!.walk!) + 10; touchPlayer(w, 'u2', now);
    expect(applyAction(w, 'u2', { t: 'insult', personId: v.id }, now).msg).toMatch(/yanına/);
  });
});

describe('murder → corpse → report → bekçi → case → trial → verdict', () => {
  it('runs the whole flow', () => {
    rules.reach = false;
    const w = setup(); const me = findPerson(w, w.players.u2!.personId)!; me.protectedUntil = 0;
    const v = w.people.find((p) => !p.playerId && p.prof === 'hamal' && p.id !== me.id)!; v.protectedUntil = 0;
    let now = T0 + 1000; w.serverNow = now;
    const r = act(w, 'u2', { t: 'kill', personId: v.id }, now); expect(r.ok).toBe(true);
    expect(w.people.includes(v)).toBe(false); const co = w.corpses![0]!; expect(co.stage).toBe('yerde'); expect(co.killerId).toBe(me.id);
    now += 60_000; touchPlayer(w, 'u2', now); touchPlayer(w, 'f', now); realtime(w, now); expect(co.stage).toBe('ihbar'); expect(co.bekciId).toBeTruthy();
    now += 60_000; realtime(w, now); expect(co.stage).toBe('inceleme');
    now += 5 * 60_000; realtime(w, now); expect((w.corpses ?? []).length).toBe(0); // removed after 5 real minutes
    // a case for the player goes to a real hearing
    w.cases = w.cases.filter((x) => x.accusedId !== me.id); openCase(w, me.id, 'cinayet', v.id, 0, 60); const c = w.cases[w.cases.length - 1]!; c.stage = 'hakim'; startTrial(w, c, now);
    expect(c.trial!.msgs.length).toBe(2);
    const dr = act(w, 'u2', { t: 'defense', caseId: c.id, text: 'Ben masumum, o gece evdeydim, tanığım komşum Hasan.' }, now + 1000); expect(dr.msg).toBe('');
    expect(c.trial!.msgs.filter((m) => m.who === 'hakim').length).toBe(2); expect(c.trial!.persuasion).toBeGreaterThan(0);
    act(w, 'u2', { t: 'restCase', caseId: c.id }, now + 2000);
    expect(c.trial!.done).toBe(true); expect(c.trial!.verdictText).toMatch(/SUÇLU|BERAAT/);
    if (c.verdict === 'suclu') { expect(me.jailedDays).toBeGreaterThan(0); expect(w.escorts!.length).toBe(1); }
  });
});

describe('rebellion trigger (bug: everyone republican, no isyan)', () => {
  it('a republican majority rises within a few days', () => {
    rules.reach = false;
    const w = setup(); let now = T0;
    let rose = false;
    for (let d = 0; d < 6 && !rose; d++) { for (const p of w.people) if (p.prof !== 'naip' && p.prof !== 'kayzer') p.republic = 95; for (let h = 0; h < 24; h++) { now += DAY_MS / 24; touchPlayer(w, 'f', now); advanceWorld(w, now); if (w.isyan || w.regime === 'cumhuriyet') rose = true; } }
    expect(rose).toBe(true);
  });
});

describe('elections', () => {
  it('slow calendar; soldiers and watchmen cannot stand', () => {
    rules.reach = false;
    const w = setup(); const d = electionDates(w); expect(d.vote - d.adayFrom).toBe(11); expect(w.election.nextDay).toBeGreaterThanOrEqual(25);
    w.day = d.adayFrom; expect(electionPhase(w).phase).toBe('aday');
    const me = findPerson(w, w.players.u2!.personId)!; me.prof = 'bekci';
    expect(applyAction(w, 'u2', { t: 'runForMeclis' }, T0).ok).toBe(false);
  });
});

describe('NPC replies', () => {
  it('always answer, and greet the Kayzer as İmparatorum', () => {
    rules.reach = false;
    const w = setup(); const k = findPerson(w, w.kayzerId)!; const n = w.people.find((p) => !p.playerId && p.prof === 'firinci')!;
    const t = replyTo(w, n, k, 'merhaba dayı nabıyon'); expect(t).toMatch(/İmparatorum/); expect(t.length).toBeGreaterThan(10);
    for (const q of ['?', 'ekmek kaç para', 'dedikodu var mı', 'asdfgh']) expect(replyTo(w, n, k, q).length).toBeGreaterThan(3);
    const m = makeChat(w, 'f', 'selam nasılsın', n.id, [], T0, false); expect(typeof m).not.toBe('string');
    expect(w.chatOut.some((x) => x.fromPersonId === n.id && x.toPersonId === k.id)).toBe(true);
    const d = makeChat(w, 'f', 'selam', n.id, [], T0 + 9000, true) as { replies?: unknown[] }; expect(d.replies?.length).toBe(1);
  });
});
void placeOf; void ({} as Person);

describe('v1.5 leftovers', () => {
  it('law preview shows real numbers on day 1', async () => {
    const { previewLaw } = await import('../src/sim/laws');
    const w = setup(); expect(previewLaw(w, { kind: 'satisVergisi', value: w.taxRate + 5 } as never)).not.toMatch(/≈ \+0 D/);
  });
  it('bread gets dearer in a drought', () => {
    rules.reach = false;
    const w = setup(); let now = T0; w.nature = { kind: 'kuraklik', start: w.day, until: w.day + 13 }; w.nextDrought = 9999; const b0 = w.prices.ekmek;
    for (let d = 0; d < 8; d++) for (let h = 0; h < 24; h++) { now += DAY_MS / 24; touchPlayer(w, 'f', now); advanceWorld(w, now); }
    expect(w.prices.ekmek).toBeGreaterThan(b0 * 1.2);
  });
});
