import type { Building, Good, Person, World } from '../sim/types';
import { GOODS } from '../sim/types';
import { BASE_PRICE, GOOD_LABEL, PROF_LABEL } from '../sim/constants';
import { findPerson } from '../sim/world';
import { electionDates, electionPhase } from '../sim/tick';
import { rankOf } from '../sim/economy';
import { QUESTS, armyPower } from '../sim/life';
import { lawPreview } from '../sim/extras';
import { CRIME_LABEL } from '../sim/ai';
import { h, fmt, select } from './dom';
import type { Ctx } from './panels';

export const NATURE_LABEL: Record<string, string> = { kuraklik: '☀️ Kuraklık', salgin: '🦠 Salgın', sel: '🌊 Sel', bereket: '🌾 Bereket', balik: '🐟 Balık bolluğu' };
export function dayPart(hour: number): string { return hour < 6 ? '🌙 Gece' : hour < 11 ? '🌅 Sabah' : hour < 15 ? '☀️ Öğle' : hour < 19 ? '🌇 İkindi' : hour < 22 ? '🌆 Akşam' : '🌙 Gece'; }

function num(v: number, min = 0, max = 100000, step = 1): HTMLInputElement { return h('input', { type: 'number', value: String(v), min: String(min), max: String(max), step: String(step), style: 'width:80px' }); }
function chip(text: string, tip: string, cls = ''): HTMLElement { return h('span', { class: `stat ${cls}`, title: tip }, text); }

/** Active events shown in the HUD: nature, festival, caravan, border threat, election phase. */
export function activeEvents(w: World): { text: string; tip: string }[] {
  const out: { text: string; tip: string }[] = [];
  if (w.nature && w.day <= w.nature.until) out.push({ text: `${NATURE_LABEL[w.nature.kind]} (${w.nature.until}. güne dek)`, tip: 'Doğal olay: üretimi etkiler. Kurallar → Doğa.' });
  if ((w.festivalUntil ?? 0) >= w.day) out.push({ text: '🎉 Festival', tip: 'Festival Alanı açık: oraya gidin, mutluluk artar.' });
  if (w.caravan && w.day <= w.caravan.until) out.push({ text: `🐪 ${w.caravan.name}`, tip: 'Limanda kervan: pahalı ama bol mal; şehrin fazlasını da alır.' });
  if (w.threat) out.push({ text: `⚔️ ${w.threat.name}: ${w.threat.demand} D haraç (${w.threat.deadline}. gün)`, tip: 'Sınırda tehdit. Kayzer haraç öder ya da ordu savaşır.' });
  const ph = electionPhase(w); if (ph.phase !== 'bekleme' || w.election.nextDay - w.day <= 9) out.push({ text: `🗳 ${ph.label}`, tip: 'Seçim takvimi: adaylık → propaganda (afiş, konuşma) → oylama günü.' });
  if (w.bans?.includes('icki')) out.push({ text: '🚫🍺 İçki yasak', tip: 'İçki Yasağı kanunu yürürlükte.' });
  return out;
}

/** HUD chips: clock + speed, my needs, events. */
export function hudChips(c: Ctx): HTMLElement[] {
  const w = c.w; const m = c.me; const out: HTMLElement[] = [];
  out.push(chip(`${dayPart(w.hour)} · Gün ${w.day} · ${String(w.hour).padStart(2, '0')}:00${w.speed !== 1 ? ` · ${w.speed}x` : ''}`, '1 oyun günü = 6 gerçek dakika (1x). Hızı sadece Kayzer değiştirir.'));
  if (m) {
    const mealOk = m.meals >= 3, waterOk = m.drinks >= 5;
    out.push(chip(`🍞 ${m.meals}/3`, 'Bugünkü öğünler. 3 olmazsa gün sonunda −10 sağlık.', mealOk ? 'ok' : 'warn'));
    out.push(chip(`💧 ${m.drinks}/5`, 'Bugün içilen su. 5 olmazsa gün sonunda −10 sağlık.', waterOk ? 'ok' : 'warn'));
    out.push(chip(`❤️ ${Math.round(m.health)}${m.wounded ? ' 🩸' : ''}`, m.health < 30 || m.wounded ? 'Hekime gitmeniz lazım (Hekimhane ya da ⚡).' : 'Sağlık', m.health < 30 || m.wounded ? 'warn' : ''));
    out.push(chip(`😊 ${Math.round(m.mood)}`, 'Mutluluk: kişisel hayatınız (yemek, aile, eğlence).'));
    out.push(chip(`🕌 ${Math.round(m.din)}`, 'Dindarlık (0–100): namaz artırır, içki düşürür.'));
  }
  for (const e of activeEvents(w)) out.push(chip(e.text, e.tip, 'event'));
  return out;
}

