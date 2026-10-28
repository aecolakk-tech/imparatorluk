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
import { realtime, judgeRule, judgeAnswer, dmPrompt, talksPrompt, judgePrompt } from '../sim/v16';
import { findPerson } from '../sim/world';
export { migrateWorld };
/** NPC chat lines produced by the simulation; the server stores them as messages and clears the outbox. */
export function drainChat(w: World): NpcMsg[] { const out = w.chatOut ?? []; w.chatOut = []; return out; }

export { createWorld, filterProfanity, rateOk, personOf };
export type { AdminOp };

export interface ChatMsg { id: string; fromPersonId: string; fromName: string; toPersonId: string | null; text: string; at: number; replies?: LlmReply[] }

export function heartbeat(w: World, playerId: string, now: number): { summary: string | null; hours: number; snapshotDue: boolean } {
  migrateWorld(w);
  const summary = touchPlayer(w, playerId, now);
  const hours = advanceWorld(w, now);
  realtime(w, now);
  const snapshotDue = now - w.lastSnapshotAt >= SNAPSHOT_EVERY_MS;
  if (snapshotDue) w.lastSnapshotAt = now;
  return { summary, hours, snapshotDue };
}

export function act(w: World, playerId: string, a: Action, now: number, deferJudge = false): ActionResult {
  migrateWorld(w); advanceWorld(w, now); realtime(w, now);
  const r = applyAction(w, playerId, a, now);
  if (a.t === 'defense' && r.ok && !deferJudge) { const c = w.cases.find((x) => x.id === a.caseId); const last = c?.trial?.msgs.at(-1); if (c && last) { const j = judgeRule(w, c, last.text); judgeAnswer(w, c, j.reply, j.score, now + 800); } }
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

export function makeChat(w: World, playerId: string, text: string, toPersonId: string | null, times: number[], now: number, defer = false, history?: { from: string; text: string }[]): ChatMsg | string {
  const me = personOf(w, playerId); if (!me) return 'Karakter yok.';
  if (w.players[playerId]?.banned) return 'Sürgündesiniz.';
  const clean = filterProfanity(text.replace(/[<>]/g, '').trim()).slice(0, 280);
  if (!clean) return 'Boş mesaj.';
  if (!rateOk(times, now)) return 'Çok hızlı yazıyorsunuz; biraz bekleyin.';
  if (toPersonId && !w.people.some((p) => p.id === toPersonId)) return 'Alıcı yok.';
  const replies = playerSaid(w, me, clean, toPersonId, now, defer); // NPCs answer (into w.chatOut unless deferred)
  const msg: ChatMsg = { id: `${now}-${Math.round(Math.random() * 1e6)}`, fromPersonId: me.id, fromName: me.name, toPersonId, text: clean, at: now };
  if (defer) msg.replies = replies.map((r) => ({ npcId: r.npc.id, npcName: r.npc.name, to: toPersonId ? me.id : null, fallback: r.fallback, prompt: dmPrompt(w, r.npc, me, clean, history ?? []) }));
  return msg;
}

// ---------- LLM helpers (server) ----------
export interface LlmReply { npcId: string; npcName: string; to: string | null; fallback: string; prompt: { system: string; user: string } }
/** Talks generated this hour that the model may rewrite (batched, max 3). */
export function talkBatch(w: World, now: number): { idx: number[]; prompt: { system: string; user: string } } | null {
  const idx: number[] = []; (w.talks ?? []).forEach((t, i) => { if (!t.ai && t.at && t.at > now - 20_000) idx.push(i); });
  const pick3 = idx.slice(-3); if (!pick3.length) return null;
  const pairs = pick3.map((i) => ({ a: findPerson(w, w.talks[i]!.a)!, b: findPerson(w, w.talks[i]!.b)! })).filter((p) => p.a && p.b);
  if (pairs.length !== pick3.length) return null;
  return { idx: pick3, prompt: talksPrompt(w, pairs) };
}
export function applyTalks(w: World, idx: number[], out: { talks?: string[][]; gossip?: string }, now: number): void {
  idx.forEach((i, k) => { const t = w.talks[i]; const l = out.talks?.[k]; if (t && Array.isArray(l) && l.length >= 2 && typeof l[0] === 'string') { t.lines = [String(l[0]).slice(0, 90), String(l[1]).slice(0, 90)]; t.text = t.lines[0]!; t.ai = true; } });
  if (typeof out.gossip === 'string' && out.gossip.length > 5) {
    const ppl = w.people.filter((p) => !p.playerId && p.prof !== 'naip' && p.jailedDays === 0); const a = ppl[Math.floor(Math.random() * ppl.length)];
    if (a) w.chatOut.push({ fromPersonId: a.id, fromName: a.name, toPersonId: null, text: `🗣 ${out.gossip.slice(0, 200)}`, at: now });
  }
}
export function judgeRequest(w: World, caseId: string): { system: string; user: string } | null { const c = w.cases.find((x) => x.id === caseId); return c?.trial?.pending ? judgePrompt(w, c) : null; }
export function judgeReply(w: World, caseId: string, out: { cevap?: string; ikna?: number } | null, now: number): void {
  const c = w.cases.find((x) => x.id === caseId); if (!c?.trial?.pending) return;
  const last = c.trial.msgs.at(-1)?.text ?? ''; const rule = judgeRule(w, c, last);
  const score = typeof out?.ikna === 'number' && Number.isFinite(out.ikna) ? Math.max(-4, Math.min(3, Math.round(out.ikna))) : rule.score;
  judgeAnswer(w, c, out?.cevap ? String(out.cevap) : rule.reply, score, now);
}
export function llmBudget(w: World, today: string, perDay: number): boolean { w.llm = w.llm ?? { day: '', n: 0, talkAt: 0 }; if (w.llm.day !== today) { w.llm.day = today; w.llm.n = 0; } return w.llm.n < perDay; }
export function llmSpend(w: World, today: string, n = 1): void { w.llm = w.llm ?? { day: today, n: 0, talkAt: 0 }; if (w.llm.day !== today) { w.llm.day = today; w.llm.n = 0; } w.llm.n += n; }

export function admin(w: World, op: AdminOp): string { return applyAdmin(w, op); }
