export type Good = 'ekmek' | 'su' | 'et' | 'balik' | 'kumas' | 'alet' | 'odun' | 'bugday' | 'yun' | 'elbise' | 'mobilya' | 'icki' | 'sut' | 'yumurta' | 'un';
export const GOODS: Good[] = ['ekmek', 'su', 'et', 'balik', 'kumas', 'alet', 'odun', 'bugday', 'yun', 'elbise', 'mobilya', 'icki', 'sut', 'yumurta', 'un'];

export type Profession =
  | 'firinci' | 'sucu' | 'kasap' | 'balikci' | 'terzi' | 'demirci' | 'marangoz'
  | 'tuccar' | 'hekim' | 'hoca' | 'hamal' | 'insaatci' | 'kalemsor' | 'imam'
  | 'memur' | 'tahsildar' | 'bekci' | 'savci' | 'hakim' | 'asker' | 'kayzer' | 'naip' | 'hayvanci'
  | 'ciftci' | 'dokumaci' | 'mobilyaci' | 'barci' | 'degirmenci';

export type Office = 'meclis';

export type BuildingKind =
  | 'saray' | 'mahkeme' | 'kisla' | 'cami' | 'meclis' | 'okul' | 'hekimhane' | 'liman'
  | 'kasap' | 'degirmen' | 'firin' | 'kuyu' | 'atolye' | 'pazar' | 'ev' | 'santiye' | 'zindan' | 'kahve'
  | 'bar' | 'festival' | 'ciftlik' | 'dokuma' | 'mobilyahane' | 'ambar' | 'arsa' | 'yapi' | 'hayvan';

export interface Building {
  id: string;
  name: string;
  kind: BuildingKind; ownerId?: string; burned?: { day: number; prevOwner: string | null };
  x: number; y: number; w: number; h: number; // tiles
  door: { x: number; y: number };
  market?: boolean;
}

export interface Person {
  goal?: GoalId; goalsDone?: GoalId[];
  rank?: import('./realm').Rank | null; fief?: string | null; favor?: number; homeUntil?: number; sleeping?: boolean; renting?: string | null; energy?: number; look?: import('./look').Look; lookSet?: boolean; genderSet?: boolean; /* v2.0.1: the player chose Erkek/Kadın (once) */ profile?: { surname?: string; age?: import('./profile').AgeGroup; origin?: import('./profile').Origin; temper?: import('./profile').Temper; set?: boolean; fresh?: boolean }; farm?: boolean; barn?: { ahir: number; kumes: number }; farmStock?: Partial<Record<Good, number>>; fedDay?: number; riding?: boolean; animals?: Record<import('./realm').Animal, number>;
  task?: import('./orders').Task; // v1.7: an order the NPC is carrying out
  orderedBy?: { by: string; crime: CrimeKind; victimId: string | null; day: number };
  id: string;
  name: string;
  prof: Profession;
  meclis: boolean;
  playerId: string | null; // controlled by a player account
  npc: boolean; // true if AI always controls
  home: string; // building id
  work: string; // building id
  money: number;
  inv: Record<Good, number>;
  hunger: number; // 0 full .. 100 starving
  thirst: number;
  mood: number; // 0..100
  loyalty: number; // to the Kayzer 0..100
  ambition: number; // 0..100
  honesty: number; // 0..100
  republic: number; // 0..100 personal republican sentiment
  health: number; // 0..100
  spouse: string | null;
  jailedDays: number;
  incomeToday: number;
  unemployedDays: number;
  /** v2.0.1 esnaf kredisi still owed to the hazine */
  kredi?: number;
  thought: string;
  lastAction: string;
  relations: Record<string, number>; // -100..100, sparse
  hairColor: number; skin: number; shirt: number; // sprite seeds
  female: boolean;
  plotting: 'none' | 'coup' | 'revolution';
  faction: string | null; // Meclis faction (party)
  immune: boolean; // parliamentary immunity (members only)
  sidedWith: string | null; // soldiers: who they back in a coup
  born: number; // game day of birth (adults start with a past birthday)
  poorDays?: number; cantAfford?: number; // v2.0.1: days in a row the person could not afford basics
  vaatler?: import('./genelge').GKind[]; proposedG?: import('./genelge').GKind[]; voteRec?: { bill: string; v: VoteChoice; line?: VoteChoice; day: number }[]; promiseScore?: number; // v2.0.1 Meclis record
  itibar?: number; // v2.0.1 itibar 0..100 (starts at 10), separate from money
  yol?: MainRank; // v2.0.1 yükselme yolu (main path)
  askerRank?: number; // v2.0.1 0 acemi er … 5 komutan (only while prof === 'asker')
  ilimRank?: number; // v2.0.1 0 talebe, 1 hoca, 2 kadı
  cs?: CareerStats; job?: Job; // v2.0.1 career counters and current job
  notes?: { day: number; hour: number; kind: 'itibar' | 'din'; d: number; why: string }[]; // v2.0.1 'Neden değişti' (last 8)
  parents: string[]; // person/child ids
  soylu: boolean; // nobility (Kayzer's spouse, royal children)
  school: number; // days of schooling (children who grew up)
  exiledDays: number; // sürgün
  din: number; // dindarlık 0..100
  meals: number; drinks: number; // today
  wounded: boolean; // needs a doctor
  protectedUntil: number; // newcomer protection (game day)
  xp: number; // profession experience → çırak/kalfa/usta
  rep: number; // reputation -100..100 (gossip)
  relNote: Record<string, string>; // why we are friends/enemies
  titles: string[]; // achievements
  taxDue: number; smuggle: boolean;
  nightOut: boolean;
  bought?: Partial<Record<Good, number>>; // bought today – cannot be resold the same day
  arms?: Partial<Record<'hancer' | 'kilic' | 'yay' | 'ok' | 'kalkan', number>>; drawn?: 'hancer' | 'kilic' | 'yay' | null; kitDay?: number; armsFines?: number; // v1.9.9 weapons
  recruit?: { prof: string; work: string }; infected?: { day: number }; onboardUntil?: number; atkAt?: number; hold?: { by: string; x: number; y: number; until: number }; captive?: { by: string; day: number }; // v1.9.9 war; v2.0.1 onboardUntil pauses a newcomer's needs
  walk?: import('./move').Walk; // player characters: current walk (real-time path)
}

