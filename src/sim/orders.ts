/**
 * v1.7 chat-to-action: a player DMs an NPC with a request/order → parsed into a whitelisted Order
 * (rule parser here, or the LLM's structured JSON on the server), accepted or refused by GAME RULES
 * (rank/authority, loyalty, fear, morality, relation, payment), then queued as the NPC's task:
 * the NPC walks there and does it, with the normal consequences (crime, witnesses, bekçi, trial).
 */
import type { Good, Person, World } from './types';
import { GOODS } from './types';
import { GOOD_LABEL, PROF_LABEL } from './constants';
import { findPerson } from './world';
import { log } from './log';
import { clamp } from './rng';
import { transfer, buy, produce, marketPrice } from './economy';
import { arrest, assault, murder, steal, rumor, isProtected, relate } from './life';
import { placeOf } from './place';
import { doorSpot, findPath, walkEnd, WALK_SPEED, PERSON_REACH, walkPos, type Pt } from './move';

export const ORDER_TYPES = ['go', 'follow', 'attack', 'kill', 'arrest', 'steal', 'give', 'sell', 'buy', 'work', 'vote', 'gossip', 'bribe', 'guard', 'leave'] as const;
export type OrderType = typeof ORDER_TYPES[number];
export interface Order { type: OrderType; targetId?: string | null; place?: string | null; item?: Good | null; amount?: number; text?: string }
export interface Task extends Order { byId: string; at: number; status: 'yolda' | 'bitti' | 'basarisiz' | 'donus'; label: string; until: number; note?: string; tries?: number; repath?: number; doneAt?: number; pay?: number }

export const STATE_FORCES = ['asker', 'bekci', 'memur', 'tahsildar', 'savci', 'hakim', 'naip'];
const HARM: Partial<Record<OrderType, number>> = { kill: 90, attack: 55, steal: 45, bribe: 30, gossip: 15, arrest: 15 };
const TASK_MS: Partial<Record<OrderType, number>> = { follow: 180_000, guard: 300_000 };

const low = (s: string): string => s.toLocaleLowerCase('tr');
const say = (w: World, from: Person, to: string | null, text: string, at: number): void => { w.chatOut.push({ fromPersonId: from.id, fromName: from.name, toPersonId: to, text: text.slice(0, 280), at }); if (w.chatOut.length > 60) w.chatOut.splice(0, w.chatOut.length - 60); };
const isRuler = (w: World, p: Person): boolean => !!w.kayzerId && p.id === w.kayzerId;
const rebel = (w: World, p: Person): boolean => !!w.isyan?.rebels.includes(p.id);
const hitab = (w: World, from: Person): string => isRuler(w, from) ? (w.regime === 'cumhuriyet' ? 'Başkanım' : 'İmparatorum') : from.soylu ? 'efendim' : from.name.split(' ').slice(-1)[0]!;

export function orderLabel(w: World, o: Order): string {
  const t = findPerson(w, o.targetId)?.name ?? ''; const pl = w.buildings.find((b) => b.id === o.place)?.name ?? ''; const it = o.item ? GOOD_LABEL[o.item] : '';
  const n = o.amount ?? 1;
  switch (o.type) {
    case 'go': return `${pl || t || 'bir yere'} gidiyor`; case 'follow': return `${t} kişisini takip ediyor`; case 'attack': return `${t} kişisine saldırmaya gidiyor`;
    case 'kill': return `${t} kişisini öldürmeye gidiyor`; case 'arrest': return `${t} kişisini tutuklamaya gidiyor`; case 'steal': return `${t} kişisinden çalmaya gidiyor`;
    case 'give': return `${t}'a ${n} ${it} götürüyor`; case 'sell': return `${t}'a ${n} ${it} satıyor`; case 'buy': return `Pazardan ${n} ${it} almaya gidiyor`;
    case 'work': return `${pl || 'işyerinde'} çalışmaya gidiyor`; case 'vote': return `${t}'a oy vermeye gidiyor`; case 'gossip': return `${t} hakkında dedikodu yaymaya gidiyor`;
    case 'bribe': return `${t}'a rüşvet götürüyor`; case 'guard': return `${t} kişisini koruyor`; case 'leave': return 'evine gidiyor';
  }
}

