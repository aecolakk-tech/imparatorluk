/**
 * Rule-based NPC dialogue (no LLM): NPCs chat in the Meydan, talk to each other on the map (speech bubbles),
 * answer players' DMs and Meydan messages, and approach players on their own (chat, favours, deals, bribes).
 * Lines reflect mood, needs, opinions, dindarlık, prices and politics.
 */
import type { Good, Person, World } from './types';
import { BASE_PRICE, GOOD_LABEL, PROF_LABEL, PRODUCES } from './constants';
import { chance, clamp, nextId, pick } from './rng';
import { findPerson } from './world';
import { marketPrice } from './economy';
import { fullAI } from './ai';
import { relate } from './life';

const say = (w: World, from: Person, to: string | null, text: string, at: number): void => {
  w.chatOut.push({ fromPersonId: from.id, fromName: from.name, toPersonId: to, text: text.slice(0, 280), at });
  if (w.chatOut.length > 60) w.chatOut.splice(0, w.chatOut.length - 60);
};
const talk = (w: World, a: Person, b: Person, text: string): void => {
  w.talks.push({ a: a.id, b: b.id, text: text.slice(0, 60), day: w.day, hour: w.hour });
  if (w.talks.length > 30) w.talks.shift();
};

/** What is on this person's mind, as one sentence. */
export function opinion(w: World, p: Person): string {
  const bread = marketPrice(w, 'ekmek');
  const opts: string[] = [];
  if (p.meals < 2 && w.hour > 14) opts.push('Bugün doğru dürüst bir şey yemedim, karnım zil çalıyor.');
  if (p.drinks < 3 && w.hour > 14) opts.push('Susuzluktan dudaklarım çatladı, su da pahalı.');
  if (p.health < 30 || p.wounded) opts.push('Hastayım, hekime gidecek param yok.');
  if (bread > BASE_PRICE.ekmek * 1.6) opts.push(`Ekmek ${bread.toFixed(1)} Dinar olmuş, bu nasıl iş!`);
  else if (bread < BASE_PRICE.ekmek * 0.9) opts.push('Ekmek ucuzladı, şükür.');
  if (w.nature?.kind === 'kuraklik') opts.push('Bu kuraklık hepimizi aç bırakacak.');
  if (w.nature?.kind === 'salgin') opts.push('Salgın kapıda, ellerinizi yıkayın.');
  if (w.taxRate > 15) opts.push(`Vergi %${w.taxRate}; esnaf can çekişiyor.`);
  if (p.din > 70) opts.push(pick(w, ['Cuma namazında görüşelim inşallah.', 'İçki şehri bozuyor, haram işler çoğaldı.', 'Hocanın vaazı çok güzeldi.']));
  if (p.din < 30) opts.push(pick(w, ['Akşam meyhanede bir kadeh içelim mi?', 'Her şeye dinle karışmasınlar.', 'Meyhaneci yeni şarap getirmiş.']));
  if (p.republic > 60 && w.regime === 'imparatorluk') opts.push(pick(w, ['Saltanat bitmeli, halk kendini yönetmeli!', 'Meclis güçlenmeli, Kayzer’in sözü kanun olmamalı.']));
  if (p.loyalty > 75) opts.push(w.regime === 'imparatorluk' ? 'Kayzerimize uzun ömür! Devlet sağlam.' : 'Başkanımız iyi gidiyor.');
  if (p.loyalty < 30) opts.push('Saray bizi görmüyor, umurlarında değiliz.');
  if (w.isyan) opts.push('Sokaklar karıştı, evden çıkmayın!');
  if (w.threat) opts.push(`${w.threat.name} sınırda; askerimiz yeter mi acaba?`);
  if (w.caravan) opts.push(`${w.caravan.name} limanda, pahalı ama mal var.`);
  const e = w.election; if (w.day >= e.nextDay - 6 && w.day <= e.nextDay) opts.push(e.candidates.length ? `Seçimde ${findPerson(w, pick(w, e.candidates))?.name ?? 'birine'} oy vereceğim.` : 'Seçim yaklaşıyor, kim aday olacak?');
  if (p.mood > 75) opts.push(pick(w, ['Ne güzel bir gün!', 'İşler yolunda, Allah bereket versin.']));
  if (PRODUCES[p.prof]) opts.push(`${PROF_LABEL[p.prof]}lık zor zanaat; ${GOOD_LABEL[PRODUCES[p.prof]!.good]} ${marketPrice(w, PRODUCES[p.prof]!.good).toFixed(1)} Dinar ediyor.`);
  return opts.length ? pick(w, opts) : pick(w, ['Hava güzel bugün.', 'Pazarda kalabalık var.', 'Çocuklar büyüyor maşallah.']);
}

