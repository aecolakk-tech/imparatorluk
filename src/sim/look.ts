/** v1.9.7 character customization: palettes/options shared by the sim (validation) and the sprite renderer. */
export interface Look { skin: number; hair: number; hairColor: number; beard: number; eye: number; build: number; height: number; cloth: number; outfit: number; head: number; scarf: boolean; belt: boolean; jewel: boolean }
export const SKIN_TONES = ['#f6d7bd', '#f1c9a5', '#e8b88f', '#e0ac7e', '#d39a6a', '#c68a5a', '#a8714a', '#8d5a3b', '#6e4329', '#4f2f1c'];
export const SKIN_NAMES = ['Çok açık', 'Açık', 'Buğday açık', 'Buğday', 'Bal', 'Esmer açık', 'Esmer', 'Koyu esmer', 'Kahve', 'Koyu'];
export const HAIR_COLORS = ['#151515', '#2b1a10', '#3d2314', '#4a2c17', '#6b3a1e', '#7a4a22', '#9a5a2a', '#b07a3b', '#c8a060', '#e0c890', '#a83224', '#6b6b6b', '#b8b8b8', '#efefef'];
export const HAIR_COLOR_NAMES = ['Siyah', 'Koyu kahve', 'Kestane koyu', 'Kahve', 'Kızıl kahve', 'Kestane', 'Bakır', 'Açık kahve', 'Kumral', 'Sarı', 'Kızıl', 'Kır', 'Gri', 'Ak'];
export const HAIR_STYLES_M = ['Kısa', 'Asker tıraşı', 'Yana taranmış', 'Kâküllü', 'Kıvırcık', 'Dalgalı', 'Uzun', 'At kuyruğu', 'Topuz (derviş)', 'Omuzda', 'Dikleşik', 'Kel'];
export const HAIR_STYLES_F = ['Uzun düz', 'Örgü', 'Çift örgü', 'Topuz', 'At kuyruğu', 'Dalgalı', 'Kâküllü', 'Kısa', 'Kıvırcık', 'Omuzda', 'Yandan örgü', 'Yüksek topuz'];
export const BEARDS = ['Yok', 'Bıyık', 'Pala bıyık', 'Keçi sakalı', 'Kısa sakal', 'Gür sakal'];
export const EYES = ['#1a1410', '#3b2414', '#5a3a1a', '#3a6a3a', '#3a5a8a', '#6a6a6a'];
export const EYE_NAMES = ['Siyah', 'Koyu kahve', 'Ela', 'Yeşil', 'Mavi', 'Gri'];
export const BUILDS = ['İnce', 'Orta', 'İri'];
export const HEIGHTS = ['Kısa', 'Uzun'];
export const CLOTHS = ['#b8492f', '#3f6fb0', '#4f8a3a', '#b08a2f', '#7a4fa0', '#a0603a', '#2f8a86', '#8a2f55', '#d8d0c0', '#2a2a2a', '#c86a1a', '#1f4a6a', '#6a7a2a', '#a02a2a', '#d0a0b0', '#4a3a2a', '#e0c040'];
export const CLOTH_NAMES = ['Kiremit', 'Çivit', 'Yeşil', 'Hardal', 'Mor', 'Tarçın', 'Turkuaz', 'Bordo', 'Keten', 'Siyah', 'Turuncu', 'Lacivert', 'Zeytin', 'Al', 'Gül', 'Toprak', 'Altın sarısı'];
export const OUTFITS = ['Gömlek', 'Entari', 'Yelek', 'Kaftan', 'İş önlüğü', 'Cüppe'];
export const HEADS = ['Yok', 'Fes', 'Sarık', 'Kalpak', 'Başörtüsü', 'Hasır şapka', 'Takke'];
export const TERZI_PRICE = 15; export const BERBER_PRICE = 8;
const n = (v: unknown, max: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < max ? v : null);
/** Validates and normalizes a look sent by a client. */
export function cleanLook(x: Partial<Look> | null | undefined): Look | null {
  if (!x || typeof x !== 'object') return null;
  const o = { skin: n(x.skin, SKIN_TONES.length), hair: n(x.hair, 12), hairColor: n(x.hairColor, HAIR_COLORS.length), beard: n(x.beard, BEARDS.length), eye: n(x.eye, EYES.length), build: n(x.build, BUILDS.length), height: n(x.height, HEIGHTS.length), cloth: n(x.cloth, CLOTHS.length), outfit: n(x.outfit, OUTFITS.length), head: n(x.head, HEADS.length) };
  if (Object.values(o).some((v) => v === null)) return null;
  return { ...(o as Omit<Look, 'scarf' | 'belt' | 'jewel'>), scarf: !!x.scarf, belt: !!x.belt, jewel: !!x.jewel };
}
export function randomLook(r: () => number, female: boolean): Look {
  const i = (m: number): number => Math.floor(r() * m);
  return { skin: i(SKIN_TONES.length), hair: i(12), hairColor: i(HAIR_COLORS.length - 3), beard: female ? 0 : i(BEARDS.length), eye: i(EYES.length), build: i(3), height: i(2), cloth: i(CLOTHS.length), outfit: i(OUTFITS.length), head: female ? (r() < 0.4 ? 4 : 0) : i(HEADS.length), scarf: r() < 0.25, belt: r() < 0.4, jewel: female && r() < 0.4 };
}
/** Default look derived from the old sprite seeds (so a player's first editor starts from his current look). */
export function lookFromSeeds(p: { skin: number; hairColor: number; shirt: number; female: boolean }): Look {
  return { skin: [1, 3, 5, 7][p.skin % 4]!, hair: 0, hairColor: [1, 3, 5, 7, 0, 11, 8, 2][p.hairColor % 8]!, beard: !p.female && p.hairColor % 3 === 0 ? 1 : 0, eye: 1, build: 1, height: 1, cloth: p.shirt % 8, outfit: 0, head: 0, scarf: false, belt: false, jewel: false };
}