export type MainRank = 'dilenci' | 'isci' | 'cirak' | 'usta' | 'tuccar' | 'esraf' | 'soylu' | 'danisman';
/** v2.0.1 career counters (days are game days). */
export interface CareerStats {
  jobDays?: number; jobStreak?: number; cirakDays?: number; ustaId?: string; ustaDays?: number; flawless?: number; trades?: number; tradeVal?: number;
  notHungry?: number; talim?: number; talimDays?: number[]; talimAt?: number; service?: number; raids?: number; raidDay?: number; kills?: number; defenseWins?: number; campaignWins?: number;
  literate?: boolean; read?: number; readDay?: number; readToday?: number; taught?: number; rec?: boolean; skill?: number; fled?: number;
  namazDay?: number; cumaDay?: number; cumaWeek?: number; cumaMissNoted?: number; sadakaDay?: number; sadakaIt?: number; sadakaDin?: number; asevi?: number; sifaDay?: number;
  ateDay?: number; ateHour?: number; orucDay?: number; goals?: Record<string, boolean>; missStreak?: number; offStreak?: number; dukkan?: boolean; depo?: boolean; hanRoom?: boolean;
  quests?: number; honest?: number; taxWeek?: number; noted?: Record<string, number>; hardMode?: boolean;
}
export interface Job {
  id: string; title: string; place: string; prof?: Profession; wage: number; from: number; to: number; employerId: string; // 'saray' | 'dis' | person id
  kind: 'gundelik' | 'cirak' | 'usta' | 'devlet' | 'oyuncu' | 'kendi' | 'asker'; req?: { rank?: MainRank; itibar?: number; din?: number; literate?: boolean }; att?: number; attDay?: number; online?: boolean;
}
export interface Arrest { id: string; criminalId: string; catcherId: string; crime: CrimeKind; victimId: string | null; amount: number; day: number; hour: number; offer: number; status: 'bekliyor' | 'kabul' | 'ret'; at?: number; evidence?: number; eyewitnesses?: number; basis?: string; eyeIds?: string[]; complainantId?: string | null }
export type CrimeKind = 'hirsizlik' | 'rusvet' | 'zimmet' | 'isyan' | 'saldiri' | 'cinayet' | 'kacakcilik';
export interface Talk { a: string; b: string; text: string; day: number; hour: number; at?: number; lines?: string[]; ai?: boolean }
export interface Corpse { id: string; personId: string; name: string; look: { hairColor: number; skin: number; shirt: number; female: boolean; prof: Profession }; x: number; y: number; at: number; killerId: string | null; witnesses: string[]; stage: 'yerde' | 'ihbar' | 'inceleme' | 'kapandi'; reportedBy?: string; reportedAt?: number; bekciId?: string; bekciFrom?: { x: number; y: number }; note?: string }
export interface Escort { personId: string; bekciId: string; from: { x: number; y: number }; at: number }
export interface TrialMsg { who: 'hakim' | 'savci' | 'sanik' | 'tanik' | 'suclanan'; name: string; text: string; at: number }
export interface Trial { at: number; until: number; judgeId: string | null; prosecutorId: string | null; msgs: TrialMsg[]; persuasion: number; done: boolean; doneAt?: number; verdictText?: string; pending?: boolean; reasoning?: string; lastReason?: string; blamedId?: string | null }
export interface NpcMsg { fromPersonId: string; fromName: string; toPersonId: string | null; text: string; at: number }
export interface Offer { id: string; from: string; to: string; kind: 'mal' | 'borc' | 'is' | 'rusvet'; good?: Good; qty?: number; price?: number; amount?: number; arrestId?: string; day: number; text: string }
export interface Nature { kind: 'kuraklik' | 'salgin' | 'sel' | 'bereket' | 'balik'; start: number; until: number }
export interface Caravan { day: number; until: number; goods: Partial<Record<Good, number>>; name: string; earned?: number; spent?: number; arriveAt?: number; leaveAt?: number; ship?: boolean; hour?: number }
export interface Threat { name: string; demand: number; day: number; deadline: number; strength: number }

