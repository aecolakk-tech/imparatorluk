/**
 * v2.0.1 party package: programs (linked to the genelge catalogue), party lines + discipline, coalition/hükümet,
 * party kasa (account 'parti:<id>', money conserved), Ocak, mahalle support, proportional (D'Hondt) seats,
 * opposition soru önergesi / hazine audit, ranks (üye / il başkanı / genel başkan).
 */
import { use } from './usage';
import type { Bill, Faction, Person, VoteChoice, World } from './types';
import type { GKind } from './genelge';
import { GENELGE, isGKind } from './genelge';
import { transfer } from './economy';
import { chance, clamp } from './rng';
import { findPerson } from './world';
import { personal } from './log';
import { itibar } from './career';

export const DISTRICTS = ['merkez', 'bati', 'dogu', 'liman'] as const;
export const DISTRICT_LABEL: Record<string, string> = { merkez: 'Merkez', bati: 'Batı', dogu: 'Doğu', liman: 'Liman' };
export const PROGRAMS: Record<string, { program: GKind[]; oppose: GKind[] }> = {
  saltanatci: { program: ['asker', 'vergiArtirim', 'ickiYasak', 'liman'], oppose: ['vergiIndirim', 'ickiSerbest'] },
  cumhuriyetci: { program: ['okul', 'bekci', 'saglik', 'ickiSerbest'], oppose: ['ickiYasak', 'asker'] },
  esnaf: { program: ['vergiIndirim', 'yol', 'ithalat', 'liman'], oppose: ['vergiArtirim', 'fiyatTavani'] },
  halkci: { program: ['ambar', 'asevi', 'fiyatTavani', 'saglik'], oppose: ['vergiArtirim'] },
};
export const AXES: Record<string, [number, number, number]> = { saltanatci: [15, 50, 35], cumhuriyetci: [90, 50, 60], esnaf: [50, 15, 50], halkci: [60, 85, 40] };
export const AXIS_LABEL: [string, string, string][] = [['Yönetim', 'Saltanat', 'Cumhuriyet'], ['Ekonomi', 'Serbest pazar', 'Devlet desteği/narh'], ['Din', 'Dindar', 'Laik']];
export const axesOf = (f: Faction): [number, number, number] => f.axes ?? AXES[f.ideology] ?? [50, 50, 50];
/** A person's position: yönetim from cumhuriyetçilik, ekonomi from wealth/meslek, din from dindarlık. Read-only (never changes republic/din). */
export function personAxes(p: Person): [number, number, number] {
  const trader = ['tuccar', 'firinci', 'kasap', 'marangoz', 'demirci', 'dokumaci', 'terzi', 'barci', 'degirmenci', 'mobilyaci'].includes(p.prof);
  const worker = ['hamal', 'ciftci', 'insaatci', 'balikci', 'sucu', 'cirak'].includes(p.prof as string);
  const uniform = p.prof === 'asker' || p.soylu || !!p.rank; const cleric = p.prof === 'imam' || p.prof === 'hoca';
  const yon = clamp(p.republic * 0.8 + (100 - p.loyalty) * 0.2 - (uniform ? 25 : 0), 0, 100);
  const eko = clamp(70 - Math.min(60, p.money / 4) + (worker ? 20 : 0) - (trader ? 35 : 0), 0, 100);
  const din = clamp(100 - p.din - (cleric ? 20 : 0), 0, 100);
  return [yon, eko, din];
}
export const axisDist = (a: [number, number, number], b: [number, number, number]): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Where a genelge moves policy for this party: + toward its position (yes), − away (no). */
export function axisFit(f: Faction, k: GKind): number { const ax = axesOf(f); const e = GENELGE[k].axes; let s = 0; for (let i = 0; i < 3; i++) s += e[i]! * (ax[i]! - 50) / 50; return Math.max(-1, Math.min(1, s)); }
export const DUES = 1; export const JOIN_FEE = 5; export const FOUND_FEE = 100; export const MAJORITY = 9;
export const NEAR: Record<string, string[]> = { saltanatci: ['esnaf'], esnaf: ['saltanatci', 'halkci'], halkci: ['cumhuriyetci', 'esnaf'], cumhuriyetci: ['halkci'] };
export const acc = (f: Faction): string => `parti:${f.id}`;
export const facOf = (w: World, id: string | null | undefined): Faction | undefined => (id ? w.meclis.factions.find((f) => f.id === id) : undefined);
export const partyName = (w: World, id: string | null | undefined): string => facOf(w, id)?.name ?? 'Bağımsız';
export const membersOf = (w: World, f: Faction): Person[] => w.people.filter((p) => p.faction === f.id);
export const mpsOf = (w: World, f: Faction): Person[] => w.people.filter((p) => p.faction === f.id && p.meclis);
const isPlayer = (p: Person): boolean => !!p.playerId && !p.npc;
const tell = (w: World, p: Person, m: string): void => { if (p.playerId) personal(w, p.playerId, m); };
function districtOf(w: World, p: Person): string { const b = w.buildings.find((x) => x.id === p.home); const x = b?.x ?? 36; const y = b?.y ?? 20; if (y >= 38) return 'liman'; if (x < 24) return 'bati'; if (x < 48) return 'merkez'; return 'dogu'; }
export { districtOf as partyDistrict };

