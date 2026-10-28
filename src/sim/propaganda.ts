/**
 * v2.0.1 propaganda package: vaatler, kapı kapı ikna, miting, ikram / seçim rüşveti, parti kampanyası,
 * kara propaganda and the daily 'Seçim nabzı'. Effects feed voterScore() through w.election.{vaat,pledges,symp,smear,partyPosters,endorse}.
 */
import { use } from './usage';
import type { Person, World } from './types';
import type { GKind } from './genelge';
import { GENELGE, isGKind } from './genelge';
import { transfer } from './economy';
import { chance, clamp, pick } from './rng';
import { findPerson } from './world';
import { log } from './log';
import { itibar, itibarOf } from './career';
import { openCase } from './ai';
import { facOf, acc, partyName } from './party';
import { voterScore, vaatFit } from './meclis';
import { placePeople } from './place';
import { electionPhase } from './tick';

export const MEYDAN = { x: 36, y: 30 }; export const MITING_R = 7; export const MITING_COST = 5;
export const PARTY_POSTER = 10; export const SMEAR_EXPOSE = 0.3;
const E = (w: World) => w.election;
const isPlayer = (p: Person): boolean => !!p.playerId && !p.npc;
const symp = (w: World, cand: string, voter: string, d: number): void => { const s = (E(w).symp ??= {}); const k = `${cand}|${voter}`; s[k] = clamp((s[k] ?? 0) + d, -20, 20); };
const campaigning = (w: World): boolean => { const ph = electionPhase(w).phase; return ph === 'aday' || ph === 'propaganda'; };
const isCand = (w: World, p: Person): boolean => E(w).candidates.includes(p.id);

