import type { Building, BuildingKind, Good, Law, Person, Profession, World } from './types';
import { GOODS } from './types';
import { BASE_PRICE, DEFAULT_SALARY, MAP_H, MAP_W } from './constants';
import { pick, rand, randInt } from './rng';
import { DEFAULT_BUDGET, initMeclis, meclisElection } from './meclis';

function b(id: string, name: string, kind: BuildingKind, x: number, y: number, w: number, h: number, market = false): Building {
  return { id, name, kind, x, y, w, h, door: { x: x + Math.floor(w / 2), y: y + h }, market };
}

export const ROADS_Y = [13, 20, 29, 35, 44];
export const ROADS_X = [6, 17, 29, 44, 56, 68, 80, 92];

export function makeBuildings(): Building[] {
  const list: Building[] = [
    b('saray', 'Saray', 'saray', 30, 2, 12, 9),
    b('meclis', 'Meclis', 'meclis', 46, 5, 8, 6),
    b('mahkeme', 'Mahkeme', 'mahkeme', 19, 5, 8, 6),
    b('zindan', 'Zindan', 'zindan', 19, 15, 5, 4),
    b('kisla', 'Kışla', 'kisla', 57, 3, 10, 8),
    b('cami', 'Cami', 'cami', 7, 3, 8, 8),
    b('okul', 'Okul', 'okul', 8, 15, 7, 4),
    b('hekimhane', 'Hekimhane', 'hekimhane', 46, 15, 7, 4),
    b('kahve', 'Memurlar Kahvesi', 'kahve', 34, 15, 6, 4, true),
    b('pazar', 'Pazar', 'pazar', 30, 22, 12, 6, true),
    b('gida', 'Gıda Pazarı', 'pazar', 19, 22, 8, 5, true),
    b('zanaat', 'Zanaat Çarşısı', 'pazar', 46, 22, 8, 5, true),
    b('yeni', 'Yeni Pazar', 'pazar', 58, 22, 8, 5, true),
    b('firin', 'Fırın', 'firin', 8, 23, 6, 4),
    b('kasaphane', 'Kasap', 'kasap', 8, 30, 6, 4),
    b('degirmen', 'Değirmen', 'degirmen', 1, 36, 4, 6),
    b('kuyu', 'Su Kuyusu', 'kuyu', 25, 30, 3, 3),
    b('atolye', 'Zanaat Atölyesi', 'atolye', 58, 30, 8, 4),
    b('santiye', 'Şantiye', 'santiye', 46, 30, 8, 4),
    b('liman', 'Liman / Balıkhane', 'liman', 30, 45, 12, 3),
    b('bar', 'Meyhane (Bar)', 'bar', 58, 15, 7, 4, true),
    b('festival', 'Festival Alanı', 'festival', 70, 3, 9, 8),
    b('ciftlik', 'Buğday Tarlaları', 'ciftlik', 82, 36, 14, 10),
    b('dokuma', 'Dokuma Tezgâhı', 'dokuma', 70, 30, 8, 4),
    b('mobilyahane', 'Mobilyahane', 'mobilyahane', 82, 22, 8, 5),
    b('ambar', 'Tahıl Ambarı', 'ambar', 70, 22, 8, 5),
    b('arsa1', 'Arsa (boş)', 'arsa', 82, 3, 8, 6),
    b('arsa2', 'Arsa (boş)', 'arsa', 93, 3, 6, 6),
    b('arsa3', 'Arsa (boş)', 'arsa', 93, 22, 6, 5),
    b('arsa4', 'Arsa (boş)', 'arsa', 46, 37, 8, 5),
  ];
  // houses on a grid wherever free
  const occupied = (x: number, y: number, w: number, h: number): boolean =>
    list.some((o) => x < o.x + o.w + 1 && x + w + 1 > o.x && y < o.y + o.h + 2 && y + h + 2 > o.y) ||
    ROADS_Y.some((ry) => ry >= y && ry < y + h + 1) || ROADS_X.some((rx) => rx >= x && rx < x + w);
  let n = 0;
  for (let y = 30; y <= 46; y += 5) {
    for (let x = 1; x <= MAP_W - 5; x += 4) {
      if (!occupied(x, y, 3, 3) && x + 3 < MAP_W && y + 3 < MAP_H - 6 && n < 70) {
        n += 1; list.push(b(`ev${n}`, `Ev ${n}`, 'ev', x, y, 3, 3));
      }
    }
  }
  for (let y = 14; y <= 26; y += 5) {
    for (let x = 1; x <= MAP_W - 5; x += 4) {
      if (!occupied(x, y, 3, 3) && n < 90) { n += 1; list.push(b(`ev${n}`, `Ev ${n}`, 'ev', x, y, 3, 3)); }
    }
  }
  return list;
}