// ---------------- rule-based intent parser (fallback for the LLM) ----------------
const PROF_WORDS: [RegExp, string][] = [[/asker/, 'asker'], [/bekçi/, 'bekci'], [/fırıncı/, 'firinci'], [/sucu/, 'sucu'], [/kasap/, 'kasap'], [/balıkçı/, 'balikci'], [/terzi/, 'terzi'], [/demirci/, 'demirci'], [/marangoz/, 'marangoz'], [/tüccar/, 'tuccar'], [/hekim|doktor/, 'hekim'], [/hoca/, 'hoca'], [/hamal/, 'hamal'], [/inşaatçı/, 'insaatci'], [/imam/, 'imam'], [/memur/, 'memur'], [/tahsildar/, 'tahsildar'], [/savcı/, 'savci'], [/kadı|hakim|hâkim/, 'hakim'], [/çiftçi/, 'ciftci'], [/dokumacı/, 'dokumaci'], [/mobilyacı/, 'mobilyaci'], [/barcı|meyhaneci/, 'barci']];
const GOOD_WORDS: [RegExp, Good][] = [[/ekmek/, 'ekmek'], [/\bsu(yu|dan)?\b/, 'su'], [/\bet(i)?\b/, 'et'], [/balık/, 'balik'], [/kumaş/, 'kumas'], [/alet/, 'alet'], [/odun/, 'odun'], [/buğday/, 'bugday'], [/yün/, 'yun'], [/elbise/, 'elbise'], [/mobilya/, 'mobilya'], [/içki|şarap|rakı/, 'icki']];
const PLACE_WORDS: [RegExp, string][] = [[/pazar/, 'pazar'], [/saray/, 'saray'], [/cami/, 'cami'], [/meyhane|bar\b/, 'bar'], [/kışla/, 'kisla'], [/liman/, 'liman'], [/zindan/, 'zindan'], [/mahkeme/, 'mahkeme'], [/kuyu/, 'kuyu'], [/meydan/, 'pazar'], [/kahve/, 'kahve'], [/meclis/, 'meclis'], [/çiftlik|tarla/, 'ciftlik'], [/şantiye|inşaat/, 'santiye']];

export function parseOffer(text: string): number { const m = low(text).match(/(\d+)\s*(dinar|altın|akçe|para|lira)/); return m ? Math.min(5000, Number(m[1])) : 0; }

export function parseIntent(w: World, npc: Person, from: Person, text: string): Order | null {
  const t = low(text);
  const has = (r: RegExp): boolean => r.test(t);
  let type: OrderType | null = null;
  if (has(/öldür|gebert|katlet|canını al|işini bitir|temizle\b/)) type = 'kill';
  else if (has(/tutukla|yakala|zindana at|içeri at|tevkif|hapse at/)) type = 'arrest';
  else if (has(/döv|saldır|yarala|dayak at|pataka|\bvur\b|tokat/)) type = 'attack';
  else if (has(/\bçal\b|çalsana|çalıp|\bsoy\b|soysana|aşır|yürüt/)) type = 'steal';
  else if (has(/rüşvet/)) type = 'bribe';
  else if (has(/oy ver|oyunu ver|oy at|oyla|seç onu/)) type = 'vote';
  else if (has(/dedikodu|söylenti|yay(ıl)?\b|herkese söyle|kötüle|iftira/)) type = 'gossip';
  else if (has(/takip|peşimden|arkamdan gel|benimle gel|izle\b|peşine düş/)) type = 'follow';
  else if (has(/koru|nöbet tut|bekçilik et|muhafız/)) type = 'guard';
  else if (has(/satın al|\bal\b|alsana|alıp getir|al gel/) && GOOD_WORDS.some(([r]) => r.test(t))) type = 'buy';
  else if (has(/\bsat\b|satsana|satar mısın|satabilir/)) type = 'sell';
  else if (has(/\bver\b|versene|verir misin|getir|ver bana/) && GOOD_WORDS.some(([r]) => r.test(t))) type = 'give';
  else if (has(/çalış|işe git|işine dön|işbaşı/)) type = 'work';
  else if (has(/defol|uzaklaş|çekil|evine git|evine dön|bırak beni|git başımdan|kaybol/)) type = 'leave';
  else if (has(/\bgit\b|gitsene|\bgel\b|gelsene|yanıma gel|buraya gel|yürü/)) type = 'go';
  if (!type) return null;
  // target person: name mention, "beni/bana" (= sender), or a profession word ("başka askeri")
  let target: Person | undefined = w.people.find((p) => p.id !== npc.id && p.name.split(' ').some((x) => x.length > 2 && !PROF_LABEL[p.prof]?.startsWith(x) && t.includes(low(x))));
  if (!target) for (const [r, prof] of PROF_WORDS) if (r.test(t)) { const c = w.people.filter((p) => p.prof === prof && p.id !== npc.id && p.id !== from.id && p.jailedDays === 0); if (c.length) { const me = placeOf(w, npc.id, w.serverNow ?? w.lastTickAt); target = me ? c.sort((a, b) => dist(w, a, me) - dist(w, b, me))[0] : c[0]; break; } }
  if (!target && (has(/\bbeni\b|\bbana\b|yanıma|peşimden|arkamdan|benimle/))) target = from;
  const place = PLACE_WORDS.find(([r]) => r.test(t))?.[1] ?? null;
  const item = GOOD_WORDS.find(([r]) => r.test(t))?.[1] ?? null;
  const num = t.match(/(\d+)\s*(tane|adet|kilo|ekmek|su|et|balık|kumaş|alet|odun|buğday|yün|elbise|mobilya|içki)/); const amount = num ? Math.min(20, Number(num[1])) : 1;
  const o: Order = { type, targetId: target?.id ?? null, place, item, amount, text: type === 'gossip' ? text.slice(0, 160) : undefined };
  if (['give', 'sell'].includes(type) && !o.targetId) o.targetId = from.id;
  if (type === 'go' && !place && !o.targetId) o.targetId = from.id;
  return o;
}
function dist(w: World, a: Person, at: { x: number; y: number }): number { const q = placeOf(w, a.id, w.serverNow ?? w.lastTickAt); return q ? Math.hypot(q.x - at.x, q.y - at.y) : 99; }

