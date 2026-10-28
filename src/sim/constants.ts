import type { Good, Profession } from './types';
// ---- v2.0.1 world clock: the ONE place to set the day length ----
// v2.0.3: daytime (06:00–22:00) = 15 real minutes, night (22:00–06:00) = 3 real minutes → 1 game day = 18 real minutes at 1x
// (v2.0.1–v2.0.2: 16 + 4 = 20 minutes). Kayzer speed 0.5x / 2x divides these via hourMs().
export const DAY_PART_MIN = 15, NIGHT_PART_MIN = 3;
export const DAY_REAL_MIN = DAY_PART_MIN + NIGHT_PART_MIN; // 18
export const DAY_FROM = 6, NIGHT_FROM = 22; // daytime = [06:00, 22:00)
export const DAY_MS = DAY_REAL_MIN * 60 * 1000;
const DAY_HOURS = NIGHT_FROM - DAY_FROM, NIGHT_HOURS = 24 - DAY_HOURS;
/** Real ms of one daytime game hour at 1x (56.25 s); a night hour lasts 22.5 s. */
export const DAY_HOUR_MS = (DAY_PART_MIN * 60_000) / DAY_HOURS;
export const NIGHT_HOUR_MS = (NIGHT_PART_MIN * 60_000) / NIGHT_HOURS;
export const NIGHT_FASTER = DAY_HOUR_MS / NIGHT_HOUR_MS;
export const isDayHour = (h: number): boolean => h >= DAY_FROM && h < NIGHT_FROM;
/** Real ms of game hour h at 1x. */
export const hourLen = (h: number): number => (isDayHour(((h % 24) + 24) % 24) ? DAY_HOUR_MS : NIGHT_HOUR_MS);
// ---- v2.0.1 ageing: the ONE place to set the length of a year ----
export const DAYS_PER_YEAR = 5; // 1 year of age = 5 game days (≈100 real min online at 1x)
export const DEATH_START_AGE = 68; // natural-death chance is 0 up to this age, then (age − DEATH_START_AGE)% at each birthday
export const DEATH_CERTAIN_AGE = 88;
export const HOUR_MS = DAY_MS / 24; // average hour (only for rough estimates)
export const ONLINE_WINDOW_MS = 60 * 1000; // heartbeat considered online for 60s
export const MAX_CATCHUP_HOURS = 48; // safety cap per tick call
export const SNAPSHOT_EVERY_MS = 3 * 24 * 3600 * 1000; // every 3 real days
export const SNAPSHOTS_KEPT = 8;
export const INACTIVE_TO_NPC_MS = 21 * 24 * 3600 * 1000; // 3 real weeks
export const MAP_W = 100; export const MAP_H = 60;

