import { describe, expect, it } from 'vitest';
import { createWorld, joinWorld, touchPlayer, findPerson } from '../src/sim/index';
import { naturalAlong, paceOf, NPC_SPEED, placePeople, TALK_MS } from '../src/sim/place';
import { isGhostClick, invisibleBox, staleFlag } from '../src/ui/guard';
import { DAY_MS, DAY_HOUR_MS, NIGHT_HOUR_MS } from '../src/sim/constants';

const T0 = 1_700_000_000_000;
describe('v2.0.3 freeze / input guards', () => {
  it('the tap that opened a panel never lands on it; later taps and keyboard clicks do', () => {
    expect(isGhostClick(1000, 900, 1100, 1)).toBe(true);   // press began before the panel was born
    expect(isGhostClick(1000, 1200, 1300, 1)).toBe(false); // a fresh press on the open panel
    expect(isGhostClick(1000, 900, 1100, 0)).toBe(false);  // keyboard (Enter) click
    expect(isGhostClick(1000, 900, 2500, 1)).toBe(false);  // long after: never swallow
  });
  it('invisible modals are detected; press flags self-clear', () => {
    expect(invisibleBox(null)).toBe(true); expect(invisibleBox({ width: 0, height: 0 })).toBe(true);
    expect(invisibleBox({ width: 300, height: 200 }, 'block', 'visible', '0')).toBe(true);
    expect(invisibleBox({ width: 300, height: 200 }, 'block', 'visible', '1')).toBe(false);
    expect(staleFlag(true, 0, 9000, 8000)).toBe(true); expect(staleFlag(true, 5000, 9000, 8000)).toBe(false); expect(staleFlag(false, 0, 99999, 8000)).toBe(false);
  });
});
describe('v2.0.3 day length', () => {
  it('a day is 18 real minutes: 15 min daytime (06–22) + 3 min evening/night', () => {
    expect(DAY_MS).toBe(18 * 60_000); expect(DAY_HOUR_MS * 16).toBe(15 * 60_000); expect(NIGHT_HOUR_MS * 8).toBe(3 * 60_000);
  });
});
describe('v2.0.3 natural NPC walking', () => {
  const path = [{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 8 }]; const len = 18;
  it('starts and ends exactly on the path ends; corners are cut on a curve; no jumps', () => {
    const a = naturalAlong(path, 0, len, 1234, T0), z = naturalAlong(path, len, len, 1234, T0);
    expect(a.x).toBeCloseTo(0, 5); expect(a.y).toBeCloseTo(0, 5); expect(z.x).toBeCloseTo(10, 5); expect(z.y).toBeCloseTo(8, 5);
    const c = naturalAlong(path, 5, len, 1234, T0); expect(Math.hypot(c.x - 0, c.y - 5)).toBeGreaterThan(0.05); // the corner is rounded
    let prev = a; for (let d = 0.1; d <= len; d += 0.1) { const q = naturalAlong(path, d, len, 1234, T0 + d * 400); expect(Math.hypot(q.x - prev.x, q.y - prev.y)).toBeLessThan(0.35); prev = q; }
  });
  it('people keep their own lane and pace', () => {
    const p1 = naturalAlong(path, 9, len, 7, T0), p2 = naturalAlong(path, 9, len, 7 + 16 * 37, T0);
    expect(Math.abs(p1.y - p2.y) + Math.abs(p1.x - p2.x)).toBeGreaterThan(0.01);
    for (let h = 0; h < 200; h++) { expect(paceOf(h)).toBeGreaterThanOrEqual(NPC_SPEED * 0.85); expect(paceOf(h)).toBeLessThanOrEqual(NPC_SPEED * 1.16); }
  });
});
describe('v2.0.3 NPC walks up to a standing player, then walks away', () => {
  it('toPlayer talk: the NPC comes next to the player; after the chat it eases back (no snap)', () => {
    const w = createWorld(3, T0); joinWorld(w, 'u2', 'Testoğlu', 'hamal', false, T0); touchPlayer(w, 'u2', T0);
    const me = findPerson(w, w.players.u2!.personId)!; const npc = w.people.find((p) => !p.playerId && p.prof !== 'naip' && p.jailedDays === 0)!;
    w.talks = [{ a: me.id, b: npc.id, text: 'Selam', lines: ['Selam'], day: w.day, hour: w.hour, at: T0 + 1000, toPlayer: true }];
    const at = (t: number) => { const all = placePeople(w, t); return { me: all.find((q) => q.p.id === me.id)!, npc: all.find((q) => q.p.id === npc.id)! }; };
    const s = at(T0 + 1000 + 8000); expect(Math.hypot(s.npc.x - (s.me.x + 0.95), s.npc.y - s.me.y)).toBeLessThan(0.05);
    const e1 = at(T0 + 1000 + TALK_MS + 100), e2 = at(T0 + 1000 + TALK_MS + 300);
    expect(Math.hypot(e1.npc.x - e2.npc.x, e1.npc.y - e2.npc.y)).toBeLessThan(0.5); // walking away, not teleporting
  });
});
