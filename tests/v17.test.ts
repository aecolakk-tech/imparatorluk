import { describe, expect, it, beforeEach } from 'vitest';
import { rules } from '../src/sim/move';
import { createWorld, joinWorld, touchPlayer, findPerson, applyAction } from '../src/sim/index';
import type { World, Person } from '../src/sim/index';
import { parseIntent, decideOrder, handleOrder, sanitizeOrder, runTasks } from '../src/sim/orders';
import { realtime, CUSTODY_MS } from '../src/sim/v16';
import { makeChat, resetWorld, act, llmOrder } from '../src/server/core';
import { inCustody, placeOf } from '../src/sim/place';
import { arrest } from '../src/sim/life';

const T0 = 1_700_000_000_000;
function setup(): World { const w = createWorld(5, T0); joinWorld(w, 'f', 'Enes', 'kayzer', true, T0); joinWorld(w, 'u2', 'Alparslan', 'hamal', false, T0); touchPlayer(w, 'f', T0); touchPlayer(w, 'u2', T0); w.serverNow = T0; for (const p of w.people) p.protectedUntil = 0; return w; }
const K = (w: World): Person => findPerson(w, w.kayzerId)!;
const U = (w: World): Person => findPerson(w, w.players.u2!.personId)!;
const npc = (w: World, prof: string, not?: string): Person => w.people.find((p) => p.prof === prof && !p.playerId && p.id !== not)!;
function runUntil(w: World, cond: () => boolean, start: number, ms = 240_000): number { let now = start; while (now < start + ms && !cond()) { now += 1000; touchPlayer(w, 'f', now); touchPlayer(w, 'u2', now); realtime(w, now); } return now; }
beforeEach(() => { rules.reach = false; });

describe('intent parser', () => {
  it('understands orders in Turkish', () => {
    const w = setup(); const a = npc(w, 'asker'); const k = K(w);
    const o = parseIntent(w, a, k, 'git başka askeri öldür')!; expect(o.type).toBe('kill'); expect(findPerson(w, o.targetId)!.prof).toBe('asker'); expect(o.targetId).not.toBe(a.id);
    expect(parseIntent(w, a, k, 'beni takip et')!.type).toBe('follow');
    expect(parseIntent(w, a, k, 'pazara git')!).toMatchObject({ type: 'go', place: 'pazar' });
    expect(parseIntent(w, npc(w, 'firinci'), k, 'bana 3 ekmek sat')!).toMatchObject({ type: 'sell', item: 'ekmek', amount: 3, targetId: k.id });
    expect(parseIntent(w, a, k, 'merhaba dayı nabıyon')).toBeNull();
    expect(parseIntent(w, a, k, 'ekmek kaç para')).toBeNull();
  });
  it('sanitizes LLM actions to the whitelist', () => {
    const w = setup(); const a = npc(w, 'asker'); const k = K(w);
    expect(sanitizeOrder(w, a, k, { type: 'launch_nukes' })).toBeNull();
    expect(sanitizeOrder(w, a, k, { type: 'follow', target: 'ben' })!.targetId).toBe(k.id);
  });
});

describe('acceptance by game rules', () => {
  it('soldiers always obey the Kayzer – even an honest, pious one – unless in rebellion', () => {
    const w = setup(); const a = npc(w, 'asker'); const b = npc(w, 'asker', a.id); a.honesty = 100; a.din = 100; a.loyalty = 5;
    expect(decideOrder(w, a, K(w), { type: 'kill', targetId: b.id }).ok).toBe(true);
    w.isyan = { rebels: [a.id] } as never; expect(decideOrder(w, a, K(w), { type: 'kill', targetId: b.id }).code).toBe('isyan');
  });
  it('a stranger cannot order a soldier to murder; citizens do reasonable favours', () => {
    const w = setup(); const a = npc(w, 'asker'); const b = npc(w, 'asker', a.id); a.honesty = 60; a.din = 60;
    expect(decideOrder(w, a, U(w), { type: 'kill', targetId: b.id }).ok).toBe(false);
    const f = npc(w, 'firinci'); expect(decideOrder(w, f, U(w), { type: 'follow', targetId: U(w).id }).ok).toBe(true);
    expect(decideOrder(w, f, U(w), { type: 'go', place: 'pazar' }).ok).toBe(true);
  });
  it('the reply matches the outcome', () => {
    const w = setup(); const a = npc(w, 'asker'); const b = npc(w, 'asker', a.id);
    const yes = handleOrder(w, K(w), a, { type: 'kill', targetId: b.id }, '', T0); expect(yes.reply).toMatch(/Emredersiniz/);
    const c = npc(w, 'imam'); const no = handleOrder(w, U(w), c, { type: 'kill', targetId: b.id }, '', T0); expect(no.d.ok).toBe(false); expect(no.reply).not.toMatch(/Emredersiniz|Tamam|Peki/);
  });
});