const ERKEK = ['Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Hasan', 'Hüseyin', 'İbrahim', 'Osman', 'Yusuf', 'Murat', 'Kemal', 'Ömer', 'Halil', 'Recep', 'Ramazan', 'Selim', 'Kadir', 'Orhan', 'Rıza', 'Fikret', 'Sinan', 'Levent', 'Yavuz', 'Cengiz', 'Tuncay', 'Serkan', 'Gökhan', 'Volkan', 'Kerem', 'Bülent', 'Ferhat', 'Erdem', 'Doğan', 'Haydar', 'İsmail', 'Faruk', 'Nuri', 'Şükrü', 'Cevdet', 'Adem'];
const KADIN = ['Fatma', 'Ayşe', 'Emine', 'Hatice', 'Zeynep', 'Elif', 'Meryem', 'Şerife', 'Hanife', 'Sultan', 'Hacer', 'Gülsüm', 'Esra', 'Merve', 'Derya', 'Sevgi', 'Leyla', 'Nermin', 'Songül', 'Filiz', 'Gül', 'Dilek', 'Nazlı', 'Pınar', 'Aslı', 'Melek', 'Saadet', 'Feride', 'Kevser', 'Nesrin'];

interface Seed { name: string; prof: Profession; female?: boolean; honesty?: number; ambition?: number; money?: number; loyalty?: number }
const NAMED: Seed[] = [
  { name: 'Maecenas', prof: 'naip', honesty: 95, ambition: 10, money: 200, loyalty: 100 },
  { name: 'Tüccar Cemal', prof: 'tuccar', honesty: 15, ambition: 90, money: 900, loyalty: 35 },
  { name: 'Usta Bekir', prof: 'insaatci', honesty: 70, ambition: 40, money: 180 },
  { name: 'Öğretmen Nur', prof: 'hoca', female: true, honesty: 85, ambition: 45, money: 120 },
  { name: 'Hamal Can', prof: 'hamal', honesty: 60, ambition: 30, money: 30 },
  { name: 'Hamal Burak', prof: 'hamal', honesty: 50, ambition: 55, money: 25 },
  { name: 'Fırıncı Ayşe', prof: 'firinci', female: true, honesty: 80, money: 140 },
  { name: 'Fırıncı Zehra', prof: 'firinci', female: true, honesty: 75, money: 130 },
  { name: 'Bekçi Emre', prof: 'bekci', honesty: 70, money: 90 },
  { name: 'Savcı Tarık', prof: 'savci', honesty: 65, ambition: 60, money: 220 },
  { name: 'Hâkim Süleyman', prof: 'hakim', honesty: 80, money: 300 },
  { name: 'Kalemşör Necati', prof: 'kalemsor', female: false, honesty: 40, ambition: 75, money: 110, loyalty: 30 },
  { name: 'Hoca Abdullah', prof: 'imam', honesty: 85, money: 100, loyalty: 70 },
  { name: 'Tahsildar Rıfat', prof: 'tahsildar', honesty: 35, ambition: 60, money: 200 },
  { name: 'Hekim Lokman', prof: 'hekim', honesty: 85, money: 260 },
  { name: 'Kasap Hayri', prof: 'kasap', money: 160 },
  { name: 'Balıkçı Rüstem', prof: 'balikci', money: 90 },
  { name: 'Sucu Dursun', prof: 'sucu', money: 80 },
  { name: 'Terzi Nimet', prof: 'terzi', female: true, money: 120 },
  { name: 'Demirci Kazım', prof: 'demirci', money: 150 },
  { name: 'Marangoz Şevket', prof: 'marangoz', money: 120 },
  { name: 'Memur Nazmi', prof: 'memur', money: 140 },
];