/** Migration: programs, kasa, support, NPC membership (≈1 in 5 adults) – existing seats untouched. */
export function migrateParty(w: World): void {
  for (const f of w.meclis.factions) {
    const pr = PROGRAMS[f.ideology] ?? PROGRAMS.halkci!;
    f.axes ??= [...(AXES[f.ideology] ?? [50, 50, 50])] as [number, number, number];
    f.program ??= [...pr.program]; f.oppose ??= [...pr.oppose]; f.kasa ??= 0; f.standing ??= {}; f.strikes ??= {}; f.ilBaskan ??= {};
    f.support ??= Object.fromEntries(DISTRICTS.map((d) => [d, 25]));
  }
  if ((w as { partyV?: number }).partyV) return; (w as { partyV?: number }).partyV = 1;
  for (const p of w.people) { if (p.faction || p.playerId || p.prof === 'naip' || p.prof === 'kayzer') continue; if ((hash(p.id) % 5) === 0) p.faction = closest(w, p)?.id ?? null; }
  recomputeSupport(w);
}
const hash = (s: string): number => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
export function closest(w: World, p: Person): Faction | undefined { const me = personAxes(p); return [...w.meclis.factions].sort((a, b) => axisDist(me, axesOf(a)) - axisDist(me, axesOf(b)))[0]; }
/** Program match of a genelge for a party: +1 program, −1 opposed, 0 neutral. */
export function programFit(f: Faction | undefined, k: string): number { if (!f || !isGKind(k)) return 0; if (f.program?.includes(k)) return 1; if (f.oppose?.includes(k)) return -1; const a = axisFit(f, k); return Math.abs(a) >= 0.2 ? a : 0; }

// ---------------- support (mahalle %) ----------------
export function recomputeSupport(w: World): void {
  const fs = w.meclis.factions; if (!fs.length) return;
  for (const d of DISTRICTS) {
    const ppl = w.people.filter((p) => districtOf(w, p) === d && p.prof !== 'naip'); if (!ppl.length) continue;
    const score: Record<string, number> = {};
    for (const f of fs) score[f.id] = 1 + ppl.filter((p) => p.faction === f.id).length * 3 + ppl.filter((p) => !p.faction && closest(w, p)?.id === f.id).length + (f.support?.[d] ?? 25) / 10;
    const tot = Object.values(score).reduce((a, b) => a + b, 0);
    for (const f of fs) { const target = (score[f.id]! / tot) * 100; f.support![d] = Math.round(((f.support![d] ?? 25) * 0.7 + target * 0.3) * 10) / 10; }
  }
}
export const supportAvg = (f: Faction): number => { const v = Object.values(f.support ?? {}); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : 0; };
/** A genelge ended: the proposer's party (and the hükümet) gain or lose support by the measured result. */
export function partyOnGenelge(w: World, g: { by?: string | null; result?: number; kind: GKind }): void {
  const f = facOf(w, findPerson(w, g.by ?? undefined)?.faction ?? null); if (!f || !g.result) return;
  for (const d of DISTRICTS) f.support![d] = clamp((f.support![d] ?? 25) + g.result * 3, 1, 90);
  (w.gnews ??= []).push({ day: w.day, text: `${f.name}: “${GENELGE[g.kind].label}” ${g.result > 0 ? 'işe yaradı, desteği arttı' : 'ters tepti, desteği düştü'} (ort. %${supportAvg(f)}).` });
}