function questBox(c: Ctx): HTMLElement | '' {
  const w = c.w; const s = Object.values(w.players).find((p) => p.personId === c.me?.id); if (!s) return '';
  const i = s.quest ?? 0; const q = QUESTS[i];
  return h('div', { class: 'card quest' }, h('b', {}, '🎯 Görev '), q ? `${i + 1}/${QUESTS.length}: ${q.text}` : 'Rehber tamam! 🎖');
}

/** “Ne yapabilirim?” – everything a player can do right now, always available. */
export function quickPanel(c: Ctx): HTMLElement {
  const w = c.w; const me = c.me; const box = h('div', {}, h('h2', {}, '⚡ Ne yapabilirim?'));
  if (!me) return box;
  box.append(questBox(c));
  const btn = (label: string, tip: string, a: Parameters<Ctx['act']>[0], dis = false): HTMLElement => h('button', { title: tip, disabled: dis, onclick: () => c.act(a) }, label);
  box.append(h('h3', {}, 'İhtiyaçlar'), h('div', { class: 'row' },
    btn(`🍞 Ye (${me.meals}/3)`, 'Elinizdeki ya da pazardaki en uygun yemeği yer. Et/balık daha çok mutlu eder.', { t: 'eat' }),
    btn(`💧 Su iç (${me.drinks}/5)`, 'Kuyudan/pazardan su alıp içer.', { t: 'drinkWater' }),
    btn('🩺 Hekime git', 'Sağlık 30 altı ya da yara varsa şart. Ücretlidir.', { t: 'doctor' }, !(me.health < 100 || me.wounded)),
  ));
  box.append(h('h3', {}, 'Gündelik hayat'), h('div', { class: 'row' },
    btn('🕌 Namaz kıl', 'Camide: dindarlık +, biraz mutluluk.', { t: 'pray' }),
    btn('🍺 Meyhanede iç', 'Mutluluk ++, dindarlık −. Akşam meyhanede.', { t: 'drink' }, w.bans.includes('icki')),
    btn('🔨 Fazla mesai', 'Mesleğinizde bir tur daha üretir (günde bir).', { t: 'work' }),
    btn(me.nightOut ? '🏠 Geceyi evde geçir' : '🌙 Gece dışarı çık', 'Gece sokakta olmak riskli; gece yasağı varsa ceza.', { t: 'nightOut', on: !me.nightOut }),
  ));
  // loans
  const myLoans = w.loans.filter((l) => l.debtor === me.id); const amt = num(50, 5, 150);
  box.append(h('h3', {}, '💱 Sarraf'), h('div', { class: 'row' }, amt, h('button', { title: '%15 faiz, 7 gün. Ödenmezse haciz, sonra zindan.', onclick: () => c.act({ t: 'borrow', amount: Number(amt.value) }) }, 'Borç al'),
  ), ...myLoans.map((l) => h('div', { class: 'row card' }, `Borç ${fmt(l.amount)} D · son gün ${l.due}`, h('button', { onclick: () => c.act({ t: 'repay', loanId: l.id }) }, 'Öde'))));
  // arrests
  const mine = w.arrests.filter((a) => a.criminalId === me.id && a.status === 'bekliyor');
  for (const a of mine) {
    const ca = findPerson(w, a.catcherId); const off = num(Math.min(30, Math.round(me.money / 2)), 1, 1000);
    box.append(h('div', { class: 'card warn' }, h('b', {}, `⛓ ${ca?.name ?? 'Bekçi'} sizi yakaladı (${CRIME_LABEL[a.crime] ?? a.crime}).`),
      h('div', { class: 'muted' }, 'Rüşvet teklif edebilirsiniz; kabul ihtimali yakalayanın sadakatine bağlıdır. Reddedilirse rüşvet de suç sayılır.'),
      h('div', { class: 'row' }, off, h('button', { onclick: () => c.act({ t: 'offerBribe', arrestId: a.id, amount: Number(off.value) }) }, '🤫 Rüşvet teklif et'))));
  }
  const caught = w.arrests.filter((a) => a.catcherId === me.id && a.status === 'bekliyor');
  for (const a of caught) box.append(h('div', { class: 'card' }, `${findPerson(w, a.criminalId)?.name ?? '?'} yakalandı · teklif: ${a.offer ? `${a.offer} D` : 'yok'}`,
    h('div', { class: 'row' }, h('button', { onclick: () => c.act({ t: 'answerBribe', arrestId: a.id, accept: true }) }, 'Rüşveti al, sal'), h('button', { class: 'primary', onclick: () => c.act({ t: 'answerBribe', arrestId: a.id, accept: false }) }, 'Kadıya teslim et'))));
  // offers from NPCs
  const offers = w.offers.filter((o) => o.to === me.id);
  if (offers.length) box.append(h('h3', {}, `📨 Size gelen teklifler (${offers.length})`));
  for (const o of offers) box.append(h('div', { class: 'card' }, h('b', {}, findPerson(w, o.from)?.name ?? '?'), `: ${o.text}`,
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => c.act({ t: 'answerOffer', offerId: o.id, accept: true }) }, '✔ Kabul'), h('button', { onclick: () => c.act({ t: 'answerOffer', offerId: o.id, accept: false }) }, '✖ Ret'))));
  // trade hint
  const r = rankOf(me);
  box.append(h('h3', {}, '💼 Meslek'), h('div', { class: 'muted' }, `${PROF_LABEL[me.prof]} · ${r.label} (tecrübe ${Math.round(me.xp)}). Usta daha çok ve daha kaliteli üretir.`),
    h('div', { class: 'row' }, h('button', { title: 'Satışları vergiden saklamak (kaçakçılık). Tahsildar yakalayabilir.', class: me.smuggle ? 'danger' : '', onclick: () => c.act({ t: 'smuggle', on: !me.smuggle }) }, me.smuggle ? '🕵 Kaçakçılığı bırak' : '🕵 Vergiden kaç (suç)')));
  if (me.prof === 'imam' || me.prof === 'hoca') box.append(h('div', { class: 'row' }, ...(['namaz', 'icki', 'sabir'] as const).map((t) => btn(`📿 Vaaz: ${t}`, 'Cuma vaazı toplumun dindarlığını etkiler.', { t: 'sermon', topic: t }))));
  // titles
  if (me.titles?.length) box.append(h('h3', {}, '🎖 Unvanlarınız'), h('div', {}, me.titles.join(' · ')));
  box.append(h('h3', {}, 'Başka ne var?'), h('div', { class: 'muted' }, 'Binalara dokunun: Pazar (al/sat), Meclis (aday ol, oy ver, kanun teklif et), Mahkeme (avukat/tanık ol), Kışla (komplo), Saray (dilekçe). İnsanlara dokunun: sohbet, mesaj, para, evlilik, hakaret ya da suç.'));
  return box;
}

