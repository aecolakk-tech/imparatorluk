import { describe, expect, it } from 'vitest';
import { createWorld, joinWorld, touchPlayer } from '../src/sim/index';
import type { World } from '../src/sim/index';
import { act, heartbeat } from '../src/server/core';
import { applyView, haveOf, makeView, type WorldView } from '../src/server/view';
import { ViewCache } from '../src/backend/viewcache';
import { MockBackend } from '../src/backend/mock';

const T0 = 1_700_000_000_000;
const wire = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
function setup(): World { const w = createWorld(7, T0); joinWorld(w, 'f', 'Enes', 'kayzer', true, T0); joinWorld(w, 'u2', 'Testoğlu', 'hamal', false, T0); touchPlayer(w, 'u2', T0); return w; }
const sortKeys = (x: unknown): unknown => Array.isArray(x) ? x.map(sortKeys) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sortKeys((x as Record<string, unknown>)[k])])) : x;
/** what the client should end up with: the full slim view, built from scratch */
const truth = (w: World, uid: string): string => JSON.stringify(sortKeys(applyView(null, null, wire(makeView(w, uid, null)))));

describe('v2.0.5 slim world view', () => {
  it('deltas rebuild exactly the server view over hours of play (patches, new/removed people, actions)', () => {
    const w = setup(); let cw: World | null = null; let v: WorldView | null = null; let now = T0; let small = 0;
    for (let i = 0; i < 400; i++) {
      now += 6000; heartbeat(w, 'u2', now);
      if (i % 7 === 3) act(w, 'u2', { t: 'work' } as never, now);
      const nv: WorldView = wire(makeView(w, 'u2', haveOf(v)));
      if (i > 0 && JSON.stringify(nv).length < 30_000) small++;
      const nw = applyView(cw, v, nv); expect(nw, `step ${i}`).not.toBeNull(); cw = wire(nw); v = nv;
      if (i % 50 === 0 || i === 399) expect(JSON.stringify(sortKeys(cw))).toBe(truth(w, 'u2'));
    }
    expect(small).toBeGreaterThan(200); // most heartbeats are deltas
  });
  it('server-only data is not sent; the ledger holds only my rows', () => {
    const w = setup(); w.posLog = { p1: [[1, 2, 3]] }; heartbeat(w, 'u2', T0 + 1000);
    const me = w.players.u2!.personId; w.ledger.push({ day: w.day, from: 'dis', to: me, amount: 1, reason: 'test' } as never, { day: w.day, from: 'dis', to: 'zzz', amount: 2, reason: 'baska' } as never);
    const cw = applyView(null, null, wire(makeView(w, 'u2', null)))!;
    expect(cw.posLog).toBeUndefined();
    expect(cw.ledger.length).toBeGreaterThan(0); expect(cw.ledger.every((l) => l.from === me || l.to === me)).toBe(true);
    expect(cw.people.length).toBe(w.people.length);
  });
  it('the position log reaches only an accused on trial (Tanık çağır picker needs it)', () => {
    const w = setup(); w.posLog = { p1: [[1, 2, 3]] }; const me = w.players.u2!.personId;
    expect(applyView(null, null, wire(makeView(w, 'u2', null)))!.posLog).toBeUndefined();
    w.cases.push({ id: 'C1', accusedId: me, crime: 'hirsizlik', victimId: null, amount: 0, evidence: 1, stage: 'dava', day: w.day, deadline: w.day + 2, trial: { msgs: [] } } as never);
    expect(applyView(null, null, wire(makeView(w, 'u2', null)))!.posLog).toEqual(w.posLog);
    expect(applyView(null, null, wire(makeView(w, 'f', null)))!.posLog).toBeUndefined();
  });
  it('a delta computed against a base the client no longer holds is refused (→ full view), never half-applied', () => {
    const w = setup(); const v0 = wire(makeView(w, 'u2', null)); const c0 = applyView(null, null, v0)!;
    heartbeat(w, 'u2', T0 + 4 * 3600_000); const v1 = wire(makeView(w, 'u2', haveOf(v0))); const c1 = applyView(c0, v0, v1)!;
    heartbeat(w, 'u2', T0 + 8 * 3600_000);
    const stale = wire(makeView(w, 'u2', haveOf(v0))); // answered against v0 while the client already moved to v1
    const r = applyView(c1, v1, stale);
    if (r) expect(JSON.stringify(sortKeys(r))).toBe(truth(w, 'u2')); // only accepted when it is fully consistent
  });
  it('ViewCache ignores an older answer that overtakes a newer one and hands an action\'s world over once', () => {
    const w = setup(); const vc = new ViewCache();
    vc.take({ ...wire(makeView(w, 'u2', null)), ver: 5 });
    heartbeat(w, 'u2', T0 + 3600_000);
    const newer = vc.take({ ...wire(makeView(w, 'u2', vc.have())), ver: 7 }, true);
    expect(vc.take({ ...wire(makeView(w, 'u2', null)), ver: 6 })).toBe(newer);
    expect(vc.takeFresh()).toBe(newer); expect(vc.takeFresh()).toBeNull();
  });
  it('mock backend speaks the same protocol: heartbeat + action answer with a usable world', async () => {
    const mem = new Map<string, string>(); const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    let t = T0; const be = new MockBackend(st, () => t);
    expect(await be.register('imparator', 'a@b.cd', 'gizli123', 'Deneme Kişi', 'hamal')).toBeNull();
    const a = await be.heartbeat(); expect(a.world.people.length).toBeGreaterThan(50);
    t += 6000; const b = await be.heartbeat(); expect(b.world.people.length).toBe(a.world.people.length);
    const r = await be.act({ t: 'work' } as never); expect(typeof r.msg).toBe('string'); expect((r as { view?: unknown }).view).toBeUndefined();
    expect(be.takeFresh()).not.toBeNull(); expect(be.takeFresh()).toBeNull();
  });
});
