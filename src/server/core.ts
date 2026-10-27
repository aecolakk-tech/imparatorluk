/**
 * Authoritative server logic, shared by the in-browser mock backend and the Supabase Edge Function
 * (bundled to supabase/functions/game/core.js by `npm run build:edge`).
 * Everything that changes money or state goes through here – the client only sends intents.
 */
import type { Action, ActionResult, Profession, World } from '../sim/types';
import { advanceWorld } from '../sim/tick';
import { applyAction, filterProfanity, joinWorld, rateOk, touchPlayer, personOf, takeoverCandidates, officeOf } from '../sim/actions';
import { applyAdmin, type AdminOp } from '../sim/admin';
import { createWorld } from '../sim/world';
import { SNAPSHOT_EVERY_MS } from '../sim/constants';
import { migrateWorld } from '../sim/extras';
import { playerSaid } from '../sim/chat';
import { questReward } from '../sim/life';
import type { NpcMsg } from '../sim/types';
export { migrateWorld };
/** NPC chat lines produced by the simulation; the server stores them as messages and clears the outbox. */
export function drainChat(w: World): NpcMsg[] { const out = w.chatOut ?? []; w.chatOut = []; return out; }

export { createWorld, filterProfanity, rateOk, personOf };
export type { AdminOp };

export interface ChatMsg { id: string; fromPersonId: string; fromName: string; toPersonId: string | null; text: string; at: number; }

export function heartbeat(w: World, playerId: string, now: number): { summary: string | null; hours: number; snapshotDue: boolean } {
  migrateWorld(w);
  const summary = touchPlayer(w, playerId, now);
  const hours = advanceWorld(w, now);
  const snapshotDue = now - w.lastSnapshotAt >= SNAPSHOT_EVERY_MS;
  if (snapshotDue) w.lastSnapshotAt = now;
  return { summary, hours, snapshotDue };
}

export function act(w: World, playerId: string, a: Action, now: number): ActionResult {
  migrateWorld(w); advanceWorld(w, now);
  const r = applyAction(w, playerId, a, now);
  const q = questReward(w, playerId); if (q) r.msg = `${r.msg}\n🎯 ${q}`;
  return r;
}

export function register(w: World, playerId: string, name: string, prof: Profession, founder: boolean, now: number, takeOverId?: string | null): void {
  migrateWorld(w); joinWorld(w, playerId, name, prof, founder, now, takeOverId);
}

/** Public card data of NPCs a newcomer may take over (shown before sign-up, behind the access password). */
export interface Candidate { id: string; name: string; office: string; money: number; mood: number; loyalty: number; republic: number; health: number; thought: string; home: string; spouse: string | null; sprite: { hairColor: number; skin: number; shirt: number; female: boolean; prof: Profession } }
export function candidates(w: World): Candidate[] {
  migrateWorld(w);
  return takeoverCandidates(w).map((p) => ({ id: p.id, name: p.name, office: officeOf(w, p), money: Math.round(p.money), mood: Math.round(p.mood), loyalty: Math.round(p.loyalty), republic: Math.round(p.republic), health: Math.round(p.health), thought: p.thought, home: p.home, spouse: w.people.find((x) => x.id === p.spouse)?.name ?? null, sprite: { hairColor: p.hairColor, skin: p.skin, shirt: p.shirt, female: p.female, prof: p.prof } }));
}

export function makeChat(w: World, playerId: string, text: string, toPersonId: string | null, times: number[], now: number): ChatMsg | string {
  const me = personOf(w, playerId); if (!me) return 'Karakter yok.';
  if (w.players[playerId]?.banned) return 'Sürgündesiniz.';
  const clean = filterProfanity(text.replace(/[<>]/g, '').trim()).slice(0, 280);
  if (!clean) return 'Boş mesaj.';
  if (!rateOk(times, now)) return 'Çok hızlı yazıyorsunuz; biraz bekleyin.';
  if (toPersonId && !w.people.some((p) => p.id === toPersonId)) return 'Alıcı yok.';
  playerSaid(w, me, clean, toPersonId, now); // NPCs answer (into w.chatOut)
  return { id: `${now}-${Math.round(Math.random() * 1e6)}`, fromPersonId: me.id, fromName: me.name, toPersonId, text: clean, at: now };
}

export function admin(w: World, op: AdminOp): string { return applyAdmin(w, op); }
