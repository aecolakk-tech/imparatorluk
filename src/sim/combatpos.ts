/**
 * v2.0.1 real-time combat – the deterministic part shared by client (drawing) and server (rules):
 * where a foe is, and where an engaged soldier/bekçi stands (walking up to his foe).
 */
import type { World } from './types';
import { walkPos, type Pt, type Walk } from './move';

export interface Foe { id: string; kind: 'eskiya' | 'macar'; hp: number; max: number; bow: boolean; walk: Walk; pathAt?: number; robbed?: string[] }
export interface Hit { at: number; x: number; y: number; dmg: number; to: string; toName: string; by: string; w: string; k: 'hit' | 'kill' | 'block' | 'miss' | 'rob' | 'down' }
export interface Combat {
  fought?: Record<string, number>; // v2.0.1 person id → kills in this fight (players who attacked)
  kind: 'raid' | 'war'; startAt: number; at: number; spawnAt: number; foes: Foe[]; hits: Hit[];
  assign: Record<string, { foe: string; at: number; fx: number; fy: number }>; spawned?: boolean;
}
export const SAIL_MS = 45_000; // ships sail up the river to the Liman before troops land
export const LIMAN_DOCK = { x: 36, y: 47.2 };

export function foePos(f: Foe, now: number): Pt { return walkPos(f.walk, now).pt; }
export function foeMoving(f: Foe, now: number): boolean { return walkPos(f.walk, now).moving; }
export function liveFoes(w: World): Foe[] { return (w.combat?.foes ?? []).filter((f) => f.hp > 0); }
/** An engaged fighter walks (2.8 tiles/s) from where he was to his foe and stands beside it. */
export function engagedPos(w: World, id: string, now: number): { x: number; y: number; moving: boolean } | null {
  const c = w.combat; const a = c?.assign[id]; if (!c || !a) return null;
  const f = c.foes.find((x) => x.id === a.foe && x.hp > 0); if (!f) return null;
  const fp = foePos(f, now); const k = (id.charCodeAt(id.length - 1) % 5) - 2;
  const tx = fp.x + 0.9 * (k >= 0 ? 1 : -1), ty = fp.y + k * 0.2;
  const d = Math.hypot(tx - a.fx, ty - a.fy); const dur = Math.max(300, (d / 2.8) * 1000);
  const t = Math.min(1, Math.max(0, (now - a.at) / dur));
  return { x: a.fx + (tx - a.fx) * t, y: a.fy + (ty - a.fy) * t, moving: t < 1 };
}
