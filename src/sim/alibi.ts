/**
 * v1.9.8: where was everybody? A thinned position history per person (a point is kept when someone moved
 * ≥2 tiles or every 2 game hours), the time/place of each crime, and alibi witnesses the defendant can call.
 * A witness only tells what the history shows: “he was with me at 22:00”, “he came home at 23:15”, or “I didn't see him”.
 */
import type { CourtCase, Person, World } from './types';
import { ek } from './tr';
import { findPerson } from './world';
import { placePeople } from './place';
import { hourMs } from './tick';
import { personal } from './log';
import { fullAI } from './ai';
import { relate } from './life';

export const POS_EVERY = 0.25; // game hours between samples
export const POS_KEEP_H = 36; // keep a day and a half
export const NEAR_R = 3; // tiles: “he was with me”
export const MAX_CALLS = 3;

/** Fractional game-hour index (day*24 + hour + fraction) of a real-time instant. */
export function gameH(w: World, ms: number): number { return w.day * 24 + w.hour + Math.max(0, Math.min(0.999, (ms - w.lastTickAt) / hourMs(w))); }
export function hLabel(w: World, H: number): string {
  const d = Math.floor(H / 24); const hr = Math.floor(H - d * 24); const mn = Math.floor((H - Math.floor(H)) * 4) * 15;
  return `${d === w.day ? '' : d === w.day - 1 ? 'dün ' : `${d}. gün `}${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
}

export function samplePositions(w: World, now: number): void {
  const H = gameH(w, now); if (H - (w.posAt ?? -99) < POS_EVERY) return; w.posAt = H;
  const log = (w.posLog ??= {}); const alive = new Set(w.people.map((p) => p.id));
  for (const q of placePeople(w, now)) {
    const arr = (log[q.p.id] ??= []); const last = arr[arr.length - 1]; const x = Math.round(q.x), y = Math.round(q.y);
    if (!last || Math.hypot(last[1] - x, last[2] - y) >= 2 || H - last[0] >= 2) arr.push([Math.round(H * 100) / 100, x, y]);
    while (arr.length > 2 && arr[1]![0] < H - POS_KEEP_H) arr.shift();
  }
  for (const id of Object.keys(log)) if (!alive.has(id)) delete log[id];
}
/** Where was p at game-hour H (last sample at or before H)? */
export function posAt(w: World, id: string, H: number): { x: number; y: number } | null {
  const arr = w.posLog?.[id]; if (!arr?.length) return null; let best: [number, number, number] | null = null;
  for (const s of arr) { if (s[0] <= H + 0.01) best = s; else break; }
  return best ? { x: best[1], y: best[2] } : null;
}
export function placeName(w: World, pt: { x: number; y: number }): string {
  const b = w.buildings.find((b) => pt.x >= b.x - 0.5 && pt.x <= b.x + b.w + 0.5 && pt.y >= b.y - 0.5 && pt.y <= b.y + b.h + 1);
  return b ? b.name : 'sokakta';
}

export function recordCrime(w: World, criminalId: string, victimId: string | null, now: number, x: number, y: number): void {
  w.crimeLog = [...(w.crimeLog ?? []), { criminalId, victimId, H: Math.round(gameH(w, now) * 100) / 100, x: Math.round(x), y: Math.round(y) }].slice(-30);
}
/** Fill c.crimeH / crimeX / crimeY from the crime log (latest matching deed). */
export function crimeTime(w: World, c: CourtCase): void {
  if (c.crimeH != null) return;
  const e = [...(w.crimeLog ?? [])].reverse().find((x) => x.criminalId === c.accusedId && (!c.victimId || x.victimId === c.victimId)) ?? [...(w.crimeLog ?? [])].reverse().find((x) => x.criminalId === c.accusedId);
  if (e) { c.crimeH = e.H; c.crimeX = e.x; c.crimeY = e.y; }
}

/** When did a and b come within NEAR_R between H0 and H1? Checks every sample time of either. */
function together(w: World, a: string, b: string, H0: number, H1: number): number[] {
  const ts = new Set<number>([H0]); for (const id of [a, b]) for (const s of w.posLog?.[id] ?? []) if (s[0] >= H0 && s[0] <= H1) ts.add(s[0]);
  const out: number[] = [];
  for (const t of [...ts].sort((x, y) => x - y)) { const pa = posAt(w, a, t), pb = posAt(w, b, t); if (pa && pb && Math.hypot(pa.x - pb.x, pa.y - pb.y) <= NEAR_R) out.push(t); }
  return out;
}

/** People the defendant can call, those who were near him around the crime first. */
export function witnessCandidates(w: World, c: CourtCase): { id: string; name: string; hint: string; near: boolean }[] {
  const H = c.crimeH; const tr = c.trial; const skip = new Set([c.accusedId, c.victimId, tr?.judgeId, tr?.prosecutorId, ...(c.called ?? []).map((x) => x.id)]);
  const out: { id: string; name: string; hint: string; near: boolean; d: number }[] = [];
  for (const p of w.people) {
    if (skip.has(p.id) || p.prof === 'naip') continue;
    let d = 99; let hint = '';
    if (H != null) { const t = together(w, c.accusedId, p.id, H - 2, H + 3); if (t.length) { const best = t.reduce((m, x) => Math.abs(x - H) < Math.abs(m - H) ? x : m); d = Math.abs(best - H); hint = `${hLabel(w, best)} civarı yanınızdaydı (${placeName(w, posAt(w, p.id, best)!)})`; } }
    out.push({ id: p.id, name: p.name, hint, near: d < 99, d });
  }
  return out.sort((a, b) => a.d - b.d || a.name.localeCompare(b.name, 'tr')).map(({ d: _d, ...r }) => r);
}

/** What a witness truthfully says about the defendant at the crime time. for: helps, against: hurts, null: neutral. */
export function alibiTestimony(w: World, c: CourtCase, wit: Person): { text: string; favor: boolean | null } {
  const a = findPerson(w, c.accusedId); const an = a?.name ?? 'sanık'; const H = c.crimeH;
  if ((c.eyeIds ?? []).includes(wit.id)) return { text: `Ben olayı gördüm. ${an} oradaydı ve yaptı.`, favor: false };
  if (H == null) return { text: `Olayın ne zaman olduğunu bilmiyorum; ${an} hakkında bir şey söyleyemem.`, favor: null };
  const crimeL = hLabel(w, H);
  const at = together(w, c.accusedId, wit.id, H - 0.5, H + 0.5);
  if (at.length) { const pl = placeName(w, posAt(w, wit.id, at[0]!)!); return { text: `Olay saatinde (${crimeL}) ${an} benim yanımdaydı, ${pl === 'sokakta' ? 'sokakta' : ek(pl, 'da')}. Suçu ben görmedim; o saatte yanımda olan biri orada olamaz.`, favor: true }; }
  const after = together(w, c.accusedId, wit.id, H + 0.01, H + 4);
  if (after.length) { const t = after[0]!; const pl = placeName(w, posAt(w, wit.id, t)!); return { text: `${an} olay saatinde (${crimeL}) yanımda değildi. Yanıma ancak ${hLabel(w, t)} civarı geldi (${pl}). Ondan öncesini bilmem.`, favor: false }; }
  const before = together(w, c.accusedId, wit.id, H - 3, H - 0.5);
  if (before.length) { const t = before[before.length - 1]!; return { text: `${an} ${hLabel(w, t)} civarı yanımdaydı ama sonra ayrıldı; olay saatinde (${crimeL}) nerede olduğunu bilmiyorum.`, favor: null }; }
  return { text: `O saatlerde (${crimeL}) ${an} ile hiç karşılaşmadım. Lehine bir şey söyleyemem.`, favor: false };
}

/** The defendant calls a witness. NPCs answer at once (truthfully); players get a notification and the witness box. */
export function callWitness(w: World, c: CourtCase, me: Person, witId: string, now: number): string | null {
  const tr = c.trial; if (!tr || tr.done) return 'Şu an görülen bir dava yok.';
  if (c.accusedId !== me.id) return 'Tanığı sadece sanık çağırır.';
  if ((c.called ?? []).length >= MAX_CALLS) return `En fazla ${MAX_CALLS} tanık çağırabilirsiniz.`;
  const wit = findPerson(w, witId); if (!wit || wit.id === me.id || wit.prof === 'naip') return 'Böyle biri yok.';
  if ((c.called ?? []).some((x) => x.id === wit.id)) return 'Bu kişi zaten çağrıldı.';
  crimeTime(w, c); (c.called ??= []).push({ id: wit.id, at: now });
  const judge = findPerson(w, tr.judgeId)?.name ?? 'Kadı';
  tr.msgs.push({ who: 'hakim', name: judge, text: `Sanığın tanığı ${wit.name} mahkemeye çağrılsın.`, at: now });
  if (wit.playerId && !wit.npc) {
    personal(w, wit.playerId, `⚖ ${me.name} davasında sizi tanık olarak çağırdı. Duruşma ekranından tanıklık edin.`, now);
    return null;
  }
  if (!fullAI(wit) && wit.playerId) return null;
  const t = alibiTestimony(w, c, wit);
  tr.msgs.push({ who: 'tanik', name: wit.name, text: t.text, at: now + 1 });
  if (t.favor !== null) { (c.witnesses ??= []).push({ id: wit.id, against: !t.favor }); relate(me, wit, t.favor ? 10 : -5, t.favor ? 'lehime tanıklık etti' : 'aleyhime tanıklık etti'); }
  if (t.favor === true) tr.persuasion = Math.min(12, tr.persuasion + 3);
  if (t.favor === false) tr.persuasion = Math.max(-12, tr.persuasion - 1);
  return null;
}
