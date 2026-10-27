/**
 * İsyan: a real-time uprising on the map. Rebels gather and occupy buildings hour by hour; the head of state
 * (or the acting ruler / naip AI / a soldier when nobody rules) commands the troops. The republic is declared ONLY
 * if the rebels win (take the Saray, or the army is gone). Afterwards the rebels decide the deposed Kayzer's fate.
 */
import type { Fate, Person, World } from './types';
import { transfer } from './economy';
import { chance, clamp } from './rng';
import { findPerson } from './world';
import { log } from './log';
import { openCase } from './ai';
import { die, emptiestHouse } from './family';

export const TARGETS = ['pazar', 'kahve', 'meclis', 'mahkeme', 'kisla', 'saray'];
export const FATE_LABEL: Record<Fate, string> = { surgun: 'Sürgün', zindan: 'Zindan', af: 'Af (sıradan vatandaşlık)' };
const ilog = (w: World, text: string, pid?: string): void => { if (w.isyan) { w.isyan.log.push(`Gün ${w.day} ${String(w.hour).padStart(2, '0')}:00 – ${text}`); if (w.isyan.log.length > 40) w.isyan.log.shift(); } log(w, `İSYAN: ${text}`, pid); };

const discontent = (w: World, p: Person): boolean => p.prof !== 'naip' && p.id !== w.kayzerId && p.jailedDays === 0 && p.exiledDays === 0 && !p.soylu && (p.republic > 50 || p.plotting === 'revolution' || (p.mood < 25 && p.loyalty < 40));
export const loyalSoldiers = (w: World): Person[] => w.people.filter((p) => p.prof === 'asker' && p.jailedDays === 0 && !(w.isyan?.rebels.includes(p.id)));

export function strength(w: World): { rebels: number; loyal: number } {
  const i = w.isyan; if (!i) return { rebels: 0, loyal: 0 };
  const reb = i.rebels.map((id) => findPerson(w, id)).filter((p): p is Person => !!p && p.jailedDays === 0);
  const rebels = reb.reduce((s, p) => s + (p.prof === 'asker' ? 3 : 1), 0) + i.occupied.length * 2;
  const loyal = loyalSoldiers(w).reduce((s, p) => s + 2 + p.loyalty / 50, 0) + w.people.filter((p) => p.prof === 'bekci' && p.jailedDays === 0 && p.loyalty > 40).length;
  return { rebels: Math.round(rebels), loyal: Math.round(loyal) };
}

export function startIsyan(w: World): void {
  if (w.isyan || w.regime !== 'imparatorluk' || !w.kayzerId) return;
  const rebels = w.people.filter((p) => discontent(w, p) || (p.prof === 'asker' && p.loyalty < 30));
  const leader = rebels.find((p) => p.plotting === 'revolution') ?? [...rebels].sort((a, b) => b.republic + b.ambition - a.republic - a.ambition)[0];
  w.isyan = { day: w.day, hour: w.hour, leaderId: leader?.id ?? null, rebels: rebels.map((p) => p.id), occupied: [], killed: 0, soldiersLost: 0, lastCmd: '', lastCmdHour: -99, log: [], hours: 0, concessions: 0 };
  ilog(w, `${leader?.name ?? 'Halk'} önderliğinde ${rebels.length} kişi ayaklandı! Asiler Pazar'da toplanıyor.`, leader?.id);
}

/** One game hour of the uprising. `aiCommand` = the naip/AI ruler's choice when no player commands. */
export function isyanHour(w: World, aiCommand: (() => 'dagit' | 'tutukla' | 'saldir' | null) | null): void {
  const i = w.isyan; if (!i) return;
  i.hours += 1;
  // the crowd grows with the discontented, shrinks as people lose heart
  for (const p of w.people) if (!i.rebels.includes(p.id) && discontent(w, p) && chance(w, 0.08)) i.rebels.push(p.id);
  for (const p of loyalSoldiers(w)) if (p.loyalty < 30 && chance(w, 0.12)) { i.rebels.push(p.id); ilog(w, `${p.name} silahıyla asilere katıldı!`, p.id); }
  if (aiCommand && i.hours - i.lastCmdHour >= 4) { const c = aiCommand(); if (c) command(w, c, 'Naip'); }
  const s = strength(w);
  if (i.hours % 3 === 0 && s.rebels > s.loyal * 0.8) {
    const next = TARGETS.find((t) => !i.occupied.includes(t));
    if (next) { i.occupied.push(next); ilog(w, `Asiler ${w.buildings.find((b) => b.id === next)?.name ?? next} binasını işgal etti!`); }
  }
  if (i.occupied.includes('saray') || loyalSoldiers(w).length === 0) { rebelVictory(w); return; }
  if (s.rebels <= 2 || i.hours > 72) endIsyan(w, i.hours > 72 ? 'İsyan kendiliğinden söndü; asiler evlerine döndü.' : 'İsyan bastırıldı.');
}

