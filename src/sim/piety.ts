/**
 * v2.0.1 dindarlık: Cuma namazı, daily namaz, sadaka, oruç (Ramazan), Bayram, aşevi, şifa duası, weekday names.
 * Calendar: the week is a 7-day cycle (Cuma = day % 7 === 5), independent of the 5-day year.
 * Year days: 1 ilkbahar-ish … Ramazan = 3rd day of each year, Bayram = 4th day, Panayır = 5th day (day % 5 === 0).
 */
import { use } from './usage';
import type { Person, World } from './types';
import { DAYS_PER_YEAR } from './constants';
import { transfer } from './economy';
import { clamp } from './rng';
import { log, personal, isOnline } from './log';
import { distToBuilding, REACH } from './move';
import { myPos } from './v16';
import { itibar, note } from './career';
import { findPerson } from './world';

export const WEEK = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export const weekday = (day: number): string => WEEK[(((day % 7) + 6) % 7)]!;
export const isCuma = (day: number): boolean => day % 7 === 5;
export const weekOf = (day: number): number => Math.floor((day - 5) / 7);
export const yearDay = (day: number): number => ((day - 1) % DAYS_PER_YEAR) + 1; // 1..5
export const RAMAZAN_DAY = 3, BAYRAM_DAY = 4;
export const isRamazan = (day: number): boolean => yearDay(day) === RAMAZAN_DAY;
export const isBayram = (day: number): boolean => yearDay(day) === BAYRAM_DAY;
export const fasting = (w: World): boolean => isRamazan(w.day) && w.hour >= 6 && w.hour < 22;
const isPlayer = (p: Person): boolean => !!p.playerId && !p.npc;
const tell = (w: World, p: Person, m: string): void => { if (p.playerId) personal(w, p.playerId, m); };