const COUNTS: [Profession, number][] = [
  ['ciftci', 10], ['firinci', 7], ['sucu', 8], ['kasap', 4], ['balikci', 6], ['dokumaci', 3], ['terzi', 3], ['demirci', 3], ['marangoz', 4], ['mobilyaci', 2], ['barci', 2],
  ['tuccar', 3], ['hekim', 3], ['hoca', 3], ['imam', 1], ['hamal', 9], ['insaatci', 8], ['kalemsor', 2],
  ['memur', 6], ['tahsildar', 3], ['bekci', 6], ['savci', 2], ['hakim', 2], ['asker', 10],
];

export const WORKPLACE: Record<Profession, string> = {
  firinci: 'firin', sucu: 'kuyu', kasap: 'kasaphane', balikci: 'liman', terzi: 'atolye', demirci: 'atolye', marangoz: 'atolye',
  tuccar: 'pazar', hekim: 'hekimhane', hoca: 'okul', hamal: 'pazar', insaatci: 'santiye', kalemsor: 'kahve', imam: 'cami',
  ciftci: 'ciftlik', dokumaci: 'dokuma', mobilyaci: 'mobilyahane', barci: 'bar',
  memur: 'saray', tahsildar: 'kahve', bekci: 'zindan', savci: 'mahkeme', hakim: 'mahkeme', asker: 'kisla', kayzer: 'saray', naip: 'saray',
};
const TITLE: Partial<Record<Profession, string>> = { ciftci: 'Çiftçi', barci: 'Barcı', asker: 'Asker', bekci: 'Bekçi', hoca: 'Öğretmen', hekim: 'Hekim', savci: 'Savcı', hakim: 'Kadı', tuccar: 'Tüccar', hamal: 'Hamal', firinci: 'Fırıncı', kalemsor: 'Kalemşör' };

export function emptyInv(): Record<Good, number> {
  const r = {} as Record<Good, number>; for (const g of GOODS) r[g] = 0; return r;
}

/** Gender from the first given name (titles skipped); undefined if unknown. */
export function genderOfName(name: string): boolean | undefined {
  for (const part of name.replace(/[().]/g, ' ').split(/\s+/)) { if (KADIN.includes(part) || ['Hanım', 'Sultan', 'Ayşe', 'Zehra', 'Nur', 'Nimet', 'Defne', 'Ece', 'Asya', 'Nehir', 'Lale', 'Su', 'Ada', 'Selin', 'Duru', 'İpek'].includes(part)) return true; if (ERKEK.includes(part) || ['Cemal', 'Bekir', 'Can', 'Burak', 'Emre', 'Tarık', 'Süleyman', 'Necati', 'Abdullah', 'Rıfat', 'Lokman', 'Hayri', 'Rüstem', 'Dursun', 'Kazım', 'Şevket', 'Nazmi', 'Ağa', 'Efendi', 'Kerem', 'Emir', 'Yiğit', 'Alp', 'Aras', 'Batu', 'Efe', 'Mert', 'Kaan', 'Tuna', 'Oğuz', 'Şehzade'].includes(part)) return false; }
  return undefined;
}