/** Event feed + gossip board. */
export function feedPanel(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {}, h('h2', {}, '📣 Olaylar ve dedikodu'));
  box.append(h('h3', {}, 'Son olaylar'), ...w.events.slice(-25).reverse().map((e) => h('div', { class: 'msg' }, `Gün ${e.day} ${String(e.hour).padStart(2, '0')}:00 — ${e.text}`)));
  box.append(h('h3', {}, '🗣 Dedikodu panosu'), h('div', { class: 'muted' }, 'Dedikodular kişilerin itibarını etkiler.'),
    ...(w.rumors.length ? w.rumors.slice(-15).reverse().map((r) => h('div', { class: 'msg' }, `Gün ${r.day}: ${r.text}`)) : [h('div', { class: 'muted' }, 'Şimdilik sessiz.')]));
  const top = [...w.people].filter((p) => p.titles?.length).sort((a, b) => b.titles.length - a.titles.length).slice(0, 8);
  if (top.length) box.append(h('h3', {}, '🎖 Unvan sahipleri'), ...top.map((p) => h('div', { class: 'msg', style: 'cursor:pointer', onclick: () => c.openPerson(p.id) }, `${p.name}: ${p.titles.join(', ')}`)));
  return box;
}

/** Extra rows for a person card: bars, reasons for friendships. */
export function personExtras(c: Ctx, p: Person): HTMLElement {
  const w = c.w; const r = rankOf(p);
  const rels = Object.entries(p.relations).filter(([, v]) => Math.abs(v) >= 20).sort((a, b) => b[1] - a[1]);
  const line = ([id, v]: [string, number]): HTMLElement => h('div', { class: 'msg', style: 'cursor:pointer', onclick: () => c.openPerson(id) }, `${v > 0 ? '💚' : '💢'} ${findPerson(w, id)?.name ?? '?'} (${Math.round(v)})${p.relNote?.[id] ? ` — ${p.relNote[id]}` : ''}`);
  return h('div', {},
    h('div', { class: 'muted' }, `${p.female ? '♀ Kadın' : '♂ Erkek'} · ${r.label} ${PROF_LABEL[p.prof]} · itibar ${Math.round(p.rep ?? 0)} · dindarlık ${Math.round(p.din ?? 50)}${p.wounded ? ' · 🩸 yaralı' : ''}${p.titles?.length ? ` · 🎖 ${p.titles.join(', ')}` : ''}`),
    h('div', { class: 'muted' }, `Bugün: 🍞 ${p.meals}/3 · 💧 ${p.drinks}/5`),
    rels.length ? h('details', {}, h('summary', {}, `Dostlar ve düşmanlar (${rels.length}) — nedenleriyle`), ...rels.slice(0, 6).map(line), ...rels.slice(-4).filter((x) => x[1] < 0 && !rels.slice(0, 6).includes(x)).map(line)) : h('div', { class: 'muted' }, 'Henüz güçlü bir dostluğu ya da düşmanlığı yok. Sohbet, yardım ve alışveriş dostluk; hakaret ve suç düşmanlık getirir.'),
  );
}
export function personActions(c: Ctx, p: Person): HTMLElement {
  const row = h('div', { class: 'row' },
    h('button', { class: 'primary', title: 'Ona yazın; kendi aklıyla cevap verir.', onclick: () => c.dm(p.id) }, '💬 Konuş'),
    c.me && ['bekci', 'asker'].includes(c.me.prof) && c.me.id !== p.id ? h('button', { title: 'İstifçilik araması: fazla stok varsa el konur (günde 1).', onclick: () => c.act({ t: 'inspect', personId: p.id }) }, '🔍 Ara') : '',
    h('button', { title: 'Düşmanlık −25, itibarınız düşer.', onclick: () => c.act({ t: 'insult', personId: p.id }) }, '😤 Hakaret et'),
    h('button', { class: 'danger', title: 'Suç: yaralar; yakalanırsanız 5 gün zindan.', onclick: () => { if (confirm('Saldırı suçtur. Emin misiniz?')) c.act({ t: 'assault', personId: p.id }); } }, '👊 Saldır'),
    h('button', { class: 'danger', title: 'Ağır suç: 25 gün zindan.', onclick: () => { if (confirm('Cinayet! Gerçekten mi?')) c.act({ t: 'kill', personId: p.id }); } }, '🗡 Öldür'),
  );
  return row;
}

