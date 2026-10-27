import type { Good, Profession } from './types';
export const DAY_MS = 10 * 60 * 1000; // 1 game day = 10 real minutes
export const HOUR_MS = DAY_MS / 24;
export const ONLINE_WINDOW_MS = 60 * 1000; // heartbeat considered online for 60s
export const MAX_CATCHUP_HOURS = 48; // safety cap per tick call
export const SNAPSHOT_EVERY_MS = 3 * 24 * 3600 * 1000; // every 3 real days
export const SNAPSHOTS_KEPT = 8;
export const INACTIVE_TO_NPC_MS = 21 * 24 * 3600 * 1000; // 3 real weeks
export const MAP_W = 72; export const MAP_H = 52;

export const BASE_PRICE: Record<Good, number> = { ekmek: 3, su: 2, et: 12, balik: 8, kumas: 18, alet: 22, odun: 5 };
export const GOOD_LABEL: Record<Good, string> = { ekmek: 'Ekmek', su: 'Su', et: 'Et', balik: 'Balık', kumas: 'Kumaş', alet: 'Alet', odun: 'Odun' };
/** daily output of a worker (goods professions) */
export const PRODUCES: Partial<Record<Profession, { good: Good; qty: number; market: string }>> = {
  firinci: { good: 'ekmek', qty: 11, market: 'gida' },
  sucu: { good: 'su', qty: 14, market: 'gida' },
  kasap: { good: 'et', qty: 9, market: 'gida' },
  balikci: { good: 'balik', qty: 6, market: 'pazar' },
  terzi: { good: 'kumas', qty: 2, market: 'zanaat' },
  demirci: { good: 'alet', qty: 2, market: 'zanaat' },
  marangoz: { good: 'odun', qty: 4, market: 'yeni' },
};
/** decay per day of stored goods (fraction lost) – prevents hoarding / inflation of stock */
export const DECAY: Record<Good, number> = { ekmek: 0.35, su: 0.3, et: 0.3, balik: 0.4, kumas: 0.01, alet: 0.005, odun: 0.03 };
export const STATE_PROFS: Profession[] = ['memur', 'tahsildar', 'bekci', 'savci', 'hakim', 'asker', 'hoca', 'imam'];
export const DEFAULT_SALARY: Partial<Record<Profession, number>> = {
  memur: 11, tahsildar: 11, bekci: 11, savci: 14, hakim: 15, asker: 10, hoca: 10, imam: 8, naip: 0, kayzer: 0,
};
export const PROF_LABEL: Record<Profession, string> = {
  firinci: 'Fırıncı', sucu: 'Sucu', kasap: 'Kasap', balikci: 'Balıkçı', terzi: 'Terzi', demirci: 'Demirci', marangoz: 'Marangoz',
  tuccar: 'Tüccar', hekim: 'Hekim', hoca: 'Hoca', hamal: 'Hamal', insaatci: 'İnşaatçı', kalemsor: 'Kalemşör', imam: 'İmam',
  memur: 'Memur', tahsildar: 'Tahsildar', bekci: 'Bekçi', savci: 'Savcı', hakim: 'Hâkim', asker: 'Asker', kayzer: 'Kayzer', naip: 'Naip',
};
export const PLAYER_PROFS: Profession[] = ['firinci', 'sucu', 'kasap', 'balikci', 'terzi', 'demirci', 'marangoz', 'tuccar', 'hekim', 'hamal', 'insaatci', 'kalemsor'];