/** Validate an order coming from the LLM (whitelist, ids/names resolved). */
export function sanitizeOrder(w: World, npc: Person, from: Person, raw: unknown): Order | null {
  if (!raw || typeof raw !== 'object') return null; const r = raw as Record<string, unknown>;
  const type = String(r.type ?? '') as OrderType; if (!ORDER_TYPES.includes(type)) return null;
  const tname = r.target == null ? '' : low(String(r.target));
  let target = tname ? w.people.find((p) => p.id === r.target || low(p.name) === tname) ?? w.people.find((p) => p.id !== npc.id && tname.length > 2 && low(p.name).includes(tname)) : undefined;
  if (!target && /^(ben|beni|bana|me|sender|oyuncu)$/.test(tname)) target = from;
  if (!target && tname) { const pw = PROF_WORDS.find(([re]) => re.test(tname)); if (pw) target = w.people.find((p) => p.prof === pw[1] && p.id !== npc.id && p.id !== from.id && p.jailedDays === 0); }
  const item = GOODS.includes(String(r.item) as Good) ? String(r.item) as Good : GOOD_WORDS.find(([re]) => re.test(low(String(r.item ?? ''))))?.[1] ?? null;
  const pr = low(String(r.place ?? '')); const place = w.buildings.find((b) => b.id === pr || low(b.name) === pr)?.id ?? PLACE_WORDS.find(([re]) => re.test(pr))?.[1] ?? null;
  return { type, targetId: target?.id ?? (['give', 'sell'].includes(type) || (type === 'go' && !place) ? from.id : null), place, item, amount: clamp(Math.round(Number(r.amount) || 1), 1, 20), text: type === 'gossip' ? String(r.text ?? '').slice(0, 160) || undefined : undefined };
}