const GREET = ['Selamünaleyküm', 'Merhaba', 'Hayırlı günler', 'Ooo, hoş geldin'];
/** Reply to a player's message (DM or Meydan mention). Pure rules on keywords + the NPC's state & relation. */
export function replyTo(w: World, npc: Person, from: Person, text: string): string {
  const t = text.toLocaleLowerCase('tr'); const r = npc.relations[from.id] ?? 0;
  const cold = r < -30; const warm = r > 30;
  if (/\*{3,}/.test(text) || /aptal|salak|şerefsiz|defol/.test(t)) { relate(npc, from, -12, 'bana hakaret etti'); return pick(w, ['Ağzını topla!', 'Sana yakışmadı bu söz.', 'Bunu unutmayacağım.']); }
  relate(npc, from, 2, 'sohbet ettik');
  if (/merhaba|selam|günaydın|iyi akşam/.test(t)) return `${pick(w, GREET)} ${from.name.split(' ')[0]}! ${cold ? 'Ne istiyorsun?' : opinion(w, npc)}`;
  if (/nasılsın|naber|ne haber|keyif/.test(t)) return npc.mood > 60 ? `İyiyim, şükür. ${opinion(w, npc)}` : npc.mood > 35 ? `İdare ediyoruz. ${opinion(w, npc)}` : `Hiç iyi değilim… ${opinion(w, npc)}`;
  const g = (Object.keys(GOOD_LABEL) as Good[]).find((x) => t.includes(GOOD_LABEL[x].toLocaleLowerCase('tr')));
  if (g || /fiyat|kaç para|pahalı|ucuz/.test(t)) { const gg = g ?? 'ekmek'; const mine = PRODUCES[npc.prof]?.good === gg; return `${GOOD_LABEL[gg]} şimdi ${marketPrice(w, gg).toFixed(2)} Dinar.${mine ? ` Ben de satıyorum; ${warm ? 'sana biraz indirim yaparım.' : 'tezgâhıma bak.'}` : ''}`; }
  if (/vergi|kayzer|saray|başkan|cumhuriyet|meclis|seçim|siyaset/.test(t)) return npc.republic > 60 ? 'Açık konuşayım: bu saltanat böyle gitmez. Meclis halkın sesi olmalı.' : npc.loyalty > 70 ? 'Devletimize laf ettirmem; Kayzer ne yaparsa doğru yapar.' : `Vergi %${w.taxRate}. ${w.taxRate > 14 ? 'Fazla bence.' : 'Fena değil.'} ${opinion(w, npc)}`;
  if (/namaz|cami|din|allah|hoca|vaaz/.test(t)) return npc.din > 60 ? 'Elhamdülillah. Öğle namazında camide buluşalım.' : npc.din < 30 ? 'Ben pek camiye gitmem, kusura bakma.' : 'Cumaları giderim, inşallah.';
  if (/içki|meyhane|bar|şarap|rakı/.test(t)) return npc.din > 60 ? 'Tövbe! Ben içki içmem.' : 'Akşam meyhanede görüşelim, bir kadeh benden!';
  if (/borç|para ver|yardım|ödünç/.test(t)) { if (warm && npc.money > 60) return 'Sen iyi adamsın; bana yaz, 10 Dinar verebilirim.'; return npc.money < 20 ? 'Kendi kesem boş, kusura bakma.' : 'Para işine karışmam, sarrafa git.'; }
  if (/iş|çalış/.test(t)) return npc.prof === 'insaatci' || npc.prof === 'hamal' ? 'Şantiyede iş var mı bakıyorum ben de.' : `${PROF_LABEL[npc.prof]}lık yapıyorum. ${PRODUCES[npc.prof] ? 'Ham madde bulmak zor.' : 'Maaş az ama geçiniyoruz.'}`;
  if (/teşekkür|sağ ol|eyvallah/.test(t)) { relate(npc, from, 3, 'kibar biri'); return 'Rica ederim, her zaman.'; }
  if (/evlen|sevgili|aşk/.test(t)) return npc.spouse ? 'Ben evliyim, haddini bil!' : warm ? 'Hmm… Ailemle konuşman lazım.' : 'Seni pek tanımıyorum.';
  return cold ? 'Seninle konuşacak bir şeyim yok.' : opinion(w, npc);
}