export const BASE_PRICE: Record<Good, number> = { ekmek: 1.2, su: 0.5, et: 6, balik: 4, kumas: 8, alet: 20, odun: 2.5, bugday: 0.5, yun: 2, elbise: 18, mobilya: 40, icki: 3, sut: 1, yumurta: 0.6, un: 0.8 };
export const GOOD_LABEL: Record<Good, string> = { ekmek: 'Ekmek', su: 'Su', et: 'Et', balik: 'Balık', kumas: 'Kumaş', alet: 'Alet', odun: 'Odun', bugday: 'Buğday', yun: 'Yün', elbise: 'Elbise', mobilya: 'Mobilya', icki: 'İçki', sut: 'Süt', yumurta: 'Yumurta', un: 'Un' };
export interface Recipe { good: Good; qty: number; market: string; inputs?: Partial<Record<Good, number>>; extra?: { good: Good; qty: number } }
/** daily output of a worker; inputs are consumed for a full day's output (partial inputs → partial output) */
export const PRODUCES: Partial<Record<Profession, Recipe>> = {
  ciftci: { good: 'bugday', qty: 30, market: 'gida' },
  degirmenci: { good: 'un', qty: 50, market: 'gida', inputs: { bugday: 50 } }, // v2.0.1 chain: buğday → değirmen un → fırın ekmek
  firinci: { good: 'ekmek', qty: 40, market: 'gida', inputs: { un: 20 } },
  sucu: { good: 'su', qty: 80, market: 'gida' },
  kasap: { good: 'et', qty: 14, market: 'gida', extra: { good: 'yun', qty: 3 } },
  balikci: { good: 'balik', qty: 14, market: 'pazar' },
  dokumaci: { good: 'kumas', qty: 4, market: 'zanaat', inputs: { yun: 4 } },
  terzi: { good: 'elbise', qty: 2, market: 'zanaat', inputs: { kumas: 2 } },
  marangoz: { good: 'odun', qty: 20, market: 'yeni' },
  mobilyaci: { good: 'mobilya', qty: 1, market: 'yeni', inputs: { odun: 4 } },
  demirci: { good: 'alet', qty: 2, market: 'zanaat', inputs: { odun: 2 } },
  barci: { good: 'icki', qty: 16, market: 'bar', inputs: { bugday: 8 } },
  hayvanci: { good: 'bugday', qty: 18, market: 'gida' }, // side job as a farmhand: never idle between animal sales
};
/** decay per day of stored goods (fraction lost) – food spoils, crafts wear out slowly so demand persists */
export const DECAY: Record<Good, number> = { ekmek: 0.35, su: 0.3, et: 0.3, balik: 0.4, kumas: 0.02, alet: 0.03, odun: 0.05, bugday: 0.12, yun: 0.02, elbise: 0.05, mobilya: 0.02, icki: 0.05, sut: 0.4, yumurta: 0.15, un: 0.04 };
/** max units one seller may keep listed (anti-hoarding / karaborsa) */
export const STOCK_LIMIT: Record<Good, number> = { ekmek: 120, su: 200, et: 40, balik: 40, kumas: 20, alet: 10, odun: 40, bugday: 150, yun: 30, elbise: 10, mobilya: 4, icki: 50, sut: 80, yumurta: 80, un: 150 };
export const RANKS = [{ xp: 0, label: 'Çırak', mult: 0.85 }, { xp: 20, label: 'Kalfa', mult: 1 }, { xp: 60, label: 'Usta', mult: 1.2 }];
export const STATE_PROFS: Profession[] = ['memur', 'tahsildar', 'bekci', 'savci', 'hakim', 'asker', 'hoca', 'imam'];
export const DEFAULT_SALARY: Partial<Record<Profession, number>> = {
  memur: 7, tahsildar: 7, bekci: 7, savci: 9, hakim: 10, asker: 7, hoca: 7, imam: 6, naip: 0, kayzer: 0,
};
/** Salaries of the previous version – migrated worlds still on these defaults get the new, balanced ones. */
export const OLD_DEFAULT_SALARY: Partial<Record<Profession, number>> = {
  memur: 11, tahsildar: 11, bekci: 11, savci: 14, hakim: 15, asker: 10, hoca: 10, imam: 8,
};
export const PROF_LABEL: Record<Profession, string> = {
  firinci: 'Fırıncı', sucu: 'Sucu', kasap: 'Kasap', balikci: 'Balıkçı', terzi: 'Terzi', demirci: 'Demirci', marangoz: 'Marangoz',
  tuccar: 'Tüccar', hekim: 'Hekim', hoca: 'Hoca', hamal: 'Hamal', insaatci: 'İnşaatçı', kalemsor: 'Kalemşör', imam: 'İmam',
  memur: 'Memur', tahsildar: 'Tahsildar', bekci: 'Bekçi', savci: 'Savcı', hakim: 'Kadı',
  ciftci: 'Çiftçi', dokumaci: 'Dokumacı', mobilyaci: 'Mobilyacı', barci: 'Barcı', hayvanci: 'Hayvan Tüccarı', asker: 'Asker', kayzer: 'Kayzer', naip: 'Naip', degirmenci: 'Değirmenci',
};
export const PLAYER_PROFS: Profession[] = ['ciftci', 'degirmenci', 'dokumaci', 'mobilyaci', 'barci', 'firinci', 'sucu', 'kasap', 'balikci', 'terzi', 'demirci', 'marangoz', 'tuccar', 'hekim', 'hamal', 'insaatci', 'kalemsor'];