export function command(w: World, cmd: 'dagit' | 'tutukla' | 'saldir', by: string): string {
  const i = w.isyan; if (!i) return 'Ortada isyan yok.';
  i.lastCmd = cmd; i.lastCmdHour = i.hours;
  const s = strength(w);
  const rebels = i.rebels.map((id) => findPerson(w, id)).filter((p): p is Person => !!p);
  if (cmd === 'dagit') {
    // negotiate & disperse: concessions cost the treasury; moderates go home
    const cost = Math.min(w.treasury, 150 + rebels.length * 5);
    if (cost > 0) transfer(w, 'saray', rebels[0]?.id ?? 'saray', cost, 'isyan tavizi');
    w.taxRate = Math.max(0, w.taxRate - 2); i.concessions += 1;
    let left = 0;
    for (const p of rebels) if (p.plotting !== 'revolution' && p.republic < 75 && chance(w, 0.55)) { i.rebels = i.rebels.filter((x) => x !== p.id); p.mood = clamp(p.mood + 10); p.republic = clamp(p.republic - 15); left += 1; }
    if (left >= 2) i.occupied.pop();
    ilog(w, `${by} asilerle pazarlık etti: vergi %${w.taxRate}, ${Math.round(cost)} Dinar taviz. ${left} kişi evine döndü.`);
    return `${left} asi dağıldı.`;
  }
  if (cmd === 'tutukla') {
    if (s.loyal < s.rebels * 0.5) { for (const p of loyalSoldiers(w)) p.loyalty = clamp(p.loyalty - 5); ilog(w, `${by} tutuklama emri verdi ama askerler kalabalığa yaklaşamadı.`); return 'Asker sayısı yetmedi; moral düştü.'; }
    const taken = [...rebels].sort((a, b) => (b.id === i.leaderId ? 100 : 0) + b.republic - (a.id === i.leaderId ? 100 : 0) - a.republic).slice(0, 5);
    for (const p of taken) { openCase(w, p.id, 'isyan', null, 0, 80); p.jailedDays = Math.max(p.jailedDays, 5); i.rebels = i.rebels.filter((x) => x !== p.id); }
    for (const p of w.people) if (p.republic > 30) p.loyalty = clamp(p.loyalty - 1);
    ilog(w, `${by} emriyle ${taken.length} elebaşı tutuklandı: ${taken.map((p) => p.name).join(', ')}.`);
    return `${taken.length} kişi tutuklandı.`;
  }
  // saldır: bloodshed both ways
  const ratio = s.loyal / Math.max(1, s.rebels);
  const rebelLoss = Math.min(rebels.length, Math.max(1, Math.round(rebels.length * Math.min(0.5, 0.15 * ratio))));
  const soldierLoss = Math.min(loyalSoldiers(w).length, Math.round(rebelLoss / Math.max(0.6, ratio)));
  const victims = [...rebels].filter((p) => !p.playerId).sort((a, b) => a.health - b.health).slice(0, rebelLoss);
  for (const p of victims) die(w, p, `${p.name} çatışmada hayatını kaybetti.`);
  for (const p of rebels.filter((x) => x.playerId).slice(0, Math.max(0, rebelLoss - victims.length))) { p.health = 10; p.jailedDays = 7; i.rebels = i.rebels.filter((x) => x !== p.id); }
  const sl = loyalSoldiers(w).filter((p) => !p.playerId).slice(0, soldierLoss);
  for (const p of sl) die(w, p, `Asker ${p.name} çatışmada şehit düştü.`);
  i.killed += victims.length; i.soldiersLost += sl.length;
  for (const p of w.people) { p.mood = clamp(p.mood - 6); p.loyalty = clamp(p.loyalty - 3); if (p.prof === 'asker') p.loyalty = clamp(p.loyalty - 4); }
  if (ratio > 1.5) i.occupied = i.occupied.slice(0, -1);
  ilog(w, `${by} saldırı emri verdi! ${victims.length} asi ve ${sl.length} asker öldü.`);
  return `Çatışma: ${victims.length} asi, ${sl.length} asker öldü.`;
}