/** A minor (bebek/çocuk/genç). Becomes a full Person (same id) at ADULT_AGE game days. */
export interface Child {
  id: string; name: string; female: boolean; born: number; parents: string[]; apprentice?: number; surname?: string;
  honesty: number; ambition: number; hairColor: number; skin: number; shirt: number;
  school: number; inSchool: boolean; sick: number; hunger: number; orphan: boolean; soylu: boolean;
}

export type Fate = 'surgun' | 'zindan' | 'af';
export interface Isyan {
  day: number; hour: number; leaderId: string | null; rebels: string[]; occupied: string[]; killed: number; soldiersLost: number;
  lastCmd: string; lastCmdHour: number; log: string[]; hours: number; concessions: number;
}
export interface Deposed { personId: string; until: number; killed: number; votes: Record<string, Fate>; voters: string[] }

export interface Listing { id: string; sellerId: string; good: Good; qty: number; price: number; market: string; wholesale?: boolean; }
/** v2.0.1 sipariş ilanı: 'qty good getirene reward D' (an NPC producer or the saray pays on delivery). */
export interface Order { id: string; good: Good; qty: number; reward: number; byId: string; day: number; until: number; }

export interface LedgerEntry { day: number; from: string; to: string; amount: number; reason: string; }

export type PetitionKind = 'yardim' | 'is' | 'vergi' | 'sikayet' | 'kanun' | 'gorev' | 'unvan';
export interface Petition {
  id: string; fromId: string; kind: PetitionKind; text: string; day: number; expires: number;
  status: 'bekliyor' | 'kabul' | 'ret' | 'zamanasimi'; amount: number; payload?: string; answeredBy?: string;
}

export type CaseStage = 'savci' | 'hakim' | 'kapandi';
export interface CourtCase {
  id: string; accusedId: string; crime: CrimeKind; victimId: string | null;
  amount: number; evidence: number; stage: CaseStage; day: number; deadline: number;
  verdict?: 'suclu' | 'beraat' | 'dusuruldu' | 'af'; sentence?: string; trial?: Trial; bribed?: boolean; defenders?: string[]; witnesses?: { id: string; against: boolean }[]; called?: { id: string; at: number }[]; crimeH?: number; crimeX?: number; crimeY?: number; eyewitnesses?: number; basis?: string; eyeIds?: string[]; complainantId?: string | null;
}

export interface Law { id: string; name: string; desc: string; active: boolean; param?: number; paramLabel?: string; }

