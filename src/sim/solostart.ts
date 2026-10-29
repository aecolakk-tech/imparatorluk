/**
 * v2.1.0 tek kişilik start: 'Halktan biri' (an NPC Kayzer with a random name, a random ruling temperament and a random
 * historical empire name) or 'Kayzer olarak' (the player takes the throne and names the empire).
 * The temperament (w.rulerTrait) really changes how the NPC ruler governs (rulerTraitDay + the naip policy thresholds).
 */
import type { Person, World } from './types';
import { clamp, pick } from './rng';
import { log } from './log';
import { findPerson } from './world';

export type RulerTrait = 'adil' | 'zalim' | 'cimri' | 'comert' | 'dindar';
export const RULER_TRAITS: RulerTrait[] = ['adil', 'zalim', 'cimri', 'comert', 'dindar'];
export const TRAIT_LABEL: Record<RulerTrait, string> = { adil: 'Adil', zalim: 'Zalim', cimri: 'Cimri', comert: 'Cömert', dindar: 'Dindar' };
export const TRAIT_INFO: Record<RulerTrait, string> = {
  adil: 'vergiyi ılımlı tutar, kıtlıkta ambarı açar',
  zalim: 'ağır vergi koyar, halkı ezer; memnuniyet ve sadakat her gün düşer',
  cimri: 'hazineyi biriktirir; vergi yüksek, ambar zor açılır',
  comert: 'vergi düşük, ambar kolay açılır, yoksullara hazineden sadaka dağıtır',
  dindar: 'camiye ve imama bağış yapar, halkın dindarlığını artırır; dindarlar memnun',
};
export const EMPIRE_NAMES = ['Rum Sultanlığı', 'Karaman Beyliği', 'Germiyan Beyliği', 'Trabzon İmparatorluğu', 'Danişmend Beyliği', 'Altın Orda Hanlığı', 'Hazar Kağanlığı',
  'Bulgar Çarlığı', 'Sırp Despotluğu', 'Eflak Voyvodalığı', 'Karakoyunlu Devleti', 'Akkoyunlu Devleti', 'Candar Beyliği', 'Aydın Beyliği', 'Menteşe Beyliği', 'Kıpçak Hanlığı',
  'Mora Despotluğu', 'Kırım Hanlığı', 'Dulkadir Beyliği', 'Saruhan Beyliği', 'Ramazan Beyliği', 'Artuklu Beyliği', 'Harzem Şahlığı', 'Gürcü Krallığı', 'Kilikya Krallığı', 'Epir Despotluğu',
  'Ani Krallığı', 'Hamid Beyliği', 'Karesi Beyliği', 'Erzincan Emirliği', 'Kayzer-i Rum Devleti', 'Doğu Roma Kayzerliği'];
const KAYZER_NAMES = ['Murad', 'Alaeddin', 'Kılıç Arslan', 'Konstantin', 'Aleksios', 'Süleyman', 'Bayezid', 'Mehmed', 'Orhan', 'Keykubad', 'Keyhüsrev', 'Manuel', 'Theodoros', 'Tuğrul', 'Melikşah', 'Davud', 'Gazan', 'Timur', 'Selim', 'İshak'];

export function randomEmpireName(rnd: () => number = Math.random, not?: string): string {
  for (let i = 0; i < 5; i++) { const n = EMPIRE_NAMES[Math.floor(rnd() * EMPIRE_NAMES.length)]!; if (n !== not) return n; }
  return EMPIRE_NAMES[0]!;
}
export function cleanEmpireName(name: string): string | null {
  const n = name.replace(/\s+/g, ' ').trim();
  return n.length >= 3 && n.length <= 40 && /^[\p{L}\d' .-]+$/u.test(n) ? n : null;
}

/** 'Halktan biri': the hanedan seat gets a random NPC Kayzer with a temperament; the empire a random name. */
export function npcRulerStart(w: World, rnd: () => number = Math.random): { kayzer: Person; trait: RulerTrait } {
  const k = findPerson(w, w.kayzerId)!;
  const taken = new Set(w.people.map((p) => p.name));
  let nm = `Kayzer ${KAYZER_NAMES[Math.floor(rnd() * KAYZER_NAMES.length)]}`; if (taken.has(nm)) nm = `${nm} II`;
  k.name = nm; const trait = RULER_TRAITS[Math.floor(rnd() * RULER_TRAITS.length)]!; w.rulerTrait = trait;
  if (trait === 'zalim') { k.honesty = 25; k.ambition = 85; } else if (trait === 'adil') k.honesty = 90; else if (trait === 'cimri') k.honesty = 55; else if (trait === 'comert') k.honesty = 75; else k.din = 95;
  w.empireName = randomEmpireName(rnd); w.empireNamedBy = k.id;
  log(w, `👑 ${k.name} (${TRAIT_LABEL[trait]}) ${w.empireName} tahtında: ${TRAIT_INFO[trait]}.`, k.id);
  return { kayzer: k, trait };
}

/** Daily effect of the NPC ruler's temperament (only while an NPC sits on the throne). Returns a short note or ''. */
export function rulerTraitDay(w: World): string {
  const t = w.rulerTrait; const k = findPerson(w, w.kayzerId);
  if (!t || !k || (k.playerId && !k.npc) || w.regime === 'cumhuriyet') return '';
  const folk = w.people.filter((p) => p.id !== k.id);
  switch (t) {
    case 'zalim': { for (const p of folk) { p.mood = clamp(p.mood - 0.6); p.loyalty = clamp(p.loyalty - 0.4); } const tax = Math.min(40, folk.length * 0.3); w.treasury += tax; return 'zalim kayzer halkı sıktı'; }
    case 'comert': { const poor = [...folk].sort((a, b) => a.money - b.money).slice(0, 5); let n = 0; for (const p of poor) { if (w.treasury < 30) break; w.treasury -= 2; p.money += 2; p.mood = clamp(p.mood + 2); n++; } for (const p of folk) p.loyalty = clamp(p.loyalty + 0.2); return n ? `${n} yoksula hazineden sadaka` : ''; }
    case 'dindar': { for (const p of folk) { p.din = clamp((p.din ?? 50) + 0.3); if ((p.din ?? 50) >= 60) p.mood = clamp(p.mood + 0.3); } return 'dindar kayzer camiye bağış yaptı'; }
    case 'cimri': { for (const p of folk) p.mood = clamp(p.mood - 0.15); return ''; }
    case 'adil': { for (const p of folk) p.loyalty = clamp(p.loyalty + 0.1); return ''; }
  }
  return '';
}
/** tax band and granary thresholds of the NPC ruler, by temperament (the default = the sensible naip) */
export function traitPolicy(w: World): { taxMin: number; taxMax: number; distAt: number; buyGranary: boolean } {
  const k = findPerson(w, w.kayzerId); const t = k && !(k.playerId && !k.npc) ? w.rulerTrait : undefined;
  switch (t) {
    case 'zalim': return { taxMin: 14, taxMax: 24, distAt: 2.6, buyGranary: true };
    case 'cimri': return { taxMin: 12, taxMax: 18, distAt: 2.4, buyGranary: false };
    case 'comert': return { taxMin: 5, taxMax: 11, distAt: 1.4, buyGranary: true };
    default: return { taxMin: 8, taxMax: 16, distAt: 1.8, buyGranary: true };
  }
}
void pick;
