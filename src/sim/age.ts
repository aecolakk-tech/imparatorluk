/**
 * v2.0.1 ageing in YEARS (DAYS_PER_YEAR game days = 1 year).
 * Stages: 0–6 Bebek/Çocuk, 7–15 Genç, 16–64 Yetişkin, 65+ Yaşlı. Marriage from 16.
 * Natural death: none up to DEATH_START_AGE (68); at each later birthday the chance is (age−68)%; certain at 88.
 * Fertility: women 16–45; men's fertility falls after 60.
 */
import { DAYS_PER_YEAR, DEATH_START_AGE, DEATH_CERTAIN_AGE } from './constants';
import type { Person, World } from './types';

export const ADULT_YEARS = 16; export const OLD_YEARS = 65; export const DEATH_CERTAIN = DEATH_CERTAIN_AGE;
export const yearsOf = (w: World, x: { born: number }): number => Math.max(0, Math.floor((w.day - x.born) / DAYS_PER_YEAR));
export const bornForYears = (w: World, years: number): number => w.day - Math.round(years * DAYS_PER_YEAR);
export const isOld = (w: World, p: { born: number }): boolean => yearsOf(w, p) >= OLD_YEARS;
/** Chance to die of old age at a birthday reaching `years`. */
export function deathChance(years: number): number { if (years >= DEATH_CERTAIN) return 1; if (years <= DEATH_START_AGE) return 0; return (years - DEATH_START_AGE) / 100; }
/** True on the game day a person turns a new year. */
export const isBirthday = (w: World, x: { born: number }): boolean => w.day > x.born && (w.day - x.born) % DAYS_PER_YEAR === 0;
/** Fertility factor for a couple (0 = impossible). */
export function fertility(w: World, a: Person, b: Person): number {
  const f = a.female ? a : b, m = a.female ? b : a; if (f.female === m.female) return 0;
  const fy = yearsOf(w, f), my = yearsOf(w, m);
  if (fy < ADULT_YEARS || fy > 45 || my < ADULT_YEARS) return 0;
  return my <= 60 ? 1 : Math.max(0, 1 - (my - 60) * 0.1); // men: 61 → 0.9 … 70+ → 0
}
/** Elderly modifiers (1 = none). */
export const oldWalk = (w: World, p: { born: number }): number => (isOld(w, p) ? 0.8 : 1);
export const oldFight = (w: World, p: { born: number }): number => (isOld(w, p) ? 0.8 : 1);
export const oldStamina = (w: World, p: { born: number }): number => (isOld(w, p) ? 1.25 : 1);
export const oldHeal = (w: World, p: { born: number }): number => (isOld(w, p) ? 0.6 : 1);
/** Extra sickness chance multiplier, rising with age above 65. */
export const oldSick = (w: World, p: { born: number }): number => { const y = yearsOf(w, p); return y >= OLD_YEARS ? 1 + (y - OLD_YEARS) * 0.08 : 1; };
export function ageText(w: World, x: { born: number }): string {
  const y = yearsOf(w, x); return `${y} yaşında · ${y < 7 ? 'Bebek/Çocuk' : y < ADULT_YEARS ? 'Genç' : y < OLD_YEARS ? 'Yetişkin' : 'Yaşlı'}`;
}

/**
 * One-time migration from day-based ages (adult at 60 days, death after 540) to years.
 * Nobody dies or becomes a child: adults → 18–60 years, minors keep their stage, parents stay ≥16 years older than kids.
 */
export function migrateAge(w: World): void {
  const any = w as unknown as { ageV?: number }; if ((any.ageV ?? 0) >= 2) return; any.ageV = 2;
  for (const p of w.people) {
    const d = Math.max(60, w.day - p.born);
    const y = Math.min(60, 18 + ((d - 60) / 480) * 42);
    p.born = bornForYears(w, y);
  }
  for (const c of w.children) { const d = Math.max(0, Math.min(59, w.day - c.born)); c.born = bornForYears(w, (d / 60) * 15.8); }
  // parents at least 16 years older than every child (shift the parent older, never past 60)
  for (let pass = 0; pass < 3; pass++) for (const x of [...w.people, ...w.children]) for (const pid of x.parents ?? []) {
    const par = w.people.find((q) => q.id === pid); if (!par) continue;
    const need = Math.min(yearsOf(w, x) + ADULT_YEARS, 60); if (yearsOf(w, par) < need) par.born = bornForYears(w, need);
  }
  for (const pg of w.pregnancies ?? []) pg.due = Math.min(pg.due, w.day + Math.max(1, Math.round(DAYS_PER_YEAR * 0.75)));
}