// ---------------- acceptance by game rules ----------------
export interface Decision { ok: boolean; code: string; why: string }
export function decideOrder(w: World, npc: Person, from: Person, o: Order, offer = 0): Decision {
  const t = findPerson(w, o.targetId);
  const no = (code: string, why: string): Decision => ({ ok: false, code, why }); const yes = (why = ''): Decision => ({ ok: true, code: 'ok', why });
  if (npc.playerId && !npc.npc) return no('oyuncu', 'oyuncu');
  if (npc.jailedDays > 0) return no('zindan', 'zindandayım');
  if (npc.prof === 'naip' && HARM[o.type]) return no('naip', 'naip');
  const needsTarget = ['follow', 'attack', 'kill', 'arrest', 'steal', 'give', 'sell', 'vote', 'gossip', 'bribe', 'guard'].includes(o.type);
  if (needsTarget && !t) return no('kim', 'kimi kastettiğinizi anlamadım');
  if (t && t.id === npc.id && o.type !== 'go') return no('kendim', 'kendime bunu yapamam');
  if ((o.type === 'kill' || o.type === 'attack' || o.type === 'steal' || o.type === 'arrest') && t) {
    if (t.id === w.kayzerId) return no('kayzer', 'Kayzer’e el kaldırmak');
    if (isProtected(w, t)) return no('koruma', 'koruma');
    if (t.id === npc.spouse || t.parents?.includes(npc.id) || npc.parents?.includes(t.id)) return no('aile', 'aile');
  }
  if (o.type === 'arrest' && !['bekci', 'asker'].includes(npc.prof)) return no('yetki', 'yetki');
  if ((o.type === 'give' || o.type === 'sell') && (!o.item || npc.inv[o.item] < (o.amount ?? 1))) return no('yok', 'yok');
  if (o.type === 'buy' && !o.item) return no('kim', 'ne alacağımı anlamadım');
  const cost = o.item ? marketPrice(w, o.item) * (o.amount ?? 1) : 0;
  if (o.type === 'sell' && from.money < cost) return no('para', 'para');
  if (o.type === 'buy' && from.money < cost && npc.money < cost) return no('para', 'para');
  if (o.type === 'vote' && t && !w.election.candidates.includes(t.id) && !w.election.baskanCandidates.includes(t.id)) return no('aday', 'aday');
  if (o.type === 'bribe' && offer <= 0) return no('para', 'rüşvet için para');
  // 1) the state's chain of command: soldiers and officials always obey the ruler (unless in open rebellion)
  if (isRuler(w, from) && STATE_FORCES.includes(npc.prof) && npc.prof !== 'naip') return rebel(w, npc) ? no('isyan', 'isyan') : yes('emir');
  // 2) everyone else weighs it
  const harm = HARM[o.type] ?? 0;
  const relFrom = npc.relations[from.id] ?? 0; const relT = t ? npc.relations[t.id] ?? 0 : 0;
  const authority = isRuler(w, from) ? 30 * (npc.loyalty / 100) + 10 : from.soylu ? 10 : 0;
  const fear = (isRuler(w, from) ? 15 : 0) + (from.prof === 'asker' || from.prof === 'bekci' ? 10 : 0) + (from.rep < -30 ? 10 : 0);
  const moral = harm * (npc.honesty * 0.6 + npc.din * 0.4) / 100 + (harm >= 50 ? harm * 0.35 : 0);
  const greed = (100 - npc.honesty) / 100;
  const pay = offer > 0 ? Math.min(45, offer / Math.max(5, cost || harm / 2 || 5) * 12 * (0.6 + greed)) : 0;
  const hate = harm && t ? clamp(-relT * 0.35, -15, 35) : 0;
  const base = harm ? 20 : o.type === 'buy' || o.type === 'sell' ? 75 : 70; // reasonable requests are usually done
  const score = base + authority + fear + relFrom * 0.25 + pay + hate - moral;
  if (score >= 50) return yes();
  return no(harm ? 'ahlak' : relFrom < -30 ? 'kin' : 'istemem', 'ret');
}

// ---------------- in-character replies (fallback when the LLM is off) ----------------
export function orderReply(w: World, npc: Person, from: Person, o: Order, d: Decision): string {
  const a = hitab(w, from); const t = findPerson(w, o.targetId); const tn = t ? (t.id === from.id ? 'size' : t.name) : '';
  const it = o.item ? GOOD_LABEL[o.item] : '';
  if (d.ok) {
    const st = STATE_FORCES.includes(npc.prof) && isRuler(w, from);
    const lead = st ? `Emredersiniz ${a}!` : ['Peki ' + a + ',', 'Olur ' + a + ',', 'Tamam ' + a + ',', 'Baş üstüne ' + a + ','][npc.id.length % 4];
    const what: Record<OrderType, string> = {
      go: `hemen ${w.buildings.find((b) => b.id === o.place)?.name ?? (t?.id === from.id ? 'yanınıza' : `${tn} yanına`)} geliyorum.`, follow: `${t?.id === from.id ? 'peşinizden' : tn + ' peşinden'} ayrılmam.`,
      attack: `${tn}'a gereken dersi vereceğim.`, kill: `${tn}… iş bu gün bitecek. Kimse bilmeyecek.`, arrest: `${tn} şimdi zindanı boylar.`,
      steal: `${tn}'ın kesesi hafifleyecek, kimseye çaktırmam.`, give: `${o.amount} ${it} getiriyorum.`, sell: `${o.amount} ${it}, ${Math.round(marketPrice(w, o.item!) * (o.amount ?? 1))} Dinar. Geliyorum.`,
      buy: `pazardan ${o.amount} ${it} alıp getiririm.`, work: `işbaşı yapıyorum.`, vote: `oyum ${tn}'a.`, gossip: `${tn} hakkında söyleneceği herkes duyacak.`,
      bribe: `parayı ${tn}'a sessizce ulaştırırım.`, guard: `${t?.id === from.id ? 'sizi' : tn + "'ı"} canım pahasına korurum.`, leave: `gidiyorum, rahatsız etmem.`,
    };
    return `${lead} ${what[o.type]}`;
  }
  switch (d.code) {
    case 'kim': return `Kusura bakmayın ${a}, ${d.why}. Kimi ya da neyi kastediyorsunuz?`;
    case 'kayzer': return `Tövbe ${a}! İmparator’a el kaldırmak mı? Bunu duymamış olayım.`;
    case 'koruma': return `${tn} şehre yeni geldi, ${a}; ona dokunmak olmaz.`;
    case 'aile': return `O benim kanım, ${a}. Asla!`;
    case 'yetki': return `Benim tutuklama yetkim yok ${a}; bekçiye ya da askere söyleyin.`;
    case 'yok': return `Elimde o kadar ${it || 'mal'} yok ${a}.`;
    case 'para': return o.type === 'bribe' ? `Rüşvet havadan olmaz ${a}; ne kadar vereceksiniz?` : `Paranız yetmiyor ${a}; bu ${Math.round(o.item ? marketPrice(w, o.item) * (o.amount ?? 1) : 0)} Dinar eder.`;
    case 'aday': return `${tn} aday değil ki ${a}; ona oy verilmez.`;
    case 'zindan': return `Zindandayım ${a}, elim kolum bağlı.`;
    case 'isyan': return `Artık senin askerin değilim! Halkın yanındayım.`;
    case 'naip': return `Naip olarak böyle işlere bulaşamam ${a}.`;
    case 'kendim': return `Kendime mi ${a}? Olmaz.`;
    case 'ahlak': return npc.din > 60 ? `Bu günahı işleyemem ${a}; Allah’tan korkarım.` : `Ben katil/hırsız değilim ${a}. Başkasını bulun.`;
    case 'kin': return `Sana iyilik yapacak son kişi benim.`;
    default: return `Şu an olmaz ${a}, işim başımdan aşkın.`;
  }
}

