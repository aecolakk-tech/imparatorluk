/** v1.9.3 where animals stand on the map (pure; shared by client drawing/taps and the server's reach check). */
import type { Person, World } from './types';
import type { Animal } from './realm';
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export interface PlacedAnimal { kind: Animal; x: number; y: number; dir: number; moving: boolean; owner: string }
/** one drawn animal's fixed data (its wander box and hashes); the spot memo is a pure function of the step index k */
export interface AnimalSlot { kind: Animal; owner: string; key: string; h: number; bx: number; by: number; bw: number; bh: number; k: number; a: [number, number]; b: [number, number] }
/** v2.0.5: the per-world part of placeAnimals (string hashing), computed once per world instead of every frame. */
export function animalLayout(w: World): AnimalSlot[] {
  const out: AnimalSlot[] = []; const B = new Map(w.buildings.map((b) => [b.id, b]));
  const pen = B.get('hayvan'); const farm = B.get('ciftlik');
  for (const p of w.people) {
    const hd = p.animals; if (!hd) continue;
    const area = p.prof === 'hayvanci' ? pen : p.farm ? farm : null;
    for (const kind of ['inek', 'koyun', 'tavuk', 'at'] as Animal[]) {
      const n = Math.min(kind === 'tavuk' ? 8 : 5, hd[kind] - (kind === 'at' && p.riding ? 1 : 0)); if (n <= 0) continue;
      for (let i = 0; i < n; i++) {
        const key = p.id + kind + i; const h = hash(key); let bx: number, by: number, bw: number, bh: number;
        if (area) { const sub = area === farm ? hash(p.id) % 6 : 0; bw = area === farm ? Math.min(4, area.w / 3) : area.w - 1.2; bh = area === farm ? Math.min(3.5, area.h / 2) : area.h - 1.2; bx = area.x + 0.6 + (area === farm ? (sub % 3) * (area.w / 3) : 0); by = area.y + 0.8 + (area === farm ? Math.floor(sub / 3) * (area.h / 2) : 0); }
        else { const home = B.get(p.home); if (!home) continue; bx = home.door.x - 2.2; by = home.door.y + 0.3; bw = 2.6; bh = 0.8; }
        out.push({ kind, owner: p.id, key, h, bx, by, bw, bh, k: NaN, a: [0, 0], b: [0, 0] });
      }
    }
  }
  return out;
}
/** positions at time `now` from a layout (cheap: the two wander spots are re-hashed only when the step changes) */
export function animalsAt(layout: AnimalSlot[], now: number): PlacedAnimal[] {
  const out: PlacedAnimal[] = [];
  for (const L of layout) {
    const { h } = L; const P = 9000 + (h % 7000); const ph = now / P + (h % 997) / 997; const k = Math.floor(ph), f = ph - k;
    if (L.k !== k) { const spot = (j: number): [number, number] => { const a = hash(L.key + ':' + j); return [L.bx + (a % 1000) / 1000 * L.bw, L.by + ((a >>> 10) % 1000) / 1000 * L.bh]; }; L.a = spot(k); L.b = spot(k + 1); L.k = k; }
    const [ax, ay] = L.a, [cx, cy] = L.b; const wf = L.kind === 'tavuk' ? 0.25 : 0.4;
    const e = Math.min(1, f / wf); const s = e * e * (3 - 2 * e);
    out.push({ kind: L.kind, x: ax + (cx - ax) * s, y: ay + (cy - ay) * s, dir: cx >= ax ? 1 : -1, moving: f < wf, owner: L.owner });
  }
  return out;
}
/** Visual only: the seller's stock wanders in the Hayvan Pazarı pen, owners' herds at the farms, a led horse at home. */
export function placeAnimals(w: World, now: number): PlacedAnimal[] { return animalsAt(animalLayout(w), now); }

/** v1.9.3: you must stand within ~1 m of your own animal to ride / slaughter it. */
export const ANIMAL_REACH = 1.1;
export function ownAnimals(w: World, p: Person, kind: Animal, now: number): PlacedAnimal[] { return placeAnimals(w, now).filter((a) => a.owner === p.id && a.kind === kind); }
export function nearestOwnAnimal(w: World, p: Person, kind: Animal, now: number, at: { x: number; y: number }): PlacedAnimal | undefined {
  return ownAnimals(w, p, kind, now).sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y))[0];
}
