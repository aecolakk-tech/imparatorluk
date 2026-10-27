/**
 * Custom laws: the ruler (ferman) or the Meclis (bill) can write any parameterised law.
 * Kinds: sales tax, head tax, per-good tax, price cap, ban on a good, curfew, mandatory service,
 * subsidy per unit, wealth-tax threshold, harsher punishments. Every law has a preview of predicted effects.
 */
import type { Good, Person, World } from './types';
import { GOODS } from './types';
import { BASE_PRICE, GOOD_LABEL } from './constants';
import { clamp, nextId, pick } from './rng';
import { transfer } from './economy';
import { log } from './log';

export type LawKind = 'satisVergisi' | 'basVergisi' | 'malVergisi' | 'narh' | 'yasak' | 'sokak' | 'hizmet' | 'destek' | 'servetEsigi' | 'sertCeza';
export interface LawSpec { kind: LawKind; good?: Good; value: number; value2?: number; name?: string }
export interface CustomLaw extends LawSpec { id: string; name: string; by: string; day: number; via: 'ferman' | 'meclis' }

export const LAW_KIND_LABEL: Record<LawKind, string> = {
  satisVergisi: 'Satış vergisi oranı (%)', basVergisi: 'Baş vergisi (Dinar/gün)', malVergisi: 'Mala özel vergi (%)', narh: 'Narh – tavan fiyat (Dinar)',
  yasak: 'Mal yasağı', sokak: 'Sokağa çıkma yasağı (saat aralığı)', hizmet: 'Zorunlu hizmet (kişi/gün)', destek: 'Üretici desteği (Dinar/adet)',
  servetEsigi: 'Servet vergisi eşiği (Dinar)', sertCeza: 'Ağır cezalar (% artış)',
};
/** Which fields a kind needs, for the law builder UI. */
export const LAW_FIELDS: Record<LawKind, { good?: boolean; value: [number, number, number, string]; value2?: [number, number, number, string] }> = {
  satisVergisi: { value: [0, 40, 10, '%'] }, basVergisi: { value: [0, 10, 1.5, 'D/gün'] }, malVergisi: { good: true, value: [1, 50, 10, '%'] },
  narh: { good: true, value: [0.1, 500, 2, 'Dinar'] }, yasak: { good: true, value: [0, 0, 0, ''] }, sokak: { value: [18, 23, 22, 'başlangıç saati'], value2: [3, 8, 5, 'bitiş saati'] },
  hizmet: { value: [1, 20, 5, 'kişi/gün'] }, destek: { good: true, value: [0.1, 20, 0.3, 'D/adet'] }, servetEsigi: { value: [100, 5000, 300, 'Dinar'] }, sertCeza: { value: [10, 200, 50, '%'] },
};

export function validateLaw(s: LawSpec): string | null {
  if (!s || !(s.kind in LAW_FIELDS)) return 'Kanun türü geçersiz.';
  const f = LAW_FIELDS[s.kind];
  if (f.good && !GOODS.includes(s.good as Good)) return 'Bir mal seçin.';
  if (s.kind !== 'yasak' && (!Number.isFinite(s.value) || s.value < f.value[0] || s.value > f.value[1])) return `Değer ${f.value[0]}–${f.value[1]} arası olmalı.`;
  if (f.value2 && (!Number.isFinite(s.value2) || s.value2! < f.value2[0] || s.value2! > f.value2[1])) return `İkinci değer ${f.value2[0]}–${f.value2[1]} arası olmalı.`;
  return null;
}
export function lawTitle(s: LawSpec): string {
  const g = s.good ? GOOD_LABEL[s.good] : '';
  switch (s.kind) {
    case 'satisVergisi': return `Satış vergisi %${s.value}`;
    case 'basVergisi': return `Baş vergisi ${s.value} D/gün`;
    case 'malVergisi': return `${g} vergisi %${s.value}`;
    case 'narh': return `${g} narhı ${s.value} D`;
    case 'yasak': return `${g} yasağı`;
    case 'sokak': return `Sokağa çıkma yasağı ${s.value}:00–${s.value2}:00`;
    case 'hizmet': return `Zorunlu hizmet: günde ${s.value} kişi`;
    case 'destek': return `${g} üreticisine ${s.value} D/adet destek`;
    case 'servetEsigi': return `Servet vergisi ${s.value} D üstüne`;
    case 'sertCeza': return `Cezalar %${s.value} ağırlaşsın`;
  }
}

const adults = (w: World): Person[] => w.people.filter((p) => p.prof !== 'naip' && p.id !== w.kayzerId && p.jailedDays === 0);
const sold = (w: World, g: Good): number => Math.max(w.market.sold[g], 1);