describe('orders are carried out', () => {
  it('Kayzer DMs “git başka askeri öldür” → the soldier walks there and kills (or badly wounds) him; crime system runs', () => {
    const w = setup(); const a = npc(w, 'asker');
    makeChat(w, 'f', 'git başka askeri öldür', a.id, [], T0, false);
    expect(a.task?.type).toBe('kill'); const victimId = a.task!.targetId!; const v0 = findPerson(w, victimId)!;
    expect(w.chatOut.some((m) => m.fromPersonId === a.id && /Emredersiniz/.test(m.text))).toBe(true);
    const end = runUntil(w, () => a.task?.status !== 'yolda', T0);
    expect(a.task?.status === 'bitti' || a.task?.status === 'basarisiz').toBe(true);
    const dead = !w.people.includes(v0); expect(dead || v0.wounded).toBe(true);
    if (dead) { expect(w.corpses!.some((c) => c.killerId === a.id)).toBe(true); runUntil(w, () => w.corpses!.every((c) => c.stage !== 'yerde'), end, 120_000); }
    expect(a.lastAction === 'emirle cinayet' || v0.wounded).toBe(true);
  });
  it('a caught hired hand may reveal the Kayzer → loyalty falls, republic rises', () => {
    const w = setup(); const a = npc(w, 'hamal'); const k = K(w);
    a.orderedBy = { by: k.id, crime: 'cinayet', victimId: null, day: w.day };
    const loy0 = w.people.reduce((s, p) => s + p.loyalty, 0); let revealed = false;
    for (let i = 0; i < 10 && !revealed; i++) { arrest(w, a, 'cinayet', null, 0); revealed = !a.orderedBy; if (!revealed) a.jailedDays = 0; }
    expect(revealed).toBe(true); expect(w.people.reduce((s, p) => s + p.loyalty, 0)).toBeLessThan(loy0); expect(w.events.some((e) => /SKANDAL/.test(e.text))).toBe(true);
  });
  it('follow, sell and go work and show on the card', () => {
    const w = setup(); const f = npc(w, 'firinci'); f.inv.ekmek = 10; const u = U(w); u.money = 100;
    const r = handleOrder(w, u, f, { type: 'sell', item: 'ekmek', amount: 2, targetId: u.id }, '', T0); expect(r.d.ok).toBe(true); expect(f.task!.label).toMatch(/Ekmek/);
    runUntil(w, () => f.task?.status !== 'yolda', T0); expect(f.task?.status).toBe('bitti'); expect(u.inv.ekmek).toBeGreaterThanOrEqual(2);
    const h2 = npc(w, 'hamal'); handleOrder(w, u, h2, { type: 'follow', targetId: u.id }, '', T0); runTasks(w, T0 + 20_000); expect(h2.task?.status).toBe('yolda');
  });
  it('the LLM path goes through the same rules', () => {
    const w = setup(); const im = npc(w, 'imam'); im.honesty = 95; im.din = 95; const b = npc(w, 'hamal');
    expect(llmOrder(w, 'u2', im.id, { type: 'kill', target: b.name }, 'öldür', T0)!.ok).toBe(false);
    expect(llmOrder(w, 'f', npc(w, 'bekci').id, { type: 'arrest', target: b.name }, 'tutukla', T0)!.ok).toBe(true);
  });
});

