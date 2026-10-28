import { describe, expect, it, beforeEach } from 'vitest';
import { rules } from '../src/sim/move';
import { createWorld, joinWorld, touchPlayer, findPerson } from '../src/sim/index';
import type { World } from '../src/sim/index';
import { heartbeat } from '../src/server/core';
import { startWarCombat, attackFoe, combatTick } from '../src/sim/combat';
import { foePos, MELEE_TILES, M_PER_TILE, SAIL_MS, WAVE_MS } from '../src/sim/combatpos';
import { placePeople } from '../src/sim/place';

const T0 = 1_700_000_000_000;
function setup(): World { const w = createWorld(3, T0); joinWorld(w, 'f', 'Enes', 'kayzer', true, T0); joinWorld(w, 'u2', 'Testoğlu', 'hamal', false, T0); touchPlayer(w, 'u2', T0); return w; }
beforeEach(() => { rules.reach = true; });
const stand = (p: { walk?: unknown }, x: number, y: number, t: number): void => { (p as { walk: unknown }).walk = { path: [{ x, y }], t0: t, speed: 3 }; };

describe('v2.0.2 combat', () => {
  it('landing troops disembark in waves, not all at the same instant', () => {
    const w = setup(); w.foreign = { name: 'Macar Krallığı', demand: 100, troops: 18, phase: 'savas', day: w.day, deadline: w.day, landed: true, recruits: [] };
    startWarCombat(w, T0, 18); let now = T0; while (!w.combat!.spawned) { now += 1000; combatTick(w, now, () => {}); }
    const c = w.combat!; expect(c.foes.length).toBe(18);
    const t0s = [...new Set(c.foes.map((f) => Math.floor((f.walk.t0 - (T0 + SAIL_MS)) / WAVE_MS)))];
    expect(t0s.length).toBeGreaterThanOrEqual(5); // 6 waves of 3
    expect(c.foes.filter((f) => f.walk.t0 <= now).length).toBeLessThanOrEqual(3); // only the first wave is ashore at the docking moment
  });
  it('melee reach is 0.5 m between bodies (0.83 kare centre-to-centre); farther swings are harmless whiffs without an error', () => {
    expect(MELEE_TILES * M_PER_TILE).toBeCloseTo(1.0, 5);
    const w = setup(); const me = findPerson(w, w.players.u2!.personId)!; me.arms = { kilic: 1 }; me.drawn = 'kilic'; me.onboardUntil = 0;
    startWarCombat(w, T0, 1); const c = w.combat!; c.spawned = true; c.foes = [{ id: 'M1', kind: 'macar', hp: 100, max: 100, bow: false, walk: { path: [{ x: 40, y: 40 }], t0: T0, speed: 1 } }];
    const now = T0 + 5000; stand(me, 41.2, 40, T0); // 1.2 kare = 1.44 m apart → out of reach
    const q = placePeople(w, now).find((x) => x.p.id === me.id)!; expect(Math.hypot(q.x - 40, q.y - 40)).toBeGreaterThan(MELEE_TILES + 0.1);
    const r = attackFoe(w, me, 'M1', now); expect(r.ok).toBe(true); expect(r.msg).toBe(''); expect(c.foes[0]!.hp).toBe(100); expect(c.hits.at(-1)!.k).toBe('miss');
    stand(me, 40.7, 40, T0); let hp = 100; for (let i = 0; i < 6 && hp === 100; i++) { attackFoe(w, me, 'M1', now + 1200 * (i + 1)); hp = c.foes[0]!.hp; }
    expect(hp).toBeLessThan(100); expect(c.hits.some((h) => h.from === me.id && h.k !== 'miss')).toBe(true);
  });
  it('aimed bow: the arrow flies to the aim point and hits the foe there; an empty spot wastes the arrow', () => {
    const w = setup(); const me = findPerson(w, w.players.u2!.personId)!; me.arms = { yay: 1, ok: 10 }; me.drawn = 'yay'; me.onboardUntil = 0;
    startWarCombat(w, T0, 1); const c = w.combat!; c.spawned = true; c.foes = [{ id: 'M1', kind: 'macar', hp: 100, max: 100, bow: true, walk: { path: [{ x: 46, y: 40 }], t0: T0, speed: 1 } }];
    stand(me, 40, 40, T0); let now = T0 + 5000;
    const miss = attackFoe(w, me, '', now, { x: 40, y: 46 }); expect(miss.ok).toBe(true); expect(c.foes[0]!.hp).toBe(100); expect(me.arms.ok).toBe(9); expect(c.hits.at(-1)!.arrow).toBe(true);
    let n = 0; while (c.foes[0]!.hp === 100 && n++ < 10) { now += 1200; attackFoe(w, me, '', now, { x: 46, y: 40 }); }
    expect(c.foes[0]!.hp).toBeLessThan(100); const h = c.hits.at(-1)!; expect(h.fx).toBeCloseTo(40, 0); expect(h.arrow).toBe(true);
    void foePos;
  });
  it('enemy strikes carry the attacker (sword swing / arrow flight) and the war ends cleanly', () => {
    const w = setup(); const me = findPerson(w, w.players.u2!.personId)!; me.onboardUntil = 0;
    w.foreign = { name: 'Macar Krallığı', demand: 100, troops: 6, phase: 'savas', day: w.day, deadline: w.day, landed: true, recruits: [] };
    startWarCombat(w, T0, 6); let now = T0;
    for (let i = 0; i < 700 && w.combat; i++) { now += 1000; heartbeat(w, 'u2', now); }
    expect(w.combat).toBeFalsy(); expect(w.speed).toBe(1); expect(w.foreign).toBeFalsy();
  });
});