/** Predicted effects with numbers, computed from the current market. */
export function previewLaw(w: World, s: LawSpec): string {
  const err = validateLaw(s); if (err) return `⚠️ ${err}`;
  const g = s.good; const n = adults(w).length; const out: string[] = [];
  const allSales = Object.entries(w.market.sold).reduce((a, [k, v]) => a + v * w.prices[k as Good], 0);
  switch (s.kind) {
    case 'satisVergisi': { const d = s.value - w.taxRate; out.push(`Vergi geliri günde ≈ ${d >= 0 ? '+' : ''}${Math.round(allSales * d / 100)} D.`, d > 0 ? `Memnuniyet günde ≈ −${((d) * 0.12).toFixed(1)}; esnaf ve fakirler kızar.` : 'Halk rahatlar, memnuniyet artar.'); if (s.value > 18) out.push('⚠️ %18 üstü: cumhuriyetçiler güçlenir.'); break; }
    case 'basVergisi': { const d = s.value - w.headTax; out.push(`Hazineye günde ≈ ${d >= 0 ? '+' : ''}${Math.round(d * n)} D (${n} kişi).`, d > 0 ? 'Fakirler en çok etkilenir; açlık riski.' : 'Fakirler rahatlar.'); break; }
    case 'malVergisi': out.push(`${GOOD_LABEL[g!]} geliri günde ≈ +${Math.round(sold(w, g!) * w.prices[g!] * s.value / 100)} D.`, `${GOOD_LABEL[g!]} fiyatı ≈ %${Math.round(s.value * 0.7)} artar; üreticisi kızar.`); break;
    case 'narh': { const r = s.value / Math.max(0.01, w.prices[g!]); out.push(`Şimdiki fiyat ${w.prices[g!]} D.`); if (r < 0.8) out.push(`⚠️ Piyasanın %${Math.round((1 - r) * 100)} altında: üretici zarar eder, kıtlık ve karaborsa olur.`); else out.push('Fiyat sınırlanır, alıcılar rahatlar; piyasaya yakın olduğu için kıtlık beklenmez.'); break; }
    case 'yasak': { const staple = ['ekmek', 'su', 'bugday'].includes(g!); out.push(`${GOOD_LABEL[g!]} satılamaz ve üretilemez; ${GOOD_LABEL[g!]} üreticileri işsiz kalır.`); if (staple) out.push('⛔ Temel gıda! Açlık, salgın gibi ölüm ve isyan riski çok yüksek.'); if (g === 'icki') out.push('Dindarlar memnun (+), seküler halk kızgın (−), meyhane kapanır.'); break; }
    case 'sokak': out.push(`Gece ${s.value}:00–${s.value2}:00 dışarıdakiler bekçiye yakalanır (ceza).`, 'Gece suçları ≈ %70 azalır, mutluluk günde ≈ −0,3.'); break;
    case 'hizmet': out.push(`Günde ${s.value} vatandaş ücretsiz çalışır: inşaat ilerler ya da devriyeye katılır.`, `Hizmete çağrılanların memnuniyeti ≈ −4; toplam üretim ≈ %${Math.round(s.value / Math.max(1, n) * 100)} düşer.`); break;
    case 'destek': out.push(`Hazineye günde ≈ −${Math.round(sold(w, g!) * s.value)} D.`, `${GOOD_LABEL[g!]} üreticileri memnun, arz artar, fiyat düşer.`); break;
    case 'servetEsigi': { const rich = adults(w).filter((p) => p.money > s.value); out.push(`${rich.length} kişi etkilenir; hazineye günde ≈ +${Math.round(rich.reduce((a, p) => a + Math.min(25, (p.money - s.value) * 0.02), 0))} D.`, 'Zenginler ve tüccarlar kızar, fakirler sevinir.'); break; }
    case 'sertCeza': out.push(`Suç ≈ %${Math.round(100 - 100 / (1 + s.value / 100))} azalır; zindan kalabalıklaşır.`, 'Cumhuriyetçiler “zulüm” der; dindarlar ve esnaf memnun.'); break;
  }
  return '🔮 ' + out.join(' ');
}

/** The direct mood shock of enacting a law (stance per person). */
function shock(w: World, s: LawSpec, sign: 1 | -1): void {
  for (const p of adults(w)) {
    let d = 0;
    switch (s.kind) {
      case 'satisVergisi': d = (w.taxRate - s.value) * 0.6; break;
      case 'basVergisi': d = (w.headTax - s.value) * 3; break;
      case 'malVergisi': d = -2 - (p.prof && s.good && PRODUCER[p.prof] === s.good ? 8 : 0); break;
      case 'narh': d = s.good && PRODUCER[p.prof] === s.good ? -6 : 1.5; break;
      case 'yasak': d = s.good === 'icki' ? (p.din - 50) / 6 : ['ekmek', 'su', 'bugday'].includes(s.good!) ? -25 : -3; if (s.good && PRODUCER[p.prof] === s.good) d -= 10; break;
      case 'sokak': d = p.honesty < 40 ? -4 : -1; break;
      case 'hizmet': d = -2; break;
      case 'destek': d = s.good && PRODUCER[p.prof] === s.good ? 6 : 0.5; break;
      case 'servetEsigi': d = p.money > s.value ? -6 : 1; break;
      case 'sertCeza': d = p.honesty < 35 ? -5 : p.republic > 50 ? -2 : 1; break;
    }
    p.loyalty = clamp(p.loyalty + d * sign); if (d < -5) p.republic = clamp(p.republic + 1);
  }
}
const PRODUCER: Record<string, Good> = { ciftci: 'bugday', firinci: 'ekmek', sucu: 'su', kasap: 'et', balikci: 'balik', dokumaci: 'kumas', terzi: 'elbise', marangoz: 'odun', mobilyaci: 'mobilya', demirci: 'alet', barci: 'icki' };

