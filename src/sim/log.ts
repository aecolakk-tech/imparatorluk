import type { World } from './types';
import { findPerson } from './world';

export function isOnline(w: World, playerId: string | null, now: number, windowMs = 60_000): boolean {
  if (!playerId) return false; const pl = w.players[playerId];
  return !!pl && !pl.banned && now - pl.lastSeen < windowMs;
}
/** Log an event to the town feed; also to the away-log of an offline player concerned. */
export function log(w: World, text: string, personId?: string, now?: number): void {
  const p = findPerson(w, personId);
  const b = p ? w.buildings.find((x) => x.id === (w.hour >= 8 && w.hour < 18 ? p.work : p.home)) : undefined;
  w.events.push({ day: w.day, hour: w.hour, text, personId, x: b?.door.x, y: b?.door.y });
  if (w.events.length > 120) w.events.splice(0, w.events.length - 120);
  w.todayEvents.push(text);
  if (w.todayEvents.length > 200) w.todayEvents.shift();
  if (p?.playerId) personal(w, p.playerId, text, now);
}
export function personal(w: World, playerId: string, text: string, now?: number): void {
  const pl = w.players[playerId]; if (!pl) return;
  if (now === undefined || now - pl.lastSeen > 60_000) { pl.awayLog.push(`Gün ${w.day}: ${text}`); if (pl.awayLog.length > 40) pl.awayLog.shift(); }
}
export const headTitle = (w: World): string => (w.regime === 'cumhuriyet' ? 'Başkan' : 'Kayzer');
export function kayzerPlayerId(w: World): string | null { return findPerson(w, w.kayzerId)?.playerId ?? null; }