/** Saray additions for the ruler. */
export function sarayExtras(c: Ctx): HTMLElement {
  const w = c.w; const box = h('div', {});
  // treasury breakdown
  const soldiers = w.people.filter((p) => p.prof === 'asker').length; const upkeep = soldiers * (w.salaries.asker ?? 0);
  box.append(h('h3', {}, '⚔️ Ordu'), h('div', { class: 'muted' }, `${soldiers} asker · günlük gider ${fmt(upkeep)} D · güç ${Math.round(armyPower(w))}${w.isyan ? ' · İSYAN sürüyor: hazineden saatte 4 D seferberlik' : ''}`));
  if (w.threat) box.append(h('div', { class: 'card warn' }, `${w.threat.name} ${w.threat.demand} D haraç istiyor (son gün ${w.threat.deadline}). Düşman gücü ~${w.threat.strength}, bizim ordu ~${Math.round(armyPower(w))}.`,
    h('div', { class: 'row' }, h('button', { onclick: () => c.act({ t: 'tribute', pay: true }) }, 'Haracı öde'), h('button', { class: 'danger', onclick: () => c.act({ t: 'tribute', pay: false }) }, 'Reddet, savaş'))));
  // granary
  const gq = num(50, 1, 500);
  box.append(h('h3', {}, `🌾 Tahıl Ambarı (${Math.round(w.granary)} buğday)`), h('div', { class: 'row' }, gq, h('button', { onclick: () => c.act({ t: 'granary', op: 'buy', qty: Number(gq.value) }) }, 'Ucuz buğday al'), h('button', { onclick: () => c.act({ t: 'granary', op: 'release', qty: Number(gq.value) }) }, 'Sabit fiyatla sat')),
    h('div', { class: 'muted' }, 'Ambar bollukta ucuza alır, kuraklıkta kendiliğinden satar.'));
  // price caps
  const g = select(GOODS.map((x): [string, string] => [x, `${GOOD_LABEL[x]} (şimdi ${w.prices[x]} D${w.priceCaps[x] ? `, narh ${w.priceCaps[x]}` : ''})`]), 'ekmek');
  const pv = num(BASE_PRICE.ekmek * 1.5, 0.1, 500, 0.1); g.addEventListener('change', () => { pv.value = String(Math.round(BASE_PRICE[g.value as Good] * 150) / 100); });
  box.append(h('h3', {}, '🏷 Narh (tavan fiyat)'), h('div', { class: 'row' }, g, pv, h('button', { onclick: () => c.act({ t: 'priceCap', good: g.value as Good, price: Number(pv.value) }) }, 'Narh koy'), h('button', { onclick: () => c.act({ t: 'priceCap', good: g.value as Good, price: null }) }, 'Kaldır')),
    h('div', { class: 'muted' }, 'Çok düşük narh üretimi kaçırır, karaborsa doğar.'));
  // directives & festival
  box.append(h('h3', {}, '📿 Din yönlendirmesi'), h('div', { class: 'row' }, ...([['namaz', 'Namaza teşvik'], ['icki', 'İçkiye karşı'], ['laik', 'Laik tutum']] as const).map(([t, l]) => h('button', { onclick: () => c.act({ t: 'directive', topic: t }) }, l))));
  const fc = num(300, 100, 5000);
  box.append(h('h3', {}, '🎉 Devlet festivali'), h('div', { class: 'row' }, fc, 'Dinar', h('button', { onclick: () => c.act({ t: 'festivalOpen', cost: Number(fc.value) }) }, 'Festival Alanı’nı aç (1 gün)')),
    h('div', { class: 'muted' }, 'Festival Alanı sadece devlet festivalinde açılır. Mutluluk ve memnuniyet artar; para hazineden çıkar.'));
  // law preview
  const lk = select([['tax', 'Vergi değişikliği'], ...w.laws.map((l): [string, string] => [l.id, l.name])]); const lv = num(w.taxRate, 0, 40); const out = h('div', { class: 'muted' });
  box.append(h('h3', {}, '🔮 Kanun etki tahmini'), h('div', { class: 'row' }, lk, lv, h('button', { onclick: () => { out.textContent = lawPreview(w, lk.value, Number(lv.value)); } }, 'Tahmin et')), out);
  // build at plot
  const plots = w.buildings.filter((b) => b.kind === 'arsa');
  if (plots.length) {
    const ps = select(plots.map((b): [string, string] => [b.id, `${b.name} (${b.x},${b.y})`])); const kind = select([['cesme', 'Çeşme (800)'], ['hamam', 'Hamam (1500)'], ['kutuphane', 'Kütüphane (1200)'], ['han', 'Kervansaray (2000)']]);
    box.append(h('h3', {}, '🏗 Arsaya inşaat'), h('div', { class: 'row' }, ps, kind, h('button', { onclick: () => c.act({ t: 'buildAt', plotId: ps.value, kind: kind.value }) }, 'Başlat')), h('div', { class: 'muted' }, 'İnşaatçılar arsaya yürür; ödenek bitince iş durur, boştaki inşaatçılar hamallık arar.'));
  }
  return box;
}

