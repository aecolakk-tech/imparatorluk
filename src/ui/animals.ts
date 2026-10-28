/** v1.9 animal sprites (own pixel art, drawn in code) and where the animals wander on the map. */
import type { Person } from '../sim/types';
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
export { placeAnimals, type PlacedAnimal } from '../sim/herdpos';
const SIZE: Record<Animal, number> = { inek: 1.05, koyun: 0.8, tavuk: 0.5, at: 1.1 };
export const animalSize = (a: Animal): number => SIZE[a];
export const isRiding = (p: Person): boolean => !!p.riding && (p.animals?.at ?? 0) > 0;