/** An unjust order of violence: against someone with no open case and a decent name. */
export function cruel(w: World, o: Order): boolean {
  if (!['kill', 'attack', 'steal'].includes(o.type) && !(o.type === 'arrest')) return false;
  const t = findPerson(w, o.targetId); if (!t) return false;
  const guilty = w.cases.some((c) => c.accusedId === t.id && c.stage !== 'kapandi') || t.rep < -20 || !!w.isyan?.rebels.includes(t.id);
  return !guilty && (o.type !== 'arrest' || t.rep > 10);
}
/** After a state-ordered act of violence: witnesses talk. */
function stateCrimeSeen(w: World, npc: Person, tk: Task, victimName: string, witnesses: number): void {
  const by = findPerson(w, tk.byId); if (!by || by.id !== w.kayzerId || !cruel(w, tk) && !w.people.every((p) => p.id !== tk.targetId)) return;
  if (witnesses <= 0) return;
  rumor(w, `${witnesses} kişi gördü: ${npc.name}, ${victimName}'a Saray'ın emriyle saldırdı!`, by.id, -10);
  for (const p of w.people) if (p.prof !== 'naip' && p.id !== by.id) { p.loyalty = clamp(p.loyalty - 3); p.republic = clamp(p.republic + 2.5); }
  log(w, `👀 Tanıklar konuşuyor: ${victimName} olayının arkasında Saray varmış.`, by.id);
}

// ---------------- tasks ----------------
function targetPt(w: World, o: Order, now: number, npc: Person): Pt | null {
  if (o.type === 'leave') { const b = w.buildings.find((x) => x.id === npc.home); return b ? doorSpot(b) : null; }
  if (o.type === 'buy') { const b = w.buildings.find((x) => x.id === (o.place ?? 'pazar')) ?? w.buildings.find((x) => x.id === 'pazar'); return b ? doorSpot(b) : null; }
  if (o.type === 'work') { const b = w.buildings.find((x) => x.id === (o.place ?? npc.work)); return b ? doorSpot(b) : null; }
  if (o.type === 'vote' || o.type === 'gossip') { const b = w.buildings.find((x) => x.id === 'pazar'); return b ? doorSpot(b) : null; }
  if (o.targetId) { const q = placeOf(w, o.targetId, now); if (q) return { x: q.x + 0.8, y: q.y }; }
  if (o.place) { const b = w.buildings.find((x) => x.id === o.place); if (b) return doorSpot(b); }
  return null;
}
function walkFrom(w: World, npc: Person, to: Pt, now: number): void {
  const cur = npc.walk && npc.task ? walkPos(npc.walk, now).pt : (() => { const q = placeOf(w, npc.id, now); return q ? { x: q.x, y: q.y } : to; })();
  npc.walk = { path: findPath(w, cur, to), t0: now, speed: WALK_SPEED * 0.8 };
}
export function assignTask(w: World, npc: Person, from: Person, o: Order, now: number, offer = 0): void {
  if (offer > 0 && transfer(w, from.id, npc.id, offer, o.type === 'bribe' ? 'rüşvet emaneti' : 'iş ücreti')) relate(npc, from, 3, 'bana para verdi');
  const to = targetPt(w, o, now, npc);
  npc.task = { ...o, byId: from.id, at: now, status: 'yolda', label: orderLabel(w, o), until: now + (TASK_MS[o.type] ?? 240_000), tries: 0, pay: offer };
  if (to) walkFrom(w, npc, to, now);
}