// ---------------- party line & discipline ----------------
/** The line each party takes on a bill: program/oppose for genelgeler, otherwise the leader's (or majority's) stance. */
export function partyLines(w: World, b: Bill, stance: (p: Person) => number): Record<string, VoteChoice> {
  const out: Record<string, VoteChoice> = {};
  for (const f of w.meclis.factions) {
    const mps = mpsOf(w, f); if (!mps.length) continue;
    if (b.fromKayzer && (axesOf(f)[0] ?? 50) < 40) { out[f.id] = 'evet'; continue; } // the Saltanat side backs the palace's own bills
    if (b.kind === 'cumhuriyet') { const yon = axesOf(f)[0] ?? 50; out[f.id] = yon < 40 ? 'hayir' : yon > 60 ? 'evet' : 'cekimser'; continue; } // anayasa: the line is the program's, but MPs vote by conscience
    const fit = b.kind === 'genelge' ? programFit(f, b.target) : 0;
    let s: number;
    if (fit) s = fit; else { const leader = findPerson(w, f.leaderId); s = leader && leader.meclis ? stance(leader) : mps.reduce((a, p) => a + stance(p), 0) / mps.length; }
    if (findPerson(w, b.proposerId)?.faction === f.id) s += 0.6; // a party backs its own member's bill
    if ((b.cost ?? 0) > 0 && w.treasury - (b.cost ?? 0) < 300) s = -1; // hazine can't afford it
    out[f.id] = s > 0.15 ? 'evet' : s < -0.15 ? 'hayir' : 'cekimser';
  }
  // coalition partners follow the lead party unless their program opposes the bill
  const g = w.meclis.govt ?? []; const lead = g[0];
  if (lead && out[lead]) for (const id of g.slice(1)) if (out[id] && !(b.kind === 'genelge' && programFit(facOf(w, id), b.target) < 0)) out[id] = out[lead]!;
  return out;
}
/** Final vote of an NPC MP: the party line unless he defects (weak standing/loyalty or a strong personal stake). */
export function disciplinedVote(w: World, p: Person, b: Bill, own: number): { v: VoteChoice; defect: boolean } {
  const ownV: VoteChoice = own > 0.15 ? 'evet' : own < -0.15 ? 'hayir' : 'cekimser';
  const f = facOf(w, p.faction); const line = f ? b.lines?.[f.id] : undefined;
  if (!f || !line) return { v: ownV, defect: false };
  const standing = f.standing?.[p.id] ?? 60; const stake = Math.abs(own) >= 0.95 && ownV !== line && ownV !== 'cekimser';
  const pDefect = ownV === line ? 0 : (stake ? 0.5 : 0) + (standing < 35 ? 0.2 : 0) + (p.loyalty < 25 ? 0.1 : 0) + 0.03;
  if (ownV !== line && chance(w, pDefect)) return { v: ownV, defect: true };
  return { v: line, defect: false };
}
/** Record a cast vote; voting against the line costs party standing, a second time = expelled. */
export function recordVote(w: World, p: Person, b: Bill, v: VoteChoice): void {
  const f = facOf(w, p.faction); const line = f ? b.lines?.[f.id] : undefined;
  (p.voteRec ??= []).push({ bill: b.title.slice(0, 50), v, line, day: w.day }); if (p.voteRec.length > 12) p.voteRec.shift();
  if (!f || !line || v === line || v === 'cekimser') { if (f && line && v === line) f.standing![p.id] = clamp((f.standing![p.id] ?? 60) + 1, 0, 100); return; }
  (b.defectors ??= []).push(p.id);
  // v2.0.1 anayasa (Cumhuriyet İlanı) is a vicdan oyu: the defection is logged but not punished
  if (b.kind === 'cumhuriyet') { w.meclis.log.push({ day: w.day, text: `↔️ ${p.name} anayasa oylamasında ${f.name} çizgisinden ayrıldı (vicdan oyu: ${v === 'evet' ? 'evet' : 'hayır'}).` }); return; }
  f.standing![p.id] = clamp((f.standing![p.id] ?? 60) - 15, 0, 100); f.strikes![p.id] = (f.strikes![p.id] ?? 0) + 1;
  w.meclis.log.push({ day: w.day, text: `↔️ ${p.name} “${b.title}” oylamasında ${f.name} çizgisinden ayrıldı (${v === 'evet' ? 'evet' : 'hayır'} dedi).` });
  if (f.strikes![p.id]! >= 2) expel(w, p, f, 'parti çizgisine iki kez aykırı oy');
  else tell(w, p, `⚠️ ${f.name}: parti çizgisine aykırı oy verdiniz (parti içi itibar ${Math.round(f.standing![p.id]!)}). Bir daha olursa ihraç edilirsiniz.`);
}
export function expel(w: World, p: Person, f: Faction, why: string): void {
  use(w, 'parti_ihrac', p);
  p.faction = null; delete f.standing![p.id]; delete f.strikes![p.id]; if (f.leaderId === p.id) f.leaderId = null;
  w.meclis.log.push({ day: w.day, text: `🚪 ${p.name} ${f.name}’nden ihraç edildi (${why}); artık bağımsız.` }); tell(w, p, `🚪 ${f.name} sizi ihraç etti: ${why}.`);
}