/** Hourly chatter: NPC↔NPC talk on the map + Meydan, and NPCs approaching (online) players. */
export function chatHour(w: World, now: number, online: (p: Person) => boolean): void {
  if (w.hour < 7 || w.hour > 22) return;
  const awake = w.people.filter((p) => fullAI(p) && p.jailedDays === 0 && p.exiledDays === 0 && p.prof !== 'naip');
  // map conversations among colleagues / neighbours
  for (let i = 0; i < 6 && awake.length > 1; i += 1) {
    const a = pick(w, awake); const near = awake.filter((b) => b !== a && (b.work === a.work || b.home === a.home));
    const b = near.length ? pick(w, near) : pick(w, awake); if (a === b) continue;
    const line = opinion(w, a); talk(w, a, b, line);
    const agree = Math.abs(a.republic - b.republic) < 25 && Math.abs(a.din - b.din) < 30;
    relate(a, b, agree ? 2 : -1, agree ? 'sohbetimiz tatlı' : 'fikirlerimiz uyuşmuyor'); relate(b, a, agree ? 2 : -1, agree ? 'sohbetimiz tatlı' : 'fikirlerimiz uyuşmuyor');
  }
  // Meydan: an NPC posts, another may answer
  if (chance(w, 0.5)) {
    const a = pick(w, awake); const line = opinion(w, a); say(w, a, null, line, now);
    if (chance(w, 0.6)) { const b = pick(w, awake); if (b !== a) say(w, b, null, `@${a.name.split(' ')[0]} ${Math.abs(a.republic - b.republic) < 25 ? pick(w, ['Haklısın.', 'Aynen öyle.', 'Ben de öyle düşünüyorum.']) : pick(w, ['Katılmıyorum.', 'Abartma bence.', 'Öyle deme.'])} ${opinion(w, b)}`, now + 1500); }
  }
  // NPCs approach online players
  for (const p of w.people.filter((x) => x.playerId && online(x))) {
    if (!chance(w, 0.12)) continue;
    const friends = awake.filter((x) => (x.relations[p.id] ?? 0) > 10); const n = friends.length && chance(w, 0.6) ? pick(w, friends) : pick(w, awake);
    approach(w, n, p, now);
  }
}

function approach(w: World, n: Person, p: Person, now: number): void {
  const kind = pick(w, ['sohbet', 'sohbet', 'rica', 'mal', 'davet', 'rusvet'] as const);
  if (kind === 'rica' && n.money < 20) {
    w.offers.push({ id: nextId(w, 'O'), from: n.id, to: p.id, kind: 'borc', amount: 10, day: w.day, text: `${n.name} 10 Dinar borç istiyor` });
    say(w, n, p.id, `${p.name.split(' ')[0]}, ayıptır söylemesi kesem boş. 10 Dinar verir misin? Geri öderim, bu iyiliği unutmam. (Aile/Teklifler)`, now); return;
  }
  const g = PRODUCES[n.prof]?.good;
  if (kind === 'mal' && g && n.inv[g] + w.listings.filter((l) => l.sellerId === n.id && l.good === g).reduce((s, l) => s + l.qty, 0) > 2) {
    const price = Math.round(marketPrice(w, g) * 0.9 * 100) / 100;
    w.offers.push({ id: nextId(w, 'O'), from: n.id, to: p.id, kind: 'mal', good: g, qty: 3, price, day: w.day, text: `${n.name}: 3 ${GOOD_LABEL[g]}, tanesi ${price}` });
    say(w, n, p.id, `Sana özel: 3 ${GOOD_LABEL[g]} tanesi ${price} Dinar, pazardan ucuz. İster misin? (Teklifler)`, now); return;
  }
  if (kind === 'rusvet' && ['bekci', 'tahsildar', 'savci', 'hakim', 'memur'].includes(p.prof) && n.honesty < 45 && n.money > 40) {
    w.offers.push({ id: nextId(w, 'O'), from: n.id, to: p.id, kind: 'rusvet', amount: 15, day: w.day, text: `${n.name} 15 Dinar karşılığı göz yummanızı istiyor` });
    say(w, n, p.id, `Psst… ${PROF_LABEL[p.prof]} efendi, 15 Dinar'ım var; benim işlere biraz göz yumsan? (Teklifler)`, now); return;
  }
  if (kind === 'davet') { say(w, n, p.id, n.din > 55 ? 'Öğle namazında camide buluşalım mı?' : 'Akşam meyhanede bir kadeh içelim mi? Benden!', now); return; }
  say(w, n, p.id, `${pick(w, GREET)}! ${opinion(w, n)}`, now);
  void clamp;
}

/** A player wrote something: NPC replies (DM → the addressee; Meydan → mentioned names or a couple of bystanders). */
export function playerSaid(w: World, from: Person, text: string, toPersonId: string | null, now: number): void {
  if (toPersonId) { const npc = findPerson(w, toPersonId); if (npc && fullAI(npc) && npc.prof !== 'naip') say(w, npc, from.id, replyTo(w, npc, from, text), now + 1200); if (npc?.prof === 'naip') say(w, npc, from.id, 'Efendim, devlet işlerinde size yardımcı olmak görevimdir. Dilekçelerinizi Saray’a yazın; ben de Kayzer yokken küçük işleri görürüm.', now + 1200); return; }
  const t = text.toLocaleLowerCase('tr');
  const named = w.people.filter((p) => fullAI(p) && p.name.split(' ').some((x) => x.length > 2 && t.includes(x.toLocaleLowerCase('tr'))));
  const responders = named.length ? named.slice(0, 2) : w.people.filter((p) => fullAI(p) && p.jailedDays === 0 && chance(w, 0.03)).slice(0, 2);
  responders.forEach((npc, i) => say(w, npc, null, `@${from.name.split(' ')[0]} ${replyTo(w, npc, from, text)}`, now + 1500 * (i + 1)));
}