/** 1–3 vaatler from the genelge catalogue (a party member picks from the party program first). */
export function setVaat(w: World, p: Person, kinds: string[]): string | null {
  if (!isCand(w, p)) return 'Önce aday olun.';
  const ks = [...new Set(kinds)].filter(isGKind).slice(0, 3) as GKind[]; if (!ks.length) return '1–3 vaat seçin.';
  (E(w).vaat ??= {})[p.id] = ks; return null;
}
export function npcVaat(w: World, p: Person): void {
  const f = facOf(w, p.faction); const pool: GKind[] = f?.program?.length ? [...f.program] : ['ambar', 'asevi', 'vergiIndirim', 'saglik', 'yol'];
  const pickN = Math.min(3, 1 + (p.ambition > 60 ? 2 : 1)); const out: GKind[] = [];
  while (out.length < pickN && pool.length) { const k = pool.splice(Math.floor((p.ambition * 7 + out.length * 13) % pool.length), 1)[0]!; out.push(k); }
  (E(w).vaat ??= {})[p.id] = out; use(w, 'vaat', p);
}
/** Kapı kapı 'Bana oy ver': chance from the relation, itibar and how well the vaatler fit the voter. Once per voter per day. */
export function canvass(w: World, me: Person, v: Person): { ok: boolean; msg: string } {
  if (!campaigning(w)) return { ok: false, msg: 'Kapı kapı dolaşmak sadece adaylık ve propaganda döneminde.' };
  if (!isCand(w, me)) return { ok: false, msg: 'Önce aday olun.' }; if (v.id === me.id) return { ok: false, msg: 'Kendinize oy istemeyin.' };
  const k = `${me.id}|${v.id}`; const c = (E(w).canvassed ??= {}); if (c[k] === w.day) return { ok: false, msg: `${v.name} ile bugün konuştunuz.` }; c[k] = w.day;
  const fit = (E(w).vaat?.[me.id] ?? []).reduce((s, g) => s + vaatFit(w, v, g), 0);
  const p = clamp(0.25 + (v.relations[me.id] ?? 0) / 200 + (itibarOf(me) - 20) / 200 + fit * 0.12 + (v.faction && v.faction === me.faction ? 0.15 : 0), 0.05, 0.9);
  if (chance(w, p)) { (E(w).pledges ??= {})[v.id] = me.id; symp(w, me.id, v.id, 4); v.relations[me.id] = clamp((v.relations[me.id] ?? 0) + 3, -100, 100);
    const best = (E(w).vaat?.[me.id] ?? []).sort((a, b) => vaatFit(w, v, b) - vaatFit(w, v, a))[0];
    return { ok: true, msg: `${v.name}: “Tamam, oyum senin.${best ? ` ${GENELGE[best].label} vaadin hoşuma gitti.` : ''}” (ikna şansı %${Math.round(p * 100)})` }; }
  v.relations[me.id] = clamp((v.relations[me.id] ?? 0) - 2, -100, 100);
  return { ok: false, msg: `${v.name}: “Bakarız…” (ikna olmadı; şans %${Math.round(p * 100)})` };
}
/** Miting at the Meydan: once a day per candidate; everyone within MITING_R tiles hears the vaatler. */
export function miting(w: World, me: Person, now: number, text = ''): { ok: boolean; msg: string } {
  if (!campaigning(w)) return { ok: false, msg: 'Miting sadece adaylık ve propaganda döneminde.' }; if (!isCand(w, me)) return { ok: false, msg: 'Önce aday olun.' };
  const md = (E(w).mitingDay ??= {}); if (md[me.id] === w.day) return { ok: false, msg: 'Bugün miting yaptınız.' };
  const f = facOf(w, me.faction); const payer = f && (f.kasa ?? 0) >= MITING_COST ? acc(f) : me.id;
  if (!transfer(w, payer, 'saray', MITING_COST, 'miting izni')) return { ok: false, msg: `Miting izni ${MITING_COST} D.` }; md[me.id] = w.day;
  const near = placePeople(w, now).filter((q) => q.p.id !== me.id && Math.hypot(q.x - MEYDAN.x, q.y - MEYDAN.y) <= MITING_R).map((q) => q.p);
  const vs = E(w).vaat?.[me.id] ?? []; let won = 0;
  for (const v of near) { const fit = vs.reduce((s, g) => s + vaatFit(w, v, g), 0); const d = 1.5 + fit * 2 + (v.faction === me.faction ? 1.5 : 0); symp(w, me.id, v.id, d); if (d > 2) won++; }
  const speech = text.trim() || `Seçilirsem ${vs.map((g) => GENELGE[g].label.toLocaleLowerCase('tr')).join(', ') || 'şehrin derdine çare'} için çalışacağım!`;
  w.chatOut.push({ fromPersonId: me.id, fromName: me.name, toPersonId: null, text: `📣 Miting: ${speech.slice(0, 160)}`, at: now });
  use(w, 'miting', me);
  log(w, `📣 ${me.name} (${partyName(w, me.faction)}) Meydan’da miting yaptı: ${near.length} kişi dinledi.`, me.id);
  return { ok: true, msg: `Miting yapıldı: ${near.length} kişi dinledi, ${won} kişi etkilendi.` };
}
/** İkram: pilav (2 D) or şerbet (1 D) = small sympathy; money = seçim rüşveti (case + itibar −15 if caught). */
export function ikram(w: World, me: Person, v: Person, kind: 'pilav' | 'serbet' | 'para', amount = 0): { ok: boolean; msg: string } {
  if (!campaigning(w)) return { ok: false, msg: 'İkram sadece seçim döneminde anlamlı.' }; if (!isCand(w, me)) return { ok: false, msg: 'Önce aday olun.' };
  if (kind === 'para') {
    const a = Math.max(1, Math.min(100, Math.round(amount))); if (!transfer(w, me.id, v.id, a, 'seçim rüşveti')) return { ok: false, msg: 'Kesenizde o kadar yok.' };
    symp(w, me.id, v.id, Math.min(10, a / 2)); (E(w).pledges ??= {})[v.id] = me.id;
    if (chance(w, 0.25 + (v.honesty > 70 ? 0.3 : 0))) { openCase(w, me.id, 'rusvet', v.id, a, 60); log(w, `🚨 ${me.name} seçmene para dağıtırken yakalandı (seçim rüşveti)!`, me.id); return { ok: false, msg: 'Yakalandınız! Seçim rüşveti davası açıldı (itibar −15).' }; }
    return { ok: true, msg: `${v.name} parayı aldı ve size oy sözü verdi.` };
  }
  const cost = kind === 'pilav' ? 2 : 1; if (!transfer(w, me.id, 'dis', cost, kind === 'pilav' ? 'seçim pilavı' : 'şerbet ikramı')) return { ok: false, msg: `${cost} D gerekir.` };
  symp(w, me.id, v.id, kind === 'pilav' ? 3 : 1.5); v.mood = clamp(v.mood + 1); return { ok: true, msg: `${v.name} ${kind === 'pilav' ? 'pilavı' : 'şerbeti'} memnuniyetle aldı.` };
}
/** Party posters (shared, paid from the party kasa or the member) and endorsements between party candidates. */
export function partyPoster(w: World, me: Person): string | null {
  const f = facOf(w, me.faction); if (!f) return 'Önce bir partiye üye olun.'; if (!campaigning(w)) return 'Afiş sadece seçim döneminde.';
  if (!transfer(w, (f.kasa ?? 0) >= PARTY_POSTER ? acc(f) : me.id, 'saray', PARTY_POSTER, `${f.name} afişi`)) return `Parti afişi ${PARTY_POSTER} D (parti kasası ya da keseniz).`;
  const pp = (E(w).partyPosters ??= {}); pp[f.id] = (pp[f.id] ?? 0) + 1; return null;
}
export function endorse(w: World, me: Person, cand: Person): string | null {
  if (!me.faction || me.faction !== cand.faction) return 'Sadece kendi partinizin adayını destekleyebilirsiniz.'; if (!isCand(w, cand)) return 'O kişi aday değil.';
  const en = (E(w).endorse ??= {}); const l = (en[cand.id] ??= []); if (!l.includes(me.id)) l.push(me.id); return null;
}
/** Kara propaganda: lowers the target's support; if exposed it backfires on the source. */
export function smear(w: World, me: Person, t: Person): { ok: boolean; msg: string } {
  if (!campaigning(w)) return { ok: false, msg: 'Seçim dönemi değil.' }; if (!isCand(w, t)) return { ok: false, msg: 'O kişi aday değil.' };
  const s = (E(w).smear ??= {}); const c = (me.cs ??= {}); if (c.noted?.['smear'] === w.day) return { ok: false, msg: 'Bugün zaten dedikodu yaydınız.' }; (c.noted ??= {})['smear'] = w.day;
  if (chance(w, SMEAR_EXPOSE)) { s[me.id] = (s[me.id] ?? 0) + 5; itibar(w, me, -5, 'kara propaganda ortaya çıktı'); log(w, `🗞 Kara propaganda ifşa oldu: ${me.name}, ${t.name} hakkında yalan yaymış! Halk tepkili.`, me.id); return { ok: false, msg: 'Dedikodu kaynağı ortaya çıktı; ters tepti (itibar −5).' }; }
  s[t.id] = (s[t.id] ?? 0) + 3; (w.rumors ??= []).push({ day: w.day, text: `${t.name} hakkında çirkin sözler dolaşıyor…` } as never); return { ok: true, msg: `${t.name} hakkındaki dedikodu yayıldı.` };
}
/** Daily NPC campaigning + 'Seçim nabzı' for the gazete. */
export function campaignDay(w: World, now: number): void {
  const e = E(w); const ph = electionPhase(w).phase; if (ph !== 'aday' && ph !== 'propaganda') { e.nabiz = undefined; return; }
  for (const id of e.candidates) { const c = findPerson(w, id); if (!c) continue; if (!e.vaat?.[id] && !isPlayer(c)) npcVaat(w, c); }
  if (ph === 'propaganda') for (const id of e.candidates) { const c = findPerson(w, id); if (!c || isPlayer(c) || !chance(w, 0.35)) continue; miting(w, c, now); }
  for (const f of w.meclis.factions) if (ph === 'propaganda' && (f.kasa ?? 0) > 40 && chance(w, 0.5)) { const pp = (e.partyPosters ??= {}); if (transfer(w, acc(f), 'saray', PARTY_POSTER, `${f.name} afişi`)) pp[f.id] = (pp[f.id] ?? 0) + 1; }
  // nabız: a deterministic straw poll over 40 voters
  const voters = w.people.filter((p) => !p.playerId && p.prof !== 'naip').slice(0, 40); const cnt: Record<string, number> = {}; const party: Record<string, number> = {};
  for (const v of voters) { let best = ''; let bs = -Infinity; for (const id of e.candidates) { const c = findPerson(w, id); if (!c) continue; const sc = voterScore(w, v, c); if (sc > bs) { bs = sc; best = id; } } if (best) { cnt[best] = (cnt[best] ?? 0) + 1; const pf = findPerson(w, best)?.faction ?? 'bağımsız'; party[pf] = (party[pf] ?? 0) + 1; } }
  const lead = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => `${findPerson(w, id)?.name} %${Math.round(n / Math.max(1, voters.length) * 100)}`);
  const vs: Record<string, number> = {}; for (const [id, n] of Object.entries(cnt)) for (const g of e.vaat?.[id] ?? []) vs[g] = (vs[g] ?? 0) + n;
  const topV = Object.entries(vs).sort((a, b) => b[1] - a[1])[0];
  const pl = Object.entries(party).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${partyName(w, id === 'bağımsız' ? null : id)} %${Math.round(n / Math.max(1, voters.length) * 100)}`).join(', ');
  e.nabiz = `Seçim nabzı: önde ${lead.join(', ') || '—'}. Partiler: ${pl || '—'}.${topV ? ` En çok işe yarayan vaat: ${GENELGE[topV[0] as GKind].label}.` : ''}`;
  (w.gnews ??= []).push({ day: w.day, text: e.nabiz });
}
export const pickVaatFor = (w: World, p: Person): GKind => pick(w, (facOf(w, p.faction)?.program ?? ['ambar']) as GKind[]);