/** Change din with a 'Neden değişti' note. */
export function din(w: World, p: Person, d: number, why: string): void {
  const b = p.din; p.din = clamp(p.din + d); note(w, p, 'din', p.din - b, why);
  if (isPlayer(p) && Math.abs(d) >= 1) tell(w, p, `🕌 Dindarlık ${d > 0 ? '+' : ''}${d}: ${why}`);
}
/** Trait word shown when tapping an NPC. */
export function trait(p: Person): string | null { if (p.din >= 75) return 'Dindar'; if (p.din <= 25 || (p.lastAction ?? '').includes('meyhane')) return 'Meyhane müdavimi'; return null; }
export const atBuilding = (w: World, p: Person, id: string, now: number): boolean => { const b = w.buildings.find((x) => x.id === id); return !!b && distToBuilding(b, myPos(w, p, now)) <= REACH + 0.5; };
/** Daily namaz at the cami: +1 din at most once a day (mood too). During the Cuma window this is the Cuma namazı. */
export function namaz(w: World, p: Person, now: number): string {
  const c = (p.cs ??= {}); p.mood = clamp(p.mood + 1.5); p.lastAction = 'camide namaz kıldı';
  if (isCuma(w.day) && w.hour === 13 && c.cumaDay !== w.day) { cumaAttend(w, p); return 'Cuma namazını kıldınız (dindarlık +3, itibar +1).'; }
  if (c.namazDay === w.day) return 'Namaz kıldınız (bugünün dindarlık artışı zaten alındı; mutluluk +1,5).';
  c.namazDay = w.day; din(w, p, 1, 'camide günlük namaz'); void now; return 'Camide namaz kıldınız (dindarlık +1, mutluluk +1,5).';
}
function cumaAttend(w: World, p: Person): void {
  const c = (p.cs ??= {}); if (c.cumaDay === w.day) return; c.cumaDay = w.day; c.cumaWeek = weekOf(w.day); c.namazDay = w.day;
  din(w, p, 3, 'Cuma namazı'); itibar(w, p, 1, 'Cuma namazına katıldı');
  if (p.id === w.kayzerId) { for (const x of w.people) if (x.din >= 60 && x.id !== p.id) x.loyalty = clamp(x.loyalty + 2); log(w, `🕌 ${p.name} Cuma namazına katıldı; dindar halk memnun.`, p.id); }
}
/** Hourly: Cuma warning 11:00, ezan 13:00, attendance 13:00–14:00, missed-Cuma check, Ramazan/Bayram notices, aşevi for NPCs. */
export function pietyHour(w: World, now: number): void {
  const h = w.hour; const players = w.people.filter(isPlayer);
  if (isCuma(w.day)) {
    if (h === 11) for (const p of players) tell(w, p, '🕌 Cuma namazı yaklaşıyor: 13:00’te camide olun (13:00–14:00 arası).');
    if (h === 13) { for (const p of players) tell(w, p, '🕌 Ezan okunuyor: Cuma namazı başladı (14:00’e kadar camide olan katılmış sayılır).'); for (const p of w.people) if (!isPlayer(p) && p.din >= 55 && p.jailedDays <= 0) { p.din = clamp(p.din + 1); use(w, 'cuma', p); } }
    if (h === 13 || h === 14) for (const p of players) if (isOnline(w, p.playerId, now, 120_000) && atBuilding(w, p, 'cami', now)) cumaAttend(w, p);
    if (h === 15) for (const p of players) { const c = (p.cs ??= {}); const wk = weekOf(w.day); const last = c.cumaWeek ?? wk - 1 + 0; if (c.cumaWeek === undefined) { c.cumaWeek = wk - 1; continue; } if (wk - last >= 2 && c.cumaMissNoted !== wk) { c.cumaMissNoted = wk; din(w, p, -2, 'iki haftadır Cuma namazına gelmedi'); } }
  }
  if (isRamazan(w.day) && h === 6) for (const p of players) tell(w, p, '🌙 Ramazan günü: 06:00–22:00 arası yemeyen oruç tutmuş olur (dindarlık +5). Aşevi iftarda da açık.');
  if (isRamazan(w.day) && h === 22) for (const p of players) { const c = (p.cs ??= {}); if (c.ateDay !== w.day && c.orucDay !== w.day) { c.orucDay = w.day; din(w, p, 5, 'Ramazan orucu'); } }
  if (isBayram(w.day) && h === 9) bayram(w);
  if (h === 12) aseviNpcs(w);
}
/** Record that a person ate (oruç bozulur only during 06–22 of Ramazan). */
export function ate(w: World, p: Person): void { if (fasting(w)) { (p.cs ??= {}).ateDay = w.day; } }
function bayram(w: World): void {
  w.festivalUntil = Math.max(w.festivalUntil ?? 0, w.day);
  for (const p of w.people) { p.mood = clamp(p.mood + 6); if (p.din >= 50) p.loyalty = clamp(p.loyalty + 1); }
  let gifts = 0; for (const p of w.people) if (isPlayer(p) && w.treasury > 800 && transfer(w, 'saray', p.id, 2, 'bayram hediyesi')) gifts++;
  log(w, `🎉 BAYRAM! Şenlik, ikram ve hediyeler: herkes bayramlaştı${gifts ? `, ${gifts} kişiye saraydan bayram harçlığı` : ''}.`);
  for (const p of w.people) if (isPlayer(p)) tell(w, p, '🎉 Bayramınız kutlu olsun! Meydanda şenlik var; saraydan 2 D bayram harçlığı (hazine yeterse).');
}
// ---------------- aşevi ----------------
export const ASEVI_DAILY = 20; const SOUP_COST = 0.3;
const aseviLeft = (w: World): number => { if (!w.asevi || w.asevi.day !== w.day) w.asevi = { day: w.day, left: ASEVI_DAILY }; return w.asevi.left; };
/** One free soup per day for anyone hungry, paid by the saray (vakıf). */
export function asevi(w: World, p: Person): string | null {
  const c = (p.cs ??= {}); if (c.asevi === w.day) return 'Bugün aşevinden çorbanızı aldınız; yarın gelin.';
  if (p.hunger < 30) return 'Aç değilsiniz; çorba açlara veriliyor.'; if (aseviLeft(w) <= 0) return 'Aşevinde bugünlük çorba bitti.';
  if (!transfer(w, 'saray', 'dis', SOUP_COST, 'aşevi çorbası')) return 'Vakfın parası kalmadı.';
  w.asevi!.left--; c.asevi = w.day; p.hunger = clamp(p.hunger - 30); p.meals += 1; ate(w, p); return null;
}
function aseviNpcs(w: World): void {
  // only the truly destitute: could not afford food today/yesterday and has less than a loaf's price (soup must not replace paying customers)
  const loaf = (w.prices.ekmek ?? 1.2) * 1.2;
  const hungry = w.people.filter((p) => !isPlayer(p) && p.hunger >= 60 && p.jailedDays <= 0 && (p.cantAfford ?? -9) >= w.day - 1 && p.money < loaf);
  const left = aseviLeft(w); if (hungry.length > left) hungry.sort((a, b) => b.din - a.din); // pious first only when supplies are short
  let n = 0; for (const p of hungry.slice(0, left)) if (asevi(w, p) === null) { n++; use(w, 'asevi', p); }
  if (n >= 5) log(w, `🍲 Cami aşevi ${n} aç kişiye çorba dağıttı.`);
}
// ---------------- şifa duası ----------------
export function sifa(w: World, p: Person): string | null {
  const c = (p.cs ??= {}); if (w.people.some((x) => x.prof === 'hekim' && x.jailedDays <= 0 && x.health > 30)) return 'Şehirde hekim var; şifa için hekime gidin.';
  if (c.sifaDay !== undefined && c.sifaDay > w.day - 1) return 'Şifa duası günde bir kez.';
  if (p.health >= 90) return 'Sağlığınız yerinde.';
  c.sifaDay = w.day; const add = p.din >= 60 ? 10 : 6; p.health = clamp(p.health + add); return null;
}
// ---------------- sadaka ----------------
/** Sadaka at the cami: goes to the poorest citizen (or the imam's vakıf). din +1 (once a day), itibar +1 per 5 D (max +3 a day). */
export function sadaka(w: World, p: Person, amount: number): string {
  const poor = w.people.filter((x) => x.id !== p.id && x.money < 5 && x.jailedDays <= 0).sort((a, b) => a.money - b.money)[0];
  const to = poor?.id ?? w.people.find((x) => x.prof === 'imam')?.id ?? 'saray';
  if (!transfer(w, p.id, to, amount, 'sadaka')) return 'Kesenizde o kadar para yok.';
  const c = (p.cs ??= {}); if (c.sadakaDay !== w.day) { c.sadakaDay = w.day; c.sadakaIt = 0; c.sadakaDin = 0; }
  if (!c.sadakaDin) { c.sadakaDin = 1; din(w, p, 1, 'sadaka verdi'); }
  const it = Math.min(3 - (c.sadakaIt ?? 0), Math.floor(amount / 5)); if (it > 0) { c.sadakaIt = (c.sadakaIt ?? 0) + it; itibar(w, p, it, `${amount} D sadaka`); }
  const r = findPerson(w, to); if (r) r.mood = clamp(r.mood + 3);
  return `${amount} D sadaka verdiniz${r ? ` (${r.name} aldı)` : ''}.`;
}