function apply(w: World, l: LawSpec, on: boolean): void {
  switch (l.kind) {
    case 'satisVergisi': if (on) w.taxRate = l.value; break;
    case 'basVergisi': if (on) w.headTax = l.value; break;
    case 'narh': if (on) { w.priceCaps[l.good!] = l.value; for (const x of w.listings) if (x.good === l.good && x.price > l.value) x.price = l.value; } else delete w.priceCaps[l.good!]; break;
    case 'yasak': if (on) { if (!w.bans.includes(l.good!)) w.bans.push(l.good!); for (const x of w.listings) if (x.good === l.good && x.sellerId !== 'dis') x.qty = 0; w.listings = w.listings.filter((x) => x.qty > 0); } else w.bans = w.bans.filter((b) => b !== l.good); break;
    default: break; // the others act daily through helpers below
  }
}

/** Enact a custom law. Replaces an existing law of the same kind (and good). */
export function enactLaw(w: World, s: LawSpec, by: Person | null, via: 'ferman' | 'meclis'): string {
  const err = validateLaw(s); if (err) return err;
  w.customLaws = w.customLaws ?? [];
  const old = w.customLaws.find((x) => x.kind === s.kind && x.good === s.good); if (old) repealLaw(w, old.id, true);
  shock(w, s, 1);
  const law: CustomLaw = { ...s, id: nextId(w, 'K'), name: (s.name?.trim().slice(0, 50)) || lawTitle(s), by: by?.id ?? 'meclis', day: w.day, via };
  w.customLaws.push(law); apply(w, law, true);
  log(w, `📜 YENİ KANUN (${via === 'ferman' ? 'ferman' : 'Meclis'}): ${law.name}.`);
  return `Kanun yürürlükte: ${law.name}.`;
}
export function repealLaw(w: World, id: string, quiet = false): string {
  const l = (w.customLaws ?? []).find((x) => x.id === id); if (!l) return 'Kanun yok.';
  w.customLaws = w.customLaws.filter((x) => x !== l); apply(w, l, false);
  if (!quiet) { shock(w, l, -1); log(w, `📜 Kanun kaldırıldı: ${l.name}.`); }
  return `${l.name} kaldırıldı.`;
}
export const customLaw = (w: World, kind: LawKind, good?: Good): CustomLaw | undefined => (w.customLaws ?? []).find((x) => x.kind === kind && (good === undefined || x.good === good));

/** Extra per-good tax in percent (added to what the seller owes). */
export function goodTaxPct(w: World, g: Good): number { return customLaw(w, 'malVergisi', g)?.value ?? 0; }
export function subsidyPerUnit(w: World, g: Good): number { return customLaw(w, 'destek', g)?.value ?? 0; }
export function curfewAt(w: World, hour: number): boolean {
  const c = customLaw(w, 'sokak'); if (!c) return false; const a = c.value, b = c.value2 ?? 5;
  return a > b ? hour >= a || hour < b : hour >= a && hour < b;
}
export function crimeFactor(w: World): number { const c = customLaw(w, 'sertCeza'); return c ? 1 / (1 + c.value / 100) : 1; }
export function wealthThreshold(w: World): number { return customLaw(w, 'servetEsigi')?.value ?? 300; }

/** Daily effects: service duty, curfew mood. Returns the people serving today (patrols use them). */
export function customLawsDay(w: World): Person[] {
  const serving: Person[] = [];
  const h = customLaw(w, 'hizmet');
  if (h) {
    const pool = adults(w).filter((p) => !p.playerId && p.prof !== 'asker' && p.prof !== 'bekci');
    const proj = w.projects.find((x) => !x.done);
    for (let i = 0; i < h.value && pool.length; i += 1) {
      const p = pick(w, pool); pool.splice(pool.indexOf(p), 1); serving.push(p);
      p.loyalty = clamp(p.loyalty - 1.5); p.lastAction = proj ? `zorunlu hizmet: ${proj.name}` : 'zorunlu hizmet: devriye';
      if (proj) proj.progress = Math.min(proj.needed, proj.progress + 1);
    }
  }
  if (customLaw(w, 'sokak')) for (const p of adults(w)) p.mood = clamp(p.mood - 0.3);
  w.serving = serving.map((p) => p.id);
  return serving;
}
/** Subsidy payout for one sold unit (called from the market). */
export function paySubsidy(w: World, sellerId: string, g: Good): void {
  const s = subsidyPerUnit(w, g); if (s > 0 && sellerId !== 'dis' && sellerId !== 'saray') transfer(w, 'saray', sellerId, s, `${GOOD_LABEL[g]} desteği`);
}
export { BASE_PRICE };