// ---------------- membership, kasa, Ocak ----------------
export function joinParty(w: World, p: Person, id: string): string | null {
  const f = facOf(w, id); if (!f) return 'Böyle bir parti yok.'; if (p.faction === id) return 'Zaten üyesiniz.';
  if (p.prof === 'asker' || p.prof === 'bekci') return 'Askerler ve bekçiler partiye üye olamaz.';
  if (!transfer(w, p.id, acc(f), JOIN_FEE, `${f.name} üyelik ücreti`)) return `Üyelik ücreti ${JOIN_FEE} D.`;
  const old = facOf(w, p.faction); if (old) { delete old.standing![p.id]; if (old.leaderId === p.id) old.leaderId = null; }
  p.faction = id; f.standing![p.id] = 50; f.strikes![p.id] = 0; if (isPlayer(p)) itibar(w, p, 1, `${f.name}’ne üye oldu`);
  return null;
}
export function resignParty(w: World, p: Person): string | null { const f = facOf(w, p.faction); if (!f) return 'Bir partiye üye değilsiniz.'; p.faction = null; delete f.standing![p.id]; if (f.leaderId === p.id) f.leaderId = null; w.meclis.log.push({ day: w.day, text: `${p.name} ${f.name}’nden istifa etti.` }); return null; }
export function foundParty(w: World, p: Person, name: string, ideology: Faction['ideology'], axes?: [number, number, number]): string | null {
  const n = name.trim().slice(0, 30); if (n.length < 3) return 'Parti adı en az 3 harf.'; if (w.meclis.factions.some((f) => f.name.toLocaleLowerCase('tr') === n.toLocaleLowerCase('tr'))) return 'Bu adla bir parti var.';
  if (w.meclis.factions.length >= 8) return 'En fazla 8 parti olabilir.'; if ((p.itibar ?? 10) < 30) return 'Parti kurmak için itibar 30 gerekir.';
  if (!transfer(w, p.id, 'saray', FOUND_FEE, 'parti kuruluş harcı')) return `Kuruluş harcı ${FOUND_FEE} D.`;
  const id = `f${w.idSeq++}`; const pr = PROGRAMS[ideology] ?? PROGRAMS.halkci!;
  w.meclis.factions.push({ id, name: n, ideology, axes: axes ? (axes.map((x) => clamp(Math.round(x), 0, 100)) as [number, number, number]) : [...(AXES[ideology] ?? [50, 50, 50])] as [number, number, number], leaderId: p.id, color: ['#2a9d8f', '#e76f51', '#8ab17d', '#b56576'][w.meclis.factions.length % 4]!, program: [...pr.program], oppose: [...pr.oppose], kasa: 0, standing: { [p.id]: 80 }, strikes: {}, support: Object.fromEntries(DISTRICTS.map((d) => [d, 5])), ilBaskan: {}, founded: w.day });
  const old = facOf(w, p.faction); if (old) delete old.standing![p.id]; p.faction = id;
  w.meclis.log.push({ day: w.day, text: `🎉 ${p.name} yeni bir parti kurdu: ${n}.` }); return null;
}
export function donate(w: World, p: Person, amount: number): string | null { const f = facOf(w, p.faction); if (!f) return 'Önce bir partiye üye olun.'; if (!transfer(w, p.id, acc(f), amount, `${f.name} bağışı`)) return 'Kesenizde o kadar yok.'; f.standing![p.id] = clamp((f.standing![p.id] ?? 50) + Math.min(10, amount / 5), 0, 100); return null; }
/** Ocak toplantısı: once a day, +party standing, +1 itibar for players (max once a day). */
export function meeting(w: World, p: Person): string | null {
  const f = facOf(w, p.faction); if (!f) return 'Önce bir partiye üye olun.'; const c = (p.cs ??= {}); if (c.noted?.['ocak'] === w.day) return 'Bugün toplantıya katıldınız.';
  (c.noted ??= {})['ocak'] = w.day; f.standing![p.id] = clamp((f.standing![p.id] ?? 50) + 3, 0, 100); if (isPlayer(p)) itibar(w, p, 1, `${f.name} Ocak toplantısı`); return null;
}
export function rankInParty(w: World, p: Person): string | null { const f = facOf(w, p.faction); if (!f) return null; if (f.leaderId === p.id) return 'Genel başkan'; if (Object.values(f.ilBaskan ?? {}).includes(p.id)) return 'İl başkanı'; return 'Üye'; }