/** Info + actions for the new buildings. */
export function buildingExtras(c: Ctx, b: Building): HTMLElement | null {
  const w = c.w; const me = c.me;
  const act = (label: string, a: Parameters<Ctx['act']>[0], tip = ''): HTMLElement => h('button', { class: 'primary', title: tip, disabled: !me, onclick: () => c.act(a) }, label);
  switch (b.kind) {
    case 'cami': return h('div', {}, h('div', { class: 'muted' }, 'Namaz dindarlığı artırır. Cuma (her 7. günün 5’i) vaaz verilir.'), act('🕌 Namaz kıl', { t: 'pray' }),
      me && (me.prof === 'imam' || me.prof === 'hoca') ? h('div', { class: 'row' }, ...(['namaz', 'icki', 'sabir'] as const).map((t) => h('button', { onclick: () => c.act({ t: 'sermon', topic: t }) }, `Vaaz: ${t}`))) : '');
    case 'bar': return h('div', {}, h('div', { class: 'muted' }, w.bans.includes('icki') ? 'İçki Yasağı yürürlükte: meyhane kapalı.' : 'Barcı buğdaydan içki yapar. İçmek mutluluk verir, dindarlığı düşürür.'), act('🍺 Bir kadeh iç', { t: 'drink' }));
    case 'hekimhane': return h('div', {}, h('div', { class: 'muted' }, 'Sağlık 30’un altındaysa ya da yaralıysanız ancak hekim iyileştirir. Ücret hekimin rütbesine göre.'), act('🩺 Muayene ol', { t: 'doctor' }));
    case 'kuyu': return h('div', {}, h('div', { class: 'muted' }, 'Günde 5 su gerekir.'), act('💧 Su iç', { t: 'drinkWater' }));
    case 'festival': return h('div', {}, h('div', { class: 'muted' }, (w.festivalUntil ?? 0) >= w.day ? '🎉 Festival sürüyor! Halk burada eğleniyor.' : 'Festival Alanı sadece devlet festivali ilan edilince açılır (Saray).'));
    case 'ambar': return h('div', {}, h('div', { class: 'muted' }, `Tahıl ambarında ${Math.round(w.granary)} buğday var. Kuraklıkta sabit fiyatla satılır.`));
    case 'ciftlik': return h('div', {}, h('div', { class: 'muted' }, `Çiftçiler günde ~30 buğday biçer.${w.nature?.kind === 'kuraklik' ? ' Kuraklık: hasat yarıya düştü!' : ''}`));
    case 'dokuma': return h('div', {}, h('div', { class: 'muted' }, 'Dokumacılar yünden kumaş dokur; terziler kumaştan elbise diker.'));
    case 'mobilyahane': return h('div', {}, h('div', { class: 'muted' }, 'Mobilyacılar odundan mobilya yapar: evde dinlenme ve mutluluk verir.'));
    case 'arsa': { const ruler = !!me && w.kayzerId === me.id; const kind = select([['cesme', 'Çeşme (800)'], ['hamam', 'Hamam (1500)'], ['kutuphane', 'Kütüphane (1200)'], ['han', 'Kervansaray (2000)']]);
      return h('div', {}, h('div', { class: 'muted' }, ruler ? 'Boş arsa. Buraya ne yapılsın?' : 'Boş arsa. Yönetici burada inşaat başlatabilir.'), ruler ? h('div', { class: 'row' }, kind, h('button', { class: 'primary', onclick: () => c.act({ t: 'buildAt', plotId: b.id, kind: kind.value }) }, '🏗 Burada inşa et')) : ''); }
    case 'liman': return w.caravan && w.day <= w.caravan.until ? h('div', {}, h('div', { class: 'muted' }, `🐪 ${w.caravan.name} limanda: ${Object.keys(w.caravan.goods).map((g) => GOOD_LABEL[g as Good]).join(', ')}.`)) : null;
    default: return null;
  }
}

