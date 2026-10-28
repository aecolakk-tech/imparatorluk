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
/** How an NPC addresses the speaker: İmparatorum / Başkanım / efendim / usta / first name. */
export function addressOf(w: World, from: Person): string {
  if (from.id === w.kayzerId) return w.regime === 'cumhuriyet' ? 'Başkanım' : 'İmparatorum';
  if (from.soylu) return 'efendim';
  if (['hakim', 'savci'].includes(from.prof)) return `${PROF_LABEL[from.prof]} efendi`;
  if (['bekci', 'asker', 'memur', 'tahsildar'].includes(from.prof)) return `${PROF_LABEL[from.prof].toLocaleLowerCase('tr')} efendi`;
  const first = from.name.split(' ').find((x) => !Object.values(PROF_LABEL).includes(x)) ?? from.name.split(' ')[0]!;
  return first;
}
function moodLine(p: Person): string {
  if (p.health < 40) return 'hastayım, halim yok';
  if (p.meals < 2) return 'karnım aç, idare ediyoruz';
  if (p.mood > 70) return 'çok şükür, keyfim yerinde';
  if (p.mood > 45) return 'iyidir, idare ediyoruz';
  return 'pek iyi değilim, işler kötü';
}
function gossipLine(w: World, npc: Person): string | null {
  const r = [...(w.rumors ?? [])].reverse().find((x) => x.about !== npc.id && w.day - x.day <= 4);
  if (r) return `Duydun mu? ${r.text}`;
  const e = [...w.events].reverse().find((x) => /evlendi|soyuldu|CİNAYET|yakaladı|doğdu|rüşvet|aday|kervan/.test(x.text) && w.day - x.day <= 2);
  return e ? `Duydun mu? ${e.text}` : null;
}
/** Reply to a player's message (DM or Meydan mention) – rule-based, used when no LLM is configured or it fails. Always returns a line. */
export function replyTo(w: World, npc: Person, from: Person, text: string): string {
  const t = text.toLocaleLowerCase('tr'); const r = npc.relations[from.id] ?? 0;
  const cold = r < -30; const warm = r > 30; const ad = addressOf(w, from); const ruler = from.id === w.kayzerId;
  if (/\*{3,}/.test(text) || /aptal|salak|şerefsiz|defol|gerizekal|mal mısın/.test(t)) { relate(npc, from, ruler ? -4 : -12, 'bana hakaret etti'); return ruler ? pick(w, [`Estağfurullah ${ad}, kalbimi kırdınız…`, `Haddim değil ${ad}, ama bu söz ağır oldu.`]) : pick(w, ['Ağzını topla!', 'Sana yakışmadı bu söz.', 'Bunu unutmayacağım.']); }
  relate(npc, from, 2, 'sohbet ettik');
  const parts: string[] = [];
  const greet = /merhaba|selam|^sa\b|\bsa\b|günaydın|iyi akşam|iyi günler|hayırlı/.test(t);
  const how = /nasılsın|naber|ne haber|nabıyon|napıyon|naptın|ne yapıyorsun|ne yapıyon|nasıl gidiyor|keyif|iyi misin|ne var ne yok/.test(t);
  if (greet) parts.push(cold ? 'Selam.' : `${pick(w, GREET)} ${ad}!`);
  if (how) parts.push(cold ? 'İdare ediyoruz, sana ne?' : `${moodLine(npc).replace(/^./, (c) => c.toLocaleUpperCase('tr'))} ${ad}. ${npc.lastAction && npc.lastAction !== '-' ? `Bugün ${npc.lastAction.replace(/^fazla mesai · /, '')}.` : `${PROF_LABEL[npc.prof]}lık yapıyorum.`}`);
  const g = (Object.keys(GOOD_LABEL) as Good[]).find((x) => t.includes(GOOD_LABEL[x].toLocaleLowerCase('tr')));
  if (g || /fiyat|kaç para|pahalı|ucuz|kaça/.test(t)) { const gg = g ?? 'ekmek'; const mine = PRODUCES[npc.prof]?.good === gg; const pr = marketPrice(w, gg); parts.push(`${GOOD_LABEL[gg]} şimdi ${pr.toFixed(2)} Dinar${pr > BASE_PRICE[gg] * 1.4 ? ', çok pahalandı' : pr < BASE_PRICE[gg] * 0.8 ? ', ucuz sayılır' : ''}.${mine ? ` Ben de satıyorum; ${warm ? 'sana indirim yaparım.' : 'tezgâhıma bak.'}` : ''}`); }
  if (/sağlık|hasta|hekim|yaralı|ağrı/.test(t)) parts.push(npc.health > 70 ? 'Sağlığım yerinde, çok şükür.' : npc.health > 40 ? 'Biraz halsizim ama ayaktayım.' : 'Çok hastayım, hekime param yetmiyor.');
  if (/\biş\b|işler|çalış|kazan|para/.test(t) && !/para ver|ödünç/.test(t)) parts.push(PRODUCES[npc.prof] ? `${PROF_LABEL[npc.prof]}lıktan bugün ${Math.round(npc.incomeToday)} Dinar kazandım. ${npc.money < 20 ? 'Kesem boş sayılır.' : 'Fena değil.'}` : `${PROF_LABEL[npc.prof]} olarak çalışıyorum. ${npc.money < 20 ? 'Maaş az, geçinmek zor.' : 'Geçinip gidiyoruz.'}`);
  if (/dedikodu|ne oldu|haber var|duydun|olay/.test(t)) parts.push(gossipLine(w, npc) ?? 'Valla bugün ortalık sakin, bir şey duymadım.');
  if (/vergi|kayzer|imparator|saray|başkan|cumhuriyet|meclis|seçim|siyaset|devlet|hükümet/.test(t)) {
    if (ruler) parts.push(npc.loyalty > 60 ? `Allah sizi başımızdan eksik etmesin ${ad}. Vergi %${w.taxRate}; ${w.taxRate > 14 ? 'biraz ağır geliyor halka.' : 'halk memnun.'}` : `Açık konuşayım mı ${ad}? Halk dertli; ${w.taxRate > 12 ? 'vergiler ağır,' : ''} ${marketPrice(w, 'ekmek') > BASE_PRICE.ekmek * 1.3 ? 'ekmek pahalı.' : 'saraydan ilgi bekliyor.'}`);
    else parts.push(npc.republic > 60 ? 'Açık konuşayım: bu saltanat böyle gitmez. Meclis halkın sesi olmalı.' : npc.loyalty > 70 ? 'Devletimize laf ettirmem; Kayzer ne yaparsa doğru yapar.' : `Vergi %${w.taxRate}. ${w.taxRate > 14 ? 'Fazla bence.' : 'Fena değil.'}`);
  }
  if (/namaz|cami|din|allah|hoca|vaaz|dua/.test(t)) parts.push(npc.din > 60 ? 'Elhamdülillah. Öğle namazında camide buluşalım.' : npc.din < 30 ? 'Ben pek camiye gitmem, kusura bakma.' : 'Cumaları giderim, inşallah.');
  if (/içki|meyhane|bar|şarap|rakı|içelim/.test(t)) parts.push(npc.din > 60 ? 'Tövbe! Ben içki içmem.' : 'Akşam meyhanede görüşelim, bir kadeh benden!');
  if (/borç|para ver|yardım|ödünç/.test(t)) parts.push(ruler ? `Estağfurullah ${ad}, benim size vereceğim ne olabilir? Hazine sizin.` : warm && npc.money > 60 ? 'Sen iyi adamsın; 10 Dinar verebilirim, sonra konuşuruz.' : npc.money < 20 ? 'Kendi kesem boş, kusura bakma.' : 'Para işine karışmam, sarrafa git.');
  if (/teşekkür|sağ ol|eyvallah|sağol/.test(t)) { relate(npc, from, 3, 'kibar biri'); parts.push(`Rica ederim ${ad}, her zaman.`); }
  if (/evlen|sevgili|aşk|güzelsin|yakışıklı/.test(t)) parts.push(npc.spouse ? 'Ben evliyim, haddini bil!' : npc.female === from.female ? 'Hayırdır? Öyle şeylerden anlamam.' : warm ? 'Hmm… Ailemle konuşman lazım.' : 'Seni pek tanımıyorum.');
  if (/adın|kimsin|tanış/.test(t)) parts.push(`Ben ${npc.name}, ${PROF_LABEL[npc.prof].toLocaleLowerCase('tr')}. ${findPerson(w, npc.spouse) ? `Eşim ${findPerson(w, npc.spouse)!.name}.` : 'Bekârım.'}`);
  if (/hava|yağmur|kurak|sıcak/.test(t)) parts.push(w.nature?.kind === 'kuraklik' ? 'Kuraklık var, tarlalar kurudu.' : w.nature?.kind === 'sel' ? 'Sel suları evleri bastı.' : 'Hava güzel, şükür.');
  if (/yemek|aç|karnın|ekmek/.test(t) && !g) parts.push(npc.meals >= 2 ? 'Bugün karnım tok.' : 'Bugün doğru dürüst yemedim.');
  if (/görüşürüz|hoşça|allaha ısmarladık|bay bay|iyi geceler/.test(t)) parts.push(`Güle güle ${ad}, yolun açık olsun.`);
  if (/\?$/.test(text.trim()) && parts.length <= (greet ? 1 : 0)) parts.push(pick(w, ['Vallahi bilemedim.', 'Onu bir düşüneyim.', 'Bunu sarayda sormak lazım.']) + ' ' + opinion(w, npc));
  if (!parts.length) return cold ? 'Seninle konuşacak bir şeyim yok.' : `${opinion(w, npc)}`;
  if (parts.length === 1 && greet && !cold) parts.push(opinion(w, npc));
  return parts.join(' ').slice(0, 280);
}

