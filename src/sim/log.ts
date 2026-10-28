import { maybeChronicle } from './realm';
import type { World } from './types';
import { findPerson } from './world';
import { tidy } from './tr';

export function isOnline(w: World, playerId: string | null, now: number, windowMs = 60_000): boolean {
  if (!playerId) return false; const pl = w.players[playerId];
  return !!pl && !pl.banned && now - pl.lastSeen < windowMs;
}
/** Log an event to the town feed; also to the away-log of an offline player concerned. */
export function log(w: World, text0: string, personId?: string, now?: number): void {
  const text = tidy(text0);
  if (w.events.slice(-4).some((e) => e.day === w.day && e.text === text)) return; // v2.0.2 P8: no repeated identical lines (triple propaganda)
  const p = findPerson(w, personId);
  const b = p ? w.buildings.find((x) => x.id === (w.hour >= 8 && w.hour < 18 ? p.work : p.home)) : undefined;
  w.events.push({ day: w.day, hour: w.hour, text, personId, x: b?.door.x, y: b?.door.y });
  if (w.events.length > 120) w.events.splice(0, w.events.length - 120);
  w.todayEvents.push(text);
  if (w.todayEvents.length > 200) w.todayEvents.shift();
  if (p?.playerId) personal(w, p.playerId, text, now);
  maybeChronicle(w, text);
}
export function personal(w: World, playerId: string, text0: string, now?: number): void {
  const text = tidy(text0);
  const pl = w.players[playerId]; if (!pl) return;
  // v2.0.1: every personal notice also reaches an online player as an in-game toast (client shows entries newer than the last one it saw)
  pl.liveN = (pl.liveN ?? 0) + 1; (pl.live ??= []).push({ n: pl.liveN, t: text }); if (pl.live.length > 12) pl.live.splice(0, pl.live.length - 12);
  if (now === undefined || now - pl.lastSeen > 60_000) { pl.awayLog.push(`Gün ${w.day}: ${text}`); if (pl.awayLog.length > 40) pl.awayLog.shift(); }
}
export const headTitle = (w: World): string => (w.regime === 'cumhuriyet' ? 'Başkan' : 'Kayzer');
export function kayzerPlayerId(w: World): string | null { return findPerson(w, w.kayzerId)?.playerId ?? null; }
/** v2.0.2 (P7) one ruler-name source: the actual head of state; 'Naip Maecenas (vekil)' only while a regent rules. */
export function rulerName(w: World): string {
  const k = findPerson(w, w.kayzerId); if (!k) return 'Naip Maecenas (vekil)';
  if (k.prof === 'naip') return `${k.name.startsWith('Naip') ? k.name : 'Naip ' + k.name} (vekil)`;
  return w.regime === 'cumhuriyet' ? `Başkan ${k.name}` : k.name.startsWith('Kayzer') ? k.name : `Kayzer ${k.name}`;
}