export interface Project { id: string; name: string; site: string; kind?: string; plot?: string; cost: number; paid: number; progress: number; needed: number; done: boolean; doneDay?: number; }

export interface Election {
  ballots?: string[]; // v2.0.1 gizli oy: shuffled ballots without voter ids; votes[voter] = '✓' (voted) / '' (stayed home)
  vaat?: Record<string, import('./genelge').GKind[]>; pledges?: Record<string, string>; symp?: Record<string, number>; smear?: Record<string, number>; withdrawn?: string[]; mitingDay?: Record<string, number>; canvassed?: Record<string, number>; partyPosters?: Record<string, number>; endorse?: Record<string, string[]>; nabiz?: string;
  last?: { day: number; results: { id: string; votes: number; won: boolean; name?: string; party?: string | null }[]; voters?: number; electorate?: number; parties?: { id: string; votes: number; seats: number }[]; method?: string }; posters?: Record<string, number>; nextDay: number; candidates: string[]; votes: Record<string, string>; seats: number; baskanNextDay: number; baskanCandidates: string[]; baskanVotes: Record<string, string>; }

export interface Gazette { day: number; headline: string; lines: string[]; meclis?: string[]; }

export interface PlayerInfo {
  live?: { n: number; t: string }[]; liveN?: number; // v2.0.1 live notices → client toasts
  playerId: string; personId: string; name: string; founder: boolean; banned: boolean;
  lastSeen: number; // ms
  lastSeenDay: number; dead?: { day: number; name: string; years: number; text: string; heirs: string[]; estate?: { houses: string[]; inv: Person['inv']; arms: NonNullable<Person['arms']> } }; awayLog: string[]; awayMoney: number; quest?: number; qf?: Record<string, boolean>; // v2.0.1 quest flags (what the player really did)
}

export type Ideology = 'saltanatci' | 'cumhuriyetci' | 'esnaf' | 'halkci';
export interface Faction { id: string; name: string; ideology: Ideology; leaderId: string | null; color: string;
  // v2.0.1 party package
  program?: import('./genelge').GKind[]; oppose?: import('./genelge').GKind[]; kasa?: number; standing?: Record<string, number>; strikes?: Record<string, number>;
  axes?: [number, number, number]; // v2.0.1 ideology: yönetim (0 saltanat … 100 cumhuriyet), ekonomi (0 serbest pazar … 100 devlet/narh), din (0 dindar … 100 laik)
  support?: Record<string, number>; ilBaskan?: Record<string, string>; lastPriority?: number; lastAudit?: number; leaderBid?: string[]; founded?: number;
}
export interface Seat { id: string; label: string; kind: 'bolge' | 'meslek' | 'genel' | 'atama'; key: string; holder: string | null; }
export type BillKind = 'ozel' | 'vergi' | 'fiyat' | 'maas' | 'butce' | 'kanun' | 'insaat' | 'af' | 'gensoru' | 'sorusturma' | 'dokunulmazlik' | 'azil' | 'genelge' | 'cumhuriyet' | 'kaldir';
export type VoteChoice = 'evet' | 'hayir' | 'cekimser';
export interface Bill {
  id: string; kind: BillKind; title: string; proposerId: string; value: number; target: string;
  day: number; debateUntil: number; voteUntil: number;
  status: 'tartisma' | 'oylama' | 'onay' | 'kabul' | 'ret' | 'veto' | 'zamanasimi';
  law?: import('./laws').LawSpec;
  votes: Record<string, VoteChoice>; speeches: { personId: string; text: string; day: number; ai?: boolean }[]; result?: string; fromKayzer?: boolean;
  lean?: Record<string, VoteChoice>; lines?: Record<string, VoteChoice>; priority?: boolean; defectors?: string[]; cost?: number;
  komisyon?: { members: string[]; votes: Record<string, boolean>; ok: boolean; text: string; day: number }; borc?: boolean; dilekce?: string; onayDay?: number; notified?: boolean;
}
export interface Dilekce { id: string; kind: BillKind; value: number; target: string; title: string; by: string; day: number; signers: string[]; status: 'acik' | 'gundem' | 'dustu'; billId?: string }
export interface MeclisState {
  komisyon?: string[]; // v2.0.1 Bütçe Komisyonu (3 MPs: 2 majority bloc + 1 opposition)
  dilekceler?: Dilekce[]; // v2.0.1 halk dilekçeleri (20 imza → gündem)
  borc?: number; // v2.0.1 hazine borcu (dış borç, taksitle ödenir)
  anayasaCooldown?: number; // v2.0.1 day until which no new Cumhuriyet İlanı may be proposed
  govt?: string[]; // v2.0.1 hükümet: ruling party (+ coalition partners), first = lead party
  baskanId?: string | null; // v2.0.1 Meclis başkanı
  seats: Seat[]; factions: Faction[]; bills: Bill[]; log: { day: number; text: string }[];
  bribes: { from: string; to: string; amount: number; day: number; exposed: boolean }[]; salary: number;
}
export interface Budget { limit: number; spent: number; until: number; approved: boolean; }