/** Daily: dues, kasa spending (help poor members), support drift, rival arguments, ranks, opposition audit, priority bill. */
export function partyDay(w: World, propose: (p: Person, k: GKind, priority: boolean) => void): void {
  migrateParty(w);
  for (const f of w.meclis.factions) {
    for (const p of membersOf(w, f)) if (p.money > 20 && p.jailedDays === 0) transfer(w, p.id, acc(f), DUES, `${f.name} aidatı`);
    // help for poor members (max 3 a day) when the kasa has room
    for (const p of membersOf(w, f).filter((x) => x.money < 3).slice(0, 3)) if ((f.kasa ?? 0) > 40) transfer(w, acc(f), p.id, 3, `${f.name} yardımı`);
    // v2.0.1: a fat kasa doesn't sit idle – the party runs a hayır sofrası for the city's poorest (money stays in circulation)
    if ((f.kasa ?? 0) > 300) { const pot = Math.round(((f.kasa ?? 0) - 300) * 0.05 * 100) / 100; const poor = w.people.filter((x) => x.money < 10 && x.jailedDays <= 0).sort((a, b) => a.money - b.money).slice(0, 6);
      if (poor.length && pot >= 1) { const each = Math.round((pot / poor.length) * 100) / 100; for (const x of poor) transfer(w, acc(f), x.id, each, `${f.name} hayır sofrası`); use(w, 'parti_hayir'); } }
    // ranks: il başkanı per district = highest standing member there
    for (const d of DISTRICTS) { const best = membersOf(w, f).filter((p) => districtOf(w, p) === d).sort((a, b) => (f.standing![b.id] ?? 0) - (f.standing![a.id] ?? 0))[0]; if (best) f.ilBaskan![d] = best.id; else delete f.ilBaskan![d]; }
    if (!findPerson(w, f.leaderId) || findPerson(w, f.leaderId)?.faction !== f.id) f.leaderId = pickLeader(w, f);
  }
  if (w.day % 7 === 3) for (const p of w.people) { if (p.playerId || !p.faction || p.meclis) continue; const own = facOf(w, p.faction); const best = closest(w, p); if (own && best && best.id !== own.id && axisDist(personAxes(p), axesOf(own)) - axisDist(personAxes(p), axesOf(best)) > 30 && chance(w, 0.3)) { p.faction = best.id; delete own.standing![p.id]; best.standing![p.id] = 50; use(w, 'parti_degistir', p); } }
  // non-members slowly join the closest party (keeps membership ≈ 1 in 5)
  { const share = w.people.filter((p) => p.faction).length / Math.max(1, w.people.length); if (share < 0.2) for (const p of w.people) if (!p.playerId && !p.faction && p.prof !== 'naip' && p.prof !== 'asker' && p.prof !== 'bekci' && chance(w, 0.02)) { p.faction = closest(w, p)?.id ?? null; use(w, 'parti_uye', p); } }
  recomputeSupport(w);
  // rival arguments (a couple a day)
  const ms = w.people.filter((p) => p.faction && !p.playerId);
  for (let i = 0; i < 2 && ms.length > 1; i++) { const a = ms[Math.floor((w.day * 7 + i * 13) % ms.length)]!; const b = ms[Math.floor((w.day * 11 + i * 5 + 3) % ms.length)]!; if (a.faction !== b.faction && a.id !== b.id && chance(w, 0.5)) { a.relations[b.id] = clamp((a.relations[b.id] ?? 0) - 3, -100, 100); b.relations[a.id] = clamp((b.relations[a.id] ?? 0) - 3, -100, 100); (a.relNote ??= {})[b.id] = 'siyasette ayrı düşüyoruz'; } }
  // weekly: the hükümet's priority proposal; the opposition's soru önergesi + hazine audit
  if (w.day % 7 === 1) {
    const g = facOf(w, (w.meclis.govt ?? [])[0]); const lead = g && (findPerson(w, g.leaderId)?.meclis ? findPerson(w, g.leaderId) : mpsOf(w, g)[0]);
    if (g && lead && !lead.playerId) { const k = (g.program ?? []).find((x) => !(w.genelgeler ?? []).some((a) => a.kind === x && a.until >= w.day) && !w.meclis.bills.some((b) => b.target === x && ['tartisma', 'oylama', 'onay'].includes(b.status))); if (k) propose(lead, k, true); }
    audit(w);
  }
  if (w.day % 7 === 0) { const line = w.meclis.factions.map((f) => `${f.name} %${supportAvg(f)}`).join(', '); (w.gnews ??= []).push({ day: w.day, text: `Haftalık parti desteği: ${line}.` }); }
}
function pickLeader(w: World, f: Faction): string | null {
  const bid = new Set(f.leaderBid ?? []);
  const c = membersOf(w, f).sort((a, b) => score(b) - score(a))[0]; return c?.id ?? null;
  function score(p: Person): number { return (f.standing![p.id] ?? 50) + (p.itibar ?? 10) / 2 + (p.meclis ? 20 : 0) + (bid.has(p.id) ? 25 : 0) + p.ambition / 10; }
}
/** Each election cycle the members re-elect the genel başkan (players who declared get a bonus). */
export function reelectLeaders(w: World): void { use(w, 'lider_secimi'); for (const f of w.meclis.factions) { const old = f.leaderId; f.leaderId = pickLeader(w, f); f.leaderBid = []; if (f.leaderId !== old) w.meclis.log.push({ day: w.day, text: `${f.name} genel başkanı: ${findPerson(w, f.leaderId)?.name ?? '—'}.` }); } }
/** Opposition (second-largest party) asks a soru önergesi about the hazine; the saray replies in the gazete. */
export function audit(w: World): void {
  const ranked = w.meclis.factions.map((f) => ({ f, n: mpsOf(w, f).length })).sort((a, b) => b.n - a.n); const opp = ranked.find((x) => !(w.meclis.govt ?? []).includes(x.f.id) && x.n > 0)?.f ?? ranked[1]?.f;
  if (!opp || opp.lastAudit === w.day) return; opp.lastAudit = w.day;
  const book = (w.treasuryBook ?? []).slice(-5); const tot: Record<string, number> = {}; for (const d of book) for (const [k, v] of Object.entries(d.items)) tot[k] = (tot[k] ?? 0) + v;
  const inc = Object.entries(tot).filter(([k]) => k.startsWith('+')).reduce((a, [, v]) => a + v, 0); const out = Object.entries(tot).filter(([k]) => k.startsWith('-')).reduce((a, [, v]) => a + v, 0);
  const top = Object.entries(tot).filter(([k]) => k.startsWith('-')).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k.slice(1)} ${Math.round(v)} D`).join(', ');
  const net = Math.round((inc - out) / Math.max(1, book.length));
  const q = `Soru önergesi (${opp.name}): Hazine son ${book.length} günde günlük ortalama ${net >= 0 ? '+' : ''}${net} D. Para nereye gidiyor?`;
  const a = `Saray’ın cevabı: En büyük giderler ${top || '—'}. Hazinede ${Math.round(w.treasury)} D var${net < 0 ? '; harcamalar gözden geçirilecek' : ''}.`;
  (w.gnews ??= []).push({ day: w.day, text: `${q} ${a}` }); w.meclis.log.push({ day: w.day, text: `❓ ${q} — ${a}` });
}
/** Hükümet after an election: a party with ≥9 seats, else the largest party + its nearest allies until ≥9. */
export function formGovt(w: World): void {
  const seats = (id: string): number => w.meclis.seats.filter((s) => findPerson(w, s.holder)?.faction === id).length;
  const ranked = w.meclis.factions.map((f) => ({ f, n: seats(f.id) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  if (!ranked.length) { w.meclis.govt = []; return; }
  const lead = ranked[0]!; const g = [lead.f.id]; let n = lead.n;
  const byClose = ranked.filter((r) => r.f.id !== lead.f.id).sort((a, b) => axisDist(axesOf(lead.f), axesOf(a.f)) - axisDist(axesOf(lead.f), axesOf(b.f)));
  for (const x of byClose) { if (n >= MAJORITY) break; g.push(x.f.id); n += x.n; }
  w.meclis.govt = g; const head = findPerson(w, lead.f.leaderId)?.meclis ? lead.f.leaderId : mpsOf(w, lead.f).sort((a, b) => b.ambition - a.ambition)[0]?.id ?? null; w.meclis.baskanId = head;
  w.meclis.log.push({ day: w.day, text: g.length > 1 ? `🤝 Koalisyon: ${g.map((id) => facOf(w, id)!.name).join(' + ')} (${n} sandalye). Meclis başkanı: ${findPerson(w, head)?.name ?? '—'}.` : `🏛 Hükümet partisi: ${lead.f.name} (${lead.n} sandalye). Meclis başkanı: ${findPerson(w, head)?.name ?? '—'}.` });
}
/** D'Hondt seat allocation over party lists (+ independents as one-person lists); a list never gets more seats than candidates. */
export function dhondt(votes: Record<string, number>, caps: Record<string, number>, seats: number): Record<string, number> {
  const got: Record<string, number> = {}; for (const k of Object.keys(votes)) got[k] = 0;
  for (let s = 0; s < seats; s++) {
    let best = ''; let bq = -1;
    for (const [k, v] of Object.entries(votes)) { if ((got[k] ?? 0) >= (caps[k] ?? 0)) continue; const q = v / ((got[k] ?? 0) + 1); if (q > bq || (q === bq && k < best)) { bq = q; best = k; } }
    if (!best) break; got[best] = (got[best] ?? 0) + 1;
  }
  return got;
}
/** Same-party trade discount. */
export const partyTradeMul = (w: World, buyer: Person | undefined, sellerId: string): number => { if (!buyer?.faction) return 1; const s = findPerson(w, sellerId); return s && s.faction === buyer.faction ? 0.97 : 1; };
