/**
 * v2.0.1 real-time combat – the deterministic part shared by client (drawing) and server (rules):
 * where a foe is, and where an engaged soldier/bekçi stands (walking up to his foe).
 */
import type { World } from './types';
import { walkPos, type Pt, type Walk } from './move';

export interface Foe { id: string; kind: 'eskiya' | 'macar'; hp: number; max: number; bow: boolean; walk: Walk; pathAt?: number; robbed?: string[] }
export interface Hit { at: number; x: number; y: number; dmg: number; to: string; toName: string; by: string; w: string; k: 'hit' | 'kill' | 'block' | 'miss' | 'rob' | 'down'; from?: string; fx?: number; fy?: number; arrow?: boolean }
export interface Combat {
  fought?: Record<string, number>; // v2.0.1 person id → kills in this fight (players who attacked)
  kind: 'raid' | 'war'; startAt: number; at: number; spawnAt: number; foes: Foe[]; hits: Hit[];
  assign: Record<string, { foe: string; at: number; fx: number; fy: number }>; spawned?: boolean;
}
export const SAIL_MS = 45_000; // ships sail up the river to the Liman before troops land
export const LIMAN_DOCK = { x: 36, y: 47.2 };
/** v2.0.2 scale: 1 kare (map tile) = 1.2 m (a 1.7 m person is drawn ~1.4 tiles tall). A melee blow lands only when the gap
 *  between the two bodies is ≤ 0.5 m; bodies are ~0.5 m wide, so centre-to-centre ≤ 0.5 + 2×0.25 = 1.0 m = 0.83 kare.
 *  The server allows 0.12 m (0.1 kare) for network lag. Foes and NPC fighters use the same reach. */
export const M_PER_TILE = 1.2; export const BODY_R_M = 0.25; export const MELEE_GAP_M = 0.5;
export const MELEE_TILES = (MELEE_GAP_M + 2 * BODY_R_M) / M_PER_TILE; export const REACH_SLACK = 0.1;
export const LIMAN_X = 36; // v2.0.2: ship berths along the quay (drawn in v2.ts, used for disembarking)
export const WAVE_MS = 5000; export const WAVE_SIZE = 3; // troops come down the gangplanks in waves of 3, 5 s apart
export const shipCount = (troops: number): number => Math.max(3, Math.ceil(troops / 6));
export function berth(i: number, ships: number): Pt { return { x: LIMAN_X - 7 + i * (14 / Math.max(1, ships - 1)), y: 49.6 + (i % 2) * 1.3 }; }
/** A foe still on board (before its disembark time) is not on the map yet. */
export function foeAshore(f: Foe, now: number): boolean { return now >= f.walk.t0; }

export function foePos(f: Foe, now: number): Pt { return walkPos(f.walk, now).pt; }
export function foeMoving(f: Foe, now: number): boolean { return walkPos(f.walk, now).moving; }
export function liveFoes(w: World): Foe[] { return (w.combat?.foes ?? []).filter((f) => f.hp > 0); }
/** An engaged fighter walks (2.8 tiles/s) from where he was to his foe and stands beside it. */
export function engagedPos(w: World, id: string, now: number): { x: number; y: number; moving: boolean } | null {
  const c = w.combat; const a = c?.assign[id]; if (!c || !a) return null;
  const f = c.foes.find((x) => x.id === a.foe && x.hp > 0); if (!f) return null;
  const fp = foePos(f, now); const k = (id.charCodeAt(id.length - 1) % 5) - 2;
  const tx = fp.x + 0.7 * (k >= 0 ? 1 : -1), ty = fp.y + k * 0.08; // stands within melee reach (MELEE_TILES)
  const d = Math.hypot(tx - a.fx, ty - a.fy); const dur = Math.max(300, (d / 2.2) * 1000);
  const t = Math.min(1, Math.max(0, (now - a.at) / dur));
  return { x: a.fx + (tx - a.fx) * t, y: a.fy + (ty - a.fy) * t, moving: t < 1 };
}