/** One order message: parse → decide → queue. Returns the in-character reply + the decision. */
export function handleOrder(w: World, from: Person, npc: Person, o: Order, text: string, now: number): { reply: string; d: Decision; o: Order } {
  const offer = parseOffer(text);
  // soldiers never refuse the ruler – but a demoralised one deserts (or joins the rebels) instead of obeying a cruel order
  if (isRuler(w, from) && STATE_FORCES.includes(npc.prof) && npc.prof !== 'naip' && cruel(w, o) && npc.loyalty < 20 && !rebel(w, npc)) {
    const joins = !!w.isyan || w.cumhuriyet > 45;
    npc.prof = 'hamal'; npc.work = 'liman'; npc.loyalty = clamp(npc.loyalty - 20); npc.republic = clamp(npc.republic + 25); if (joins) { npc.plotting = 'revolution'; if (w.isyan && !w.isyan.rebels.includes(npc.id)) w.isyan.rebels.push(npc.id); }
    log(w, `🏃 ${npc.name} zalim emre dayanamadı ve ${joins ? 'kışladan kaçıp cumhuriyetçilere katıldı' : 'ordudan firar etti'}!`, npc.id, now);
    rumor(w, `${npc.name}: “Kayzer bize masumları öldürtüyor!” deyip kaçtı.`, from.id, -12);
    return { reply: joins ? 'Artık yeter! Masum kanı dökmeyeceğim. Halkın yanındayım!' : 'Bu kadarı fazla… Kılıcımı bırakıyorum. Beni bir daha kışlada göremezsiniz.', d: { ok: false, code: 'firar', why: 'firar' }, o };
  }
  const d = decideOrder(w, npc, from, o, offer);
  if (d.ok) assignTask(w, npc, from, o, now, o.type === 'sell' || o.type === 'buy' ? 0 : offer);
  if (d.ok && isRuler(w, from) && cruel(w, o)) { // obeying hurts morale
    npc.loyalty = clamp(npc.loyalty - 14); npc.mood = clamp(npc.mood - 8); w.cruelOrders = (w.cruelOrders ?? 0) + 1;
    for (const s of w.people) if (s.prof === 'asker' && s.id !== npc.id) s.loyalty = clamp(s.loyalty - 3);
  }
  else if (HARM[o.type] && HARM[o.type]! >= 50) relate(npc, from, -6, 'bana kötü bir iş teklif etti');
  return { reply: orderReply(w, npc, from, o, d), d, o };
}

function finish(w: World, npc: Person, ok: boolean, note: string, now: number): void {
  const tk = npc.task!; tk.status = ok ? 'bitti' : 'basarisiz'; tk.note = note; tk.doneAt = now;
  const by = findPerson(w, tk.byId);
  if (by && by.id !== npc.id) say(w, npc, by.id, `${ok ? '✅' : '❌'} ${note}`, now + 500);
}

