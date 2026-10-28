/** v1.9 animal sprites (own pixel art, drawn in code) and where the animals wander on the map. */
import type { Person, World } from '../sim/types';
import type { Animal } from '../sim/realm';

type Px = [number, number, number, number, string]; // x, y, w, h, color on a 16×16 grid
const ART: Record<Animal, (f: number) => Px[]> = {
  inek: (f) => [[2, 6, 11, 5, '#f4f1ea'], [4, 7, 3, 2, '#2b2b2b'], [9, 8, 3, 2, '#2b2b2b'], [12, 4, 3, 4, '#f4f1ea'], [14, 6, 2, 2, '#e7a8a0'], [12, 3, 1, 1, '#c9b48a'], [14, 3, 1, 1, '#c9b48a'], [13, 5, 1, 1, '#111'],
    [3, 11, 2, 3 - f, '#d9d4c8'], [10, 11, 2, 2 + f, '#d9d4c8'], [6, 11, 2, 2 + f, '#d9d4c8'], [1, 6, 1, 4, '#d9d4c8'], [7, 11, 2, 1, '#f0b8c0']],
  koyun: (f) => [[3, 6, 9, 5, '#f7f3e8'], [4, 5, 7, 1, '#f7f3e8'], [11, 5, 4, 4, '#3a3230'], [13, 6, 1, 1, '#fff'], [4, 11, 1, 3 - f, '#3a3230'], [10, 11, 1, 2 + f, '#3a3230'], [7, 11, 1, 2 + f, '#3a3230'], [5, 7, 2, 1, '#e6decb']],
  tavuk: (f) => [[5, 8, 6, 4, '#fbfbf6'], [9, 5, 3, 4, '#fbfbf6'], [10, 4, 2, 1, '#d33'], [12, 6, 2, 1, '#f0a020'], [10, 6, 1, 1, '#111'], [4, 7, 2, 3, '#e8e4da'], [6, 12, 1, 2 - f, '#f0a020'], [9, 12, 1, 1 + f, '#f0a020']],
  at: (f) => [[2, 6, 11, 4, '#8a5a32'], [11, 2, 3, 6, '#8a5a32'], [13, 3, 2, 3, '#7a4e2a'], [11, 1, 2, 2, '#3a2414'], [10, 2, 1, 5, '#3a2414'], [13, 3, 1, 1, '#111'], [1, 6, 1, 5, '#3a2414'],
    [3, 10, 2, 4 - f, '#6e4626'], [5, 10, 1, 3 + f, '#6e4626'], [10, 10, 2, 4 - f, '#6e4626'], [8, 10, 1, 3 + f, '#6e4626'], [3, 13, 2, 1, '#222'], [10, 13, 2, 1, '#222']],
};
const cache = new Map<string, HTMLCanvasElement>();
export function animalSprite(a: Animal, f: number): HTMLCanvasElement {
  const k = `${a}${f}`; let c = cache.get(k); if (c) return c;
  c = document.createElement('canvas'); c.width = 16; c.height = 16; const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(2, 13, 12, 2);
  for (const [x, y, w, h, col] of ART[a](f)) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  cache.set(k, c); return c;
}
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export interface PlacedAnimal { kind: Animal; x: number; y: number; dir: number; moving: boolean; owner: string }
const SIZE: Record<Animal, number> = { inek: 1.05, koyun: 0.8, tavuk: 0.5, at: 1.1 };
export const animalSize = (a: Animal): number => SIZE[a];
/** Visual only: the seller's stock wanders in the Hayvan Pazarı pen, owners' herds at the farms, a led horse at home. */
export function placeAnimals(w: World, now: number): PlacedAnimal[] {
  const out: PlacedAnimal[] = []; const B = new Map(w.buildings.map((b) => [b.id, b]));
  const pen = B.get('hayvan'); const farm = B.get('ciftlik');
  for (const p of w.people) {
    const hd = p.animals; if (!hd) continue;
    const area = p.prof === 'hayvanci' ? pen : p.farm ? farm : null;
    for (const kind of ['inek', 'koyun', 'tavuk', 'at'] as Animal[]) {
      const n = Math.min(kind === 'tavuk' ? 8 : 5, hd[kind] - (kind === 'at' && p.riding ? 1 : 0)); if (n <= 0) continue;
      for (let i = 0; i < n; i++) {
        const h = hash(p.id + kind + i); let bx: number, by: number, bw: number, bh: number;
        if (area) { const sub = area === farm ? hash(p.id) % 6 : 0; bw = area === farm ? Math.min(4, area.w / 3) : area.w - 1.2; bh = area === farm ? Math.min(3.5, area.h / 2) : area.h - 1.2; bx = area.x + 0.6 + (area === farm ? (sub % 3) * (area.w / 3) : 0); by = area.y + 0.8 + (area === farm ? Math.floor(sub / 3) * (area.h / 2) : 0); }
        else { const home = B.get(p.home); if (!home) continue; bx = home.door.x - 1.2; by = home.door.y + 0.3; bw = 1.4; bh = 0.6; }
        const P = 9000 + (h % 7000); const ph = now / P + (h % 997) / 997; const k = Math.floor(ph), f = ph - k;
        const spot = (j: number): [number, number] => { const a = hash(p.id + kind + i + ':' + j); return [bx + (a % 1000) / 1000 * bw, by + ((a >> 10) % 1000) / 1000 * bh]; };
        const [ax, ay] = spot(k), [cx, cy] = spot(k + 1); const wf = kind === 'tavuk' ? 0.25 : 0.4;
        const e = Math.min(1, f / wf); const s = e * e * (3 - 2 * e);
        out.push({ kind, x: ax + (cx - ax) * s, y: ay + (cy - ay) * s, dir: cx >= ax ? 1 : -1, moving: f < wf, owner: p.id });
      }
    }
  }
  return out;
}
export const isRiding = (p: Person): boolean => !!p.riding && (p.animals?.at ?? 0) > 0;