export interface Coup { leaderId: string; kind: 'coup' | 'revolution'; day: number; fund: number; }

export type GoalId = 'tuccar' | 'meclisbaskani' | 'vezir' | 'asi';
export interface Mission { id: string; text: string; reward: number; to: string | null; by: string; day: number; status: 'acik' | 'bildirildi' | 'odendi' | 'iptal'; claimedBy?: string }
export interface World {
  ageV?: number; // 2 = ages in years (v2.0.1)
  popTarget?: number; // v2.0.1 demography: newcomers arrive while the city is below this
  econV?: number; // v2.0.1 economy migration
  wageIdx?: number; // v2.0.1 wages follow sustained bread prices and fall with unemployment (1 = normal)
  orders?: Order[]; // v2.0.1 sipariş ilanları
  imports?: boolean; // v2.0.1 Kayzer: ithalat izni (Liman toptancısı + kervanlar); default true
  panayir?: number; // v2.0.1 day of the current Panayır
  cityHist?: number[][]; // v2.0.1 Şehir Göstergesi: [day, hour, pop, unemployed, bread*100, mood, treasury] hourly, 5 days
  karaborsaToday?: number;
  jobs?: Job[]; // v2.0.1 İş İlanı Tahtası
  usage?: Record<string, number>; // v2.0.1 solo audit: how often NPCs used each feature
  genelgeler?: { kind: import('./genelge').GKind; from: number; until: number; before: number; billId?: string; by?: string | null; result?: number }[]; // v2.0.1 active genelgeler
  gnews?: { day: number; text: string }[]; // v2.0.1 genelge/party news for the gazete
  advisors?: string[]; // v2.0.1 Kayzer'e danışmanlar
  seferberlik?: number; // v2.0.1 day the Kayzer declared mobilisation (0 = none)
  asevi?: { day: number; left: number }; // v2.0.1 cami aşevi soup left today
  careerV?: number;
  cruelOrders?: number; missions?: Mission[];
  orgs?: import('./realm').Org[]; spies?: import('./realm').Spy[]; plots?: import('./realm').Plot[]; warrants?: string[]; history?: import('./realm').Chronicle[]; informantPay?: number;
  version: number;
  seed: number;
  rng: number;
  day: number;
  hour: number; // 0..23
  lastTickAt: number; // ms real time of the last processed game hour boundary
  frozen: boolean;
  treasury: number;
  taxRate: number; // percent of sales
  headTax: number; // dinar per adult per day
  salaries: Partial<Record<Profession, number>>;
  laws: Law[];
  people: Person[];
  buildings: Building[];
  listings: Listing[];
  prices: Record<Good, number>;
  market: { sold: Record<Good, number>; unmet: Record<Good, number> };
  ledger: LedgerEntry[];
  petitions: Petition[];
  cases: CourtCase[];
  projects: Project[];
  election: Election;
  gazette: Gazette[];
  events: { day: number; hour: number; text: string; personId?: string; x?: number; y?: number }[];
  todayEvents: string[];
  players: Record<string, PlayerInfo>;
  regime: 'imparatorluk' | 'cumhuriyet';
  meclis: MeclisState;
  budget: Budget;
  headAwayDays: number;
  children: Child[];
  proposals: { id: string; kind: 'evlilik' | 'cocuk'; from: string; to: string; day: number }[];
  pregnancies: { parents: string[]; due: number }[];
  veliaht: string | null; // designated heir (child id)
  exKayzerId?: string | null;
  disaster?: { id: number; kind: string; text: string; day: number } | null; // v1.9.6: shown to every online player as a popup // v1.9.6: a Kayzer who lost the throne by going to the zindan
  regentId: string | null; // rules for a minor heir
  regentFor: string | null;
  isyan: Isyan | null;
  deposed: Deposed | null;
  schema: number;
  speed: number; // 0.5 | 1 | 2 (Kayzer only); 0.25 automatically during a raid/landing (v2.0.1)
  speedBefore?: number | null;
  nature: Nature | null; nextDrought: number;
  festivalUntil: number; // game day (inclusive) the festival ground is open
  granary: number; // state wheat store (tahıl ambarı)
  priceCaps: Partial<Record<Good, number>>;
  arrests: Arrest[];
  chatOut: NpcMsg[];
  talks: Talk[];
  chests?: Record<string, { goods: Partial<Record<Good, number>>; arms: Partial<Record<'hancer' | 'kilic' | 'yay' | 'ok' | 'kalkan', number>> }>;
  armsReg?: { ownerId: string; kind: 'hancer' | 'kilic' | 'yay'; day: number; by: 'demirci' | 'kisla' }[]; armsV?: number;
  combat?: import('./combatpos').Combat | null; // v2.0.1 real-time fight (raid night / landing)
  raid?: { phase: 'uyari' | 'gece'; day: number; robbers?: { id: string; hp: number }[]; startAt?: number; killed?: number; stolen?: number; dead?: string[]; hurt?: string[]; fought?: string[]; defDead?: string[]; defHurt?: string[] } | null; raidNext?: number;
  foreign?: { name: string; demand: number; troops: number; phase: 'talep' | 'savas'; day: number; deadline: number; landDay?: number; landReal?: number; landed?: boolean; landAt?: number; alive?: number; killed?: number; ourDead?: string[]; ourHurt?: number; recruits: string[] } | null;
  notices?: { id: number; kind: string; text: string; day: number }[]; whatsNew?: Record<string, string>;
  fire?: { bid: string; startH: number; cause: string } | null; empireName?: string; empireNamedBy?: string;
  warNext?: number; wars?: number; vassal?: { name: string; until: number } | null;
  posLog?: Record<string, [number, number, number][]>; posAt?: number; crimeLog?: { criminalId: string; victimId: string | null; H: number; x: number; y: number }[]; // v1.9.8 alibi history
  corpses?: Corpse[]; crimeReports?: { criminalId: string; victimId: string; crime: CrimeKind; amount: number; at: number; eyes?: number; eyeIds?: string[] }[]; escorts?: Escort[];
  llm?: { day: string; n: number; talkAt: number; speechAt?: number };
  offers: Offer[];
  rumors: { day: number; text: string; about: string }[];
  caravan: Caravan | null; threat: Threat | null;
  bans: string[]; // custom bans (icki, kumar, gece)
  loans: { id: string; debtor: string; lender: string; amount: number; due: number; day: number }[];
  serverNow?: number;
  shortDays?: number;
  customLaws: import('./laws').CustomLaw[];
  serving?: string[];
  suspicion?: Record<string, number>;
  treasuryBook?: { day: number; items: Record<string, number> }[];
  priceHist?: Partial<Record<Good, number[]>>;
  outsideNet: number; // money that left to / came from the outside world (caravans, tribute) – keeps the books balanced
  allowStateTakeover: boolean;
  kayzerId: string | null; // head of state person id: Kayzer, or Başkan in the republic
  founderPersonId: string | null;
  hanedanId: string; // the founder dynasty person id placeholder
  cumhuriyet: number; // 0..100
  cumhuriyetDays: number; // days spent >= 85
  coup: Coup | null;
  stats: { day: number; treasury: number; mood: number; cumhuriyet: number; money: number; prices: Record<Good, number> }[];
  dailyIncome: number; dailyExpense: number;
  lastSnapshotAt: number;
  idSeq: number;
}