function execute(w: World, npc: Person, now: number): void {
  const tk = npc.task!; const t = findPerson(w, tk.targetId); const by = findPerson(w, tk.byId);
  const n = tk.amount ?? 1; const it = tk.item ? GOOD_LABEL[tk.item] : '';
  w.serverNow = now;
  switch (tk.type) {
    case 'go': return finish(w, npc, true, 'Geldim.', now);
    case 'leave': return finish(w, npc, true, 'Evime geldim.', now);
    case 'kill': { if (!t) return finish(w, npc, false, 'Hedef ortada yok.', now); npc.orderedBy = tk.byId ? { by: tk.byId, crime: 'cinayet', victimId: t.id, day: w.day } : undefined; const wasCruel = cruel(w, tk); const r = murder(w, npc, t); npc.lastAction = 'emirle cinayet'; const co = (w.corpses ?? []).find((c) => c.personId === t.id); if (wasCruel) stateCrimeSeen(w, npc, tk, t.name, co?.witnesses.length ?? 1); return finish(w, npc, !w.people.includes(t), r, now); }
    case 'attack': { if (!t) return finish(w, npc, false, 'Hedef ortada yok.', now); npc.orderedBy = { by: tk.byId, crime: 'saldiri', victimId: t.id, day: w.day }; const wc = cruel(w, tk); const res = assault(w, npc, t); if (wc) stateCrimeSeen(w, npc, tk, t.name, 1 + (t.id.length % 3)); return finish(w, npc, true, res, now); }
    case 'steal': { if (!t) return finish(w, npc, false, 'Hedef ortada yok.', now); npc.orderedBy = { by: tk.byId, crime: 'hirsizlik', victimId: t.id, day: w.day }; const a = steal(w, npc, t); if (a > 0 && by && by.id !== npc.id) transfer(w, npc.id, by.id, Math.floor(a / 2), 'çalıntı payı'); return finish(w, npc, a > 0, a > 0 ? `${t.name}'dan ${a} Dinar çaldım; yarısı sizin.` : `${t.name}'ın kesesi boştu.`, now); }
    case 'arrest': { if (!t) return finish(w, npc, false, 'Hedef ortada yok.', now); const open = w.cases.find((c) => c.accusedId === t.id && c.stage !== 'kapandi'); const r = arrest(w, t, open?.crime ?? 'isyan', null, 0, npc); return finish(w, npc, !!r, r ? `${t.name} tutuklandı.` : 'Tutuklayamadım.', now); }
    case 'give': { if (!t || !tk.item || npc.inv[tk.item] < n) return finish(w, npc, false, `Elimde ${it} kalmadı.`, now); npc.inv[tk.item] -= n; t.inv[tk.item] += n; relate(t, npc, 4, 'bana hediye getirdi'); return finish(w, npc, true, `${t.name}'a ${n} ${it} verdim.`, now); }
    case 'sell': { if (!t || !tk.item || npc.inv[tk.item] < n) return finish(w, npc, false, `${it} kalmadı.`, now); const price = Math.round(marketPrice(w, tk.item) * n * 100) / 100; if (!transfer(w, t.id, npc.id, price, `${it} satışı`)) return finish(w, npc, false, 'Paranız yetmedi.', now); npc.inv[tk.item] -= n; t.inv[tk.item] += n; npc.incomeToday += price; return finish(w, npc, true, `${n} ${it} teslim; ${price} Dinar aldım.`, now); }
    case 'buy': { if (!tk.item) return finish(w, npc, false, 'Ne alacağımı bilmiyorum.', now); const price = marketPrice(w, tk.item) * n * 1.2; if (by && by.id !== npc.id) transfer(w, by.id, npc.id, Math.min(by.money, price), 'alışveriş parası'); const got = buy(w, npc.id, tk.item, n); if (got > 0 && by && by.id !== npc.id) { npc.inv[tk.item] -= got; by.inv[tk.item] += got; } return finish(w, npc, got > 0, got > 0 ? `${got} ${it} aldım, size teslim ettim.` : `Pazarda ${it} bulamadım.`, now); }
    case 'work': { produce(w, npc); npc.lastAction = 'emirle çalıştı'; return finish(w, npc, true, 'Çalıştım, mal pazarda.', now); }
    case 'vote': { if (!t) return finish(w, npc, false, 'Aday yok.', now); const e = w.election; if (e.baskanCandidates.includes(t.id)) e.baskanVotes[npc.id] = t.id; else if (e.candidates.includes(t.id)) e.votes[npc.id] = t.id; else return finish(w, npc, false, `${t.name} aday değil.`, now); return finish(w, npc, true, `Oyumu ${t.name}'a verdim.`, now); }
    case 'gossip': { if (!t) return finish(w, npc, false, 'Kimin hakkında?', now); const line = tk.text && tk.text.length > 8 ? tk.text : `${t.name} hakkında kötü şeyler duydum…`; rumor(w, `${npc.name}: ${line}`, t.id, -8); w.chatOut.push({ fromPersonId: npc.id, fromName: npc.name, toPersonId: null, text: `🗣 ${t.name} diyorlar ki… ${line.replace(/^.*?(dedikodu|yay)\w*\s*/i, '')}`.slice(0, 200), at: now }); return finish(w, npc, true, 'Dedikoduyu Meydan’da yaydım.', now); }
    case 'bribe': { if (!t) return finish(w, npc, false, 'Kime?', now); const amt = Math.min(npc.money, tk.pay ?? 0); if (amt <= 0 || !transfer(w, npc.id, t.id, amt, 'rüşvet')) return finish(w, npc, false, 'Para yok.', now); if (by) relate(t, by, 15, 'bana rüşvet gönderdi'); if (t.honesty > 75) { rumor(w, `${t.name} gönderilen rüşveti geri çevirdi ve herkese anlattı!`, by?.id ?? t.id, -10); } return finish(w, npc, true, `${amt} Dinar'ı ${t.name}'a ulaştırdım.`, now); }
    case 'follow': case 'guard': return;
  }
}

