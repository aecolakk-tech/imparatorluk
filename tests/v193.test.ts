import { describe, expect, it, afterEach } from 'vitest';
import { rules } from '../src/sim/move';
import { createWorld, joinWorld, touchPlayer, findPerson, applyAction } from '../src/sim/index';
import type { World, Person } from '../src/sim/index';
import { placePeople } from '../src/sim/place';
import { placeAnimals } from '../src/sim/herdpos';
import { hourMs } from '../src/sim/tick';
import { fixPen } from '../src/sim/realm';

const T0 = 1_700_000_000_000;
function setup(): World { const w = createWorld(5, T0); joinWorld(w, 'f', 'Enes', 'kayzer', true, T0); joinWorld(w, 'u2', 'Alparslan', 'hamal', false, T0); touchPlayer(w, 'f', T0); touchPlayer(w, 'u2', T0); w.serverNow = T0; w.frozen = false; for (const p of w.people) p.protectedUntil = 0; return w; }
const U = (w: World): Person => findPerson(w, w.players.u2!.personId)!;
afterEach(() => { rules.reach = false; });

describe('v1.9.3', () => {
  it('the clock keeps running between snapshots: no NPC freezes at hour+0.999', () => {
    const w = setup(); w.lastTickAt = T0; const hm = hourMs(w);
    const a = placePeople(w, T0 + hm * 1.2), b = placePeople(w, T0 + hm * 1.2 + 50);
    const moved = a.filter((q, i) => q.visible && q.moving && Math.hypot(q.x - b[i]!.x, q.y - b[i]!.y) > 0.001).length;
    expect(moved).toBeGreaterThan(0);
  });
  it('NPCs walk at a human pace (no sprinting legs) through a whole day', () => {
    const w = setup(); w.lastTickAt = T0; const hm = hourMs(w); let prev = placePeople(w, T0); let bad = 0, n = 0;
    for (let t = T0 + 100; t < T0 + hm * 24; t += 100) { const cur = placePeople(w, t); cur.forEach((q, i) => { const o = prev[i]!; if (q.visible && o.visible) { n++; if (Math.hypot(q.x - o.x, q.y - o.y) > 0.5) bad++; } }); prev = cur; }
    expect(bad / n).toBeLessThan(0.0005);
  });
  it('the Hayvan Pazarı pen overlaps no building', () => {
    const w = setup(); const h = w.buildings.find((b) => b.id === 'hayvan')!;
    expect(w.buildings.filter((o) => o !== h && h.x < o.x + o.w && h.x + h.w > o.x && h.y < o.y + o.h && h.y + h.h > o.y)).toEqual([]);
    h.y = 37; h.h = 5; fixPen(w); expect(w.buildings.filter((o) => o !== h && h.x < o.x + o.w && h.x + h.w > o.x && h.y < o.y + o.h && h.y + h.h > o.y)).toEqual([]);
  });
  it('ride/slaughter need you next to YOUR animal', () => {
    const w = setup(); const u = U(w); u.animals = { inek: 0, koyun: 1, tavuk: 0, at: 1 }; u.farm = false; rules.reach = true; u.walk = { path: [{ x: 50, y: 21 }, { x: 50.01, y: 21 }], t0: T0 - 10_000, speed: 3.6 };
    const r = applyAction(w, 'u2', { t: 'ride', on: true }, T0); expect(r.ok).toBe(false);
    const horse = placeAnimals(w, T0).find((a) => a.owner === u.id && a.kind === 'at')!;
    u.walk = { path: [{ x: horse.x, y: horse.y }, { x: horse.x + 0.01, y: horse.y }], t0: T0 - 10_000, speed: 3.6 };
    expect(applyAction(w, 'u2', { t: 'ride', on: true }, T0).ok).toBe(true); expect(u.riding).toBe(true);
    const other = w.people.find((p) => p.prof === 'hayvanci')!; const before = other.animals!.koyun;
    expect(applyAction(w, 'u2', { t: 'slaughter', animal: 'inek' }, T0).ok).toBe(false); expect(other.animals!.koyun).toBe(before);
  });
});
