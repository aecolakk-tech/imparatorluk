/**
 * v2.0.1 character profile, chosen ONCE at creation (existing players: once at next login, without harmful changes):
 * Soyadı, Yaş grubu, Köken (starting meslek + money + skill), Mizaç. Every option trades something for something.
 */
import type { Person, Profession, World } from './types';
import { clamp } from './rng';
import { WORKPLACE } from './world';
import { bornForYears, oldFight, oldStamina } from './age';

export type AgeGroup = 'genc' | 'olgun' | 'yasli';
export type Origin = 'koylu' | 'zanaatkar' | 'tuccar' | 'yoksul';
export type Temper = 'durust' | 'hirsli' | 'kurnaz' | 'dindar' | 'cesur';
export interface ProfileChoice { surname: string; age: number; origin: Origin; temper: Temper }
/** v2.0.1: the age picker (16–60) keeps the old trade-offs: 16–22 genç, 23–45 olgun, 46–60 yaşlı. */
export const ageGroupOf = (years: number): AgeGroup => (years <= 22 ? 'genc' : years <= 45 ? 'olgun' : 'yasli');
export const MIN_START_AGE = 16, MAX_START_AGE = 60;

export const AGE: Record<AgeGroup, { label: string; text: string; money: number; xp: number; fight: number; energy: number }> = {
  genc: { label: 'Genç (16–22)', text: 'Güçlü ve dinç (savaşta +%15 hasar, yorgunluk %15 yavaş), ama tecrübesiz ve az parayla başlar (−10 D).', money: -10, xp: 0, fight: 1.15, energy: 0.85 },
  olgun: { label: 'Olgun (23–45)', text: 'Dengeli: ne artısı ne eksisi.', money: 0, xp: 25, fight: 1, energy: 1 },
  yasli: { label: 'Orta yaş üstü (46–60)', text: 'Tecrübeli (işte daha verimli) ve birikimli (+25 D), ama savaşta yavaş (−%20 hasar) ve çabuk yorulur.', money: 25, xp: 60, fight: 0.8, energy: 1.15 },
};
export const ORIGIN: Record<Origin, { label: string; prof: Profession; money: number; skill: string; text: string }> = {
  koylu: { label: 'Köylü', prof: 'ciftci', money: 35, skill: 'Tarım: tarlada iyi hasat; çantada +2 ekmek', text: 'Çiftçi olarak başlar. Gelir az ama sabit, yiyeceği bol.' },
  zanaatkar: { label: 'Zanaatkâr', prof: 'marangoz', money: 30, skill: 'Usta eli: 1 alet ile başlar, işte daha tecrübeli', text: 'Marangoz olarak başlar. Malını satabildikçe iyi kazanır.' },
  tuccar: { label: 'Tüccar ailesi', prof: 'tuccar', money: 75, skill: 'Pazarlık: ticarette para kazanır', text: 'Tüccar olarak başlar. En çok parayla başlar ama maaşı yok: alıp satarak kazanır, kayıp riski var.' },
  yoksul: { label: 'Yoksul', prof: 'hamal', money: 10, skill: 'Dayanıklı: açlık/susuzluk %15 yavaş, 3 gün fazla dokunulmazlık', text: 'Hamal olarak başlar. Çok az para, ama her gün iş bulur ve zor şartlara dayanır.' },
};
export const TEMPER: Record<Temper, { label: string; text: string; honesty: number; ambition: number; din: number; loyalty: number; rel: number; bribe: number; fight: number }> = {
  durust: { label: 'Dürüst', text: 'Halk ve görevliler size güvenir (+ilişki), ama rüşvet teklifiniz daha sık reddedilir.', honesty: 90, ambition: 40, din: 50, loyalty: 70, rel: 8, bribe: 0.7, fight: 1 },
  hirsli: { label: 'Hırslı', text: 'Yükselmeye, darbeye ve isyana yatkın; halk biraz çekinir.', honesty: 50, ambition: 90, din: 35, loyalty: 35, rel: -3, bribe: 1, fight: 1.05 },
  kurnaz: { label: 'Kurnaz', text: 'Rüşvet ve pazarlıkta başarılı, ama insanlar size daha az güvenir.', honesty: 30, ambition: 60, din: 30, loyalty: 45, rel: -6, bribe: 1.35, fight: 1 },
  dindar: { label: 'Dindar', text: 'İmam/hoca ve dindarlar sizi sever, isyana az yatkın; kavgada çekingen.', honesty: 75, ambition: 35, din: 90, loyalty: 75, rel: 4, bribe: 0.85, fight: 0.95 },
  cesur: { label: 'Cesur', text: 'Savaşta +%15 hasar, soyulursa daha az kaybeder; rüşvet/pazarlıkta sıradan.', honesty: 60, ambition: 60, din: 45, loyalty: 60, rel: 0, bribe: 1, fight: 1.15 },
};