/** Hourly chatter: NPC↔NPC talk on the map (they walk up and speak), Meydan gossip, NPCs approaching (online) players. */
export function chatHour(w: World, now: number, online: (p: Person) => boolean): void {
  if (w.hour < 7 || w.hour > 22) return;
  const awake = w.people.filter((p) => fullAI(p) && p.jailedDays === 0 && p.exiledDays === 0 && p.prof !== 'naip');
  w.talks = (w.talks ?? []).filter((x) => !x.at || now - x.at < 120_000 || w.day - x.day < 1).slice(-24);
  for (let i = 0; i < 4 && awake.length > 1; i += 1) {
    const a = pick(w, awake); const near = awake.filter((b) => b !== a && (b.work === a.work || b.home === a.home));
    const b = near.length ? pick(w, near) : pick(w, awake); if (a === b) continue;
    const line = opinion(w, a);
    const agree = Math.abs(a.republic - b.republic) < 25 && Math.abs(a.din - b.din) < 30;
    const answer = agree ? `${pick(w, ['Haklısın.', 'Aynen öyle.', 'Doğru söylersin.'])} ${opinion(w, b)}` : `${pick(w, ['Katılmıyorum.', 'Abartma bence.', 'Öyle deme.'])} ${opinion(w, b)}`;
    w.talks.push({ a: a.id, b: b.id, text: line.slice(0, 80), lines: [line, answer], day: w.day, hour: w.hour, at: now + i * 9000 });
    relate(a, b, agree ? 2 : -1, agree ? 'sohbetimiz tatlı' : 'fikirlerimiz uyuşmuyor'); relate(b, a, agree ? 2 : -1, agree ? 'sohbetimiz tatlı' : 'fikirlerimiz uyuşmuyor');
  }
  // Meydan: only public gossip / news NPCs want everybody to hear
  if (chance(w, 0.35)) { const a = pick(w, awake); const gsp = gossipLine(w, a); if (gsp) say(w, a, null, `🗣 ${gsp.replace(/^Duydun mu\? /, pick(w, ['Duydunuz mu? ', 'Ahali, haberiniz var mı? ', 'Kulağıma geldi: ']))}`, now); }
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

/** A player wrote something: NPC replies (DM → the addressee; Meydan → mentioned names or a bystander). Returns the replying NPCs. */
export function playerSaid(w: World, from: Person, text: string, toPersonId: string | null, now: number, defer = false): { npc: Person; fallback: string }[] {
  const out: { npc: Person; fallback: string }[] = [];
  const emit = (npc: Person, to: string | null, line: string, delay: number): void => { out.push({ npc, fallback: line }); if (!defer) say(w, npc, to, line, now + delay); };
  if (toPersonId) {
    const npc = findPerson(w, toPersonId); if (!npc || npc.playerId) return out;
    if (npc.prof === 'naip') emit(npc, from.id, from.id === w.kayzerId ? `${/nab|nası|naber|merhaba|selam/i.test(text) ? 'İyiyim ' + addressOf(w, from) + ', sağ olun. ' : ''}Buyurun ${addressOf(w, from)}, emrinizdeyim. Devlet işleri yolunda; dilekçeler Saray’da bekliyor.` : 'Devlet işlerinde size yardımcı olmak görevimdir. Dilekçelerinizi Saray’a yazın.', 1200);
    else if (npc.jailedDays > 0) emit(npc, from.id, `Zindandayım ${addressOf(w, from)}… ${replyTo(w, npc, from, text)}`, 1200);
    else emit(npc, from.id, replyTo(w, npc, from, text), 1200);
    return out;
  }
  const t = text.toLocaleLowerCase('tr');
  const named = w.people.filter((p) => !p.playerId && p.prof !== 'naip' && p.name.split(' ').some((x) => x.length > 2 && t.includes(x.toLocaleLowerCase('tr'))));
  const bystanders = w.people.filter((p) => fullAI(p) && p.jailedDays === 0 && p.prof !== 'naip');
  const responders = named.length ? named.slice(0, 2) : chance(w, 0.8) && bystanders.length ? [pick(w, bystanders)] : [];
  responders.forEach((npc, i) => emit(npc, null, `@${from.name.split(' ').slice(-1)[0]} ${replyTo(w, npc, from, text)}`, 1500 * (i + 1)));
  return out;
}
export { say as npcSay };