export function makePerson(w: World, s: Seed, home: string): Person {
  const female = s.female ?? genderOfName(s.name) ?? (s.prof === 'asker' ? false : rand(w) < 0.4);
  return {
    id: `p${++w.idSeq}`, name: s.name, prof: s.prof, meclis: false, playerId: null, npc: true, home, work: WORKPLACE[s.prof],
    money: s.money ?? randInt(w, 40, 160), inv: { ...emptyInv(), ekmek: 2, su: 2 },
    hunger: randInt(w, 0, 20), thirst: randInt(w, 0, 20), mood: randInt(w, 55, 75), loyalty: s.loyalty ?? randInt(w, 50, 80),
    ambition: s.ambition ?? randInt(w, 10, 70), honesty: s.honesty ?? randInt(w, 30, 95), republic: randInt(w, 0, 15), health: 100,
    spouse: null, jailedDays: 0, incomeToday: 0, unemployedDays: 0, thought: '', lastAction: 'evde', relations: {},
    hairColor: randInt(w, 0, 7), skin: randInt(w, 0, 3), shirt: randInt(w, 0, 7), female, plotting: 'none', sidedWith: null, faction: null, immune: false,
    born: (w.day ?? 1) - randInt(w, 70, 300), parents: [], soylu: false, school: 0, exiledDays: 0,
    din: s.prof === 'imam' || s.prof === 'hoca' ? randInt(w, 70, 95) : randInt(w, 15, 85), meals: 0, drinks: 0, wounded: false, protectedUntil: 0,
    xp: randInt(w, 0, 80), rep: 0, relNote: {}, titles: [], taxDue: 0, smuggle: false, nightOut: false,
  };
}

export function defaultLaws(): Law[] {
  return [
    { id: 'rusvet', name: 'Rüşvet Yasağı', desc: 'Rüşvet veren ve alan yargılanır.', active: true },
    { id: 'zimmet', name: 'Zimmet Yasağı', desc: 'Devlet parasını zimmetine geçiren memur yargılanır.', active: true },
    { id: 'devletsuyu', name: 'Devlet Suyu', desc: 'Suyun fiyatı devletçe sabitlenir; fark hazineden sucuya ödenir.', active: true, param: 2, paramLabel: 'Sabit fiyat (Dinar)' },
    { id: 'devletekmegi', name: 'Devlet Ekmeği', desc: 'Hazine her gün en aç vatandaşlara ekmek dağıtır.', active: true, param: 12, paramLabel: 'Günlük ekmek' },
    { id: 'askida', name: 'Askıda Ekmek', desc: 'Varlıklı vatandaşlar fırına ekmek asar; aç olan alır.', active: true },
    { id: 'saraykor', name: 'Saray Koruması', desc: 'Askerler sarayı korur; darbe zorlaşır, maaşları %20 artar.', active: false },
    { id: 'ickiyasak', name: 'İçki Yasağı', desc: 'Meyhane kapanır; içki satmak karaborsadır. Dindarlar memnun, seküler halk kızgın.', active: false },
    { id: 'gece', name: 'Gece Sokağa Çıkma Yasağı', desc: 'Geceleri sokağa çıkan bekçiye yakalanır; gece suçları azalır, mutluluk biraz düşer.', active: false },
    { id: 'servet', name: 'Servet Vergisi', desc: 'Kesesinde 500 Dinar üstü olanlardan fazlanın %2’si her gün hazineye; eşitsizliği azaltır.', active: true },
    { id: 'toplanti', name: 'Toplanma Özgürlüğü', desc: 'Protestolar serbest; memnuniyetsizlik dilekçeye döner, cumhuriyet baskısı yavaş artar.', active: true },
  ];
}