/** Real-time progress of NPC tasks (called from realtime()). */
export function runTasks(w: World, now: number): void {
  for (const npc of w.people) {
    const tk = npc.task; if (!tk) continue;
    if (npc.jailedDays > 0 && tk.status === 'yolda') { finish(w, npc, false, 'Yakalandım, görevi yapamadım.', now); }
    if (tk.status !== 'yolda') { if (now - (tk.doneAt ?? now) > 30_000) { delete npc.task; delete npc.walk; } continue; }
    if (now > tk.until) { if (tk.type === 'follow' || tk.type === 'guard') finish(w, npc, true, tk.type === 'follow' ? 'Takibi bitirdim.' : 'Nöbetim bitti.', now); else finish(w, npc, false, 'Vaktinde yapamadım.', now); continue; }
    if (!npc.walk) { const to = targetPt(w, tk, now, npc); if (to) walkFrom(w, npc, to, now); else { finish(w, npc, false, 'Yeri bulamadım.', now); continue; } }
    const moving = tk.type === 'follow' || tk.type === 'guard' || !!(tk.targetId && ['attack', 'kill', 'steal', 'arrest', 'give', 'sell', 'bribe', 'go'].includes(tk.type));
    const end = walkEnd(npc.walk!);
    if (moving && tk.targetId) {
      const tq = placeOf(w, tk.targetId, now); const me = walkPos(npc.walk!, now).pt;
      if (!tq) { finish(w, npc, false, 'Hedefi kaybettim.', now); continue; }
      const d = Math.hypot(tq.x - me.x, tq.y - me.y);
      if ((tk.type === 'follow' || tk.type === 'guard')) { if (now - (tk.repath ?? 0) > 6000 && d > 1.6) { tk.repath = now; walkFrom(w, npc, { x: tq.x + 0.9, y: tq.y }, now); } continue; }
      if (now >= end) {
        if (d <= PERSON_REACH) execute(w, npc, now);
        else if ((tk.tries ?? 0) < 6) { tk.tries = (tk.tries ?? 0) + 1; walkFrom(w, npc, { x: tq.x + 0.8, y: tq.y }, now); }
        else finish(w, npc, false, 'Hedefe yetişemedim.', now);
      } else if (now - (tk.repath ?? tk.at) > 8000) { tk.repath = now; const last = npc.walk!.path[npc.walk!.path.length - 1]!; if (Math.hypot(last.x - tq.x, last.y - tq.y) > 2.5) walkFrom(w, npc, { x: tq.x + 0.8, y: tq.y }, now); }
      continue;
    }
    if (now >= end) execute(w, npc, now);
  }
}

/** The ordered crime comes out when the hired hand is caught: rumours, the ruler's legitimacy suffers. */
export function revealOrder(w: World, criminal: Person): void {
  const o = criminal.orderedBy; if (!o) return;
  delete criminal.orderedBy;
  const by = findPerson(w, o.by); if (!by || by.id === criminal.id) return;
  const victim = findPerson(w, o.victimId)?.name ?? w.corpses?.find((c) => c.personId === o.victimId)?.name ?? 'birini';
  if (by.id === w.kayzerId) {
    const heavy = o.crime === 'cinayet' ? 1 : 0.4;
    rumor(w, `${criminal.name} itiraf etti: “${victim}'ı bana ${w.regime === 'cumhuriyet' ? 'Başkan' : 'İmparator'} ${by.name} emretti!”`, by.id, -25 * heavy);
    for (const p of w.people) if (p.id !== by.id && p.prof !== 'naip') { p.loyalty = clamp(p.loyalty - 10 * heavy); p.republic = clamp(p.republic + 8 * heavy); p.mood = clamp(p.mood - 3 * heavy); }
    log(w, `📢 SKANDAL: ${criminal.name}, ${victim} olayını ${by.name}'ın emriyle yaptığını söyledi! Halkın sadakati sarsıldı, cumhuriyetçiler güçleniyor.`, by.id);
  } else {
    rumor(w, `${criminal.name}: “${victim} işini bana ${by.name} yaptırdı!”`, by.id, -15);
    log(w, `🗣 ${criminal.name}, ${victim} olayının azmettiricisi olarak ${by.name}'ı gösterdi.`, by.id);
    if (o.crime === 'cinayet' || o.crime === 'saldiri') { by.jailedDays = Math.max(by.jailedDays, 0); w.cases.push({ id: `C${w.cases.length + 1}-${by.id}`, accusedId: by.id, crime: o.crime, victimId: o.victimId, amount: 0, evidence: 55, stage: 'savci', day: w.day, deadline: w.day + 1 }); }
  }
}