/** Court extras: lawyer / witness. */
export function caseRoles(c: Ctx, caseId: string, accusedId: string): HTMLElement | '' {
  if (!c.me || c.me.id === accusedId) return '';
  return h('div', { class: 'row' }, h('button', { title: 'Savunma: delili azaltır.', onclick: () => c.act({ t: 'defend', caseId }) }, '🧑‍⚖️ Avukat ol'),
    h('button', { onclick: () => c.act({ t: 'witness', caseId, against: true }) }, '👁 Aleyhte tanık'), h('button', { onclick: () => c.act({ t: 'witness', caseId, against: false }) }, '🤝 Lehte tanık'));
}

/** Meclis election phases block. */
export function electionBlock(c: Ctx): HTMLElement {
  const w = c.w; const ph = electionPhase(w); const n = w.election.nextDay; const d = electionDates(w);
  const step = (k: string, label: string, days: string): HTMLElement => h('div', { class: `phase ${ph.phase === k ? 'on' : ''}` }, h('b', {}, label), h('div', { class: 'muted' }, days));
  const box = h('div', { class: 'card' }, h('b', {}, '🗳 Seçim takvimi'), h('div', { class: 'row' }, step('aday', '1. Adaylık', `${Math.max(1, d.adayFrom)}–${d.adayTo}. gün`), step('propaganda', '2. Propaganda', `${d.propFrom}–${d.propTo}. gün`), step('oylama', '3. Oylama', `${n}. gün`)), h('div', { class: 'muted' }, ph.label));
  if (c.me && w.election.candidates.includes(c.me.id) && (ph.phase === 'propaganda' || ph.phase === 'aday')) {
    const sp = h('input', { placeholder: 'Seçim konuşması…', maxlength: '160', style: 'flex:1' });
    box.append(h('div', { class: 'row' }, h('button', { onclick: () => c.act({ t: 'poster' }) }, '📜 Afiş as (5 D)'), sp, h('button', { onclick: () => c.act({ t: 'campaign', text: sp.value }) }, '🎤 Konuş')));
  }
  const posters = w.election.posters ?? {};
  if (Object.keys(posters).length) box.append(h('div', { class: 'muted' }, 'Afişler: ' + Object.entries(posters).map(([id, k]) => `${findPerson(w, id)?.name ?? '?'} ×${k}`).join(', ')));
  return box;
}