export type Action =
  | { t: 'buy'; good: Good; qty: number; market?: string }
  | { t: 'sell'; good: Good; qty: number; price: number; market?: string }
  | { t: 'fulfillOrder'; orderId: string } | { t: 'imports'; on: boolean }
  | { t: 'jobApply'; jobId: string } | { t: 'jobQuit' } | { t: 'jobPost'; title: string; wage: number; from: number; to: number } | { t: 'askJob'; personId: string }
  | { t: 'kisla'; op: 'kayit' | 'terhis' | 'talim' | 'nobet'; shift?: 'gunduz' | 'aksam' | 'gece' } | { t: 'seferberlik'; on: boolean } | { t: 'recommend'; personId: string }
  | { t: 'sadaka'; amount: number } | { t: 'asevi' } | { t: 'sifa' } | { t: 'talebe' } | { t: 'oku' } | { t: 'dersVer' }
  | { t: 'eat' }
  | { t: 'askida'; qty: number }
  | { t: 'petition'; kind: PetitionKind; text: string; amount?: number; payload?: string }
  | { t: 'answer'; petitionId: string; accept: boolean }
  | { t: 'setTax'; rate: number }
  | { t: 'setHeadTax'; amount: number }
  | { t: 'setSalary'; prof: Profession; amount: number }
  | { t: 'toggleLaw'; lawId: string; active: boolean; param?: number }
  | { t: 'startProject'; name: string; cost: number }
  | { t: 'fundProject'; projectId: string; amount: number }
  | { t: 'appoint'; personId: string; prof: Profession }
  | { t: 'pardon'; caseId: string }
  | { t: 'caseDecision'; caseId: string; decision: 'kovustur' | 'dusur' | 'suclu' | 'beraat' }
  | { t: 'arrest'; personId: string }
  | { t: 'steal'; personId: string }
  | { t: 'bribe'; personId: string; amount: number }
  | { t: 'give'; personId: string; amount: number }
  | { t: 'runForMeclis' }
  | { t: 'vote'; candidateId: string }
  | { t: 'dilekceAc'; kind: BillKind; value?: number; target?: string; title?: string }
  | { t: 'dilekceImza'; id: string }
  | { t: 'dilekceIste'; id: string; personId: string }
  | { t: 'runForBaskan' }
  | { t: 'propose'; kind: BillKind; value?: number; target?: string; title?: string; law?: import('./laws').LawSpec; borc?: boolean }
  | { t: 'enactLaw'; law: import('./laws').LawSpec } | { t: 'repealLaw'; lawId: string } | { t: 'inspect'; personId: string }
  | { t: 'castVote'; billId: string; choice: VoteChoice }
  | { t: 'speak'; billId: string; text: string }
  | { t: 'sanction'; billId: string; approve: boolean }
  | { t: 'joinFaction'; factionId: string }
  | { t: 'voteBaskan'; candidateId: string }
  | { t: 'plot'; kind: 'coup' | 'revolution' | 'none' }
  | { t: 'fundPlot'; amount: number }
  | { t: 'seize' }
  | { t: 'restore' }
  | { t: 'festival'; cost: number }
  // v2.0.2 player campaign + party actions (S/U)
  | { t: 'vaat'; kinds: string[] } | { t: 'canvass'; personId: string } | { t: 'miting'; text?: string } | { t: 'ikram'; personId: string; kind: 'pilav' | 'serbet' | 'para'; amount?: number }
  | { t: 'partyPoster' } | { t: 'endorse'; personId: string } | { t: 'smear'; personId: string } | { t: 'joinParty'; factionId: string } | { t: 'resignParty' }
  | { t: 'foundParty'; name: string; ideology: Ideology } | { t: 'donate'; amount: number } | { t: 'ocak' }
  | { t: 'marry'; personId: string }
  | { t: 'answerProposal'; proposalId: string; accept: boolean }
  | { t: 'divorce' }
  | { t: 'haveChild' }
  | { t: 'school'; childId: string; on: boolean }
  | { t: 'cure'; childId: string }
  | { t: 'veliaht'; childId: string | null }
  | { t: 'abdicate' }
  | { t: 'isyanCmd'; cmd: 'dagit' | 'tutukla' | 'saldir' }
  | { t: 'joinRebels' }
  | { t: 'fateVote'; fate: Fate }
  | { t: 'setSpeed'; speed: number }
  | { t: 'setGoal'; goal: GoalId }
  | { t: 'buyHome'; houseId: string } | { t: 'rentHome'; houseId: string } | { t: 'goHome'; sleep?: boolean } | { t: 'leaveHome' } | { t: 'foundFaction'; name: string }
  | { t: 'drinkMilk' } | { t: 'eatEgg' } | { t: 'buyFarm' } | { t: 'buildBarn'; kind: 'ahir' | 'kumes' } | { t: 'feedAnimals' } | { t: 'collectFarm' } | { t: 'ride'; on: boolean } | { t: 'buyAnimal'; animal: import('./realm').Animal; n?: number } | { t: 'slaughter'; animal: import('./realm').Animal }
  | { t: 'grantTitle'; personId: string; rank: import('./realm').Rank; fief?: string | null } | { t: 'stripTitle'; personId: string }
  | { t: 'orgFound'; kind: import('./realm').OrgKind; name: string } | { t: 'orgJoin'; orgId: string } | { t: 'orgLeave' } | { t: 'orgMeet' } | { t: 'orgRole'; personId: string; role: import('./realm').OrgRole } | { t: 'orgAct'; deed: import('./realm').OrgDeed }
  | { t: 'assignSpy'; spyId: string; targetId: string } | { t: 'warrant'; personId: string } | { t: 'searchHouse'; personId: string } | { t: 'raidOrg'; orgId: string } | { t: 'informantPay'; amount: number }
  | { t: 'missionCreate'; text: string; reward: number; to: string | null }
  | { t: 'missionClaim'; id: string }
  | { t: 'missionPay'; id: string; pay: boolean }
  | { t: 'drinkWater' } | { t: 'pray' } | { t: 'drink' } | { t: 'doctor' } | { t: 'work' } | { t: 'nightOut'; on: boolean }
  | { t: 'assault'; personId: string } | { t: 'kill'; personId: string } | { t: 'insult'; personId: string } | { t: 'chatWith'; personId: string }
  | { t: 'offerBribe'; arrestId: string; amount: number } | { t: 'answerBribe'; arrestId: string; accept: boolean }
  | { t: 'answerOffer'; offerId: string; accept: boolean }
  | { t: 'poster' } | { t: 'campaign'; text: string }
  | { t: 'sermon'; topic: 'namaz' | 'icki' | 'sabir' }
  | { t: 'directive'; topic: 'namaz' | 'icki' | 'laik' }
  | { t: 'granary'; op: 'buy' | 'release' | 'dagit'; qty: number }
  | { t: 'priceCap'; good: Good; price: number | null }
  | { t: 'defend'; caseId: string } | { t: 'witness'; caseId: string; against: boolean; text?: string } | { t: 'callWitness'; caseId: string; personId: string } | { t: 'customize'; look: import('./look').Look; where: 'ilk' | 'terzi' | 'berber'; female?: boolean; profile?: import('./profile').ProfileChoice }
  | { t: 'smuggle'; on: boolean }
  | { t: 'borrow'; amount: number } | { t: 'repay'; loanId: string } | { t: 'festivalOpen'; cost: number } | { t: 'buildAt'; plotId: string; kind: string }
  | { t: 'move'; x: number; y: number } | { t: 'report'; corpseId: string } | { t: 'defense'; caseId: string; text: string } | { t: 'restCase'; caseId: string }
  | { t: 'tribute'; pay: boolean } | { t: 'buyArm'; item: 'hancer' | 'kilic' | 'yay' | 'ok' | 'kalkan'; qty?: number } | { t: 'kislaKit' } | { t: 'onboardPause' } | { t: 'continueAs'; childId: string } | { t: 'newCharacter'; name: string } | { t: 'drawWeapon'; kind: 'hancer' | 'kilic' | 'yay' | null } | { t: 'stash'; item: string; qty: number; toChest: boolean } | { t: 'useItem'; good: Good } | { t: 'searchPerson'; personId: string } | { t: 'foreignAnswer'; choice: 'pay' | 'vassal' | 'war' } | { t: 'recruit'; n: number } | { t: 'ransom'; personId: string } | { t: 'rebuild'; buildingId: string } | { t: 'nameEmpire'; name: string } | { t: 'seenNews'; v: string } | { t: 'onboardDone' } | { t: 'attack'; foeId: string; aimX?: number; aimY?: number } | { t: 'buyBag'; good: Good; qty: number } | { t: 'holdNpc'; personId: string; on: boolean } | { t: 'caravanBuy'; good: Good; qty: number };

export interface ActionResult { ok: boolean; msg: string; }