describe('caught player: custody → trial → verdict → only then zindan', () => {
  it('never jumps straight to the zindan', () => {
    const w = setup(); const u = U(w); const v = npc(w, 'hamal');
    const r = act(w, 'u2', { t: 'kill', personId: v.id }, T0 + 1000);
    expect(r.ok).toBe(true);
    if (!w.arrests.some((a) => a.criminalId === u.id)) arrest(w, u, 'cinayet', v.id, 0);
    expect(inCustody(w, u)).toBe(true);
    const q = placeOf(w, u.id, T0 + 2000)!; const mh = w.buildings.find((b) => b.id === 'mahkeme')!; expect(Math.hypot(q.x - mh.door.x, q.y - mh.door.y)).toBeLessThan(4);
    const t1 = runUntil(w, () => w.cases.some((c) => c.accusedId === u.id && !!c.trial), T0 + 2000, CUSTODY_MS + 10_000);
    const c = w.cases.find((x) => x.accusedId === u.id && x.trial)!; expect(c).toBeTruthy(); expect(c.trial!.done).toBe(false);
    expect(act(w, 'u2', { t: 'defense', caseId: c.id, text: 'Masumum, nefsi müdafaaydı.' }, t1 + 100).ok).toBe(true);
    act(w, 'u2', { t: 'restCase', caseId: c.id }, t1 + 200); expect(c.trial!.done).toBe(true); expect(c.trial!.verdictText).toBeTruthy();
  });
});

describe('admin reset', () => {
  it('builds a fresh world and keeps the accounts', () => {
    const w = setup(); w.day = 50; const ids = resetWorld(w, T0); expect(w.day).toBeLessThan(3); expect(Object.keys(ids)).toHaveLength(2); expect(findPerson(w, ids.f!)!.id).toBe(w.kayzerId); expect(findPerson(w, ids.u2!)!.prof).toBe('hamal');
  });
});
void applyAction;

describe('costs of cruel orders', () => {
  it('obeying lowers morale; a broken soldier deserts instead of refusing', () => {
    const w = setup(); const a = npc(w, 'asker'); const v = npc(w, 'hamal'); v.rep = 20; a.loyalty = 60;
    handleOrder(w, K(w), a, { type: 'kill', targetId: v.id }, '', T0); expect(a.task).toBeTruthy(); expect(a.loyalty).toBeLessThan(60);
    const b = npc(w, 'asker', a.id); b.loyalty = 10; const r = handleOrder(w, K(w), b, { type: 'kill', targetId: v.id }, '', T0);
    expect(r.d.code).toBe('firar'); expect(b.prof).not.toBe('asker'); expect(w.events.some((e) => /firar|kaçıp/.test(e.text))).toBe(true);
  });
});

describe('player goals and Kayzer missions', () => {
  it('a goal completes with title + reward; a mission is claimed and paid', async () => {
    const { goalsDay } = await import('../src/sim/goals');
    const w = setup(); const u = U(w);
    expect(applyAction(w, 'u2', { t: 'setGoal', goal: 'tuccar' }, T0).ok).toBe(true);
    u.money = 2500; goalsDay(w); expect(u.titles).toContain('Zengin Tüccar'); expect(u.money).toBeGreaterThan(2500);
    expect(applyAction(w, 'f', { t: 'missionCreate', text: 'Limana 20 odun getir', reward: 80, to: u.id }, T0).ok).toBe(true);
    const m = w.missions![0]!; applyAction(w, 'u2', { t: 'missionClaim', id: m.id }, T0); expect(m.status).toBe('bildirildi');
    const before = u.money; applyAction(w, 'f', { t: 'missionPay', id: m.id, pay: true }, T0); expect(m.status).toBe('odendi'); expect(u.money).toBe(before + 80);
    expect(applyAction(w, 'u2', { t: 'missionCreate', text: 'x yap', reward: 1, to: null }, T0).ok).toBe(false);
  });
});
