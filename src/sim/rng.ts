import type { World } from './types';
/** mulberry32 step stored in world so the sim is deterministic & replayable */
export function rand(w: { rng: number }): number {
  let t = (w.rng = (w.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function randInt(w: { rng: number }, lo: number, hi: number): number {
  return lo + Math.floor(rand(w) * (hi - lo + 1));
}
export function pick<T>(w: { rng: number }, arr: readonly T[]): T {
  return arr[Math.floor(rand(w) * arr.length)] as T;
}
export function chance(w: { rng: number }, p: number): boolean { return rand(w) < p; }
export function nextId(w: World, prefix: string): string { w.idSeq += 1; return `${prefix}${w.idSeq}`; }
export const clamp = (v: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, v));
