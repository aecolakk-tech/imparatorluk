import type { Petition, Person, World } from './types';
import { lawOn, transfer } from './economy';
import { clamp } from './rng';
import { findPerson, WORKPLACE } from './world';
import { headTitle, log, personal } from './log';
import { spend } from './meclis';
import { PROF_LABEL } from './constants';

export type Decider = 'kayzer' | 'naip';

/** Apply an answer to a petition. The naip may not change laws/taxes/appointments: returns false (left pending). */
export function answerPetition(w: World, pet: Petition, accept: boolean, by: Decider, now?: number): boolean {
  const p = findPerson(w, pet.fromId);
  if (!p || pet.status !== 'bekliyor') return false;
  if (by === 'naip' && accept && (pet.kind === 'vergi' || pet.kind === 'kanun' || pet.kind === 'gorev')) return false;
  if (accept) {
    switch (pet.kind) {
      case 'yardim': {
        const amt = Math.min(pet.amount || 15, by === 'naip' ? 20 : 500);
        if (amt > 25 && !spend(w, amt)) return false; // large aid needs room in the Meclis budget
        if (!transfer(w, 'saray', p.id, amt, 'saray yardımı')) return false;
        break;
      }
      case 'is': giveJob(w, p); break;
      case 'vergi': w.taxRate = Math.max(0, w.taxRate - 2); log(w, `Ferman: vergi %${w.taxRate}'e indirildi.`); break;
      case 'sikayet': w.prices.ekmek = Math.round(w.prices.ekmek * 0.9 * 100) / 100; break;
      case 'kanun': { const law = w.laws.find((l) => l.id === pet.payload); if (law) { law.active = !law.active; log(w, `Ferman: ${law.name} ${law.active ? 'yürürlüğe girdi' : 'kaldırıldı'}.`); } break; }
      case 'gorev': { const prof = pet.payload as Person['prof'] | undefined; if (prof && PROF_LABEL[prof]) { p.prof = prof; p.work = WORKPLACE[prof]; log(w, `${p.name} ${PROF_LABEL[prof]} olarak atandı.`, p.id); } break; }
    }
    p.loyalty = clamp(p.loyalty + 8); p.mood = clamp(p.mood + 6); p.republic = clamp(p.republic - 3);
  } else {
    p.loyalty = clamp(p.loyalty - 6); p.mood = clamp(p.mood - 4); p.republic = clamp(p.republic + 1);
  }
  pet.status = accept ? 'kabul' : 'ret'; pet.answeredBy = by;
  const who = by === 'naip' ? 'Naip Maecenas' : headTitle(w);
  if (p.playerId) personal(w, p.playerId, `${who} dilekçenizi ${accept ? 'kabul' : 'ret'} etti: “${pet.text}”`, now);
  return true;
}

export function giveJob(w: World, p: Person): void {
  const proj = w.projects.find((x) => !x.done && x.paid > 20);
  p.prof = proj ? 'insaatci' : 'hamal'; p.work = proj ? 'santiye' : 'pazar'; p.unemployedDays = 0;
  log(w, `${p.name} ${proj ? 'şantiyede' : 'pazarda hamal olarak'} işe başladı.`, p.id);
}

/** Maecenas as naip: sensible, conservative rule-based state management. */
export function naipPetitions(w: World, now?: number): string[] {
  const done: string[] = [];
  for (const pet of w.petitions.filter((x) => x.status === 'bekliyor')) {
    const p = findPerson(w, pet.fromId); if (!p) continue;
    let accept: boolean | null = null;
    if (pet.kind === 'yardim') accept = w.treasury > 300 && (p.money < 15 || p.hunger > 50) && (pet.amount || 15) <= 20;
    else if (pet.kind === 'is') accept = true;
    else if (pet.kind === 'sikayet') accept = w.prices.ekmek > 4;
    else continue; // laws/taxes/appointments wait for the Kayzer
    if (answerPetition(w, pet, accept, 'naip', now)) done.push(`${p.name}: ${pet.kind} → ${accept ? 'kabul' : 'ret'}`);
  }
  return done;
}

export function expirePetitions(w: World, now?: number): void {
  for (const pet of w.petitions) {
    if (pet.status === 'bekliyor' && w.day > pet.expires) {
      pet.status = 'zamanasimi';
      const p = findPerson(w, pet.fromId);
      if (p) { p.loyalty = clamp(p.loyalty - 8); p.republic = clamp(p.republic + 2); if (p.playerId) personal(w, p.playerId, `Dilekçeniz cevapsız kaldı: “${pet.text}”`, now); }
    }
  }
  w.petitions = w.petitions.filter((x) => x.status === 'bekliyor' || w.day - x.day < 4);
}

export function saraykorBonus(w: World): number { return lawOn(w, 'saraykor') ? 1.2 : 1; }
