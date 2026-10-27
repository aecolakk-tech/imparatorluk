/* Headless world simulation: node smoke test of ~200 game days with a "sensible Kayzer" policy. */
import { createWorld, joinWorld, advanceWorld, touchPlayer, applyAction, totalMoney, DAY_MS, naipPetitions, sanction } from '../src/sim/index';
import type { World } from '../src/sim/index';

export function runSim(days = 200, seed = 7, policy: 'sensible' | 'naip' | 'tyrant' = 'sensible'): { w: World; report: string[]; moneyDrift: number } {
  let now = 1_700_000_000_000;
  const w = createWorld(seed, now);
  joinWorld(w, 'founder', 'Ahmet Enes', 'kayzer', true, now);
  joinWorld(w, 'friend', 'Berat', 'firinci', false, now);
  const m0 = totalMoney(w);
  const report: string[] = [];
  let lastT = w.treasury;
  for (let d = 0; d < days; d += 1) {
    for (let h = 0; h < 24; h += 1) {
      now += DAY_MS / 24;
      if (policy !== 'naip') touchPlayer(w, 'founder', now); // naip policy: the Kayzer never shows up
      if (policy === 'naip' || d % 3 === 0) touchPlayer(w, 'friend', now);
      advanceWorld(w, now);
    }
    if (policy === 'sensible') {
      const delta = w.treasury - lastT;
      if (delta < -15 && w.taxRate < 20) applyAction(w, 'founder', { t: 'setTax', rate: w.taxRate + 1 }, now);
      else if (delta > 40 && w.taxRate > 6) applyAction(w, 'founder', { t: 'setTax', rate: w.taxRate - 1 }, now);
      naipPetitions(w, now); // answers like a fair ruler
      for (const p of w.petitions.filter((x) => x.status === 'bekliyor' && x.kind === 'vergi')) applyAction(w, 'founder', { t: 'answer', petitionId: p.id, accept: w.taxRate > 14 }, now);
      if (w.projects.every((p) => p.done) && w.treasury > 1500) applyAction(w, 'founder', { t: 'startProject', name: 'Köprü', cost: 600 }, now);
      if (w.cumhuriyet > 45 && w.treasury > 350 && d % 5 === 0) applyAction(w, 'founder', { t: 'festival', cost: 150 }, now);
      const pr = w.projects.find((p) => !p.done); if (pr && pr.paid < 60 && w.treasury > 1000) applyAction(w, 'founder', { t: 'fundProject', projectId: pr.id, amount: 100 }, now);
      for (const b of w.meclis.bills.filter((x) => x.status === 'onay')) sanction(w, b, !(b.kind === 'vergi' && b.value > 20) && b.kind !== 'gensoru');
    } else if (policy === 'tyrant') {
      if (w.regime === 'imparatorluk' && w.kayzerId === w.founderPersonId && w.taxRate < 30) applyAction(w, 'founder', { t: 'setTax', rate: 30 }, now);
      for (const b of w.meclis.bills.filter((x) => x.status === 'onay')) sanction(w, b, false);
    }
    lastT = w.treasury;
    if ((d + 1) % 20 === 0) {
      const s = w.stats[w.stats.length - 1]!;
      report.push(`gün ${String(w.day).padStart(3)} | hazine ${String(s.treasury).padStart(6)} | vergi %${w.taxRate} | memnuniyet ${s.mood} | cumhuriyet ${s.cumhuriyet} | halkın parası ${s.money} | ekmek ${s.prices.ekmek} su ${s.prices.su} et ${s.prices.et} | aç ${w.people.filter((p) => p.hunger > 60).length} | zindan ${w.people.filter((p) => p.jailedDays > 0).length} | ${w.regime === 'cumhuriyet' ? 'CUMHURİYET' : w.kayzerId === w.founderPersonId ? 'kurucu' : 'gasp'} | sadakat ${Math.round(w.people.reduce((a, p) => a + p.loyalty, 0) / w.people.length)} | tasarı ${w.meclis.bills.length}`);
    }
  }
  return { w, report, moneyDrift: Math.round((totalMoney(w) - m0) * 100) / 100 };
}

const isMain = process.argv[1]?.includes('simulate');
if (isMain) {
  for (const policy of ['sensible', 'naip', 'tyrant'] as const) {
    const t0 = Date.now();
    const { w, report, moneyDrift } = runSim(Number(process.env.DAYS ?? 200), 7, policy);
    console.log(`\n=== politika: ${policy} (${Date.now() - t0} ms) para sızıntısı: ${moneyDrift}`);
    for (const r of report) console.log(r);
    console.log('son manşet:', w.gazette[w.gazette.length - 1]?.headline);
    const crimes = w.ledger.filter((l) => l.reason === 'hırsızlık').length;
    console.log(`son ledger kayıtlarında hırsızlık: ${crimes}, evli: ${w.people.filter((p) => p.spouse).length}, meclis: ${w.people.filter((p) => p.meclis).map((p) => p.name).join(', ')}`);
  }
}