export function cleanSurname(s: unknown): string | null {
  if (typeof s !== 'string') return null; const t = s.replace(/[<>()0-9]/g, '').trim().replace(/\s+/g, ' ');
  if (t.length < 2 || t.length > 16 || /\s/.test(t)) return null; return t.charAt(0).toLocaleUpperCase('tr') + t.slice(1);
}
export const surnameOf = (p: Person): string | undefined => p.profile?.surname;
const prof = (p: Person): NonNullable<Person['profile']> => (p.profile ??= {});

/** Combat damage multiplier (age × temperament). */
export function fightMul(p: Person, w?: World): number { const x = p.profile; return (x?.age ? AGE[x.age].fight : 1) * (x?.temper ? TEMPER[x.temper].fight : 1) * (w ? oldFight(w, p) : 1); }
/** Bribe acceptance multiplier for bribes this person offers. */
export function bribeMul(p: Person): number { const t = p.profile?.temper; return t ? TEMPER[t].bribe : 1; }
/** Hunger/thirst drain multiplier. */
export function needsMul(p: Person): number { return p.profile?.origin === 'yoksul' ? 0.85 : 1; }
/** Energy drain multiplier. */
export function energyMul(p: Person, w?: World): number { const a = p.profile?.age; return (a ? AGE[a].energy : 1) * (w ? oldStamina(w, p) : 1); }
/** Share of the purse a beaten player loses to eşkıya. */
export function robShare(p: Person): number { return p.profile?.temper === 'cesur' ? 0.25 : 0.4; }

/**
 * Apply the one-time choice. fresh = a brand-new character (gets the starting meslek and money);
 * an existing character keeps its meslek and money (never lowered), only traits and surname are added.
 */
export function applyProfile(w: World, p: Person, c: ProfileChoice, fresh: boolean): string | null {
  if (p.profile?.set) return 'Bu seçimler bir kez yapılır.';
  const sn = cleanSurname(c.surname); if (!sn) return 'Soyadı 2–16 harf, tek kelime olmalı.';
  const yrs = Math.round(Number(c.age)); if (!Number.isFinite(yrs) || yrs < MIN_START_AGE || yrs > MAX_START_AGE) return `Yaş ${MIN_START_AGE}–${MAX_START_AGE} arasında olmalı.`;
  if (!ORIGIN[c.origin] || !TEMPER[c.temper]) return 'Geçersiz seçim.';
  const grp = ageGroupOf(yrs); const o = ORIGIN[c.origin], a = AGE[grp], t = TEMPER[c.temper];
  const full = `${p.name} ${sn}`.toLocaleLowerCase('tr'); if (!p.name.endsWith(` ${sn}`) && w.people.some((q) => q !== p && q.name.toLocaleLowerCase('tr') === full)) return 'Bu ad ve soyadla biri zaten var; başka bir soyadı seçin.';
  const x = prof(p); x.surname = sn; x.age = grp; p.born = bornForYears(w, yrs) - (fresh ? 0 : 0); x.origin = c.origin; x.temper = c.temper; x.set = true;
  if (!p.name.endsWith(` ${sn}`)) { p.name = `${p.name} ${sn}`.slice(0, 40); const pl = p.playerId ? w.players[p.playerId] : undefined; if (pl) pl.name = p.name; }
  p.honesty = t.honesty; p.ambition = t.ambition; p.din = t.din; p.loyalty = t.loyalty;
  p.xp = Math.max(p.xp ?? 0, a.xp + (c.origin === 'zanaatkar' ? 20 : 0));
  for (const q of w.people) if (q !== p && !q.playerId) { if (t.rel) q.relations[p.id] = clamp((q.relations[p.id] ?? 0) + t.rel, -100, 100); if (c.temper === 'dindar' && (q.prof === 'imam' || q.prof === 'hoca')) q.relations[p.id] = clamp((q.relations[p.id] ?? 0) + 10, -100, 100); }
  if (fresh) {
    p.prof = o.prof; p.work = WORKPLACE[o.prof]; p.money = Math.max(5, o.money + a.money);
    if (c.origin === 'koylu') p.inv.ekmek += 2; if (c.origin === 'zanaatkar') p.inv.alet += 1;
    if (c.origin === 'yoksul') p.protectedUntil = (p.protectedUntil ?? w.day) + 3;
  }
  return null;
}