export function createWorld(seed = 42, now = Date.now()): World {
  const w: World = {
    version: 1, seed, rng: seed, day: 1, hour: 6, lastTickAt: now, frozen: true,
    treasury: 10000, taxRate: 10, headTax: 1.5, salaries: { ...DEFAULT_SALARY }, laws: defaultLaws(),
    people: [], buildings: makeBuildings(), listings: [], prices: { ...BASE_PRICE }, market: { sold: emptyInv(), unmet: emptyInv() }, ledger: [], petitions: [], cases: [],
    projects: [{ id: 'saray-insa', name: 'Saray Kanadı İnşaatı (Usta Bekir)', site: 'santiye', cost: 1200, paid: 200, progress: 0, needed: 120, done: false }],
    election: { nextDay: 10, candidates: [], votes: {}, seats: 5, baskanNextDay: 0, baskanCandidates: [], baskanVotes: {} }, gazette: [], events: [], todayEvents: [], players: {},
    regime: 'imparatorluk', meclis: initMeclis(), budget: { limit: DEFAULT_BUDGET, spent: 0, until: 20, approved: false }, schema: 2, speed: 1, nature: null, nextDrought: 60, festivalUntil: 0, granary: 400, priceCaps: {}, arrests: [], chatOut: [], talks: [], offers: [], rumors: [], caravan: null, threat: null, bans: [], loans: [], outsideNet: 0,
    headAwayDays: 0, children: [], proposals: [], pregnancies: [], veliaht: null, regentId: null, regentFor: null, isyan: null, deposed: null, allowStateTakeover: false, kayzerId: null, founderPersonId: null, hanedanId: '', cumhuriyet: 5, cumhuriyetDays: 0, coup: null, stats: [],
    dailyIncome: 0, dailyExpense: 0, lastSnapshotAt: now, idSeq: 0,
  };
  const houses = w.buildings.filter((x) => x.kind === 'ev');
  let hi = 0;
  const nextHome = (): string => { const h = houses[hi % houses.length]; hi += 1; return h ? h.id : 'ev1'; };
  // the Kayzer (hanedan seat, taken over by the founder on first login)
  const kayzer = makePerson(w, { name: 'Kayzer', prof: 'kayzer', honesty: 70, ambition: 50, money: 500, loyalty: 100 }, 'saray');
  kayzer.work = 'saray'; kayzer.female = false; kayzer.din = 50; w.people.push(kayzer); w.kayzerId = kayzer.id; w.hanedanId = kayzer.id;
  const usedNames = new Set<string>();
  const counts = new Map<Profession, number>(COUNTS);
  for (const s of NAMED) {
    const home = s.prof === 'naip' ? 'saray' : nextHome();
    w.people.push(makePerson(w, s, home)); usedNames.add(s.name);
    counts.set(s.prof, (counts.get(s.prof) ?? 0) - 1);
  }
  for (const [prof, c] of counts) {
    for (let i = 0; i < c; i += 1) {
      const female = prof === 'asker' ? false : rand(w) < 0.4;
      let name = '';
      for (let k = 0; k < 20; k += 1) {
        const first = pick(w, female ? KADIN : ERKEK);
        name = TITLE[prof] ? `${TITLE[prof]} ${first}` : first;
        if (!usedNames.has(name)) break;
        name = `${name} ${String.fromCharCode(65 + randInt(w, 0, 25))}.`;
      }
      usedNames.add(name);
      w.people.push(makePerson(w, { name, prof, female }, prof === 'asker' ? 'kisla' : nextHome()));
    }
  }
  // generated extra citizens (families / dependants working as hamal etc.) to reach ~110
  while (w.people.length < 112) {
    const prof = pick(w, ['hamal', 'ciftci', 'ciftci', 'sucu', 'balikci', 'insaatci', 'dokumaci', 'kasap'] as const);
    const female = rand(w) < 0.5;
    const name = `${pick(w, female ? KADIN : ERKEK)} ${pick(w, female ? ['Hanım', 'Usta', 'Kalfa'] : ['Usta', 'Efendi', 'Ağa', 'Kalfa'])}`;
    w.people.push(makePerson(w, { name, prof, female }, nextHome()));
  }
  // a few marriages
  const singles = w.people.filter((p) => p.home.startsWith('ev'));
  for (let i = 0; i + 1 < singles.length && i < 30; i += 2) {
    const a = singles[i]; const c = singles[i + 1];
    if (a && c && a.female !== c.female && rand(w) < 0.5) { a.spouse = c.id; c.spouse = a.id; c.home = a.home; }
  }
  // Necati is a committed republican agitator; Cemal an ambitious merchant
  const nec = w.people.find((p) => p.name === 'Kalemşör Necati'); if (nec) { nec.republic = 75; nec.plotting = 'revolution'; nec.faction = 'cumhuriyet'; }
  const cem = w.people.find((p) => p.name === 'Tüccar Cemal'); if (cem) cem.faction = 'esnaf';
  meclisElection(w, [], {}, () => true); // the first Meclis sits from day 1
  w.todayEvents = [];
  return w;
}

export function findPerson(w: World, id: string | null | undefined): Person | undefined {
  if (!id) return undefined; return w.people.find((p) => p.id === id);
}