function endIsyan(w: World, text: string): void {
  ilog(w, text);
  for (const p of w.people) p.republic = clamp(p.republic - 20);
  w.isyan = null; w.cumhuriyetDays = 0;
}

/** Rebels win: the republic is declared; the deposed Kayzer's fate is decided by the rebels within a day. */
export function rebelVictory(w: World): void {
  const i = w.isyan!; const old = findPerson(w, w.kayzerId);
  const voters = i.rebels.filter((id) => findPerson(w, id)?.playerId);
  ilog(w, `Asiler Saray'ı aldı! ${old?.name ?? 'Kayzer'} tahttan indirildi. CUMHURİYET İLAN EDİLDİ!`);
  w.isyan = null;
  w.regime = 'cumhuriyet'; w.kayzerId = null; w.taxRate = Math.min(w.taxRate, 12); w.coup = null; w.regentId = null; w.regentFor = null;
  w.election.baskanNextDay = w.day + 1; w.election.baskanCandidates = []; w.election.baskanVotes = {};
  for (const p of w.people) { p.republic = clamp(p.republic - 40); p.mood = clamp(p.mood + 10); if (p.prof === 'asker') p.loyalty = 60; }
  for (const p of w.people) if (p.soylu && p.home === 'saray') { p.soylu = false; p.home = emptiestHouse(w); }
  if (old) { old.prof = 'memur'; old.work = 'saray'; old.home = emptiestHouse(w); w.deposed = { personId: old.id, until: w.day + 1, killed: i.killed, votes: {}, voters }; }
  w.cumhuriyetDays = 0; w.cumhuriyet = Math.round(w.people.reduce((s, p) => s + p.republic, 0) / w.people.length);
}

/** NPC rebel leaders' rule: bloodshed → zindan, a ruinous reign → sürgün, otherwise af. */
export function ruleFate(w: World, killed: number): Fate {
  if (killed >= 3) return 'zindan';
  if (w.taxRate >= 20 || w.treasury < 500) return 'surgun';
  return 'af';
}
export function voteFate(w: World, p: Person, fate: Fate): string {
  const d = w.deposed; if (!d) return 'Karar verilecek bir devrik hükümdar yok.';
  if (!d.voters.includes(p.id)) return 'Sadece isyana katılan oyuncular oy verir.';
  d.votes[p.id] = fate; return `Oyunuz: ${FATE_LABEL[fate]}.`;
}
export function settleFate(w: World): void {
  const d = w.deposed; if (!d || w.day < d.until) return; const killed = d.killed;
  const t: Record<Fate, number> = { surgun: 0, zindan: 0, af: 0 }; for (const f of Object.values(d.votes)) t[f] += 1;
  const voted = Object.values(t).some((x) => x > 0);
  const fate: Fate = voted ? (Object.entries(t).sort((a, b) => b[1] - a[1])[0]![0] as Fate) : ruleFate(w, killed);
  const p = findPerson(w, d.personId); w.deposed = null; if (!p) return;
  if (fate === 'surgun') { p.exiledDays = 20; p.home = 'liman'; }
  else if (fate === 'zindan') { p.jailedDays = 15; }
  else { p.prof = 'hamal'; p.work = 'pazar'; }
  log(w, `Asilerin kararı (${voted ? 'oylama' : 'önderlerin kararı'}): devrik ${p.name} için ${FATE_LABEL[fate]}. Hanedan hakkı yine de sürüyor.`, p.id);
}
