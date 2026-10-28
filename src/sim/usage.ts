import type { Person, World } from './types';
/** v2.0.1 single-player audit: count a feature use by an NPC (or by the AI state when `p` is omitted). */
export function use(w: World, key: string, p?: Person | null): void {
  if (p && p.playerId && !p.npc) return;
  const u = (w.usage ??= {}); u[key] = (u[key] ?? 0) + 1;
}
